import json, urllib.request, urllib.error, http.cookiejar, io, time

BFF = "http://localhost:3330"
results = []

def call(method, url, body=None, headers=None, raw=False, cookies=None):
    req = urllib.request.Request(url, method=method)
    req.add_header("Origin", BFF)
    for k, v in (headers or {}).items():
        req.add_header(k, v)
    if cookies:
        req.add_header("Cookie", cookies)
    data = None
    if body is not None:
        if isinstance(body, (dict, list)):
            data = json.dumps(body).encode()
            req.add_header("Content-Type", "application/json")
        else:
            data = body
    try:
        r = urllib.request.urlopen(req, data=data, timeout=30)
        return r.status, (r.read() if raw else r.read().decode("utf-8", "replace")), dict(r.headers)
    except urllib.error.HTTPError as e:
        return e.code, (e.read() if raw else e.read().decode("utf-8", "replace")), dict(e.headers)
    except Exception as e:
        return -1, str(e), {}

def check(name, ok, detail=""):
    results.append((name, ok, detail))
    print(("PASS" if ok else "FAIL"), name, detail[:160])

# ── 1. public chat: waiting-area classify (committed vocab, now on new image)
for q, want_sub in [
    ("Có chỗ ngồi chờ không?", "amenity"),
    ("Xe máy để ở đâu?", "amenity"),
    ("đi xe đau tim", "emergency"),
]:
    s, body, _ = call("POST", f"{BFF}/api/v1/public/ai/chat", {"message": q})
    routing = ""
    try:
        routing = json.loads(body).get("routingReason", "")
    except Exception:
        pass
    check(f"chat {q!r}", want_sub in routing or want_sub in body.lower(), f"{s} {routing}")

# ── 2. slots rate limit (defaultPostLimit=60/window on this env → expect 429 eventually)
limited = False
last = 0
for i in range(75):
    s, _, _ = call("GET", f"{BFF}/api/v1/appointments/doctors/00000000-0000-4000-8000-000000000001/slots")
    last = s
    if s == 429:
        limited = True
        break
    time.sleep(0.02)
check("slots rate limit 429", limited, f"last={last} after {i+1} req")

# ── 3. patient login → media purpose binding + DELETE lifecycle
s, body, hdrs = call("POST", f"{BFF}/api/v1/auth/browser-sessions",
                     {"email": "patient@healthcare.com", "password": "HealthCare@2026", "grantType": "PASSWORD"})
check("patient login", s in (200, 201), f"{s} {body[:140]}")
setcookies = hdrs.get("Set-Cookie", "")
if isinstance(setcookies, list):
    setcookies = "; ".join(setcookies)
# extract session+csrf cookies
import re
cookies = "; ".join(re.findall(r"(__Host-healthcare_(?:session|csrf)=[^;]+)", setcookies))
if not cookies and isinstance(hdrs.get("set-cookie"), str):
    cookies = "; ".join(re.findall(r"(__Host-healthcare_(?:session|csrf)=[^;]+)", hdrs["set-cookie"]))
check("cookies captured", "session=" in cookies, cookies[:60])

# csrf token value for BFF (it derives header from cookie automatically)
boundary = "----qa" + str(int(time.time() * 1000))
png = bytes([0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A, 0, 0, 0, 0]) + b"qa-png-pad"

def upload(purpose):
    parts = []
    parts.append(f"--{boundary}\r\nContent-Disposition: form-data; name=\"purpose\"\r\n\r\n{purpose}\r\n".encode())
    parts.append(f"--{boundary}\r\nContent-Disposition: form-data; name=\"file\"; filename=\"a.png\"\r\nContent-Type: image/png\r\n\r\n".encode())
    parts.append(png)
    parts.append(f"\r\n--{boundary}--\r\n".encode())
    data = b"".join(parts)
    req = urllib.request.Request(f"{BFF}/api/v1/media/upload", data=data, method="POST")
    req.add_header("Origin", BFF)
    req.add_header("Content-Type", f"multipart/form-data; boundary={boundary}")
    req.add_header("Cookie", cookies)
    try:
        r = urllib.request.urlopen(req, timeout=30)
        return r.status, r.read().decode()
    except urllib.error.HTTPError as e:
        return e.code, e.read().decode("utf-8", "replace")
    except Exception as e:
        return -1, str(e)

s, body = upload("DOCTOR_PORTRAIT")
check("patient→DOCTOR_PORTRAIT blocked", s == 403, f"{s} {body[:80]}")
s, body = upload("GENERAL")
check("patient→GENERAL blocked", s == 403, f"{s} {body[:80]}")
s, body = upload("PATIENT_AVATAR")
asset_id = ""
try:
    asset_id = json.loads(body).get("id", "")
except Exception:
    pass
check("patient→PATIENT_AVATAR ok", s == 200 and bool(asset_id), f"{s} {body[:80]}")

if asset_id:
    s, body, _ = call("DELETE", f"{BFF}/api/v1/media/{asset_id}", cookies=cookies)
    check("owner DELETE media", s in (200, 204), f"{s}")
    s, body, _ = call("GET", f"{BFF}/api/v1/media/{asset_id}", cookies=cookies)
    check("deleted asset 404", s == 404, f"{s}")

print()
fails = [r for r in results if not r[1]]
print(f"{len(results) - len(fails)}/{len(results)} PASS")
for r in fails:
    print("  FAIL:", r[0], r[2])
