# Mirrored for GitHub Actions from files/site-algolia/build_index.py; keep in sync.
#!/usr/bin/env python3
"""Build the Algolia public projection index for douglascirillo.com (A1).

Reads the deployed site bundle, emits one object per page (title, fixed
approved summary = the page's meta description, URL, type, H2 headings,
hero image, declared keywords = the page's meta keywords, if any),
builds into site_public_tmp, and swaps atomically to site_public on success.
Records are NOT indexed here (that is A2). Restricted/excluded content never
enters this index: it is built from published pages only, and results show
title + fixed summary, never body snippets, so figures keep their scope.

Env: ALGOLIA_APP_ID, ALGOLIA_WRITE_KEY (admin/write key; never hardcoded).
"""
import json, os, re, sys, time, urllib.request
from datetime import datetime
from pathlib import Path

APP = os.environ["ALGOLIA_APP_ID"]
KEY = os.environ["ALGOLIA_WRITE_KEY"]
SITE = Path(os.environ.get("SITE_DIR", Path.home() / "workspace/goals/job-search-claude-x-grok-and-linkedin-alignment/files/home-base-deploy/site"))
TARGET = os.environ.get("TARGET_INDEX", "site_public")
BASE = f"https://{APP}.algolia.net/1/indexes"

def req(method, url, body=None):
    r = urllib.request.Request(url, method=method,
        data=json.dumps(body).encode() if body is not None else None,
        headers={"X-Algolia-API-Key": KEY, "X-Algolia-Application-Id": APP,
                 "content-type": "application/json"})
    with urllib.request.urlopen(r, timeout=30) as resp:
        return json.loads(resp.read().decode())

def wait_task(index, task):
    for _ in range(60):
        s = req("GET", f"https://{APP}.algolia.net/1/indexes/{index}/task/{task}")
        if s.get("status") == "published":
            return
        time.sleep(5)
    raise SystemExit(f"task did not publish in time (index={index}, task={task})")

def page_type(path):
    if path == "/": return "Home"
    if path.startswith("/case-studies/") and path != "/case-studies/": return "Case study"
    if path == "/case-studies/": return "Hub"
    if path.startswith("/practice/") and path != "/practice/": return "Practice"
    if path == "/practice/": return "Hub"
    if path.startswith("/writing/") and path != "/writing/": return "Essay"
    if path == "/writing/": return "Hub"
    if path.startswith("/record/") and path != "/record/": return "Record"
    if path == "/record/": return "Hub"
    if path == "/speaking/": return "Speaking"
    if path == "/scorecard/": return "Tool"
    if path == "/colophon/": return "Colophon"
    return "Page"

objects = []
for html_file in sorted(SITE.rglob("index.html")):
    rel = "/" + str(html_file.parent.relative_to(SITE)) + "/"
    if rel == "/./": rel = "/"
    text = html_file.read_text()
    title_m = re.search(r"<title>(.*?)</title>", text, re.S)
    title = re.sub(r"\s*\|\s*Douglas Cirillo\s*$", "", title_m.group(1).strip()) if title_m else rel
    desc_m = re.search(r'<meta name="description" content="(.*?)"', text, re.S)
    summary = desc_m.group(1).strip() if desc_m else ""
    # Declared bridge terms (Nov 22, 2026): searchable, never retrieved;
    # results still surface on title + summary.
    kw_m = re.search(r'<meta name="keywords" content="(.*?)"', text, re.S)
    keywords = [k.strip() for k in kw_m.group(1).split(",") if k.strip()] if kw_m else []
    headings = [re.sub(r"<[^>]+>", "", h).strip() for h in re.findall(r"<h2[^>]*>(.*?)</h2>", text, re.S)]
    hero_m = re.search(r'<figure class="hero"><img src="([^"]+)"', text)
    image = hero_m.group(1) if hero_m else ""
    headings = [h for h in headings if h and h != "Ask my record"]
    date_m = re.search(r'"datePublished":\s*"([^"]+)"', text)
    date_ts = 0
    if date_m:
        try:
            date_ts = int(datetime.fromisoformat(date_m.group(1).replace("Z", "+00:00")).timestamp())
        except Exception:
            date_ts = 0
    oid = "home" if rel == "/" else rel.strip("/").replace("/", "-")
    objects.append({"objectID": oid, "title": title, "summary": summary,
                    "url": rel, "type": page_type(rel), "headings": headings,
                    "date": date_ts, "image": image, "keywords": keywords})

print(f"{len(objects)} objects")
# fresh tmp index
TMP = TARGET + "_tmp"
try:
    req("DELETE", f"{BASE}/{TMP}")
except Exception:
    pass
s = req("PUT", f"{BASE}/{TMP}/settings", {
    "searchableAttributes": ["title", "headings", "summary", "keywords"],
    "attributesToRetrieve": ["title", "summary", "url", "type", "date", "image"],
    "attributesForFaceting": ["type"],
    "attributesToHighlight": [],
})
b = req("POST", f"{BASE}/{TMP}/batch",
        {"requests": [{"action": "addObject", "body": o} for o in objects]})
wait_task(TMP, b["taskID"])
m = req("POST", f"{BASE}/{TMP}/operation",
        {"operation": "move", "destination": TARGET})
wait_task(TARGET, m["taskID"])
print(TARGET + " is live")
