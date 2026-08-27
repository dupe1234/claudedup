# ที่ปรึกษา Storyboard & Content (AI Agent)

หน้าเว็บที่เปลี่ยน [`SKILL.md`](./SKILL.md) ให้กลายเป็น AI agent ที่ให้คำปรึกษา
เรื่องการสร้าง storyboard และ content ผ่านหน้าแชท — ฝั่งหน้าเว็บ (`index.html`,
`admin.html`) เป็น static site รันบน GitHub Pages ได้เลย ส่วนการเก็บ API key,
เช็คสิทธิ์ผู้ใช้ และนับ token ใช้ backend เล็ก ๆ บน Cloudflare Workers
(`worker/worker.js`)

## สถาปัตยกรรม

```
เบราว์เซอร์ผู้ใช้ ──▶ index.html / admin.html (GitHub Pages)
                              │  fetch()
                              ▼
                    Cloudflare Worker (worker/worker.js)
                              │  เก็บ ANTHROPIC_API_KEY, รายชื่ออีเมล,
                              │  ยอด token ต่อคน ใน KV
                              ▼
                    Anthropic API (api.anthropic.com)
```

- **`index.html`** — หน้าแชทสำหรับผู้ใช้ทั่วไป ล็อกอินด้วยอีเมล
- **`admin.html`** — หน้าแอดมิน (จำกัดด้วยอีเมล + passphrase) สำหรับเพิ่ม/ลบ
  สิทธิ์ผู้ใช้ ดูสัดส่วนการใช้ token ของแต่ละคน และรีเซ็ตยอด
- **`worker/worker.js`** — Cloudflare Worker ที่ถือ Anthropic API key จริงไว้
  ฝั่งเซิร์ฟเวอร์ (ไม่หลุดออกไปที่เบราว์เซอร์อีกต่อไป) และเป็นคนตัดสินใจว่า
  จะอนุญาต/ปฏิเสธ request ตามสิทธิ์และโควต้า

## กติกาการใช้ token

ผู้ใช้แต่ละคน (นับตาม token สะสมของตัวเอง) **จะถูกปฏิเสธ request ใหม่ถ้า
token สะสมของตัวเองเกิน 25% ของยอดรวม token ที่ทุกคนใช้สะสมอยู่ ณ ขณะนั้น**
(เช็คก่อนเรียก Anthropic ทุกครั้ง, ปรับ 25% ได้ที่ `QUOTA_SHARE_LIMIT` ใน
`worker/worker.js`) แอดมินรีเซ็ตยอดของคนใดคนหนึ่ง หรือรีเซ็ตทั้งหมด (เช่น
ตอนเริ่มรอบเดือนใหม่) ได้จากหน้า `admin.html`

## Deploy — ลำดับขั้นตอน

### 1. Backend: Cloudflare Worker (ทำผ่านเว็บ dashboard ล้วน ๆ ไม่ต้องลง CLI)

1. สมัคร/ล็อกอิน [dash.cloudflare.com](https://dash.cloudflare.com) → เมนู
   **Workers & Pages** → **Create** → **Create Worker** → ตั้งชื่อ (เช่น
   `storyboard-consultant`) → **Deploy**
2. เข้า Worker ที่สร้าง → **Edit code** → ลบโค้ด template เดิม แล้ววาง
   เนื้อหาทั้งหมดจาก [`worker/worker.js`](./worker/worker.js) → **Deploy**
3. สร้าง KV namespace: **Workers & Pages → KV → Create a namespace** ตั้งชื่อ
   เช่น `QUOTA`
4. กลับไปที่ Worker → **Settings → Variables and Secrets**:
   - ผูก **KV Namespace Binding**: Variable name `QUOTA` → เลือก namespace
     `QUOTA` ที่สร้างไว้
   - เพิ่ม **Secret**: `ANTHROPIC_API_KEY` = API key จริงของคุณ (ขอได้ที่
     [console.anthropic.com](https://console.anthropic.com/settings/keys))
   - เพิ่ม **Variable**: `ADMIN_EMAIL` = `dupli.pasu@gmail.com`
   - เพิ่ม **Secret**: `ADMIN_PASSPHRASE` = ตั้ง passphrase เอง (ใช้คู่กับ
     อีเมลแอดมินตอนล็อกอินหน้า admin.html)
   - บันทึก (Worker จะ redeploy อัตโนมัติ)
5. คัดลอก URL ของ Worker (เช่น
   `https://storyboard-consultant.<your-subdomain>.workers.dev`)

> ครั้งแรกที่มีคน login สำเร็จ Worker จะ seed รายชื่อที่อนุญาตให้มีแค่
> `ADMIN_EMAIL` โดยอัตโนมัติ — เพิ่มอีเมลคนอื่นทีหลังผ่านหน้า admin.html

### 2. Frontend: แก้ไฟล์ 2 ไฟล์

ใน [`index.html`](./index.html) และ [`admin.html`](./admin.html) แก้บรรทัด:

```js
const WORKER_URL = "REPLACE_WITH_YOUR_WORKER_URL";
```

ให้เป็น URL ของ Worker จากขั้นตอนที่แล้ว (ทั้งสองไฟล์ใช้ค่าเดียวกัน)

### 3. Deploy หน้าเว็บขึ้น GitHub Pages

1. สร้าง GitHub repository แล้ว push โค้ดทั้งหมดขึ้นไปที่ branch `main`
2. ไปที่ repo → **Settings → Pages**
3. ใต้ **Build and deployment** เลือก Source: **Deploy from a branch**,
   Branch: `main` / `/(root)`
4. รอสักครู่ แล้วเปิดลิงก์ที่ GitHub ให้มา (`https://<username>.github.io/<repo>/`)
   และ `.../admin.html` สำหรับหน้าแอดมิน

## แก้ไข "สมอง" ของ agent

แก้ไขได้ที่ [`SKILL.md`](./SKILL.md) โดยตรง — เนื้อหาทั้งหมด (ยกเว้น frontmatter
ด้านบนสุด) จะถูกใช้เป็น system prompt ของ agent ทันทีที่ผู้ใช้โหลดหน้าเว็บใหม่
(ฝั่ง client เป็นคนโหลดไฟล์นี้แล้วส่งไปให้ Worker ต่อ)

## รันทดสอบในเครื่อง

หน้าเว็บต้องเปิดผ่าน local server (ไม่ใช่เปิดไฟล์ตรง ๆ) เพราะมีการ `fetch()`
ไฟล์ `SKILL.md`:

```bash
python3 -m http.server 8000
```

แล้วเปิด `http://localhost:8000` — ส่วน backend ทดสอบได้โดยตรงบน
Cloudflare (Worker มี URL ใช้งานได้ทันทีหลัง deploy ไม่ต้องรอ GitHub Pages)

## ความปลอดภัยที่ยังต้องรู้

- หน้า `admin.html` ตรวจสิทธิ์ด้วยอีเมล + passphrase ที่ตั้งไว้ใน Worker
  เท่านั้น (ไม่ใช่ระบบล็อกอินแบบ OAuth/รหัสผ่านจริง) — เก็บ passphrase ไว้
  เป็นความลับ อย่าใส่ไว้ใน commit หรือแชร์เกินความจำเป็น
- Anthropic API key อยู่ฝั่ง Worker เท่านั้น ไม่ถูกส่งไปที่เบราว์เซอร์ผู้ใช้
  แล้ว — ปลอดภัยกว่าเวอร์ชันฝัง key ไว้ใน `index.html` เดิม
- โควต้า 25% เป็นการป้องกัน "คนเดียวใช้ token หมด" ไม่ใช่การจำกัดยอดใช้จ่าย
  รวมทั้งหมด — ยังแนะนำให้ตั้ง spending limit ของ API key ไว้ที่
  [console.anthropic.com/settings/limits](https://console.anthropic.com/settings/limits)
  เผื่อไว้อีกชั้น
