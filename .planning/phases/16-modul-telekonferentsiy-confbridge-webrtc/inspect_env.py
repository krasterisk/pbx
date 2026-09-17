from pathlib import Path

p = Path("/var/www/pbx/.env.production")
data = p.read_bytes()
print("size", len(data), "head", data[:8])
enc = "utf-8"
if data.startswith(b"\xff\xfe") or data.startswith(b"\xfe\xff"):
    enc = "utf-16"
text = data.decode(enc, errors="replace")
keys = {}
for line in text.splitlines():
    line = line.strip("\ufeff").strip()
    if not line or line.startswith("#") or "=" not in line:
        continue
    k, v = line.split("=", 1)
    keys[k] = v
print("DB_DIALECT", keys.get("DB_DIALECT"))
print("DB_HOST", keys.get("DB_HOST"))
print("DB_PORT", keys.get("DB_PORT"))
print("DB_NAME_set", bool(keys.get("DB_NAME")))
print("DB_USER_set", bool(keys.get("DB_USER")))
print("JWT_SECRET_set", bool(keys.get("JWT_SECRET")))
print("SERVICE_TOKEN_set", bool(keys.get("KRASTERISK_SERVICE_TOKEN")))
print("DEFAULT_VPBX", keys.get("DEFAULT_VPBX_USER_UID"))
