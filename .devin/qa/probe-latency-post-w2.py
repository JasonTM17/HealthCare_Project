import json, sys, urllib.request, urllib.error, time
sys.stdout.reconfigure(encoding="utf-8")

BFF = "https://www.healthcare.id.vn"
QUERIES = [
    "vitamin D uống liều bao nhiêu",
    "uống nước chanh mỗi sáng có tốt không",
    "mất ngủ kéo dài nên làm gì",
    "đau đầu chóng mặt là bệnh gì",
    "bị đau dạ dày nên ăn gì",
    "uống collagen có tác dụng gì",
    "sốt nhẹ 37.5 có cần đi khám không",
    "khám sức khỏe định kỳ nên làm những gì",
    "có nên uống thuốc bổ gan hàng ngày",
    "ăn tỏi sống có tốt cho tim không",
]

out = []
for q in QUERIES:
    req = urllib.request.Request(f"{BFF}/api/v1/public/ai/chat", method="POST")
    req.add_header("Origin", BFF)
    req.add_header("Content-Type", "application/json")
    data = json.dumps({"message": q}, ensure_ascii=False).encode("utf-8")
    t0 = time.time()
    try:
        r = urllib.request.urlopen(req, data=data, timeout=90)
        body = json.loads(r.read().decode("utf-8", "replace"))
        dt = time.time() - t0
        route = body.get("routingReason", "")
        action = body.get("safety_action") or body.get("safetyAction") or ""
        out.append({"q": q[:28], "s": round(dt, 1), "action": action, "route": route})
        print(f"{dt:6.1f}s  {action:18s} {route:32s} {q[:40]}")
    except Exception as e:
        out.append({"q": q[:28], "s": round(time.time() - t0, 1), "err": str(e)[:80]})
        print(f"  ERR {e} {q[:40]}")

with open(".devin/qa/latency-post-w2.json", "w", encoding="utf-8") as f:
    json.dump(out, f, ensure_ascii=False, indent=1)
