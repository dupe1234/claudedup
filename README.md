# toolWork

เครื่องมือทำงานของทีมในเว็บเดียว เปิดใช้ได้ทั้งบนคอมและมือถือ

| หน้า | ไฟล์ | ใช้ทำอะไร |
|---|---|---|
| บอร์ดงาน | `taskboard.html` | บอร์ดงานแบบ Jira มีมุมมองบอร์ด รายการ และปฏิทิน |
| Spec Payment Gateway | `spec.html` | ติ๊กเลือก service ของ Max Card Payment Gateway API (spec v3.8) แล้วสรุปว่าใช้เส้นไหนได้บ้าง |
| Note | `notes.html` | บันทึกช่วยจำของทีม แนบรูปและเอกสารได้ |
| สมาชิก | `members.html` | ผู้ดูแลอนุมัติคนที่สมัครเข้ามาใช้งาน |

## ข้อมูลเก็บที่ไหน

ข้อมูลทั้งหมดอยู่ใน Supabase (โปรเจกต์ `taskjob Project`)

- `tasks`: งานบนบอร์ด สมาชิกที่อนุมัติแล้วทุกคนเห็นและแก้ได้
- `notes` และ `note_attachments`: โน้ตและไฟล์แนบ ทุกคนอ่านได้ แก้หรือลบได้เฉพาะคนเขียน ตัวไฟล์อยู่ใน Storage bucket `note-files`
- `members`: รายชื่อคนที่สมัคร คนใหม่จะรออนุมัติจนกว่าผู้ดูแลจะกดอนุมัติ

การตั้งค่าการเชื่อมต่อ Supabase อยู่ใน `auth.js` ในไฟล์มีแค่ publishable key ซึ่งเปิดเผยได้ เพราะ Row Level Security ในฐานข้อมูลเป็นตัวคุมสิทธิ์ทั้งหมด

## รันบนเครื่อง

ทุกหน้าเป็นไฟล์ HTML ธรรมดา เปิดผ่านเว็บเซิร์ฟเวอร์อะไรก็ได้

```bash
python3 -m http.server 8765
```

จากนั้นเปิด http://localhost:8765/taskboard.html

## สมาชิกและการอนุมัติ

1. คนใหม่สมัครในหน้าล็อกอิน แล้วยืนยันอีเมล
2. ระบบส่งอีเมลแจ้งผู้ดูแล (dupli.pasu@gmail.com) ผ่าน Edge Function `notify-new-member` และ Resend
3. ผู้ดูแลกดอนุมัติในหน้า "สมาชิก" แล้วคนนั้นจึงเข้าใช้งานได้

Secrets ของ Edge Function ตั้งค่าใน Supabase Dashboard → Edge Functions → Secrets

- `RESEND_API_KEY`: API key ของ Resend
- `SITE_URL`: ที่อยู่เว็บจริง ใช้ทำลิงก์ในอีเมล

## ไฟล์อื่น

- `server.py`, `start.command`, `requirements.txt`: เซิร์ฟเวอร์รุ่นเก่าที่เก็บงานลง Excel ตอนนี้ไม่ได้ใช้แล้ว เก็บไว้อ้างอิง
