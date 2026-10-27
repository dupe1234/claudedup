// Supabase client, sign-in and approval screens shared by taskboard.html, notes.html and members.html.
// New accounts stay "pending" until the admin approves them on members.html.
// The publishable key is meant to be public: row level security in the database decides what each user can see.
const SUPABASE_URL = "https://ruakfotckopkhbtlobtx.supabase.co";
const SUPABASE_KEY = "sb_publishable_ey3_rjBGiKJovFZ3Nxz-Kw_Vzj282w5";

const sb = window.supabase.createClient(SUPABASE_URL, SUPABASE_KEY);

(function () {
  const css = `
  .auth-scrim { position: fixed; inset: 0; z-index: 50; background: var(--bg); display: grid; place-items: center; padding: 16px }
  .auth-card { width: min(380px, 100%); background: var(--surface); border: 1px solid var(--line); border-radius: 10px; padding: 24px; display: flex; flex-direction: column; gap: 12px }
  .auth-card h2 { margin: 0; font-size: 20px }
  .auth-card p { margin: 0; color: var(--muted); font-size: 13px }
  .auth-card label { font-size: 12px; font-weight: 600; color: var(--muted); display: flex; flex-direction: column; gap: 4px }
  .auth-card input { border: 1px solid var(--line); background: var(--bg); border-radius: 6px; padding: 8px 10px; font: inherit; color: inherit }
  .auth-card .row { display: flex; gap: 8px; align-items: center; justify-content: space-between; flex-wrap: wrap }
  .auth-card .link { border: 0; background: transparent; color: var(--accent); padding: 0; font: inherit; font-size: 13px; cursor: pointer }
  .auth-msg { font-size: 13px; border-radius: 6px; padding: 8px 10px; background: var(--bg) }
  .auth-msg.err { color: #c9372c }
  .auth-user { margin-left: auto; padding-left: 8px; display: flex; align-items: center; gap: 8px; flex: none; font-size: 12px; color: var(--muted); white-space: nowrap }
  .auth-user button { border: 1px solid var(--line); background: var(--surface); border-radius: 8px; padding: 6px 10px; font: inherit; font-weight: 500; color: var(--fg); cursor: pointer }
  .auth-user button:hover { border-color: #c9372c; color: #c9372c }
  .appnav .badge { background: #c9372c; color: #fff; border-radius: 10px; padding: 0 7px; font-size: 11px; line-height: 18px; font-variant-numeric: tabular-nums }
  @media (max-width: 720px) { .auth-user .email { display: none } }
  @media (max-width: 600px) { .auth-card { padding: 20px } .auth-card input { font-size: 16px; padding: 10px 12px } .auth-card .btn { padding: 10px 16px } }`;
  document.head.insertAdjacentHTML("beforeend", `<style>${css}</style>`);

  const THAI_ERRORS = {
    "Invalid login credentials": "อีเมลหรือรหัสผ่านไม่ถูกต้อง",
    "Email not confirmed": "ยังไม่ได้ยืนยันอีเมล เปิดลิงก์ยืนยันในอีเมลก่อน",
    "User already registered": "อีเมลนี้มีบัญชีแล้ว ลองเข้าสู่ระบบแทน",
    "Signups not allowed for this instance": "ระบบปิดการสมัครเอง ให้ผู้ดูแลเพิ่มบัญชีให้",
  };
  const thai = e => THAI_ERRORS[e?.message] || e?.message || "ทำรายการไม่สำเร็จ ลองอีกครั้ง";

  function showUser(user) {
    const nav = document.querySelector(".appnav");
    if (!nav || nav.querySelector(".auth-user")) return;
    const box = document.createElement("span");
    box.className = "auth-user";
    const email = document.createElement("span");
    email.className = "email";
    email.textContent = user.email || "";
    box.append(email);
    const out = document.createElement("button");
    out.type = "button"; out.textContent = "ออกจากระบบ";
    out.onclick = async () => { await sb.auth.signOut(); location.reload() };
    box.append(out);
    nav.append(box);
  }

  function signInScreen() {
    return new Promise(resolve => {
      const el = document.createElement("div");
      el.className = "auth-scrim";
      el.innerHTML = `<form class="auth-card" id="authForm">
        <h2 id="authTitle">เข้าสู่ระบบ</h2>
        <p>ใช้บัญชีของทีมเพื่อเปิดบอร์ดงานและ Note</p>
        <label>อีเมล<input id="authEmail" type="email" autocomplete="email" required></label>
        <label>รหัสผ่าน<input id="authPass" type="password" autocomplete="current-password" minlength="6" required></label>
        <div class="auth-msg" id="authMsg" hidden></div>
        <div class="row">
          <button class="link" type="button" id="authSwitch">ยังไม่มีบัญชี? สร้างบัญชี</button>
          <button class="btn primary" type="submit" id="authSubmit">เข้าสู่ระบบ</button>
        </div>
      </form>`;
      document.body.append(el);
      let signUp = false;
      const $ = id => el.querySelector("#" + id);
      const msg = (text, err) => { $("authMsg").hidden = !text; $("authMsg").textContent = text || ""; $("authMsg").classList.toggle("err", !!err) };
      $("authSwitch").onclick = () => {
        signUp = !signUp;
        $("authTitle").textContent = $("authSubmit").textContent = signUp ? "สร้างบัญชี" : "เข้าสู่ระบบ";
        $("authSwitch").textContent = signUp ? "มีบัญชีแล้ว? เข้าสู่ระบบ" : "ยังไม่มีบัญชี? สร้างบัญชี";
        $("authPass").autocomplete = signUp ? "new-password" : "current-password";
        msg("");
      };
      $("authForm").onsubmit = async e => {
        e.preventDefault();
        $("authSubmit").disabled = true; msg("");
        const creds = { email: $("authEmail").value.trim(), password: $("authPass").value };
        const { data, error } = signUp ? await sb.auth.signUp(creds) : await sb.auth.signInWithPassword(creds);
        $("authSubmit").disabled = false;
        if (error) return msg(thai(error), true);
        if (!data.session) return msg("สร้างบัญชีแล้ว เปิดลิงก์ยืนยันในอีเมล แล้วกลับมาเข้าสู่ระบบ จากนั้นรอผู้ดูแลอนุมัติ");
        el.remove();
        resolve(data.session.user);
      };
      setTimeout(() => $("authEmail").focus(), 0);
    });
  }

  // Shown to members the admin has not approved (or has turned down). Never resolves.
  function waitingScreen(member) {
    const rejected = member?.status === "rejected";
    const el = document.createElement("div");
    el.className = "auth-scrim";
    el.innerHTML = `<div class="auth-card">
      <h2>${rejected ? "ไม่ได้รับอนุญาตให้เข้าใช้งาน" : "รอผู้ดูแลอนุมัติ"}</h2>
      <p>${rejected
        ? "ผู้ดูแลยังไม่อนุญาตบัญชีนี้ ติดต่อผู้ดูแลถ้าคิดว่าผิดพลาด"
        : "เราแจ้งผู้ดูแลแล้ว เมื่อได้รับอนุมัติ รีเฟรชหน้านี้เพื่อเริ่มใช้งาน"}</p>
      <div class="auth-msg"></div>
      <div class="row">
        <button class="link" type="button" id="waitOut">ออกจากระบบ</button>
        ${rejected ? "" : `<button class="btn primary" type="button" id="waitReload">รีเฟรช</button>`}
      </div>
    </div>`;
    el.querySelector(".auth-msg").textContent = member?.email || "";
    document.body.append(el);
    el.querySelector("#waitOut").onclick = async () => { await sb.auth.signOut(); location.reload() };
    el.querySelector("#waitReload")?.addEventListener("click", () => location.reload());
    return new Promise(() => {});
  }

  async function showAdminLink() {
    const nav = document.querySelector(".appnav");
    if (!nav || nav.querySelector('a[href="members.html"]')) return;
    const { count } = await sb.from("members").select("user_id", { count: "exact", head: true }).eq("status", "pending");
    const a = document.createElement("a");
    a.href = "members.html";
    a.innerHTML = `<svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="8" r="4"/><path d="M4 21c0-4 3.6-6 8-6s8 2 8 6"/></svg><span>สมาชิก</span>`
      + (count ? `<span class="badge" title="${count} คนรออนุมัติ">${count}</span>` : "");
    if (count) a.setAttribute("aria-label", `สมาชิก, ${count} คนรออนุมัติ`);
    if (location.pathname.endsWith("/members.html")) a.setAttribute("aria-current", "page");
    nav.insertBefore(a, nav.querySelector(".auth-user"));
  }

  // Resolves with {user, member} once the signed-in member is approved.
  window.requireUser = async function () {
    const { data } = await sb.auth.getSession();
    const user = data.session?.user || await signInScreen();
    showUser(user);
    sb.auth.onAuthStateChange(event => { if (event === "SIGNED_OUT") location.reload() });
    const { data: member } = await sb.from("members").select("email,status,is_admin").eq("user_id", user.id).maybeSingle();
    if (member?.status !== "approved") return waitingScreen(member || { email: user.email });
    if (member.is_admin) showAdminLink();
    return { user, member };
  };
})();
