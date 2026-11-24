(function() {
var ASK_ENABLED = true;
var PIPE_ENABLED = true;
var ASK_ENDPOINT = "https://7i3yr1dzge.execute-api.us-east-1.amazonaws.com/ask";
var ALGOLIA_APP = "AL1TQKLUI7";
var ALGOLIA_SEARCH_KEY = "63308c453ec399e4360c003851faa733";
var ALGOLIA_INDEX = "site_public";
if (!ASK_ENABLED) return;
var LINKEDIN = "https://www.linkedin.com/in/douglascirillo/";
function extAttrs(a) {
if (a && a.hostname && a.hostname !== "douglascirillo.com") {
a.target = "_blank";
a.rel = "noopener";
var hint = document.createElement("span");
hint.className = "visually-hidden";
hint.textContent = "(opens in new tab)";
a.appendChild(hint);
}
}
var CONVO = {
label: "Start a conversation on LinkedIn",
href: LINKEDIN
};
var DEFAULT_CTX = {
placeholder: "Ask about a role, a result, a method…",
chips: [ "What does Douglas do now?", "What is a CDP, in his framing?", "What were the results at Sotheby’s?" ],
cta: CONVO
};
var CONTEXTS = {
"/": {
placeholder: "Ask about a role, a result, a method…",
chips: [ "What does Douglas do now?", "How did he grow organic traffic at Sotheby’s?", "What is a CDP, in his framing?" ],
cta: CONVO
},
"/case-studies/": DEFAULT_CTX,
"/case-studies/sothebys/": {
placeholder: "Ask about Sotheby’s…",
chips: [ "What did the CDP contribute to the growth?", "How much did organic traffic grow?", "What was Alpine?" ],
cta: CONVO
},
"/case-studies/lindblad-expeditions/": {
placeholder: "Ask about Lindblad…",
chips: [ "How much did bookings grow?", "What did the funnel improvement look like?", "What did he lead there?" ],
cta: CONVO
},
"/case-studies/madison-square-garden/": {
placeholder: "Ask about Madison Square Garden…",
chips: [ "How many websites did he run?", "What happened to digital ticket sales?", "What was MSG Go recognized for?" ],
cta: CONVO
},
"/case-studies/a-place-for-mom/": {
placeholder: "Ask about A Place for Mom…",
chips: [ "What was wrong with the site?", "How did search market share change?", "How big was the team he built?" ],
cta: CONVO
},
"/case-studies/ae-networks/": {
placeholder: "Ask about A+E Networks…",
chips: [ "What did he build at A+E?", "What standard did he set for A+E’s web presence?" ],
cta: CONVO
},
"/case-studies/gangverk/": {
placeholder: "Ask about Gangverk…",
chips: [ "How many client brands did he grow?", "What was his commercial role there?" ],
cta: CONVO
},
"/practice/": DEFAULT_CTX,
"/practice/composable-martech-and-customer-data/": {
placeholder: "Ask about composable martech…",
chips: [ "What is a CDP, in his framing?", "Where has he built CDPs?", "What is the difference between Conductor and Algolia?" ],
cta: CONVO
},
"/practice/digital-experience-strategy/": {
placeholder: "Ask about digital experience strategy…",
chips: [ "What does Douglas do now?", "How much did bookings grow at Lindblad?", "How did organic traffic grow at Sotheby’s?" ],
cta: CONVO
},
"/practice/experimentation-and-measurement/": {
placeholder: "Ask about experimentation…",
chips: [ "How did he improve the Lindblad booking funnel?", "What happened to search CTR at Sotheby’s?", "What was the A Place for Mom diagnosis?" ],
cta: CONVO
},
"/practice/ai-readiness-and-answer-discoverability/": {
placeholder: "Ask about answer discoverability…",
chips: [ "How did search market share change at A Place for Mom?", "What is the difference between Conductor and Algolia?", "How did organic traffic grow at Sotheby’s?" ],
cta: CONVO
},
"/speaking/": {
placeholder: "Ask about Douglas’s talks…",
chips: [ "What does Douglas speak about?", "What was the Synapse talk about?" ],
cta: {
label: "Talk about a speaking engagement on LinkedIn",
href: LINKEDIN
}
},
"/scorecard/": {
placeholder: "Ask about the record behind the score…",
chips: [ "What is a CDP, in his framing?", "How did he grow organic traffic at Sotheby’s?", "What are the harness checks?" ],
cta: {
label: "Work through the practice areas",
href: "/practice/"
}
},
"/writing/": {
placeholder: "Ask my record anything…",
chips: [ "What does Douglas do now?", "What is a CDP, in his framing?", "What were the results at Sotheby’s?" ],
cta: null
},
"/writing/what-a-customer-data-platform-actually-is/": {
placeholder: "Ask about CDPs…",
chips: [ "What is a CDP, in his framing?", "What CDP experience does he have?", "What was the CDP approach at Lindblad?" ],
cta: null
},
"/writing/own-your-harness/": {
placeholder: "Ask about owning your harness…",
chips: [ "What are the harness checks?", "What does Douglas do now?", "What is the approval rule for publishing?" ],
cta: null
},
"/writing/data-first-ai-second/": {
placeholder: "Ask about data first, AI second…",
chips: [ "How did he grow organic traffic at Sotheby’s?", "What is a CDP, in his framing?", "What were the results at Sotheby’s?" ],
cta: null
},
"/writing/the-hardest-part-of-strategy-is-letting-go/": {
placeholder: "Ask about strategy and letting go…",
chips: [ "What does Douglas do now?", "What were the results at Lindblad?", "How did he grow organic traffic at Sotheby’s?" ],
cta: null
},
"/writing/seo-is-just-ux-done-right/": {
placeholder: "Ask about search and UX…",
chips: [ "What was the A Place for Mom diagnosis?", "How did search market share change at A Place for Mom?", "How did he grow organic traffic at Sotheby’s?" ],
cta: null
},
"/writing/what-customer-centric-actually-means/": {
placeholder: "Ask about customer-centric work…",
chips: [ "What does Douglas do now?", "What were the results at Lindblad?", "What were the results at Sotheby’s?" ],
cta: null
},
"/writing/marketing-vs-selling/": {
placeholder: "Ask about marketing and leadership…",
chips: [ "What does Douglas do now?", "What were the results at Lindblad?", "What were the results at Sotheby’s?" ],
cta: null
},
"/writing/the-long-road-back/": {
placeholder: "Ask my record anything…",
chips: [ "What does Douglas do now?", "What were the results at Sotheby’s?", "What is a CDP, in his framing?" ],
cta: null
},
"/writing/the-ac-ledger/": {
placeholder: "Ask my record anything…",
chips: [ "What does Douglas do now?", "What were the results at Sotheby’s?", "What is a CDP, in his framing?" ],
cta: null
},
"/writing/composable-is-a-culture-not-just-a-stack/": {
placeholder: "Ask about composable culture…",
chips: [ "What is a CDP, in his framing?", "What CDP experience does he have?", "What was the CDP approach at Lindblad?" ],
cta: null
},
"/writing/build-it-with-them-not-for-them/": {
placeholder: "Ask about building with people…",
chips: [ "What does Douglas do now?", "What were the results at Lindblad?", "How did he grow organic traffic at Sotheby’s?" ],
cta: null
},
"/writing/remote-work-is-isolating/": {
placeholder: "Ask my record anything…",
chips: [ "What does Douglas do now?", "What were the results at Sotheby’s?", "What is a CDP, in his framing?" ],
cta: null
},
"/writing/prioritization-is-about-saying-no/": {
placeholder: "Ask about prioritization…",
chips: [ "What does Douglas do now?", "What were the results at Sotheby’s?", "What were the results at Lindblad?" ],
cta: null
},
"/writing/alignment-isnt-a-meeting-its-a-system/": {
placeholder: "Ask about alignment…",
chips: [ "What does Douglas do now?", "How did he grow organic traffic at Sotheby’s?", "What were the results at Lindblad?" ],
cta: null
},
"/record/": {
placeholder: "Ask my record anything…",
chips: [ "What does Douglas do now?", "What is a CDP, in his framing?", "What were the results at Sotheby’s?" ],
cta: null
},
"/record/organic-search-decline/": {
placeholder: "Ask about this diagnosis…",
chips: [ "What was the A Place for Mom diagnosis?", "How did search market share change at A Place for Mom?", "How did he grow organic traffic at Sotheby’s?" ],
cta: null
},
"/colophon/": {
placeholder: "Ask about how this site runs…",
chips: [ "What are the harness checks?", "What is the approval rule for publishing?" ],
cta: null
}
};
var page = window.location.pathname;
if (page.charAt(page.length - 1) !== "/") page += "/";
var ctx = CONTEXTS[page] || DEFAULT_CTX;
var css = [ ".explore{position:relative;margin:26px 0 4px;padding:18px 18px 12px;border:1px solid var(--line);border-radius:12px}", ".explore textarea{font:inherit;font-size:16px;width:100%;box-sizing:border-box;padding:11px 16px;border:1px solid var(--line);border-radius:999px;background:transparent;color:var(--ink);resize:none;display:block}", ".explore textarea:focus{outline:none;border-color:var(--accent)}", ".explore textarea.explore-q-grown{border-radius:14px}", ".explore .explore-panel{position:absolute;left:0;right:0;top:calc(100% + 6px);z-index:70;background:var(--bg);border:1px solid var(--line);border-radius:12px;padding:10px 12px;box-shadow:0 12px 32px rgba(0,0,0,.16);max-height:46vh;overflow-y:auto}", ".explore .explore-hit{display:block;padding:10px 14px;border:1px solid var(--line);border-radius:10px;margin:0 0 8px;text-decoration:none;color:var(--ink)}", ".explore .explore-hit:hover,.explore .explore-hit.active{border-color:var(--accent)}", ".explore .explore-hit .t{display:block;font-size:11.5px;text-transform:uppercase;letter-spacing:.07em;color:var(--muted);margin:0 0 2px}", ".explore .explore-hit .ti{display:block;font-size:16px;font-weight:600;margin:0 0 2px}", ".explore .explore-hit .sm{display:block;font-size:14px;color:var(--ink-2);line-height:1.45}", ".explore .explore-askrow{display:block;width:100%;text-align:left;font:inherit;font-size:15px;padding:10px 14px;border:1px solid var(--accent);border-radius:10px;background:transparent;color:var(--ink);cursor:pointer;margin:0 0 8px}", ".explore .explore-askrow.active{background:var(--accent-light)}", ".explore .explore-recent{display:block;width:100%;text-align:left;font:inherit;font-size:15px;padding:10px 14px;border:1px solid var(--line);border-radius:10px;background:transparent;color:var(--ink);cursor:pointer;margin:0 0 8px}", ".explore .explore-recent:hover,.explore .explore-recent.active{border-color:var(--accent)}", ".explore .explore-starter{display:block;width:100%;text-align:left;font:inherit;font-size:15px;padding:10px 14px;border:1px solid var(--line);border-radius:10px;background:transparent;color:var(--ink);cursor:pointer;margin:0 0 8px}", ".explore .explore-starter:hover,.explore .explore-starter.active{border-color:var(--accent)}", ".explore .explore-none{font-size:14.5px;color:var(--muted);margin:2px 0 10px}", ".explore .explore-head{font-size:11.5px;text-transform:uppercase;letter-spacing:.07em;color:var(--muted);margin:4px 0 6px}", ".explore .explore-answer{margin-top:14px}", ".explore .ask-prose{font-size:15.5px;line-height:1.55;margin:0 0 4px}.ask-gen-tag{font-size:12px;color:var(--muted,#777);margin:0 0 10px}.ask-item{padding:14px 18px;border:1px solid var(--line);border-radius:10px;margin:0 0 10px}", ".explore .ask-item p{margin:0 0 6px;font-size:16.5px;line-height:1.55}", ".explore .ask-item a{font-size:14px}", ".explore .ask-msg{font-size:16.5px;line-height:1.55}", ".explore .ask-next{margin-top:6px;font-size:15px}" ].join("\n");
var style = document.createElement("style");
style.textContent = css;
document.head.appendChild(style);
function track(n, p) {
if (window.amplitude && typeof window.amplitude.track === "function") {
try {
window.amplitude.track(n, p || {});
} catch (e) {}
}
}
var _registryPromise = null;
var _registryMap = null;
function ledgerAskOutcome(cls) {
try {
if (window.DCLedger && window.DCLedger.enabled && typeof window.DCLedger.recordAskOutcome === "function") {
window.DCLedger.recordAskOutcome(cls);
}
} catch (e) {}
}
function ensureRegistry() {
if (_registryPromise) return _registryPromise;
var fetchPromise;
try {
var fetchOpts = {
credentials: "omit"
};
try {
if (typeof AbortController !== "undefined") {
var controller = new AbortController;
fetchOpts.signal = controller.signal;
setTimeout(function() {
try {
controller.abort();
} catch (e) {}
}, 3e3);
}
} catch (e) {}
fetchPromise = fetch("/record.json", fetchOpts).then(function(r) {
return r.ok ? r.json() : null;
}).catch(function() {
return null;
});
} catch (e) {
fetchPromise = Promise.resolve(null);
}
var timeoutPromise = new Promise(function(resolve) {
setTimeout(function() {
resolve(null);
}, 3e3);
});
_registryPromise = Promise.race([ fetchPromise, timeoutPromise ]).then(function(data) {
if (!data || !data.records || !data.records.length) return null;
var map = {};
var ambiguous = {};
var anchors = {};
data.records.forEach(function(rec) {
if (!rec || rec.status !== "approved" || !rec.id || typeof rec.claim !== "string" || typeof rec.source !== "string") return;
var key = rec.claim + "\n" + rec.source;
if (Object.prototype.hasOwnProperty.call(map, key) && map[key] !== rec.id) {
ambiguous[key] = true;
} else {
map[key] = rec.id;
}
if (typeof rec.anchor === "string" && rec.anchor) {
anchors[rec.id] = rec.anchor;
}
});
Object.keys(ambiguous).forEach(function(key) {
delete map[key];
});
_registryMap = {
map: map,
ambiguous: ambiguous,
anchors: anchors
};
return _registryMap;
}).catch(function() {
return null;
});
return _registryPromise;
}
function registryIdForItem(it) {
if (!_registryMap || !it || typeof it.claim !== "string" || typeof it.source !== "string") return null;
var key = it.claim + "\n" + it.source;
if (_registryMap.ambiguous[key]) return null;
return _registryMap.map[key] || null;
}
function registryAnchorForItem(it) {
var id = registryIdForItem(it);
if (!id || !_registryMap || !_registryMap.anchors) return null;
return _registryMap.anchors[id] || null;
}
function markStreamExitedForContext() {
try {
var raw = window.sessionStorage.getItem("dc_stream_v1");
if (!raw) return;
var store = JSON.parse(raw);
if (store && store.engaged && !store.exited) {
store.exited = true;
window.sessionStorage.setItem("dc_stream_v1", JSON.stringify(store));
}
} catch (e) {}
}
function ledgerAskRecords(items) {
try {
if (!(window.DCLedger && window.DCLedger.enabled) || !items || !items.length) return;
} catch (e) {
return;
}
ensureRegistry().then(function(reg) {
try {
if (!reg) return;
if (!(window.DCLedger && window.DCLedger.enabled && typeof window.DCLedger.recordAskRecords === "function")) {
return;
}
var ids = [];
items.forEach(function(it) {
var id = registryIdForItem(it);
if (id) ids.push(id);
});
if (ids.length) window.DCLedger.recordAskRecords(ids);
} catch (e) {}
});
}
function ledgerRecordOpened(it) {
try {
if (!(window.DCLedger && window.DCLedger.enabled && typeof window.DCLedger.recordRecordOpened === "function")) {
return;
}
if (!_registryMap) return;
var id = registryIdForItem(it);
if (id) window.DCLedger.recordRecordOpened(id);
} catch (e) {}
}
var main = document.querySelector("main");
if (!main) return;
var bar = document.createElement("div");
bar.className = "explore";
bar.id = "ask-h";
bar.innerHTML = '<textarea id="explore-q" rows="1" maxlength="300" autocomplete="off" enterkeyhint="send" aria-label="Search the record or ask a question"></textarea>' + '<div class="explore-panel" id="explore-panel" hidden></div>' + '<div class="explore-answer" id="explore-answer" hidden></div>';
var dockMount = document.getElementById("cp-composer");
if (dockMount && document.getElementById("cp-dock")) {
dockMount.appendChild(bar);
} else {
main.insertBefore(bar, main.firstChild);
}
var ein = document.getElementById("explore-q");
ein.setAttribute("placeholder", ctx.placeholder);
var restHeight = 0, lineHeight = 0, borderH = 0;
function measureInput() {
if (restHeight) return;
try {
var cs = window.getComputedStyle(ein);
lineHeight = parseFloat(cs.lineHeight) || 0;
restHeight = ein.offsetHeight || 0;
borderH = restHeight - (ein.clientHeight || 0);
if (borderH < 0) borderH = 0;
if (restHeight && lineHeight) {
try {
ein._qMaxH = restHeight + lineHeight * 4;
} catch (e) {}
}
} catch (e) {}
}
measureInput();
function growInput() {
if (!(window.DCSurface && window.DCSurface.active)) return;
measureInput();
if (!restHeight || !lineHeight) return;
try {
var max = restHeight + lineHeight * 4;
ein.style.height = restHeight + "px";
var sh = ein.scrollHeight || 0;
if (!sh) {
ein.style.height = "";
ein.classList.remove("explore-q-grown");
return;
}
var target = Math.min(Math.max(sh + borderH, restHeight), max);
ein.style.height = target + "px";
ein.style.overflowY = sh + borderH > max ? "auto" : "hidden";
ein.classList.toggle("explore-q-grown", target > restHeight + 1);
} catch (e) {}
}
function resetInputHeight() {
try {
ein.style.height = "";
ein.style.overflowY = "";
ein.classList.remove("explore-q-grown");
} catch (e) {}
}
var panel = document.getElementById("explore-panel");
var answerBox = document.getElementById("explore-answer");
if (answerBox) answerBox.setAttribute("aria-live", "polite");
var viewed = false;
if ("IntersectionObserver" in window) {
var io = new IntersectionObserver(function(entries) {
entries.forEach(function(en) {
if (en.isIntersecting && !viewed) {
viewed = true;
track("Ask Module Viewed", {
page: page
});
io.disconnect();
}
});
}, {
threshold: .4
});
io.observe(bar);
}
function measurementHeld() {
try {
if (window.DCInternal) return true;
if (window.DCAmplitude && typeof window.DCAmplitude.gate === "function") {
var g = window.DCAmplitude.gate();
if (g === "pending" || g === "declined") return true;
}
} catch (e) {}
return false;
}
var pipeTokCache = null;
function pipeToken() {
if (pipeTokCache) return pipeTokCache;
var t = null;
if (PIPE_ENABLED) {
try {
if (window.amplitude && typeof window.amplitude.getDeviceId === "function") {
var d = window.amplitude.getDeviceId();
if (d) t = d;
}
} catch (e) {}
}
if (!t) {
try {
t = window.localStorage.getItem("dc_anon_token") || window.sessionStorage.getItem("dc_anon_token");
} catch (e) {}
if (!t) {
t = "anon-" + Math.random().toString(36).slice(2) + Date.now().toString(36);
}
if (!measurementHeld()) {
try {
window.localStorage.setItem("dc_anon_token", t);
} catch (e) {
try {
window.sessionStorage.setItem("dc_anon_token", t);
} catch (e2) {}
}
}
}
pipeTokCache = t;
return t;
}
var aaClient = null, aaStarted = false, aaQueue = [];
function aaInstance() {
var lib = window.AlgoliaAnalytics;
if (!lib) return null;
var inst = lib.default || lib;
if (inst && typeof inst.init === "function" && typeof inst.clickedObjectIDsAfterSearch === "function") return inst;
return null;
}
function aaFlush() {
if (measurementHeld()) {
aaQueue.length = 0;
return;
}
var inst = aaInstance();
if (!inst) return;
if (!aaClient) {
try {
inst.init({
appId: ALGOLIA_APP,
apiKey: ALGOLIA_SEARCH_KEY
});
} catch (e) {
return;
}
aaClient = inst;
}
try {
aaClient.setUserToken(pipeToken());
} catch (e) {}
while (aaQueue.length) {
var item = aaQueue.shift();
try {
aaClient[item[0]](item[1]);
} catch (e) {}
}
}
function aaLoad() {
if (aaStarted) return;
aaStarted = true;
if (aaInstance()) {
aaFlush();
return;
}
var sc = document.createElement("script");
sc.src = "https://cdn.jsdelivr.net/npm/search-insights@2.17.3/dist/search-insights.min.js";
sc.integrity = "sha384-puGTibgj5tll4rKBSZMNWXFBG+MuObLcSQE3VnZ/PbPozbHGK7qhg0CFKG9FBUjZ";
sc.crossOrigin = "anonymous";
sc.async = true;
sc.onload = function() {
aaFlush();
};
document.head.appendChild(sc);
}
function aaSend(method, payload) {
if (measurementHeld()) return;
aaQueue.push([ method, payload ]);
if (aaQueue.length > 50) aaQueue.shift();
if (aaClient) aaFlush(); else aaLoad();
}
var AA_PENDING_KEY = "dc_aa_pending_v1";
var AA_METHODS = {
clickedObjectIDsAfterSearch: 1,
clickedObjectIDs: 1,
viewedObjectIDs: 1,
convertedObjectIDsAfterSearch: 1
};
function aaRestorePending() {
var savedAa = null;
try {
savedAa = window.sessionStorage.getItem(AA_PENDING_KEY);
} catch (e) {}
if (!savedAa) return;
try {
window.sessionStorage.removeItem(AA_PENDING_KEY);
} catch (e) {}
if (measurementHeld()) return;
try {
var parsedAa = JSON.parse(savedAa);
if (parsedAa && parsedAa.length) {
parsedAa.forEach(function(item) {
if (item && AA_METHODS[item[0]] && item[1] && typeof item[1] === "object" && aaQueue.length < 50) {
aaQueue.push([ item[0], item[1] ]);
}
});
}
} catch (e) {}
}
aaRestorePending();
window.addEventListener("pagehide", function() {
try {
if (aaQueue.length && !measurementHeld()) {
window.sessionStorage.setItem(AA_PENDING_KEY, JSON.stringify(aaQueue.slice(0, 50)));
aaQueue.length = 0;
} else {
window.sessionStorage.removeItem(AA_PENDING_KEY);
}
} catch (e) {}
});
window.addEventListener("pageshow", function(ev) {
try {
if (ev && ev.persisted) {
aaRestorePending();
if (aaQueue.length && !measurementHeld()) {
if (aaInstance()) aaFlush(); else aaLoad();
}
}
} catch (e) {}
});
try {
if (window.DCAmplitude && typeof window.DCAmplitude.gate === "function" && window.DCAmplitude.gate() === "declined") {
window.localStorage.removeItem("dc_anon_token");
window.sessionStorage.removeItem("dc_anon_token");
window.sessionStorage.removeItem(AA_PENDING_KEY);
}
} catch (e) {}
if (!measurementHeld()) aaLoad();
var lastSearchCtx = null;
function aaPathKey(raw) {
try {
var p = new URL(raw, window.location.href).pathname;
return p.length > 1 ? p.replace(/\/$/, "") : p;
} catch (e) {
return null;
}
}
function aaCitationClick(rawUrl) {
if (!lastSearchCtx || !lastSearchCtx.queryID) return;
var key = aaPathKey(rawUrl);
if (!key) return;
var matches = [];
lastSearchCtx.hits.forEach(function(h, i) {
if (aaPathKey(h.url) === key) matches.push(i);
});
if (matches.length > 1) {
var full = null;
try {
full = new URL(rawUrl, window.location.href);
} catch (e) {}
var exact = matches.filter(function(i) {
try {
var hu = new URL(lastSearchCtx.hits[i].url, window.location.href);
return !!full && hu.pathname === full.pathname && hu.hash === full.hash;
} catch (e) {
return false;
}
});
if (exact.length === 1) matches = exact;
}
if (matches.length !== 1) return;
var hit = lastSearchCtx.hits[matches[0]];
aaSend("clickedObjectIDsAfterSearch", {
eventName: "Search Result Clicked",
index: ALGOLIA_INDEX,
queryID: lastSearchCtx.queryID,
objectIDs: [ hit.objectID ],
positions: [ matches[0] + 1 ]
});
}
document.addEventListener("click", function(ev) {
try {
var t = ev.target;
var a = t && t.closest ? t.closest("a[data-ask-citation]") : null;
if (!a) return;
aaCitationClick(a.getAttribute("href") || "");
} catch (e) {}
});
function nextStep() {
if (!ctx.cta) return null;
var p = document.createElement("p");
p.className = "ask-next";
var a = document.createElement("a");
a.href = ctx.cta.href;
a.textContent = ctx.cta.label;
extAttrs(a);
a.addEventListener("click", function() {
track("Ask Next Click", {
page: page,
kind: "cta"
});
});
p.appendChild(a);
return p;
}
function ask(q, via) {
track("Ask Submitted", {
page: page,
via: via
});
panel.hidden = true;
answerBox.hidden = false;
answerBox.innerHTML = '<p class="ask-msg">Checking the record…</p>';
fetch(ASK_ENDPOINT, {
method: "POST",
headers: {
"content-type": "application/json"
},
body: JSON.stringify({
question: q,
page: page
})
}).then(function(r) {
return r.json();
}).then(function(data) {
answerBox.innerHTML = "";
if (data.type === "answer" && data.items && (data.items.length || data.gen)) {
track("Ask Answered", {
page: page,
records: data.items.length,
generated: !!data.generated,
twin: !!data.gen
});
ledgerAskOutcome(data.gen ? "answer_gen" : data.generated ? "answer_prose" : "answer");
ledgerAskRecords(data.items);
if (data.gen && data.gen.paragraphs) {
data.gen.paragraphs.forEach(function(para) {
var gp = document.createElement("p");
gp.className = "ask-prose";
gp.textContent = para.text;
answerBox.appendChild(gp);
});
var gtag = document.createElement("p");
gtag.className = "ask-gen-tag";
gtag.textContent = "Answered by Douglas's digital twin. Career facts are cited to the published record; the claims themselves are below, word for word.";
answerBox.appendChild(gtag);
} else if (data.generated && data.prose) {
var lead = document.createElement("p");
lead.className = "ask-prose";
lead.textContent = data.prose;
answerBox.appendChild(lead);
var tag = document.createElement("p");
tag.className = "ask-gen-tag";
tag.textContent = "Framing written by AI. The claims below are quoted word for word from the record.";
answerBox.appendChild(tag);
}
data.items.forEach(function(it) {
var div = document.createElement("div");
div.className = "ask-item";
var p = document.createElement("p");
p.textContent = it.claim;
var a = document.createElement("a");
a.href = it.source;
a.textContent = "Read it in context";
extAttrs(a);
a.setAttribute("data-ask-citation", "1");
try {
var u = new URL(a.href);
if (u.origin === window.location.origin && u.pathname === "/scorecard/") {
a.setAttribute("data-link-source", "answer_context");
a.setAttribute("data-link-label", "Read it in context");
}
} catch (e) {}
a.addEventListener("click", function() {
track("Ask Next Click", {
page: page,
kind: "source"
});
ledgerRecordOpened(it);
markStreamExitedForContext();
});
ensureRegistry().then(function() {
var an = registryAnchorForItem(it);
if (an && a.href.indexOf("#") === -1) {
a.href = it.source + "#" + an;
}
});
div.appendChild(p);
div.appendChild(a);
answerBox.appendChild(div);
});
var ns = nextStep();
if (ns) answerBox.appendChild(ns);
} else if (data.type === "refusal") {
track("Ask Refused", {
page: page
});
ledgerAskOutcome("refuse");
var p1 = document.createElement("p");
p1.className = "ask-msg";
p1.textContent = data.text;
answerBox.appendChild(p1);
} else {
track("Ask No Evidence", {
page: page
});
ledgerAskOutcome("none");
var p2 = document.createElement("p");
p2.className = "ask-msg";
p2.textContent = data.text || "";
answerBox.appendChild(p2);
if (data.link) {
var a2 = document.createElement("a");
a2.href = data.link;
a2.textContent = "Browse the case studies";
extAttrs(a2);
a2.addEventListener("click", function() {
track("Ask Next Click", {
page: page,
kind: "hub"
});
});
answerBox.appendChild(a2);
}
}
}).catch(function() {
answerBox.innerHTML = '<p class="ask-msg">The record is not answering right now. The case studies are the fastest way through it.</p>';
});
}
var QWORDS = [ "what", "how", "who", "when", "where", "why", "did", "does", "do", "is", "was", "were", "can", "could", "would", "should", "has", "have" ];
var IMPERATIVES = [ "show me", "tell me", "find me", "give me" ];
function isQuestion(q) {
var t = (q || "").trim();
if (!t) return false;
if (t.charAt(t.length - 1) === "?") return true;
var words = t.split(/\s+/);
if (words.length >= 6) return true;
var lower = t.toLowerCase();
for (var i = 0; i < IMPERATIVES.length; i++) {
if (lower.indexOf(IMPERATIVES[i]) === 0) return true;
}
return QWORDS.indexOf(words[0].toLowerCase().replace(/[^a-z]/g, "")) >= 0;
}
function getRecents() {
try {
return JSON.parse(window.localStorage.getItem("dc-recent-searches") || "[]");
} catch (e) {
return [];
}
}
function saveRecent(q) {
try {
var r = getRecents().filter(function(x) {
return x !== q;
});
r.unshift(q);
window.localStorage.setItem("dc-recent-searches", JSON.stringify(r.slice(0, 4)));
} catch (e) {}
}
var activeIdx = -1;
function panelItems() {
return panel.querySelectorAll(".explore-hit, .explore-askrow, .explore-recent, .explore-starter");
}
function setActive(i) {
var items = panelItems();
items.forEach(function(el) {
el.classList.remove("active");
});
activeIdx = i;
if (i >= 0 && items[i]) items[i].classList.add("active");
}
function headRow(text) {
var h = document.createElement("p");
h.className = "explore-head";
h.textContent = text;
return h;
}
function clearTransientStatus() {
try {
if (window.DCSurface && window.DCSurface.clearTransientStatus) {
window.DCSurface.clearTransientStatus();
}
} catch (e) {}
}
function recentRow(r) {
var b = document.createElement("button");
b.type = "button";
b.className = "explore-recent";
b.textContent = r;
b.addEventListener("click", function() {
ein.value = r;
growInput();
if (unifiedAccepted(r)) return;
if (isQuestion(r)) ask(r, "unified"); else composeTyping(r);
});
return b;
}
function appendRecents() {
var recents = getRecents();
if (!recents.length) return;
panel.appendChild(headRow("Recent searches"));
recents.forEach(function(r) {
panel.appendChild(recentRow(r));
});
}
function showRecents() {
if (!getRecents().length) {
panel.hidden = true;
return;
}
panel.innerHTML = "";
appendRecents();
panel.hidden = false;
setActive(-1);
}
function startersModelNow() {
try {
if (window.DCSurface && window.DCSurface.active && typeof window.DCSurface.currentStarters === "function") {
var m = window.DCSurface.currentStarters();
if (m && m.starters && m.starters.length) return m;
}
} catch (e) {}
return null;
}
function appendStarters(model) {
panel.appendChild(headRow("Ask my record"));
model.starters.forEach(function(s) {
var b = document.createElement("button");
b.type = "button";
b.className = "explore-starter";
b.textContent = s.text;
b.addEventListener("click", function() {
panel.hidden = true;
ein.value = "";
lastSearchCtx = null;
resetInputHeight();
if (model.onTap) model.onTap(s);
});
panel.appendChild(b);
});
}
function showEmptyState() {
var model = startersModelNow();
if (!model) {
panel.hidden = true;
return;
}
panel.innerHTML = "";
appendStarters(model);
appendRecents();
panel.hidden = false;
setActive(-1);
clearTransientStatus();
}
function appendAskSection(q) {
panel.appendChild(headRow("Ask my record"));
var row = document.createElement("button");
row.type = "button";
row.className = "explore-askrow";
row.textContent = "Ask my record: “" + q + "”";
row.addEventListener("click", function() {
if (unifiedAccepted(q)) return;
ask(q, "unified");
});
panel.appendChild(row);
}
function showAskRow(q) {
panel.innerHTML = "";
appendAskSection(q);
panel.hidden = false;
setActive(-1);
}
var debounce = null;
var searchSeq = 0;
function composeTyping(q) {
showAskRow(q);
runSearch(q);
}
function runSearch(q) {
var seq = ++searchSeq;
lastSearchCtx = null;
var searchBody = {
query: q,
hitsPerPage: 6,
attributesToHighlight: [],
clickAnalytics: false
};
if (!measurementHeld()) {
searchBody.clickAnalytics = true;
searchBody.userToken = pipeToken();
}
var fetchOpts = {
method: "POST",
headers: {
"content-type": "application/json",
"X-Algolia-API-Key": ALGOLIA_SEARCH_KEY,
"X-Algolia-Application-Id": ALGOLIA_APP
},
body: JSON.stringify(searchBody)
};
try {
if (typeof AbortController !== "undefined") {
var controller = new AbortController;
fetchOpts.signal = controller.signal;
setTimeout(function() {
try {
controller.abort();
} catch (e) {}
}, 1e4);
}
} catch (e) {}
fetch("https://" + ALGOLIA_APP + "-dsn.algolia.net/1/indexes/" + ALGOLIA_INDEX + "/query", fetchOpts).then(function(r) {
return r.json();
}).then(function(data) {
if (seq !== searchSeq) return;
if (ein.value.trim() !== q) return;
var hits = data.hits || [], queryID = data.queryID;
lastSearchCtx = {
queryID: queryID || null,
hits: hits.map(function(h) {
return {
objectID: h.objectID,
url: h.url
};
})
};
track("Search Query", {
page: page,
length: q.length,
result_class: hits.length ? "results" : "none"
});
panel.innerHTML = "";
if (!hits.length) {
var none = document.createElement("p");
none.className = "explore-none";
none.textContent = isQuestion(q) ? "That's a question for my record, not keyword search:" : "Nothing in the record matches that. Ask my record instead:";
panel.appendChild(none);
}
hits.forEach(function(h, hi) {
var a = document.createElement("a");
a.className = "explore-hit";
a.href = h.url;
extAttrs(a);
var t = document.createElement("span");
t.className = "t";
t.textContent = h.type || "";
var ti = document.createElement("span");
ti.className = "ti";
ti.textContent = h.title || "";
var sm = document.createElement("span");
sm.className = "sm";
sm.textContent = h.summary || "";
a.appendChild(t);
a.appendChild(ti);
a.appendChild(sm);
a.addEventListener("click", function() {
track("Search Result Click", {
page: page,
destination_type: h.type || ""
});
saveRecent(q);
if (queryID) {
aaSend("clickedObjectIDsAfterSearch", {
eventName: "Search Result Clicked",
index: ALGOLIA_INDEX,
queryID: queryID,
objectIDs: [ h.objectID ],
positions: [ hi + 1 ]
});
}
});
panel.appendChild(a);
});
appendAskSection(q);
if (hits.length && queryID) {
aaSend("viewedObjectIDs", {
eventName: "Search Results Viewed",
index: ALGOLIA_INDEX,
queryID: queryID,
objectIDs: hits.slice(0, 20).map(function(h) {
return h.objectID;
})
});
}
panel.hidden = false;
setActive(-1);
}).catch(function() {
if (seq !== searchSeq) return;
if (ein.value.trim() !== q) return;
lastSearchCtx = null;
showAskRow(q);
});
}
ein.addEventListener("focus", function() {
var origin = "composer";
try {
if (window.DCSurface && window.DCSurface.consumeFocusOrigin) {
origin = window.DCSurface.consumeFocusOrigin() || "composer";
}
} catch (e) {}
track("Explore Focus", {
page: page,
origin: origin
});
if (!ein.value.trim()) showEmptyState();
});
ein.addEventListener("input", function() {
lastSearchCtx = null;
growInput();
answerBox.hidden = true;
var q = ein.value.trim();
if (debounce) clearTimeout(debounce);
if (q.length === 0) {
lastSearchCtx = null;
showEmptyState();
return;
}
if (q.length < 2) {
showRecents();
return;
}
showAskRow(q);
debounce = setTimeout(function() {
runSearch(q);
}, 150);
});
function unifiedAccepted(q) {
if (!(window.DCSurface && window.DCSurface.active && typeof window.DCSurface.tryUnified === "function")) {
return false;
}
var accepted = false;
try {
accepted = window.DCSurface.tryUnified(q) === true;
} catch (e) {
accepted = false;
}
if (!accepted) return false;
saveRecent(q);
panel.hidden = true;
answerBox.hidden = true;
ein.value = "";
resetInputHeight();
return true;
}
ein.addEventListener("keydown", function(ev) {
var items = panelItems();
if (ev.key === "ArrowDown" && items.length) {
ev.preventDefault();
setActive(Math.min(activeIdx + 1, items.length - 1));
return;
}
if (ev.key === "ArrowUp" && items.length) {
ev.preventDefault();
setActive(Math.max(activeIdx - 1, -1));
return;
}
if (ev.key === "Escape") {
panel.hidden = true;
return;
}
if (ev.key !== "Enter") return;
if (ev.isComposing || ev.keyCode === 229) return;
if (ev.shiftKey) return;
ev.preventDefault();
var q = ein.value.trim();
if (q.length < 3) return;
if (activeIdx >= 0 && items[activeIdx]) {
items[activeIdx].click();
return;
}
if (unifiedAccepted(q)) return;
if (isQuestion(q)) {
saveRecent(q);
ask(q, "unified");
return;
}
});
document.addEventListener("click", function(ev) {
if (!bar.contains(ev.target)) panel.hidden = true;
});
function queryIndex(body) {
if (!body.userToken && !measurementHeld()) body.userToken = pipeToken();
return fetch("https://" + ALGOLIA_APP + "-dsn.algolia.net/1/indexes/" + ALGOLIA_INDEX + "/query", {
method: "POST",
headers: {
"content-type": "application/json",
"X-Algolia-API-Key": ALGOLIA_SEARCH_KEY,
"X-Algolia-Application-Id": ALGOLIA_APP
},
body: JSON.stringify(body)
}).then(function(r) {
return r.json();
});
}
function listClick(surface, h) {
track("Dynamic List Click", {
surface: surface,
destination_type: h.type || ""
});
aaSend("clickedObjectIDs", {
eventName: "List Item Clicked",
index: ALGOLIA_INDEX,
objectIDs: [ h.objectID ]
});
}
function fmtDate(ts) {
if (!ts) return "";
try {
return new Date(ts * 1e3).toLocaleDateString("en-US", {
month: "short",
day: "numeric",
year: "numeric",
timeZone: "UTC"
});
} catch (e) {
return "";
}
}
function ensureCardCss() {
if (document.getElementById("dl-card-css")) return;
var st = document.createElement("style");
st.id = "dl-card-css";
st.textContent = ".dl-card{list-style:none}" + ".dl-card-a{display:flex;gap:14px;text-decoration:none;border:1px solid var(--line,#ddd);border-radius:12px;padding:12px;background:var(--surface,var(--bg,#fff));color:inherit;transition:border-color .15s ease,transform .15s ease}" + ".dl-card-a:hover{border-color:var(--accent,#5b7a67);transform:translateY(-1px)}" + ".dl-img{width:112px;min-height:88px;object-fit:cover;border-radius:8px;flex:none}" + ".dl-body{display:flex;flex-direction:column;gap:4px;min-width:0}" + ".dl-meta{display:flex;gap:8px;align-items:center;font-size:11.5px;color:var(--muted,#777)}" + ".dl-tag{letter-spacing:.04em;text-transform:uppercase;border:1px solid var(--line,#ddd);border-radius:4px;padding:0 5px;font-weight:600}" + ".dl-title{font-family:Newsreader,Georgia,serif;font-size:18.5px;font-weight:600;line-height:1.25;color:var(--ink,inherit)}" + ".dl-sum{font-size:14px;line-height:1.5;color:var(--ink-2,#444);display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical;overflow:hidden}" + ".dl-cta{margin-top:auto;padding-top:2px;font-size:13.5px;font-weight:600;color:var(--accent,#5b7a67)}" + ".related-writing li.dl-card,.related-writing li.dynamic-more{padding:0;border-bottom:none}" + ".related-writing li.dynamic-more{padding:6px 2px 0}" + "@media (max-width:560px){.dl-img{width:84px}}";
document.head.appendChild(st);
}
function renderEssayList(ul, hits, surface, hubUrl, hubLabel) {
ensureCardCss();
ul.innerHTML = "";
hits.forEach(function(h) {
var li = document.createElement("li");
li.className = "dl-card";
var a = document.createElement("a");
a.className = "dl-card-a";
a.href = h.url;
extAttrs(a);
a.addEventListener("click", function() {
listClick(surface, h);
});
if (h.image) {
var im = document.createElement("img");
im.className = "dl-img";
im.src = h.image;
im.alt = "";
im.loading = "lazy";
a.appendChild(im);
}
var body = document.createElement("span");
body.className = "dl-body";
var meta = document.createElement("span");
meta.className = "dl-meta";
var tag = document.createElement("span");
tag.className = "dl-tag";
tag.textContent = h.type || "Essay";
meta.appendChild(tag);
var d = fmtDate(h.date);
if (d) {
var ds = document.createElement("span");
ds.textContent = d;
meta.appendChild(ds);
}
body.appendChild(meta);
var ti = document.createElement("span");
ti.className = "dl-title";
ti.textContent = h.title || "";
body.appendChild(ti);
var su = document.createElement("span");
su.className = "dl-sum";
su.textContent = h.summary || "";
body.appendChild(su);
var ct = document.createElement("span");
ct.className = "dl-cta";
ct.textContent = (h.type === "Essay" ? "Read the essay" : "Read more") + " →";
body.appendChild(ct);
a.appendChild(body);
li.appendChild(a);
ul.appendChild(li);
});
if (hits.length) {
aaSend("viewedObjectIDs", {
eventName: "List Items Viewed",
index: ALGOLIA_INDEX,
objectIDs: hits.slice(0, 20).map(function(h) {
return h.objectID;
})
});
}
if (hubUrl) {
var mli = document.createElement("li");
mli.className = "dynamic-more";
var ma = document.createElement("a");
ma.href = hubUrl;
ma.textContent = hubLabel || "View all";
extAttrs(ma);
ma.addEventListener("click", function() {
track("Dynamic List Click", {
surface: surface,
destination_type: "Hub"
});
});
mli.appendChild(ma);
ul.appendChild(mli);
}
}
var homeList = document.querySelector("ul.selected-writing[data-dynamic-list='essays']");
if (homeList) {
queryIndex({
query: "",
filters: "type:Essay",
hitsPerPage: 50,
attributesToHighlight: []
}).then(function(data) {
var hits = (data.hits || []).slice().sort(function(a, b) {
return (b.date || 0) - (a.date || 0);
});
if (!hits.length) return;
var shown = hits.slice(0, 3);
renderEssayList(homeList, shown, "home_writing", "/writing/", "View all writing");
track("Dynamic List Rendered", {
surface: "home_writing",
count: shown.length
});
}).catch(function() {});
}
var here = window.location.pathname;
var staticRelated = document.querySelector("section.related-writing");
if (staticRelated) {} else if (/^\/writing\/[^/]+\/$/.test(here)) {
var h1 = document.querySelector("h1");
var relQ = h1 ? h1.textContent.trim() : "";
if (relQ) {
queryIndex({
query: "",
filters: "type:Essay",
hitsPerPage: 50,
attributesToHighlight: []
}).then(function(data) {
var all = data.hits || [];
var self = null;
all.forEach(function(h) {
if (h.url === here) self = h;
});
var stop = {
the: 1,
a: 1,
an: 1,
and: 1,
of: 1,
to: 1,
is: 1,
it: 1,
in: 1,
on: 1,
for: 1,
what: 1,
why: 1,
how: 1,
your: 1,
you: 1,
are: 1,
not: 1,
do: 1,
does: 1,
from: 1,
with: 1,
about: 1,
into: 1,
its: 1,
this: 1,
that: 1,
just: 1,
actually: 1,
means: 1
};
function tokens(s) {
var out = {}, parts = (s || "").toLowerCase().split(/[^a-z0-9]+/);
parts.forEach(function(w) {
if (w.length > 2 && !stop[w]) out[w] = 1;
});
return out;
}
var selfTitle = tokens(self ? self.title : relQ);
var selfBody = tokens((self ? self.summary : "") + " " + (self && self.headings ? self.headings.join(" ") : ""));
var others = all.filter(function(h) {
return h.url !== here;
});
others.forEach(function(h) {
var ht = tokens(h.title), hb = tokens((h.summary || "") + " " + (h.headings ? h.headings.join(" ") : "")), sc = 0;
Object.keys(ht).forEach(function(w) {
if (selfTitle[w]) sc += 3;
if (selfBody[w]) sc += 1;
});
Object.keys(hb).forEach(function(w) {
if (selfTitle[w]) sc += 2;
});
h._rel = sc;
});
others.sort(function(a, b) {
return b._rel - a._rel || (b.date || 0) - (a.date || 0);
});
var hits = others.slice(0, 3);
if (!hits.length) return;
var st = document.createElement("style");
st.textContent = ".related-writing{margin:34px 0 6px;padding-top:18px;border-top:1px solid var(--line,#ddd)}.related-writing h2{font-size:20px;margin:0 0 10px}.related-writing ul{list-style:none;margin:0;padding:0}.related-writing li{padding:9px 0;border-bottom:1px solid var(--line,#ddd);font-size:15.5px;line-height:1.6;color:var(--ink-2,#444)}.related-writing li:last-child{border-bottom:none}.related-writing a{font-weight:600;color:var(--ink,inherit)}";
document.head.appendChild(st);
var main = document.querySelector("main") || document.body;
var sec = document.createElement("section");
sec.className = "related-writing";
sec.setAttribute("aria-label", "Related writing");
var hd = document.createElement("h2");
hd.textContent = "Related writing";
var ul = document.createElement("ul");
sec.appendChild(hd);
sec.appendChild(ul);
renderEssayList(ul, hits, "related_writing", "/writing/", "All writing");
main.appendChild(sec);
track("Dynamic List Rendered", {
surface: "related_writing",
count: hits.length
});
}).catch(function() {});
}
}
})();
