/* The on-device mirror (ledger.js).
   A small ledger kept only in this browser, keyed by the Amplitude
   device ID as a namespace (not authentication). It holds IDs and
   counts only: pages and records opened, records Ask returned, the
   kinds of answers Ask gave, intents picked, views built (specs as
   block ID lists) and views looked at, each with a count and dates.
   No raw prompt or question text is ever written to it. What it
   feeds is the conversation's opening state: on a page load, the
   history categories it reports (the categories holding entries
   from earlier visits) preload the stream's opening state and are
   named in its opening receipt. No scores are computed from it, no
   view is weighted or re-ordered by it, nothing in it is added to
   any event or request, and no page element reads it.
   Design: site-generative/increment3-mirror-design.md; the
   decommission sheet (site-generative/decommission-build-sheet.md,
   section 6) records the removal of the emphasis model that once
   weighted arrivals and turns from these scores. Entries stop
   counting after 90 days and are pruned on read and on write.
   Inspect-and-clear lives in the panel this file renders (doors:
   the receipt and the colophon).
   Measurement never breaks the page: every storage, network and
   Amplitude call here is wrapped, and any internal failure leaves
   window.DCLedger as the inert stub below (fail closed). */
(function () {
  "use strict";

  // Launch flip: the master flag. Shipped false in the dark build;
  // the launch step is changing this one line to true.
  var MIRROR_ENABLED = true;

  /* ---------- shared pure helpers (also used by the stub) ---------- */

  var CATEGORY_LABELS = {
    pages: "pages",
    records: "records",
    ask_records: "records",
    intents: "intents",
    specs: "built views",
    compositions: "composed views"
  };

  function categoriesLabel(categories) {
    if (!categories || !categories.length) return "";
    var words = [];
    for (var i = 0; i < categories.length; i++) {
      var w = CATEGORY_LABELS[categories[i]];
      if (w && words.indexOf(w) === -1) words.push(w);
    }
    if (!words.length) return "";
    if (words.length === 1) return words[0];
    if (words.length === 2) return words[0] + " and " + words[1];
    return words.slice(0, words.length - 1).join(", ") + " and " +
      words[words.length - 1];
  }

  function resolvedPromise() {
    try { return Promise.resolve(); } catch (e) { return null; }
  }

  function makeStub() {
    return {
      enabled: false,
      ready: function () { return resolvedPromise(); },
      recordIntent: function () {},
      recordComposition: function () {},
      recordAskOutcome: function () {},
      recordAskRecords: function () {},
      recordRecordOpened: function () {},
      historyCategories: function () { return null; },
      pageVisitedThisVisit: function () { return null; },
      freshStart: function () { return false; },
      categoriesLabel: categoriesLabel,
      openPanel: function () {}
    };
  }

  // Fail closed from the first line: the stub is in place before any
  // real work runs, and stays if anything below throws.
  try { window.DCLedger = makeStub(); } catch (e) { return; }
  if (!MIRROR_ENABLED) return;

  try {

  /* ---------- constants ---------- */

  var PREFIX = "dc_ledger_v1::";
  var CONSENT_KEY = "dc_ledger_consent_v1";
  var PAUSE_KEY = "dc_ledger_pause";
  var VISIT_KEY = "dc_visit";
  var WINDOW_SEC = 90 * 24 * 60 * 60;
  var DAY_SEC = 24 * 60 * 60;
  var COUNT_MAX = 25;
  var MAP_MAX = 50;
  var SPECS_MAX = 5;

  var INTENT_IDS = ["search_decline", "cdp", "replatform", "team",
    "speaking", "coherence", "measurement"];
  var INTENT_SET = {};
  INTENT_IDS.forEach(function (id) { INTENT_SET[id] = true; });
  // Human labels from the home page intent strip (site/index.html).
  var INTENT_LABELS = {
    search_decline: "Fixing a search or SEO decline",
    cdp: "Standing up a CDP, or fixing customer data",
    replatform: "Replatforming without losing the business",
    team: "Building a digital team or function",
    speaking: "Booking a speaker",
    coherence: "An experience that does not hold together across channels",
    measurement: "Testing plenty, and learning little"
  };

  var OUTCOME_IDS = ["answer", "answer_prose", "none", "refuse"];
  var OUTCOME_SET = {};
  OUTCOME_IDS.forEach(function (id) { OUTCOME_SET[id] = true; });
  var OUTCOME_LABELS = {
    answer: "An answer from the record",
    answer_prose: "An answer with written framing",
    none: "No evidence in the record",
    refuse: "A refusal"
  };

  var FRESH_PHRASES = ["start fresh", "start over", "from scratch",
    "ignore my history", "ignore what i read", "ignore what i've read",
    "forget my history", "forget what i read", "don't use my history",
    "do not use my history", "without my history"];

  var HONEST_CLEAR_SENTENCE = "Clearing this list does not change the " +
    "device ID, assigned at random, that this browser uses for " +
    "measurement, and it does not delete the measurement events " +
    "already recorded for statistics.";

  // One prompt, one choice (amplitude-consent-gate build): the
  // choice governs this ledger and Amplitude measurement alike,
  // so the copy names both. DRAFT wording, staged Nov 18, 2026,
  // pending Douglas's exact-text approval.
  var GATE_COPY = "This site can remember what you have opened here, in " +
    "your own browser, and let it shape the conversation when you come " +
    "back. That memory never leaves this browser. It can also measure " +
    "the visit with Amplitude: the pages you view, and the session " +
    "recorded as a replay, under a device ID assigned at random, with " +
    "no name or email attached. Both stay off until you answer. Keep it?";

  // Consent detection (build sheet section 5): explicit timezone
  // allowlist, no prefix matching.
  var TZ_SET = {};
  ("Europe/London Europe/Dublin Europe/Lisbon Europe/Madrid Europe/Paris " +
   "Europe/Berlin Europe/Busingen Europe/Rome Europe/Amsterdam " +
   "Europe/Brussels Europe/Luxembourg Europe/Vienna Europe/Warsaw " +
   "Europe/Prague Europe/Bratislava Europe/Budapest Europe/Ljubljana " +
   "Europe/Zagreb Europe/Stockholm Europe/Copenhagen Europe/Helsinki " +
   "Europe/Mariehamn Europe/Tallinn Europe/Riga Europe/Vilnius " +
   "Europe/Athens Europe/Bucharest Europe/Sofia Europe/Nicosia " +
   "Europe/Valletta Europe/Oslo Europe/Vaduz Europe/Jersey " +
   "Europe/Guernsey Europe/Isle_of_Man Europe/Gibraltar Asia/Nicosia " +
   "Asia/Famagusta Atlantic/Reykjavik Iceland Atlantic/Azores " +
   "Atlantic/Madeira Atlantic/Canary Atlantic/Faeroe Africa/Ceuta " +
   "Africa/Melilla America/Guadeloupe America/Martinique America/Cayenne " +
   "America/Marigot America/St_Barthelemy Indian/Reunion Indian/Mayotte " +
   "Eire Portugal Poland").split(" ").forEach(function (z) {
     TZ_SET[z] = true;
   });
  var LANG_PRIMARY_SET = {};
  ("de fr it es pt nl pl sv da fi el cs sk sl hr ro bg hu lt lv et ga mt " +
   "is lb no nb nn").split(" ").forEach(function (l) {
     LANG_PRIMARY_SET[l] = true;
   });
  // Region subtags that signal EU/EEA/UK (the sheet names GB, IE, MT, CY
  // explicitly; the rest are the EU/EEA country codes the region rule
  // exists to catch, e.g. es-ES, de-DE).
  var REGION_SET = {};
  ("GB IE MT CY AT BE BG HR CZ DK EE FI FR DE GR HU IT LV LT LU NL PL " +
   "PT RO SK SI ES SE NO IS LI").split(" ").forEach(function (r) {
     REGION_SET[r] = true;
   });

  var MAP_CATEGORIES = ["pages", "records", "intents", "compositions",
    "ask_outcomes", "ask_records"];
  var TRACE_ORDER = ["pages", "records", "ask_records", "intents",
    "compositions", "specs"];
  var PANEL_CATEGORIES = [
    { key: "pages", heading: "Pages you have opened here",
      removeLabel: "Remove pages" },
    { key: "records", heading: "Records you have opened",
      removeLabel: "Remove records" },
    { key: "ask_records", heading: "Records Ask returned for you",
      removeLabel: "Remove Ask records" },
    { key: "intents", heading: "Intents you have picked",
      removeLabel: "Remove intents" },
    { key: "specs", heading: "Views you built",
      removeLabel: "Remove built views" },
    { key: "compositions", heading: "Views you looked at",
      removeLabel: "Remove composed views" },
    { key: "ask_outcomes", heading: "Kinds of answers Ask gave you",
      removeLabel: "Remove answer kinds" }
  ];

  /* ---------- small utilities ---------- */

  function nowSec() { return Math.floor(Date.now() / 1000); }
  var INIT_SEC = nowSec();

  function esc(s) {
    return String(s == null ? "" : s).replace(/&/g, "&amp;")
      .replace(/</g, "&lt;").replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;");
  }

  function isPlainObj(x) {
    return !!x && typeof x === "object" &&
      Object.prototype.toString.call(x) === "[object Object]";
  }

  function track(name, props) {
    try {
      if (window.amplitude && typeof window.amplitude.track === "function") {
        window.amplitude.track(name, props || {});
      }
    } catch (e) { /* measurement never breaks the page */ }
  }

  function eventPage() {
    try { return window.location.pathname; } catch (e) { return ""; }
  }

  function currentPath() {
    var p = "/";
    try { p = window.location.pathname || "/"; } catch (e) {}
    if (p.charAt(p.length - 1) !== "/" && !/\.html?$/i.test(p)) p += "/";
    return p;
  }

  function pathOfUrl(u) {
    var s = String(u || "");
    if (!s) return "";
    try { return new URL(s).pathname; } catch (e) {}
    var m = /^[a-z][a-z0-9+.-]*:\/\/[^\/]+(\/.*)?$/i.exec(s);
    if (m) return m[1] || "/";
    return s.charAt(0) === "/" ? s : "";
  }

  /* ---------- storage wrappers (every exception swallowed) ---------- */

  function lsGet(key) {
    try { return window.localStorage.getItem(key); } catch (e) { return null; }
  }
  function lsSet(key, val) {
    try { window.localStorage.setItem(key, val); return true; }
    catch (e) { return false; }
  }
  function lsRemove(key) {
    try { window.localStorage.removeItem(key); } catch (e) {}
  }
  function lsKeys() {
    var out = [];
    try {
      for (var i = 0; i < window.localStorage.length; i++) {
        var k = window.localStorage.key(i);
        if (k) out.push(k);
      }
    } catch (e) {}
    return out;
  }
  function ledgerKeys() {
    return lsKeys().filter(function (k) { return k.indexOf(PREFIX) === 0; });
  }
  function ssGet(key) {
    try { return window.sessionStorage.getItem(key); } catch (e) { return null; }
  }
  function ssSet(key, val) {
    try { window.sessionStorage.setItem(key, val); } catch (e) {}
  }

  /* ---------- identity, bot gate, visit, pause, consent ---------- */

  var isHuman = false;
  try {
    isHuman = !!document.documentElement &&
      document.documentElement.getAttribute("data-botcls") === "human";
  } catch (e) { isHuman = false; }

  function getDeviceId() {
    try {
      if (window.amplitude &&
          typeof window.amplitude.getDeviceId === "function") {
        var d = window.amplitude.getDeviceId();
        if (d) return String(d);
      }
    } catch (e) {}
    return null;
  }

  function resolveNamespace() {
    var did = getDeviceId();
    if (did) return { deviceId: did, key: PREFIX + did };
    var keys = ledgerKeys();
    if (keys.length === 1) {
      var suffix = keys[0].slice(PREFIX.length);
      if (suffix) return { deviceId: suffix, key: keys[0] };
    }
    return null;
  }

  function purgeOtherNamespaces(currentKey) {
    ledgerKeys().forEach(function (k) {
      if (k !== currentKey) lsRemove(k);
    });
  }

  var visitMarkerSec = INIT_SEC;
  function initVisitMarker() {
    var raw = ssGet(VISIT_KEY);
    var n = raw ? parseInt(raw, 10) : NaN;
    if (isFinite(n) && n > 0) { visitMarkerSec = n; return; }
    visitMarkerSec = INIT_SEC;
    ssSet(VISIT_KEY, String(INIT_SEC));
  }

  function isPaused() { return !!ssGet(PAUSE_KEY); }

  function readConsent() {
    var raw = lsGet(CONSENT_KEY);
    if (!raw) return null;
    try {
      var data = JSON.parse(raw);
      if (data && (data.state === "granted" || data.state === "declined")) {
        return { state: data.state, t: data.t };
      }
    } catch (e) {}
    return null;
  }

  function writeConsentRecord(state) {
    lsSet(CONSENT_KEY, JSON.stringify({ state: state, t: nowSec() }));
  }

  function detectedEU() {
    var tz = null;
    try {
      tz = Intl.DateTimeFormat().resolvedOptions().timeZone || null;
    } catch (e) { tz = null; }
    if (tz && TZ_SET[tz]) return true;
    var generic = !tz || tz === "UTC" || tz === "GMT" ||
      tz === "Etc/UTC" || tz === "Etc/GMT" || tz === "Etc/GMT+0" ||
      tz === "Etc/GMT-0" || tz === "Etc/Universal" || tz === "Universal";
    if (!generic) return false;
    // Language fallback, only when the timezone is missing or generic.
    // A region subtag beats the base language: es-MX alone does not
    // detect; es-ES does, via its region.
    var langs = [];
    try {
      if (navigator.languages && navigator.languages.length) {
        langs = Array.prototype.slice.call(navigator.languages);
      } else if (navigator.language) { langs = [navigator.language]; }
    } catch (e) { langs = []; }
    for (var i = 0; i < langs.length; i++) {
      var parts = String(langs[i] || "").split("-");
      if (!parts[0]) continue;
      var region = null;
      for (var j = 1; j < parts.length; j++) {
        if (/^[A-Za-z]{2}$/.test(parts[j])) {
          region = parts[j].toUpperCase(); break;
        }
      }
      if (region) {
        if (REGION_SET[region]) return true;
        continue;
      }
      if (LANG_PRIMARY_SET[parts[0].toLowerCase()]) return true;
    }
    return false;
  }

  var consentRecord = null;
  var detected = false;
  var gatePending = false;

  function consentBlocked() {
    if (consentRecord) return consentRecord.state !== "granted";
    return detected;
  }

  function canUse() {
    return isHuman && !isPaused() && !consentBlocked();
  }

  // True when the head snippet's consent gate is holding
  // measurement for an answer (see the re-ask in init).
  function ampGatePending() {
    try {
      return !!(window.DCAmplitude &&
                typeof window.DCAmplitude.gate === "function" &&
                window.DCAmplitude.gate() === "pending");
    } catch (e) { return false; }
  }

  /* ---------- the manifest (validation) ---------- */

  var manifest = null;
  var manifestFailed = false;
  var manifestPromise = null;

  function fetchText(url) {
    return fetch(url).then(function (r) {
      return r && r.ok ? r.text() : null;
    });
  }
  function fetchJson(url) {
    return fetch(url).then(function (r) {
      return r && r.ok ? r.json() : null;
    });
  }

  function addBlock(m, b) {
    if (!b || !b.id || m.blocks[b.id]) return;
    var lengths = [];
    if (b.lengths && typeof b.lengths === "object") {
      lengths = Object.keys(b.lengths);
    }
    m.blocks[b.id] = {
      kind: b.kind || "", link: b.link || null,
      page: b.page || null, lengths: lengths
    };
  }

  function buildManifest(sitemapText, recordData, blocksData, sliceData) {
    var m = {
      pages: {}, pageNames: {}, pageAnchors: {},
      records: {}, recordLabels: {}, recordPages: {},
      blocks: {}, proofByPage: {}, practiceByPage: {},
      pageThemes: {}, startingSpecs: {}, slices: {}
    };
    var locRe = /<loc>([^<]+)<\/loc>/g, lm;
    while ((lm = locRe.exec(String(sitemapText || ""))) !== null) {
      var p = pathOfUrl(lm[1]);
      if (p) m.pages[p] = true;
    }
    if (recordData && Array.isArray(recordData.records)) {
      recordData.records.forEach(function (r) {
        if (!r || !r.id || r.status !== "approved") return;
        m.records[r.id] = true;
        m.recordLabels[r.id] = r.context || r.id;
        var sp = pathOfUrl(r.source);
        if (sp) m.recordPages[r.id] = sp;
      });
    }
    function absorbPayload(data) {
      if (!data) return;
      (data.blocks || []).forEach(function (b) { addBlock(m, b); });
      (data.page_anchors || []).forEach(function (b) { addBlock(m, b); });
      (data.page_blocks || []).forEach(function (b) { addBlock(m, b); });
      if (data.pages && typeof data.pages === "object") {
        Object.keys(data.pages).forEach(function (pg) {
          var e = data.pages[pg] || {};
          m.pages[pg] = true;
          if (e.page_name) m.pageNames[pg] = e.page_name;
          if (e.anchor) m.pageAnchors[pg] = e.anchor;
        });
      }
    }
    absorbPayload(blocksData);
    if (sliceData && sliceData.pages &&
        typeof sliceData.pages === "object") {
      Object.keys(sliceData.pages).forEach(function (pg) {
        var e = sliceData.pages[pg] || {};
        m.pages[pg] = true;
        if (e.page_name) m.pageNames[pg] = e.page_name;
        if (e.anchor) m.pageAnchors[pg] = e.anchor;
        if (e.starting_spec) m.startingSpecs[pg] = e.starting_spec;
        var slice = { ids: [], set: {} };
        (e.blocks || []).forEach(function (b) {
          addBlock(m, b);
          if (b && b.id && !slice.set[b.id]) {
            slice.set[b.id] = true; slice.ids.push(b.id);
          }
        });
        m.slices[pg] = slice;
      });
    }
    // Page anchors also arrive as blocks carrying their own page.
    Object.keys(m.blocks).forEach(function (id) {
      var b = m.blocks[id];
      if (b.kind === "page_anchor" && b.page) {
        if (!m.pageAnchors[b.page]) m.pageAnchors[b.page] = id;
      }
      if (b.kind === "proof" && b.link && !m.proofByPage[b.link]) {
        m.proofByPage[b.link] = id;
      }
      if (b.kind === "practice" && b.link && !m.practiceByPage[b.link]) {
        m.practiceByPage[b.link] = id;
      }
    });
    // The theme map (amendment section 2.1): each case-study
    // page's assigned concept/principle block and practice block,
    // read from its published starting spec. A page with no
    // starting spec echoes nothing; a block outside the manifest
    // can be neither an echo source nor an echo target.
    Object.keys(m.startingSpecs).forEach(function (pg) {
      var ss = m.startingSpecs[pg];
      var list = ss && Array.isArray(ss.blocks) ? ss.blocks : [];
      var c = null, p = null;
      list.forEach(function (item) {
        var id = typeof item === "string" ? item :
          (item && item.id ? item.id : null);
        if (!id || !m.blocks[id]) return;
        var kind = m.blocks[id].kind;
        if ((kind === "concept" || kind === "principle") && !c) c = id;
        if (kind === "practice" && !p) p = id;
      });
      if (c || p) m.pageThemes[pg] = { c: c, p: p };
    });
    return m;
  }

  function ready() {
    if (!isHuman) return resolvedPromise();
    if (manifest || manifestFailed) return resolvedPromise();
    if (manifestPromise) return manifestPromise;
    if (typeof fetch !== "function") {
      manifestFailed = true;
      return resolvedPromise();
    }
    try {
      manifestPromise = Promise.all([
        fetchText("/sitemap.xml"), fetchJson("/record.json"),
        fetchJson("/blocks.json"), fetchJson("/blocks-case-studies.json")
      ]).then(function (res) {
        if (!res[0] || !res[1] || !res[2] || !res[3]) {
          manifestFailed = true; manifest = null; return;
        }
        manifest = buildManifest(res[0], res[1], res[2], res[3]);
      }).catch(function () { manifestFailed = true; manifest = null; });
    } catch (e) {
      manifestFailed = true; manifestPromise = null;
      return resolvedPromise();
    }
    // Never rejects: every failure path above resolves landing-only.
    return manifestPromise.then(function () {}, function () {});
  }

  /* ---------- ledger read / validate / write ---------- */

  function emptyLedger(deviceId) {
    var t = nowSec();
    return {
      v: 1, device_id: deviceId, created_at: t, updated_at: t,
      pages: {}, records: {}, intents: {}, compositions: {},
      ask_outcomes: {}, ask_records: {}, specs: []
    };
  }

  function validForCategory(cat, key) {
    if (cat === "intents") return !!INTENT_SET[key];
    if (cat === "ask_outcomes") return !!OUTCOME_SET[key];
    if (!manifest) return true; // read-time validation drops it later
    if (cat === "pages" || cat === "compositions") return !!manifest.pages[key];
    if (cat === "records" || cat === "ask_records") return !!manifest.records[key];
    return false;
  }

  function capMap(map) {
    var keys = Object.keys(map);
    if (keys.length <= MAP_MAX) return map;
    keys.sort(function (a, b) { return (map[a].l || 0) - (map[b].l || 0); });
    while (keys.length > MAP_MAX) { delete map[keys.shift()]; }
    return map;
  }

  function cleanMap(raw, cat, cutoff, now) {
    var out = {};
    Object.keys(raw).forEach(function (key) {
      var e = raw[key];
      if (!isPlainObj(e)) return;
      if (manifest && !validForCategory(cat, key)) return;
      if (!manifest && cat === "intents" && !INTENT_SET[key]) return;
      if (!manifest && cat === "ask_outcomes" && !OUTCOME_SET[key]) return;
      var c = Math.floor(Number(e.c)), f = Math.floor(Number(e.f)),
          l = Math.floor(Number(e.l));
      if (!isFinite(c) || !isFinite(f) || !isFinite(l)) return;
      if (c < 1 || l < cutoff) return;
      if (c > COUNT_MAX) c = COUNT_MAX;
      if (l > now + DAY_SEC) l = now + DAY_SEC;
      if (f > l) f = l;
      if (f < 0) f = 0;
      out[key] = { c: c, f: f, l: l };
    });
    return capMap(out);
  }

  function cleanSpecs(raw, cutoff, now) {
    var out = [];
    raw.forEach(function (s) {
      if (!isPlainObj(s) || !Array.isArray(s.blocks)) return;
      if (s.scope !== "page" && s.scope !== "released") return;
      if (typeof s.page !== "string" || !s.page) return;
      var t = Math.floor(Number(s.t));
      if (!isFinite(t) || t < cutoff) return;
      if (t > now + DAY_SEC) t = now + DAY_SEC;
      var blocks = [];
      for (var i = 0; i < s.blocks.length; i++) {
        if (typeof s.blocks[i] !== "string" || !s.blocks[i]) return;
        blocks.push(s.blocks[i]);
      }
      if (!blocks.length) return;
      if (manifest) {
        if (!manifest.pages[s.page]) return;
        for (var j = 0; j < blocks.length; j++) {
          if (!manifest.blocks[blocks[j]]) return; // whole spec drops
        }
      }
      out.push({ blocks: blocks, page: s.page, scope: s.scope, t: t });
    });
    return out.slice(-SPECS_MAX);
  }

  // Returns the cleaned ledger, or null on structural failure (the
  // store is then discarded, per the failure discipline).
  function cleanLedger(raw, deviceId) {
    if (!isPlainObj(raw)) return null;
    if (raw.v !== 1) return null;
    if (raw.device_id !== deviceId) return null;
    var now = nowSec(), cutoff = now - WINDOW_SEC;
    var created = Math.floor(Number(raw.created_at));
    if (!isFinite(created) || created < 0) created = now;
    if (created > now + DAY_SEC) created = now + DAY_SEC;
    var updated = Math.floor(Number(raw.updated_at));
    if (!isFinite(updated) || updated < 0) updated = created;
    var led = {
      v: 1, device_id: deviceId, created_at: created,
      updated_at: updated, specs: []
    };
    for (var i = 0; i < MAP_CATEGORIES.length; i++) {
      var cat = MAP_CATEGORIES[i];
      var val = raw[cat];
      if (val == null) { led[cat] = {}; continue; }
      if (!isPlainObj(val)) return null;
      led[cat] = cleanMap(val, cat, cutoff, now);
    }
    if (raw.specs == null) { led.specs = []; }
    else if (!Array.isArray(raw.specs)) { return null; }
    else { led.specs = cleanSpecs(raw.specs, cutoff, now); }
    return led;
  }

  function pruneLedger(led) {
    var now = nowSec(), cutoff = now - WINDOW_SEC;
    MAP_CATEGORIES.forEach(function (cat) {
      var map = led[cat] || {};
      Object.keys(map).forEach(function (k) {
        if (!map[k] || map[k].l < cutoff) delete map[k];
        else if (map[k].c > COUNT_MAX) map[k].c = COUNT_MAX;
      });
      led[cat] = capMap(map);
    });
    led.specs = (led.specs || []).filter(function (s) {
      return s && s.t >= cutoff;
    }).slice(-SPECS_MAX);
    return led;
  }

  function readLedgerInternal() {
    var ns = resolveNamespace();
    if (!ns) return null;
    purgeOtherNamespaces(ns.key);
    var rawStr = lsGet(ns.key);
    if (rawStr == null) return null;
    var parsed = null;
    try { parsed = JSON.parse(rawStr); } catch (e) {
      lsRemove(ns.key); return null;
    }
    var led = cleanLedger(parsed, ns.deviceId);
    if (!led) { lsRemove(ns.key); return null; }
    try {
      var cleaned = JSON.stringify(led);
      if (cleaned !== rawStr) lsSet(ns.key, cleaned);
    } catch (e) {}
    return led;
  }

  function saveLedger(ns, led) {
    led.updated_at = nowSec();
    pruneLedger(led);
    try { lsSet(ns.key, JSON.stringify(led)); } catch (e) {}
  }

  // One read-modify-write cycle. Returns false when there is no
  // writable namespace (device ID unknown and no single fallback).
  function mutateLedger(fn) {
    var ns = resolveNamespace();
    if (!ns) return false;
    purgeOtherNamespaces(ns.key);
    var led = null;
    var rawStr = lsGet(ns.key);
    if (rawStr != null) {
      try { led = cleanLedger(JSON.parse(rawStr), ns.deviceId); }
      catch (e) { led = null; }
      if (!led) lsRemove(ns.key);
    }
    if (!led) led = emptyLedger(ns.deviceId);
    fn(led);
    saveLedger(ns, led);
    return true;
  }

  function bumpIn(led, cat, key) {
    var map = led[cat], now = nowSec();
    var e = map[key];
    if (e) {
      e.c = Math.min(COUNT_MAX, (e.c || 0) + 1);
      e.l = now;
      return;
    }
    var keys = Object.keys(map);
    if (keys.length >= MAP_MAX) {
      keys.sort(function (a, b) { return (map[a].l || 0) - (map[b].l || 0); });
      while (keys.length >= MAP_MAX) { delete map[keys.shift()]; }
    }
    map[key] = { c: 1, f: now, l: now };
  }

  // Returns true when the write landed. It returns false when
  // there is no writable namespace yet (device ID unresolved and
  // no single fallback key), which the init page-view write
  // retries on a bounded schedule; validation drops also return
  // false and simply never land.
  function bump(cat, key) {
    if (!canUse()) return false;
    if (typeof key !== "string" || !key) return false;
    if (manifest && !validForCategory(cat, key)) return false;
    if (!manifest && !validForCategory(cat, key) &&
        (cat === "intents" || cat === "ask_outcomes")) return false;
    try {
      return mutateLedger(function (led) { bumpIn(led, cat, key); });
    } catch (e) { return false; }
  }

  function freshStart(text) {
    if (typeof text !== "string") return false;
    var t = text.toLowerCase().replace(/\u2019/g, "'").trim();
    if (!t) return false;
    for (var i = 0; i < FRESH_PHRASES.length; i++) {
      if (t.indexOf(FRESH_PHRASES[i]) !== -1) return true;
    }
    return false;
  }

  // The categories the ledger reports for the conversation's
  // opening state (decommission sheet, section 6.2): the
  // categories holding at least one entry last seen before
  // this visit began, in the settled report order. No scores
  // are computed; this read feeds the stream's opening
  // receipt alone, and nothing else in the experience reads
  // the ledger.
  function historyCategories() {
    try {
      if (!canUse()) return null;
      var led = readLedgerInternal();
      if (!led) return null;
      var out = [];
      TRACE_ORDER.forEach(function (cat) {
        var entries = led[cat];
        if (!entries) return;
        var prior = false;
        if (Array.isArray(entries)) {
          prior = entries.some(function (e) {
            return e && e.t && e.t < visitMarkerSec;
          });
        } else {
          for (var key in entries) {
            if (!Object.prototype.hasOwnProperty.call(entries, key)) {
              continue;
            }
            var e = entries[key];
            if (e && e.l && e.l < visitMarkerSec) {
              prior = true;
              break;
            }
          }
        }
        if (prior) out.push(cat);
      });
      return out.length ? out : null;
    } catch (e) { return null; }
  }

  // Whether the given page was opened at any point in the
  // current visit: its pages entry's last-seen at or after
  // the visit marker. Tri-state by design: true or false
  // only when the ledger is usable and readable; null when
  // it cannot say (consent pending or declined, paused,
  // storage unreadable), so the caller treats unknown as
  // its own case rather than as "not visited". Read for the
  // scorecard promotion's suppression (build sheet v2): any
  // arrival at /scorecard/ this visit, by any path, counts.
  function pageVisitedThisVisit(path) {
    try {
      if (!canUse()) return null;
      var led = readLedgerInternal();
      if (!led) return null;
      var entries = led.pages || {};
      var e = entries[path];
      if (!e) return false;
      return !!(e.l && e.l >= visitMarkerSec);
    } catch (e) { return null; }
  }

  /* ---------- writers (public record* methods) ---------- */

  function recordIntent(intentId) {
    if (typeof intentId !== "string") return;
    var id = intentId.replace(/^intent_/, "");
    if (!INTENT_SET[id]) return;
    bump("intents", id);
  }

  function recordComposition(pageKey) {
    return bump("compositions", pageKey);
  }

  // The composition-view write races the same async Amplitude
  // SDK load as the init page-view write, but compose.js calls
  // it exactly once, at render, with no retry of its own. On
  // the first page after a ledger clear the namespace is
  // usually not resolvable yet at render time, so the write
  // was silently dropped while the page-open beside it landed
  // through its retry (the Nov 16 re-probe: a Gangverk visit
  // recorded the open but never the view, so the Reading B
  // promotion composite, open echo 0.5 + view echo 1.5 = the
  // 2.0 floor, stopped at 0.5 and nothing promoted). Retry on
  // the same bounded schedule as recordPageViewWithRetry
  // until the write lands, exactly once. A false return from
  // a validation drop simply exhausts the schedule, as with
  // the page-view write.
  function recordCompositionWithRetry(pageKey) {
    if (recordComposition(pageKey)) return;
    var tries = 0;
    var timer = setInterval(function () {
      tries++;
      var done = false;
      try { done = !canUse() || recordComposition(pageKey); }
      catch (e) { done = true; }
      if (done || tries >= 12) {
        try { clearInterval(timer); } catch (e) {}
      }
    }, 250);
  }

  function recordAskOutcome(cls) {
    if (typeof cls !== "string" || !OUTCOME_SET[cls]) return;
    bump("ask_outcomes", cls);
  }

  function recordAskRecords(recordIds) {
    try {
      if (!canUse() || !Array.isArray(recordIds)) return;
      var ids = recordIds.filter(function (id) {
        return typeof id === "string" && id &&
          (!manifest || manifest.records[id]);
      });
      if (!ids.length) return;
      mutateLedger(function (led) {
        ids.forEach(function (id) { bumpIn(led, "ask_records", id); });
      });
    } catch (e) {}
  }

  function recordRecordOpened(recordId) { bump("records", recordId); }

  function recordPageView() { return bump("pages", currentPath()); }

  // The init page-view write races the Amplitude SDK: ledger.js
  // is deferred and the SDK loads async, so at init the device ID
  // is usually not resolvable yet, and a fresh or just-cleared
  // ledger has no fallback key either; that first write was
  // silently dropped (the Nov 16 live probe lost exactly that
  // write). Retry on the same bounded schedule the Session
  // Replay loader uses (250ms, up to about 3s) until the
  // namespace resolves and the write lands, once.
  function recordPageViewWithRetry() {
    if (recordPageView()) return;
    var tries = 0;
    var timer = setInterval(function () {
      tries++;
      var done = false;
      try { done = !canUse() || recordPageView(); } catch (e) { done = true; }
      if (done || tries >= 12) {
        try { clearInterval(timer); } catch (e) {}
      }
    }, 250);
  }

  /* ---------- styling, consent gate, inspect panel ---------- */

  var styleDone = false;
  function ensureStyle() {
    if (styleDone) return;
    styleDone = true;
    try {
      var css = [
        ".dc-ledger-gate{position:fixed;left:16px;right:16px;bottom:16px;z-index:9998;max-width:720px;margin:0 auto;padding:14px 16px;border:1px solid var(--line,#ddd);border-radius:12px;background:var(--surface,#fff);color:var(--ink,#111);font-family:-apple-system,BlinkMacSystemFont,\"Segoe UI\",Roboto,Helvetica,Arial,sans-serif;font-size:14.5px;line-height:1.5;box-shadow:0 8px 30px rgba(0,0,0,.18)}",
        ".dc-ledger-gate--band{position:static;left:auto;right:auto;bottom:auto;z-index:auto;max-width:none;margin:0;padding:12px 0;border:none;border-top:1px solid var(--line,#ddd);border-bottom:1px solid var(--line,#ddd);border-radius:0;background:transparent;box-shadow:none;font-family:inherit}",
        ".dc-ledger-gate p{margin:0 0 10px}",
        ".dc-ledger-gate-actions{margin:0;display:flex;gap:8px;flex-wrap:wrap;align-items:center}",
        ".dc-ledger-btn{font:inherit;font-size:14px;padding:8px 14px;border:1px solid var(--line,#bbb);border-radius:999px;background:transparent;color:inherit;cursor:pointer}",
        ".dc-ledger-btn:hover{border-color:var(--accent,#5b7a67)}",
        ".dc-ledger-close{font:inherit;font-size:18px;line-height:1;margin-left:auto;background:none;border:none;color:inherit;cursor:pointer;padding:6px}",
        ".dc-ledger-overlay{position:fixed;inset:0;z-index:9999;background:rgba(0,0,0,.45);display:flex;align-items:center;justify-content:center;padding:16px;font-family:-apple-system,BlinkMacSystemFont,\"Segoe UI\",Roboto,Helvetica,Arial,sans-serif}",
        ".dc-ledger-panel{background:var(--surface,#fff);color:var(--ink,#111);max-width:640px;width:100%;max-height:86vh;overflow:auto;border-radius:12px;padding:20px 22px;box-sizing:border-box}",
        ".dc-ledger-panel h2{font-size:20px;margin:0 32px 8px 0;line-height:1.3}",
        ".dc-ledger-panel h3{font-size:15px;margin:18px 0 6px}",
        ".dc-ledger-panel p{font-size:14.5px;line-height:1.55;margin:0 0 10px}",
        ".dc-ledger-panel ul{list-style:none;margin:0 0 6px;padding:0}",
        ".dc-ledger-panel li{font-size:14.5px;line-height:1.5;padding:6px 0;border-bottom:1px solid var(--line,#eee)}",
        ".dc-ledger-panel .dc-ledger-meta{color:var(--muted,#777);font-size:13px}",
        ".dc-ledger-panel-head{display:flex;align-items:flex-start;justify-content:space-between}",
        ".dc-ledger-actions{display:flex;gap:8px;flex-wrap:wrap;margin:14px 0 10px}",
        ".dc-ledger-remove{font:inherit;font-size:13px;background:none;border:none;padding:0;color:var(--muted,#777);cursor:pointer;text-decoration:underline}"
      ].join("\n");
      var st = document.createElement("style");
      st.id = "dc-ledger-css";
      st.textContent = css;
      document.head.appendChild(st);
    } catch (e) {}
  }

  var gateEl = null;

  function removeGate() {
    try { if (gateEl && gateEl.parentNode) gateEl.parentNode.removeChild(gateEl); }
    catch (e) {}
    gateEl = null;
  }

  function applyConsent(state) {
    consentRecord = { state: state, t: nowSec() };
    gatePending = false;
    try { writeConsentRecord(state); } catch (e) {}
    // The same choice governs Amplitude (amplitude-consent-gate
    // build): the head snippet exposes DCAmplitude, and this answer
    // is what releases or holds it. Absent DCAmplitude (a cached
    // pre-gate snippet), behavior is exactly the pre-gate one.
    var amp = null;
    try {
      amp = (window.DCAmplitude &&
             typeof window.DCAmplitude.grant === "function") ?
        window.DCAmplitude : null;
    } catch (e) { amp = null; }
    if (state === "granted") {
      if (amp) {
        var wasHeld = false;
        try {
          wasHeld = amp.gate() !== "granted" && !amp.isReady();
        } catch (e) { wasHeld = false; }
        try { amp.grant(); } catch (e) {}
        if (wasHeld) {
          // Measurement starts with this answer, so the grant
          // event and the ledger's first page view wait for the
          // SDK to be ready: both then describe a measured visit,
          // and the page view finds the device ID it keys on.
          try {
            amp.whenReady(function () {
              track("Ledger Consent Granted", { page: eventPage() });
              if (canUse()) recordPageViewWithRetry();
            });
          } catch (e) {}
        } else {
          track("Ledger Consent Granted", { page: eventPage() });
          if (canUse()) recordPageView();
        }
      } else {
        track("Ledger Consent Granted", { page: eventPage() });
        if (canUse()) recordPageView();
      }
      removeGate();
    } else {
      // A decline fires nothing. Reporting it to the measurement
      // system would spend the very consent just withheld, so the
      // pre-gate Ledger Consent Declined event is retired: the
      // stored record is the only trace of a no. A change of mind
      // after a grant (the panel's revoke) instead opts the live
      // SDK out, which stops event sending and shuts replay down.
      if (amp) {
        try {
          if (amp.gate() === "granted" || amp.isReady()) amp.revoke();
          else amp.decline();
        } catch (e) {}
      }
      removeGate();
    }
  }

  function renderGate() {
    if (gateEl) return;
    if (!document.body) {
      try {
        document.addEventListener("DOMContentLoaded", renderGate);
      } catch (e) {}
      return;
    }
    ensureStyle();
    try {
      gateEl = document.createElement("div");
      gateEl.className = "dc-ledger-gate";
      gateEl.setAttribute("role", "region");
      gateEl.setAttribute("aria-label", "What this site remembers and measures");
      var text = document.createElement("p");
      text.textContent = GATE_COPY;
      gateEl.appendChild(text);
      var actions = document.createElement("p");
      actions.className = "dc-ledger-gate-actions";
      var yes = document.createElement("button");
      yes.type = "button"; yes.className = "dc-ledger-btn";
      yes.textContent = "Yes, keep it";
      yes.addEventListener("click", function () { applyConsent("granted"); });
      var no = document.createElement("button");
      no.type = "button"; no.className = "dc-ledger-btn";
      no.textContent = "No thanks";
      no.addEventListener("click", function () { applyConsent("declined"); });
      var dismiss = document.createElement("button");
      dismiss.type = "button"; dismiss.className = "dc-ledger-close";
      dismiss.setAttribute("aria-label", "Dismiss");
      dismiss.textContent = "\u00D7";
      dismiss.addEventListener("click", function () { applyConsent("declined"); });
      actions.appendChild(yes); actions.appendChild(no);
      actions.appendChild(dismiss);
      gateEl.appendChild(actions);
      // Surface build (A7.4): when the page carries the control
      // plane's consent mount, the gate presents as a slim band
      // inside the frame, in flow, never an overlay on the
      // canvas. Without the mount, today's fixed overlay stands.
      var cpMount = document.getElementById("cp-consent");
      if (cpMount) {
        gateEl.className = "dc-ledger-gate dc-ledger-gate--band";
        cpMount.appendChild(gateEl);
      } else {
        document.body.appendChild(gateEl);
      }
    } catch (e) { gateEl = null; }
  }

  function humanizePath(p) {
    if (!p || p === "/") return "Home page";
    var parts = String(p).replace(/^\/+|\/+$/g, "").split("/");
    var words = parts.map(function (seg) {
      var w = seg.replace(/-/g, " ");
      return w.charAt(0).toUpperCase() + w.slice(1);
    });
    return words.join(" / ");
  }

  function pageLabel(p) {
    if (manifest && manifest.pageNames[p]) return manifest.pageNames[p];
    return humanizePath(p);
  }

  function recordLabel(id) {
    if (manifest && manifest.recordLabels[id]) return manifest.recordLabels[id];
    var w = String(id).replace(/-/g, " ");
    return w.charAt(0).toUpperCase() + w.slice(1);
  }

  function relativeWords(l) {
    var diff = nowSec() - l;
    if (diff < DAY_SEC) return "today";
    var days = Math.floor(diff / DAY_SEC);
    if (days === 1) return "yesterday";
    if (days < 7) return days + " days ago";
    var weeks = Math.floor(days / 7);
    return weeks === 1 ? "1 week ago" : weeks + " weeks ago";
  }

  function builtDate(t) {
    try {
      return new Date(t * 1000).toLocaleDateString("en-US",
        { month: "short", day: "numeric" });
    } catch (e) { return ""; }
  }

  function dispatchCleared(category) {
    try {
      var ev = null;
      if (typeof CustomEvent === "function") {
        ev = new CustomEvent("dc:ledger-cleared",
          { detail: { category: category } });
      } else if (document.createEvent) {
        ev = document.createEvent("CustomEvent");
        ev.initCustomEvent("dc:ledger-cleared", true, false,
          { category: category });
      }
      if (ev) document.dispatchEvent(ev);
    } catch (e) {}
  }

  function clearAllLedgers() {
    ledgerKeys().forEach(function (k) { lsRemove(k); });
  }

  var panelOverlay = null;
  var panelSource = "colophon";

  function closePanel() {
    try {
      if (panelOverlay && panelOverlay.parentNode) {
        panelOverlay.parentNode.removeChild(panelOverlay);
      }
    } catch (e) {}
    panelOverlay = null;
  }

  function entryLabel(cat, key) {
    if (cat === "pages" || cat === "compositions") return pageLabel(key);
    if (cat === "records" || cat === "ask_records") return recordLabel(key);
    if (cat === "intents") return INTENT_LABELS[key] || key;
    if (cat === "ask_outcomes") return OUTCOME_LABELS[key] || key;
    return key;
  }

  function renderPanelContents() {
    if (!panelOverlay) return;
    var body = panelOverlay.querySelector(".dc-ledger-panel-body");
    if (!body) return;
    var led = null;
    try { led = readLedgerInternal(); } catch (e) { led = null; }
    var html = "";
    html += "<p>This ledger lives in this browser. Entries stop counting " +
      "after 90 days and are deleted on the next visit after that.</p>";
    var any = false;
    if (led) {
      PANEL_CATEGORIES.forEach(function (cfg) {
        var cat = cfg.key;
        var items = [];
        if (cat === "specs") {
          (led.specs || []).forEach(function (s, idx) {
            items.push({ spec: s, idx: idx });
          });
          items.reverse();
        } else {
          var map = led[cat] || {};
          Object.keys(map).forEach(function (k) {
            items.push({ key: k, entry: map[k] });
          });
          items.sort(function (a, b) { return b.entry.l - a.entry.l; });
        }
        if (!items.length) return;
        any = true;
        html += "<h3>" + esc(cfg.heading) + "</h3><ul>";
        items.forEach(function (it) {
          if (cat === "specs") {
            var d = builtDate(it.spec.t);
            html += "<li>A view on " + esc(pageLabel(it.spec.page)) +
              (d ? ", built " + esc(d) : "") + "</li>";
          } else {
            var count = it.entry.c === 1 ? "1 time" :
              it.entry.c + " times";
            html += "<li>" + esc(entryLabel(cat, it.key)) +
              ' <span class="dc-ledger-meta">' + esc(count) + ", " +
              esc(relativeWords(it.entry.l)) + "</span></li>";
          }
        });
        html += "</ul>";
        html += '<p><button type="button" class="dc-ledger-remove" ' +
          'data-dc-remove="' + esc(cat) + '">' + esc(cfg.removeLabel) +
          "</button></p>";
      });
    }
    if (!any) {
      html += "<p>Nothing is remembered here yet.</p>";
    }
    // A stored decline holds both the ledger and measurement off
    // wherever the visitor now is (the snippet reads the record
    // before detection), so the way back is offered whenever the
    // record exists, not only under today's detection.
    if (consentRecord && consentRecord.state === "declined") {
      html += "<p>You said no to keeping this ledger and to " +
        "measurement. Both stay off in this browser. You can change " +
        'that here. <button type="button" class="dc-ledger-btn" ' +
        'data-dc-grant="1">Yes, keep it</button></p>';
    }
    // The revoke is offered wherever a granted record exists:
    // the record, not today's detection, is what measurement
    // runs under, so the way to withdraw it cannot depend on
    // where the visitor happens to be now.
    if (consentRecord && consentRecord.state === "granted") {
      html += "<p>You said yes to keeping this ledger. Measurement, " +
        "session replay included, runs under the same choice. You " +
        'can stop both here. <button type="button" ' +
        'class="dc-ledger-btn" data-dc-revoke="1">Stop both</button></p>';
    }
    html += '<div class="dc-ledger-actions">' +
      '<button type="button" class="dc-ledger-btn" data-dc-clear="all">' +
      "Clear all</button>" +
      '<button type="button" class="dc-ledger-btn" ' +
      'data-dc-clear="not_my_history">' +
      "This isn\u2019t my history</button></div>";
    html += "<p>" + esc(HONEST_CLEAR_SENTENCE) + "</p>";
    body.innerHTML = html;
    Array.prototype.forEach.call(
      body.querySelectorAll("[data-dc-remove]"),
      function (btn) {
        btn.addEventListener("click", function () {
          var cat = btn.getAttribute("data-dc-remove");
          try {
            mutateLedger(function (l2) {
              if (cat === "specs") l2.specs = [];
              else if (l2[cat]) l2[cat] = {};
            });
          } catch (e) {}
          track("History Category Removed",
            { page: eventPage(), category: cat });
          dispatchCleared(cat);
          renderPanelContents();
        });
      });
    Array.prototype.forEach.call(
      body.querySelectorAll("[data-dc-clear]"),
      function (btn) {
        btn.addEventListener("click", function () {
          var scope = btn.getAttribute("data-dc-clear");
          clearAllLedgers();
          if (scope === "not_my_history") ssSet(PAUSE_KEY, "1");
          track("History Cleared", { page: eventPage(), scope: scope });
          dispatchCleared("all");
          renderPanelContents();
        });
      });
    Array.prototype.forEach.call(
      body.querySelectorAll("[data-dc-grant]"),
      function (btn) {
        btn.addEventListener("click", function () {
          applyConsent("granted");
          renderPanelContents();
        });
      });
    Array.prototype.forEach.call(
      body.querySelectorAll("[data-dc-revoke]"),
      function (btn) {
        btn.addEventListener("click", function () {
          applyConsent("declined");
          renderPanelContents();
        });
      });
  }

  function openPanel(source) {
    try {
      if (!isHuman) return;
      panelSource = (source === "receipt" || source === "colophon") ?
        source : "colophon";
      track("History Inspect Opened",
        { page: eventPage(), source: panelSource });
      ensureStyle();
      if (!panelOverlay) {
        panelOverlay = document.createElement("div");
        panelOverlay.className = "dc-ledger-overlay";
        panelOverlay.innerHTML =
          '<div class="dc-ledger-panel" role="dialog" aria-modal="true" ' +
          'aria-label="What this site remembers on this device">' +
          '<div class="dc-ledger-panel-head">' +
          "<h2>What this site remembers on this device</h2>" +
          '<button type="button" class="dc-ledger-close" ' +
          'data-dc-close="1" aria-label="Close">\u00D7</button></div>' +
          '<div class="dc-ledger-panel-body"></div></div>';
        document.body.appendChild(panelOverlay);
        var closeBtn = panelOverlay.querySelector("[data-dc-close]");
        if (closeBtn) {
          closeBtn.addEventListener("click", closePanel);
        }
        panelOverlay.addEventListener("click", function (ev) {
          if (ev.target === panelOverlay) closePanel();
        });
      }
      renderPanelContents();
      ready().then(function () {
        if (panelOverlay) renderPanelContents();
      });
    } catch (e) {}
  }

  /* ---------- public surface and init ---------- */

  window.DCLedger = {
    enabled: true,
    ready: ready,
    recordIntent: function (id) {
      try { recordIntent(id); } catch (e) {}
    },
    recordComposition: function (pageKey) {
      try { recordCompositionWithRetry(pageKey); } catch (e) {}
    },
    recordAskOutcome: function (cls) {
      try { recordAskOutcome(cls); } catch (e) {}
    },
    recordAskRecords: function (ids) {
      try { recordAskRecords(ids); } catch (e) {}
    },
    recordRecordOpened: function (id) {
      try { recordRecordOpened(id); } catch (e) {}
    },
    historyCategories: function () {
      try { return historyCategories(); } catch (e) { return null; }
    },
    pageVisitedThisVisit: function (path) {
      try { return pageVisitedThisVisit(path); }
      catch (e) { return null; }
    },
    freshStart: freshStart,
    categoriesLabel: categoriesLabel,
    openPanel: openPanel
  };

  try {
    if (isHuman) {
      initVisitMarker();
      detected = detectedEU();
      consentRecord = readConsent();
      document.addEventListener("click", function (ev) {
        var t = ev.target;
        while (t && t !== document) {
          if (t.getAttribute &&
              typeof t.hasAttribute === "function" &&
              t.hasAttribute("data-ledger-open")) {
            openPanel(t.getAttribute("data-ledger-open") || "colophon");
            return;
          }
          t = t.parentNode;
        }
      });
      document.addEventListener("keydown", function (ev) {
        if (panelOverlay && (ev.key === "Escape" || ev.keyCode === 27)) {
          closePanel();
        }
      });
      if (detected && !consentRecord) {
        gatePending = true;
        renderGate();
      } else {
        // A grant recorded under the pre-gate prompt covered this
        // ledger only. When the snippet's gate still reads
        // pending under a granted record, the measurement
        // question has not been answered yet, so ask it. The
        // ledger itself keeps working under the grant already
        // given; measurement waits for the fresh answer.
        if (consentRecord && consentRecord.state === "granted" &&
            ampGatePending()) {
          renderGate();
        }
        if (canUse()) recordPageViewWithRetry();
      }
    }
  } catch (e) { /* the stub discipline: the page never breaks */ }

  } catch (e) {
    try { window.DCLedger = makeStub(); } catch (e2) {}
  }
})();
