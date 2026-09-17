"""Inspect conference rooms / settings without printing secrets."""
from __future__ import annotations

import os
import re
from pathlib import Path

import pymysql

ROOT = Path(__file__).resolve().parents[3]
env: dict[str, str] = {}
for line in (ROOT / ".env").read_text(encoding="utf-8").splitlines():
    m = re.match(r"\s*([A-Z0-9_]+)\s*=\s*(.*)$", line)
    if not m:
        continue
    env[m.group(1)] = m.group(2).strip().strip("'\"")

print("AMI_HOST", env.get("AMI_HOST"), "AMI_PORT", env.get("AMI_PORT"))
print("DB_HOST", env.get("DB_HOST"), "DB_NAME", env.get("DB_NAME"))

conn = pymysql.connect(
    host=env["DB_HOST"],
    port=int(env.get("DB_PORT") or 3306),
    user=env["DB_USER"],
    password=env["DB_PASSWORD"],
    database=env["DB_NAME"],
    cursorclass=pymysql.cursors.DictCursor,
)
with conn:
    with conn.cursor() as cur:
        cur.execute(
            "SELECT uid, vpbx_user_uid, number, name, record_mode "
            "FROM conference_rooms ORDER BY uid DESC LIMIT 20"
        )
        rooms = cur.fetchall()
        print("rooms", rooms)
        cur.execute("SHOW TABLES LIKE 'conference_meetings'")
        print("meetings_table", bool(cur.fetchall()))
        try:
            cur.execute(
                "SELECT uid, room_uid, has_recording, recording_file_rel "
                "FROM conference_meetings ORDER BY uid DESC LIMIT 5"
            )
            print("meetings", cur.fetchall())
        except Exception as e:
            print("meetings_err", str(e))
        cur.execute(
            "SELECT uniqueid, vpbx_user_uid FROM users "
            "WHERE vpbx_user_uid > 0 ORDER BY uniqueid ASC LIMIT 5"
        )
        print("users", cur.fetchall())
        for table, keycol in (
            ("system_settings", "key"),
            ("server_config", "key"),
            ("settings", "name"),
        ):
            try:
                cur.execute(f"SHOW TABLES LIKE '{table}'")
                if cur.fetchall():
                    print("table", table)
                    cur.execute(f"SELECT * FROM {table} LIMIT 20")
                    rows = cur.fetchall()
                    for row in rows:
                        keys = {str(k).lower() for k in row}
                        if any("record" in k or "path" in k or "key" in k for k in keys):
                            safe = {
                                k: v
                                for k, v in row.items()
                                if "secret" not in str(k).lower()
                                and "password" not in str(k).lower()
                            }
                            print(" cfg", safe)
            except Exception as e:
                print("settings_err", table, str(e))
