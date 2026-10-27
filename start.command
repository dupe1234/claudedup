#!/bin/bash
# ดับเบิลคลิกไฟล์นี้เพื่อเปิดบอร์ดงาน (ปิดหน้าต่าง Terminal เพื่อหยุด)
cd "$(dirname "$0")" || exit 1
if [ ! -x .venv/bin/python ]; then
  echo "กำลังติดตั้งครั้งแรก..."
  python3 -m venv .venv && .venv/bin/pip install -q -r requirements.txt || exit 1
fi
(sleep 1 && open "http://localhost:8765") &
exec .venv/bin/python server.py
