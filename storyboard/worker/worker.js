/**
 * Cloudflare Worker backend for the Storyboard & Content consultant page.
 *
 * Responsibilities:
 * - Holds the real Anthropic API key server-side (never shipped to browsers)
 * - Checks each request against an email allow-list stored in KV
 * - Enforces a per-user quota: no single user may account for more than 25%
 *   of the cumulative tokens used by everyone, checked against the running
 *   total at the time of each request
 * - Exposes /admin/* endpoints (email + passphrase gated) for managing the
 *   allow-list and viewing/resetting usage — backs admin.html
 *
 * Deploy via the Cloudflare dashboard (Workers & Pages -> Create -> paste
 * this file) — no CLI required. See ../README.md for full setup steps.
 *
 * Required bindings (set in Worker Settings):
 *   KV namespace  QUOTA              — stores allow-list + usage counters
 *   Secret        ANTHROPIC_API_KEY  — your real Anthropic API key
 *   Variable      ADMIN_EMAIL        — e.g. dupli.pasu@gmail.com
 *   Secret        ADMIN_PASSPHRASE   — a passphrase you make up, used by admin.html
 */

const QUOTA_SHARE_LIMIT = 0.25; // no user may exceed this share of the running total
const MODEL = "claude-haiku-4-5-20251001";

const CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET,POST,OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, X-Admin-Email, X-Admin-Passphrase",
};

function json(body, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json", ...CORS_HEADERS },
  });
}

async function getAllowedEmails(env) {
  const raw = await env.QUOTA.get("allowed_emails");
  if (!raw) {
    const seed = (env.ADMIN_EMAIL || "").trim().toLowerCase();
    const seedList = seed ? [seed] : [];
    await env.QUOTA.put("allowed_emails", JSON.stringify(seedList));
    return seedList;
  }
  try {
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function isAdmin(request, env) {
  const email = (request.headers.get("X-Admin-Email") || "").trim().toLowerCase();
  const pass = request.headers.get("X-Admin-Passphrase") || "";
  const adminEmail = (env.ADMIN_EMAIL || "").trim().toLowerCase();
  return Boolean(adminEmail) && email === adminEmail && Boolean(env.ADMIN_PASSPHRASE) && pass === env.ADMIN_PASSPHRASE;
}

async function getUsage(env, email) {
  const val = await env.QUOTA.get("usage:" + email);
  return parseInt(val || "0", 10);
}

async function getTotal(env) {
  const val = await env.QUOTA.get("usage_total");
  return parseInt(val || "0", 10);
}

export default {
  async fetch(request, env) {
    const url = new URL(request.url);

    if (request.method === "OPTIONS") {
      return new Response(null, { headers: CORS_HEADERS });
    }

    try {
      // --- Public: login check against the allow-list ---
      if (url.pathname === "/login" && request.method === "POST") {
        const { email } = await request.json();
        const norm = (email || "").trim().toLowerCase();
        const allowed = await getAllowedEmails(env);
        const ok = allowed.includes(norm);
        const admin = norm === (env.ADMIN_EMAIL || "").trim().toLowerCase();
        return json({ ok, isAdmin: admin });
      }

      // --- Public (allow-listed): proxy a chat turn to Anthropic ---
      if (url.pathname === "/chat" && request.method === "POST") {
        const { email, messages, system } = await request.json();
        const norm = (email || "").trim().toLowerCase();
        const allowed = await getAllowedEmails(env);
        if (!allowed.includes(norm)) {
          return json({ error: "not_allowed", message: "อีเมลนี้ไม่ได้รับอนุญาตให้ใช้งาน" }, 403);
        }

        const total = await getTotal(env);
        const userUsed = await getUsage(env, norm);
        if (total > 0 && userUsed / total > QUOTA_SHARE_LIMIT) {
          return json(
            {
              error: "quota_exceeded",
              message: "คุณใช้ token ไปแล้วเกิน 25% ของยอดรวมที่ทุกคนใช้ร่วมกัน กรุณาลองใหม่ภายหลัง หรือติดต่อผู้ดูแลระบบ",
            },
            429
          );
        }

        const anthRes = await fetch("https://api.anthropic.com/v1/messages", {
          method: "POST",
          headers: {
            "content-type": "application/json",
            "x-api-key": env.ANTHROPIC_API_KEY,
            "anthropic-version": "2023-06-01",
          },
          body: JSON.stringify({ model: MODEL, max_tokens: 2048, system, messages }),
        });

        if (!anthRes.ok) {
          const errText = await anthRes.text();
          return json({ error: "upstream_error", message: errText }, 502);
        }

        const data = await anthRes.json();
        const text = (data.content || []).map((c) => c.text || "").join("");
        const usedTokens = (data.usage?.input_tokens || 0) + (data.usage?.output_tokens || 0);

        const newUserUsed = userUsed + usedTokens;
        const newTotal = total + usedTokens;
        await env.QUOTA.put("usage:" + norm, String(newUserUsed));
        await env.QUOTA.put("usage_total", String(newTotal));

        return json({
          text,
          usedTokens,
          userTotal: newUserUsed,
          grandTotal: newTotal,
          userSharePercent: newTotal > 0 ? Math.round((newUserUsed / newTotal) * 1000) / 10 : 0,
        });
      }

      // --- Admin: list users + usage ---
      if (url.pathname === "/admin/users" && request.method === "GET") {
        if (!isAdmin(request, env)) return json({ error: "forbidden" }, 403);
        const allowed = await getAllowedEmails(env);
        const total = await getTotal(env);
        const users = [];
        for (const e of allowed) {
          const used = await getUsage(env, e);
          users.push({
            email: e,
            tokens: used,
            percent: total > 0 ? Math.round((used / total) * 1000) / 10 : 0,
          });
        }
        return json({ users, total, quotaShareLimit: QUOTA_SHARE_LIMIT });
      }

      // --- Admin: add/remove an allowed email ---
      if (url.pathname === "/admin/users" && request.method === "POST") {
        if (!isAdmin(request, env)) return json({ error: "forbidden" }, 403);
        const { action, email } = await request.json();
        const norm = (email || "").trim().toLowerCase();
        let allowed = await getAllowedEmails(env);
        if (action === "add" && norm && !allowed.includes(norm)) allowed.push(norm);
        if (action === "remove") allowed = allowed.filter((e) => e !== norm);
        await env.QUOTA.put("allowed_emails", JSON.stringify(allowed));
        return json({ ok: true, allowed });
      }

      // --- Admin: reset one user's usage, or everyone's (omit email) ---
      if (url.pathname === "/admin/reset" && request.method === "POST") {
        if (!isAdmin(request, env)) return json({ error: "forbidden" }, 403);
        const { email } = await request.json().catch(() => ({}));
        if (email) {
          const norm = email.trim().toLowerCase();
          const prevUsed = await getUsage(env, norm);
          const total = await getTotal(env);
          await env.QUOTA.put("usage:" + norm, "0");
          await env.QUOTA.put("usage_total", String(Math.max(0, total - prevUsed)));
        } else {
          const allowed = await getAllowedEmails(env);
          for (const e of allowed) await env.QUOTA.put("usage:" + e, "0");
          await env.QUOTA.put("usage_total", "0");
        }
        return json({ ok: true });
      }

      return json({ error: "not_found" }, 404);
    } catch (e) {
      return json({ error: "server_error", message: String(e && e.message ? e.message : e) }, 500);
    }
  },
};
