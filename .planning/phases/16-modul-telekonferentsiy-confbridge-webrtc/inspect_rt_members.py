from pathlib import Path

p = Path("/var/www/pbx/.env.production")
data = p.read_bytes()
enc = "utf-16" if data.startswith(b"\xff\xfe") or data.startswith(b"\xfe\xff") else "utf-8"
text = data.decode(enc, errors="replace")
env = {}
for line in text.splitlines():
    line = line.replace("\0", "").strip().lstrip("\ufeff")
    if not line or line.startswith("#") or "=" not in line:
        continue
    k, v = line.split("=", 1)
    env[k.strip()] = v.strip().strip('"').strip("'")

print("dialect", env.get("DB_DIALECT"))
print("host", env.get("DB_HOST"))
print("port", env.get("DB_PORT"))
print("name", env.get("DB_NAME"))
print("user_set", bool(env.get("DB_USER")))
