/* The Record Bar: one input for douglascirillo.com (A1.2).
   A single prominent bar at the top of every page. Keyword-style input
   searches the site on Algolia (public index: titles and fixed summaries
   only). Question-style input asks the record: the Lambda selects records,
   code assembles the answer verbatim, and it renders in place, in the bar's
   own answer region. There is no second input and no jump.
   Set ASK_ENABLED to false to remove the feature site-wide.
   Amplitude events: Ask Module Viewed, Ask Submitted, Ask Answered,
   Ask No Evidence, Ask Refused, Ask Next Click, Search Query,
   Search Result Click, Explore Focus. Every event carries the page path.
   Amplitude <> Algolia pipe: Algolia Insights events carry the visitor's
   Amplitude anonymous device ID as the user token when Amplitude is
   present (PIPE_ENABLED), so search behavior and site behavior join on one
   anonymous ID in both systems. Otherwise a session-scoped token is used.

   Engaged-UI revision (Nov 16, 2026;
   engaged-ui-revision-build-sheet.md, decisions D2, D9): the bar
   loses its label line and its privacy-note paragraph (the full
   disclosure stands in the colophon); focus no longer opens any
   panel — the "Ask my record" chips are retired and find renders
   as an overlay list anchored to the bar, carrying hits, the ask
   row, and recent searches as list rows; growInput no longer
   negotiates with the dock cap or any furniture — the textarea's
   height is a function of its own content only, and its grown
   maximum is published on the element (_qMaxH) for surface.js's
   reservation. This module serves every path, including the
   layered path when the surface layer is off: the bar stages at
   the top of main there, in the same rebuilt form.

   Suggested-search fix (Nov 16, 2026;
   suggested-search-fix-sheet.md, sections 4 and 4.3): focus on
   the empty input opens the overlay with the current page's
   registered starters as suggestion rows (read from the
   surface's model at open time, never cached here), recents
   beneath; typing runs the Algolia composition — from the
   match floor (2 characters) the panel carries the index's
   ranked matches in its own order with the ask row at the
   foot, and the hand-rolled find triage is gone (no question
   gate on what the panel may show, no locally computed
   ranking filter, no first-hit Enter fall-through). A failed
   search renders the ask row alone, never the no-results
   line; a response for the still-current query renders
   whenever it arrives, bounded only by a 10-second
   connection-hygiene abort. isQuestion survives only inside
   the layered path's submit triage. */
(function () {
  var ASK_ENABLED = true;
  var PIPE_ENABLED = true;
  var BRIDGES_ENABLED = true; /* E3: pre-generated, checked list introductions (related writing only) */
  var _bridgesPromise = null;
  function fetchBridges() {
    if (!_bridgesPromise) {
      _bridgesPromise = fetch("/bridges.json", { credentials: "omit" }).then(function (r) { return r.ok ? r.json() : null; }).catch(function () { return null; });
    }
    return _bridgesPromise;
  }
  var ASK_ENDPOINT = "https://7i3yr1dzge.execute-api.us-east-1.amazonaws.com/ask";
  var ALGOLIA_APP = "AL1TQKLUI7";
  var ALGOLIA_SEARCH_KEY = "63308c453ec399e4360c003851faa733";
  var ALGOLIA_INDEX = "site_public";
  if (!ASK_ENABLED) return;

  var LINKEDIN = "https://www.linkedin.com/in/douglascirillo/";
  /* Outbound rule (Douglas, Nov 15): external links open in a new tab;
     internal links stay in the same tab. Call after setting a.href.
     External anchors also carry a visually hidden "(opens in new tab)"
     hint so the new tab is announced (Audit #3, D2). */
  function extAttrs(a) {
    if (a && a.hostname && a.hostname !== "douglascirillo.com") {
      a.target = "_blank"; a.rel = "noopener";
      var hint = document.createElement("span");
      hint.className = "visually-hidden";
      hint.textContent = "(opens in new tab)";
      a.appendChild(hint);
    }
  }
  var CONVO = { label: "Start a conversation on LinkedIn", href: LINKEDIN };
  var DEFAULT_CTX = {
    placeholder: "Ask about a role, a result, a method\u2026",
    chips: ["What does Douglas do now?", "What is a CDP, in his framing?", "What were the results at Sotheby\u2019s?"],
    cta: CONVO
  };
  var CONTEXTS = {
    "/": {
      placeholder: "Ask about a role, a result, a method\u2026",
      chips: ["What does Douglas do now?", "How did he grow organic traffic at Sotheby\u2019s?", "What is a CDP, in his framing?"],
      cta: CONVO
    },
    "/case-studies/": DEFAULT_CTX,
    "/case-studies/sothebys/": {
      placeholder: "Ask about Sotheby\u2019s\u2026",
      chips: ["What did the CDP contribute to the growth?", "How much did organic traffic grow?", "What was Alpine?"],
      cta: CONVO
    },
    "/case-studies/lindblad-expeditions/": {
      placeholder: "Ask about Lindblad\u2026",
      chips: ["How much did bookings grow?", "What did the funnel improvement look like?", "What did he lead there?"],
      cta: CONVO
    },
    "/case-studies/madison-square-garden/": {
      placeholder: "Ask about Madison Square Garden\u2026",
      chips: ["How many websites did he run?", "What happened to digital ticket sales?", "What was MSG Go recognized for?"],
      cta: CONVO
    },
    "/case-studies/a-place-for-mom/": {
      placeholder: "Ask about A Place for Mom\u2026",
      chips: ["What was wrong with the site?", "How did search market share change?", "How big was the team he built?"],
      cta: CONVO
    },
    "/case-studies/ae-networks/": {
      placeholder: "Ask about A+E Networks\u2026",
      chips: ["What did he build at A+E?", "What standard did he set for A+E\u2019s web presence?"],
      cta: CONVO
    },
    "/case-studies/gangverk/": {
      placeholder: "Ask about Gangverk\u2026",
      chips: ["How many client brands did he grow?", "What was his commercial role there?"],
      cta: CONVO
    },
    "/practice/": DEFAULT_CTX,
    "/practice/composable-martech-and-customer-data/": {
      placeholder: "Ask about composable martech\u2026",
      chips: ["What is a CDP, in his framing?", "Where has he built CDPs?", "What is the difference between Conductor and Algolia?"],
      cta: CONVO
    },
    "/practice/digital-experience-strategy/": {
      placeholder: "Ask about digital experience strategy\u2026",
      chips: ["What does Douglas do now?", "How much did bookings grow at Lindblad?", "How did organic traffic grow at Sotheby\u2019s?"],
      cta: CONVO
    },
    "/practice/experimentation-and-measurement/": {
      placeholder: "Ask about experimentation\u2026",
      chips: ["How did he improve the Lindblad booking funnel?", "What happened to search CTR at Sotheby\u2019s?", "What was the A Place for Mom diagnosis?"],
      cta: CONVO
    },
    "/practice/ai-readiness-and-answer-discoverability/": {
      placeholder: "Ask about answer discoverability\u2026",
      chips: ["How did search market share change at A Place for Mom?", "What is the difference between Conductor and Algolia?", "How did organic traffic grow at Sotheby\u2019s?"],
      cta: CONVO
    },
    "/speaking/": {
      placeholder: "Ask about Douglas\u2019s talks\u2026",
      chips: ["What does Douglas speak about?", "What was the Synapse talk about?"],
      cta: { label: "Talk about a speaking engagement on LinkedIn", href: LINKEDIN }
    },
    "/scorecard/": {
      placeholder: "Ask about the record behind the score\u2026",
      chips: ["What is a CDP, in his framing?", "How did he grow organic traffic at Sotheby\u2019s?", "What are the harness checks?"],
      cta: { label: "Work through the practice areas", href: "/practice/" }
    },
    "/writing/": {
      placeholder: "Ask my record anything\u2026",
      chips: ["What does Douglas do now?", "What is a CDP, in his framing?", "What were the results at Sotheby\u2019s?"],
      cta: null
    },
    "/writing/what-a-customer-data-platform-actually-is/": {
      placeholder: "Ask about CDPs\u2026",
      chips: ["What is a CDP, in his framing?", "What CDP experience does he have?", "What was the CDP approach at Lindblad?"],
      cta: null
    },
    "/writing/own-your-harness/": {
      placeholder: "Ask about owning your harness\u2026",
      chips: ["What are the harness checks?", "What does Douglas do now?", "What is the approval rule for publishing?"],
      cta: null
    },
    "/writing/data-first-ai-second/": {
      placeholder: "Ask about data first, AI second\u2026",
      chips: ["How did he grow organic traffic at Sotheby\u2019s?", "What is a CDP, in his framing?", "What were the results at Sotheby\u2019s?"],
      cta: null
    },
    "/writing/the-hardest-part-of-strategy-is-letting-go/": {
      placeholder: "Ask about strategy and letting go\u2026",
      chips: ["What does Douglas do now?", "What were the results at Lindblad?", "How did he grow organic traffic at Sotheby\u2019s?"],
      cta: null
    },
    "/writing/seo-is-just-ux-done-right/": {
      placeholder: "Ask about search and UX\u2026",
      chips: ["What was the A Place for Mom diagnosis?", "How did search market share change at A Place for Mom?", "How did he grow organic traffic at Sotheby\u2019s?"],
      cta: null
    },
    "/writing/what-customer-centric-actually-means/": {
      placeholder: "Ask about customer-centric work\u2026",
      chips: ["What does Douglas do now?", "What were the results at Lindblad?", "What were the results at Sotheby\u2019s?"],
      cta: null
    },
    "/writing/marketing-vs-selling/": {
      placeholder: "Ask about marketing and leadership\u2026",
      chips: ["What does Douglas do now?", "What were the results at Lindblad?", "What were the results at Sotheby\u2019s?"],
      cta: null
    },
    "/writing/the-long-road-back/": {
      placeholder: "Ask my record anything\u2026",
      chips: ["What does Douglas do now?", "What were the results at Sotheby\u2019s?", "What is a CDP, in his framing?"],
      cta: null
    },
    "/writing/the-ac-ledger/": {
      placeholder: "Ask my record anything\u2026",
      chips: ["What does Douglas do now?", "What were the results at Sotheby\u2019s?", "What is a CDP, in his framing?"],
      cta: null
    },
    "/writing/composable-is-a-culture-not-just-a-stack/": {
      placeholder: "Ask about composable culture\u2026",
      chips: ["What is a CDP, in his framing?", "What CDP experience does he have?", "What was the CDP approach at Lindblad?"],
      cta: null
    },
    "/writing/build-it-with-them-not-for-them/": {
      placeholder: "Ask about building with people\u2026",
      chips: ["What does Douglas do now?", "What were the results at Lindblad?", "How did he grow organic traffic at Sotheby\u2019s?"],
      cta: null
    },
    "/writing/remote-work-is-isolating/": {
      placeholder: "Ask my record anything\u2026",
      chips: ["What does Douglas do now?", "What were the results at Sotheby\u2019s?", "What is a CDP, in his framing?"],
      cta: null
    },
    "/writing/prioritization-is-about-saying-no/": {
      placeholder: "Ask about prioritization\u2026",
      chips: ["What does Douglas do now?", "What were the results at Sotheby\u2019s?", "What were the results at Lindblad?"],
      cta: null
    },
    "/writing/alignment-isnt-a-meeting-its-a-system/": {
      placeholder: "Ask about alignment\u2026",
      chips: ["What does Douglas do now?", "How did he grow organic traffic at Sotheby\u2019s?", "What were the results at Lindblad?"],
      cta: null
    },
    "/record/": {
      placeholder: "Ask my record anything\u2026",
      chips: ["What does Douglas do now?", "What is a CDP, in his framing?", "What were the results at Sotheby\u2019s?"],
      cta: null
    },
    "/record/organic-search-decline/": {
      placeholder: "Ask about this diagnosis\u2026",
      chips: ["What was the A Place for Mom diagnosis?", "How did search market share change at A Place for Mom?", "How did he grow organic traffic at Sotheby\u2019s?"],
      cta: null
    },
    "/colophon/": {
      placeholder: "Ask about how this site runs\u2026",
      chips: ["What are the harness checks?", "What is the approval rule for publishing?"],
      cta: null
    }
  };
  var page = window.location.pathname;
  if (page.charAt(page.length - 1) !== "/") page += "/";
  var ctx = CONTEXTS[page] || DEFAULT_CTX;

  var css = [
    ".explore{position:relative;margin:26px 0 4px;padding:18px 18px 12px;border:1px solid var(--line);border-radius:12px}",
    ".explore textarea{font:inherit;font-size:16px;width:100%;box-sizing:border-box;padding:11px 16px;border:1px solid var(--line);border-radius:999px;background:transparent;color:var(--ink);resize:none;display:block}",
    ".explore textarea:focus{outline:none;border-color:var(--accent)}",
    ".explore textarea.explore-q-grown{border-radius:14px}",
    ".explore .explore-panel{position:absolute;left:0;right:0;top:calc(100% + 6px);z-index:70;background:var(--bg);border:1px solid var(--line);border-radius:12px;padding:10px 12px;box-shadow:0 12px 32px rgba(0,0,0,.16);max-height:46vh;overflow-y:auto}",
    ".explore .explore-hit{display:block;padding:10px 14px;border:1px solid var(--line);border-radius:10px;margin:0 0 8px;text-decoration:none;color:var(--ink)}",
    ".explore .explore-hit:hover,.explore .explore-hit.active{border-color:var(--accent)}",
    ".explore .explore-hit .t{display:block;font-size:11.5px;text-transform:uppercase;letter-spacing:.07em;color:var(--muted);margin:0 0 2px}",
    ".explore .explore-hit .ti{display:block;font-size:16px;font-weight:600;margin:0 0 2px}",
    ".explore .explore-hit .sm{display:block;font-size:14px;color:var(--ink-2);line-height:1.45}",
    ".explore .explore-askrow{display:block;width:100%;text-align:left;font:inherit;font-size:15px;padding:10px 14px;border:1px solid var(--accent);border-radius:10px;background:transparent;color:var(--ink);cursor:pointer;margin:0 0 8px}",
    ".explore .explore-askrow.active{background:var(--accent-light)}",
    ".explore .explore-recent{display:block;width:100%;text-align:left;font:inherit;font-size:15px;padding:10px 14px;border:1px solid var(--line);border-radius:10px;background:transparent;color:var(--ink);cursor:pointer;margin:0 0 8px}",
    ".explore .explore-recent:hover,.explore .explore-recent.active{border-color:var(--accent)}",
    ".explore .explore-starter{display:block;width:100%;text-align:left;font:inherit;font-size:15px;padding:10px 14px;border:1px solid var(--line);border-radius:10px;background:transparent;color:var(--ink);cursor:pointer;margin:0 0 8px}",
    ".explore .explore-starter:hover,.explore .explore-starter.active{border-color:var(--accent)}",
    ".explore .explore-none{font-size:14.5px;color:var(--muted);margin:2px 0 10px}",
    ".explore .explore-head{font-size:11.5px;text-transform:uppercase;letter-spacing:.07em;color:var(--muted);margin:4px 0 6px}",
    ".explore .explore-answer{margin-top:14px}",
    ".explore .ask-prose{font-size:15.5px;line-height:1.55;margin:0 0 4px}.ask-gen-tag{font-size:12px;color:var(--muted,#777);margin:0 0 10px}.ask-item{padding:14px 18px;border:1px solid var(--line);border-radius:10px;margin:0 0 10px}",
    ".explore .ask-item p{margin:0 0 6px;font-size:16.5px;line-height:1.55}",
    ".explore .ask-item a{font-size:14px}",
    ".explore .ask-msg{font-size:16.5px;line-height:1.55}",
    ".explore .ask-next{margin-top:6px;font-size:15px}"
  ].join("\n");
  var style = document.createElement("style");
  style.textContent = css;
  document.head.appendChild(style);

  function track(n, p) {
    if (window.amplitude && typeof window.amplitude.track === "function") {
      try { window.amplitude.track(n, p || {}); } catch (e) {}
    }
  }

  /* ---------- Increment 3: ledger writes from Ask ----------
     The Ask payload carries items as {claim, source} with no
     record ID, so ask_records and records are populated by
     matching each item, client-side, against the approved
     records in the public /record.json: claims serve verbatim,
     so an exact {claim, source} match is deterministic. The
     registry is fetched lazily, once per page lifetime, on the
     first answer render; it is cached as a promise, bounded by
     a 3-second timeout, never retried, and the answer render
     never waits on it. Unmatched or ambiguous items are skipped
     and a failed fetch records nothing. Every DCLedger call is
     guarded: a missing or inert ledger changes nothing. */
  var _registryPromise = null;
  var _registryMap = null;

  function ledgerAskOutcome(cls) {
    try {
      if (window.DCLedger && window.DCLedger.enabled &&
          typeof window.DCLedger.recordAskOutcome === "function") {
        window.DCLedger.recordAskOutcome(cls);
      }
    } catch (e) { /* the ledger never breaks the page */ }
  }

  function ensureRegistry() {
    if (_registryPromise) return _registryPromise;
    var fetchPromise;
    try {
      var fetchOpts = { credentials: "omit" };
      try {
        if (typeof AbortController !== "undefined") {
          var controller = new AbortController();
          fetchOpts.signal = controller.signal;
          setTimeout(function () {
            try { controller.abort(); } catch (e) {}
          }, 3000);
        }
      } catch (e) { /* timeout race below still bounds the wait */ }
      fetchPromise = fetch("/record.json", fetchOpts)
        .then(function (r) { return r.ok ? r.json() : null; })
        .catch(function () { return null; });
    } catch (e) {
      fetchPromise = Promise.resolve(null);
    }
    var timeoutPromise = new Promise(function (resolve) {
      setTimeout(function () { resolve(null); }, 3000);
    });
    _registryPromise = Promise.race([fetchPromise, timeoutPromise])
      .then(function (data) {
        if (!data || !data.records || !data.records.length) return null;
        var map = {};
        var ambiguous = {};
        var anchors = {};
        data.records.forEach(function (rec) {
          if (!rec || rec.status !== "approved" || !rec.id ||
              typeof rec.claim !== "string" ||
              typeof rec.source !== "string") return;
          var key = rec.claim + "\n" + rec.source;
          if (Object.prototype.hasOwnProperty.call(map, key) &&
              map[key] !== rec.id) {
            ambiguous[key] = true;
          } else {
            map[key] = rec.id;
          }
          /* Fix batch (Nov 16, 2026): the record's section
             anchor rides the same registry, so a context
             link can carry its fragment. Restricted records
             resolve through the same match below when the
             endpoint serves them: their ids are absent here
             (status filter), so their links keep the bare
             source — the pre-fix behavior. */
          if (typeof rec.anchor === "string" && rec.anchor) {
            anchors[rec.id] = rec.anchor;
          }
        });
        Object.keys(ambiguous).forEach(function (key) {
          delete map[key];
        });
        _registryMap = { map: map, ambiguous: ambiguous,
          anchors: anchors };
        return _registryMap;
      })
      .catch(function () { return null; });
    return _registryPromise;
  }

  function registryIdForItem(it) {
    if (!_registryMap || !it || typeof it.claim !== "string" ||
        typeof it.source !== "string") return null;
    var key = it.claim + "\n" + it.source;
    if (_registryMap.ambiguous[key]) return null;
    return _registryMap.map[key] || null;
  }

  function registryAnchorForItem(it) {
    var id = registryIdForItem(it);
    if (!id || !_registryMap || !_registryMap.anchors) return null;
    return _registryMap.anchors[id] || null;
  }

  /* A context navigation leaves any standing conversation
     (fix batch, Nov 16, 2026): the stream's store is
     compose.js's, but the exit write is the same one the
     Exit control makes — the visit's turns are kept, the
     presentation ends, and the arrival renders the
     published page. On this layered path no stream stands;
     the write is a no-op then. Guarded like every other
     cross-layer touch in this file. */
  function markStreamExitedForContext() {
    try {
      var raw = window.sessionStorage.getItem("dc_stream_v1");
      if (!raw) return;
      var store = JSON.parse(raw);
      if (store && store.engaged && !store.exited) {
        store.exited = true;
        window.sessionStorage.setItem("dc_stream_v1",
          JSON.stringify(store));
      }
    } catch (e) { /* a failed write changes nothing */ }
  }

  function ledgerAskRecords(items) {
    try {
      if (!(window.DCLedger && window.DCLedger.enabled) ||
          !items || !items.length) return;
    } catch (e) { return; }
    ensureRegistry().then(function (reg) {
      try {
        if (!reg) return;
        if (!(window.DCLedger && window.DCLedger.enabled &&
              typeof window.DCLedger.recordAskRecords === "function")) {
          return;
        }
        var ids = [];
        items.forEach(function (it) {
          var id = registryIdForItem(it);
          if (id) ids.push(id);
        });
        if (ids.length) window.DCLedger.recordAskRecords(ids);
      } catch (e) { /* the ledger never breaks the page */ }
    });
  }

  function ledgerRecordOpened(it) {
    try {
      if (!(window.DCLedger && window.DCLedger.enabled &&
            typeof window.DCLedger.recordRecordOpened === "function")) {
        return;
      }
      // The click write uses only the match map the answer render
      // already built; it never triggers a fetch of its own.
      if (!_registryMap) return;
      var id = registryIdForItem(it);
      if (id) window.DCLedger.recordRecordOpened(id);
    } catch (e) { /* the ledger never breaks the page */ }
  }

  /* ---------- the bar ---------- */
  var main = document.querySelector("main");
  if (!main) return;
  var bar = document.createElement("div");
  bar.className = "explore";
  bar.id = "ask-h";
  /* Engaged-UI revision (sheet section 6, strings 1 and 2):
     the label line and the privacy note leave the DOM on
     every path; the placeholder and the dock's aria-label
     carry the invitation, and the colophon carries the full
     disclosure. */
  bar.innerHTML =
    "<textarea id=\"explore-q\" rows=\"1\" maxlength=\"300\" autocomplete=\"off\" enterkeyhint=\"send\" aria-label=\"Search the record or ask a question\"></textarea>" +
    "<div class=\"explore-panel\" id=\"explore-panel\" hidden></div>" +
    "<div class=\"explore-answer\" id=\"explore-answer\" hidden></div>";
  /* Docked-composer batch (sheet section 2): surface.js runs
     first and builds the dock, so when a dock exists the bar is
     born inside #cp-composer in the dock. When none does (the
     surface layer off, bot-gated, or failed), the bar stages at
     the top of main — the layered path runs through this same
     rebuilt bar (engaged-UI revision, F8 resolution). */
  var dockMount = document.getElementById("cp-composer");
  if (dockMount && document.getElementById("cp-dock")) {
    dockMount.appendChild(bar);
  } else {
    main.insertBefore(bar, main.firstChild);
  }
  var ein = document.getElementById("explore-q");
  ein.setAttribute("placeholder", ctx.placeholder);

  /* Auto-grow (docked-composer batch, sheet section 5;
     re-scoped by the engaged-UI revision, sections 3.2 and
     3.4, ruling F7): the composer is a textarea. While the
     surface layer is active it grows from its one-line rest
     height to the content's height, capped at five lines,
     past which it scrolls internally. On the layered path it
     holds one line and overflow scrolls internally. The
     height is a function of the textarea's own content only:
     the cap-minus-furniture measurement is deleted — there
     is nothing left to negotiate with, the find panel being
     an overlay and the dock cap constraining the session
     band alone. Measurement publishes the grown maximum on
     the element (_qMaxH) once, at boot, so surface.js's
     reservation counts the input lane at its maximum from
     the first frame. Growth is measured once (rest height,
     line height, border) and is pure progressive
     enhancement: any failure leaves a working one-line
     input. */
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
        try { ein._qMaxH = restHeight + lineHeight * 4; }
        catch (e) { /* the reservation falls back to actuals */ }
      }
    } catch (e) { /* ungrown is fine */ }
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
      ein.style.overflowY = (sh + borderH) > max ? "auto" : "hidden";
      /* The pill radius (999px) belongs to the one-line rest
         state: on a grown box its curve eats half the box
         height at each end and clips the first and last lines
         at the left edge. A grown textarea takes a plain
         radius instead (the explore-q-grown style rule). */
      ein.classList.toggle("explore-q-grown", target > restHeight + 1);
    } catch (e) { /* the input still works ungrown */ }
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
    var io = new IntersectionObserver(function (entries) {
      entries.forEach(function (en) {
        if (en.isIntersecting && !viewed) { viewed = true; track("Ask Module Viewed", { page: page }); io.disconnect(); }
      });
    }, { threshold: 0.4 });
    io.observe(bar);
  }

  /* ---------- Amplitude <> Algolia pipe ---------- */
  var sessionToken = null;
  try {
    sessionToken = window.sessionStorage.getItem("dc_anon_token");
    if (!sessionToken) {
      sessionToken = "anon-" + Math.random().toString(36).slice(2) + Date.now().toString(36);
      window.sessionStorage.setItem("dc_anon_token", sessionToken);
    }
  } catch (e) { sessionToken = "anon-ephemeral"; }
  function pipeToken() {
    if (PIPE_ENABLED) {
      try {
        if (window.amplitude && typeof window.amplitude.getDeviceId === "function") {
          var d = window.amplitude.getDeviceId();
          if (d) return d;
        }
      } catch (e) {}
    }
    return sessionToken;
  }
  var aaClient = null, aaTried = false;
  function insights() {
    if (aaTried) return aaClient;
    aaTried = true;
    var lib = window.AlgoliaAnalytics;
    var aa = lib && (lib.default || lib);
    if (typeof aa !== "function") {
      var sc = document.createElement("script");
      sc.src = "https://cdn.jsdelivr.net/npm/search-insights@2/dist/search-insights.min.js";
      sc.async = true;
      sc.onload = function () {
        var l2 = window.AlgoliaAnalytics;
        var a2 = l2 && (l2.default || l2);
        if (typeof a2 === "function") {
          try { a2("init", { appId: ALGOLIA_APP, apiKey: ALGOLIA_SEARCH_KEY }); a2("setUserToken", pipeToken()); aaClient = a2; } catch (e) {}
        }
      };
      document.head.appendChild(sc);
      return null;
    }
    try { aa("init", { appId: ALGOLIA_APP, apiKey: ALGOLIA_SEARCH_KEY }); aa("setUserToken", pipeToken()); aaClient = aa; } catch (e) { aaClient = null; }
    return aaClient;
  }

  /* ---------- Ask: answers render in place ---------- */
  function nextStep() {
    if (!ctx.cta) return null;
    var p = document.createElement("p");
    p.className = "ask-next";
    var a = document.createElement("a");
    a.href = ctx.cta.href;
    a.textContent = ctx.cta.label;
    extAttrs(a);
    a.addEventListener("click", function () { track("Ask Next Click", { page: page, kind: "cta" }); });
    p.appendChild(a);
    return p;
  }
  function ask(q, via) {
    track("Ask Submitted", { page: page, via: via });
    panel.hidden = true;
    answerBox.hidden = false;
    answerBox.innerHTML = "<p class=\"ask-msg\">Checking the record\u2026</p>";
    fetch(ASK_ENDPOINT, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ question: q, page: page })
    })
      .then(function (r) { return r.json(); })
      .then(function (data) {
        answerBox.innerHTML = "";
        if (data.type === "answer" && data.items && data.items.length) {
          track("Ask Answered", { page: page, records: data.items.length, generated: !!data.generated });
          ledgerAskOutcome(data.generated ? "answer_prose" : "answer");
          ledgerAskRecords(data.items);
          if (data.generated && data.prose) {
            var lead = document.createElement("p");
            lead.className = "ask-prose";
            lead.textContent = data.prose;
            answerBox.appendChild(lead);
            var tag = document.createElement("p");
            tag.className = "ask-gen-tag";
            tag.textContent = "Framing written by AI. The claims below are quoted word for word from the record.";
            answerBox.appendChild(tag);
          }
          data.items.forEach(function (it) {
            var div = document.createElement("div");
            div.className = "ask-item";
            var p = document.createElement("p"); p.textContent = it.claim;
            var a = document.createElement("a"); a.href = it.source; a.textContent = "Read it in context"; extAttrs(a);
            a.addEventListener("click", function () { track("Ask Next Click", { page: page, kind: "source" }); ledgerRecordOpened(it); markStreamExitedForContext(); });
            /* The fragment lands when the registry resolves;
               the render never waits on it (the same bargain
               as the ledger writes above). */
            ensureRegistry().then(function () {
              var an = registryAnchorForItem(it);
              if (an && a.href.indexOf("#") === -1) {
                a.href = it.source + "#" + an;
              }
            });
            div.appendChild(p); div.appendChild(a);
            answerBox.appendChild(div);
          });
          var ns = nextStep(); if (ns) answerBox.appendChild(ns);
        } else if (data.type === "refusal") {
          track("Ask Refused", { page: page });
          ledgerAskOutcome("refuse");
          var p1 = document.createElement("p"); p1.className = "ask-msg"; p1.textContent = data.text;
          answerBox.appendChild(p1);
        } else {
          track("Ask No Evidence", { page: page });
          ledgerAskOutcome("none");
          var p2 = document.createElement("p"); p2.className = "ask-msg"; p2.textContent = data.text || "";
          answerBox.appendChild(p2);
          if (data.link) {
            var a2 = document.createElement("a");
            a2.href = data.link; a2.textContent = "Browse the case studies"; extAttrs(a2);
            a2.addEventListener("click", function () { track("Ask Next Click", { page: page, kind: "hub" }); });
            answerBox.appendChild(a2);
          }
          if (data.type === "none") maybeClassify(q);
        }
      })
      .catch(function () {
        answerBox.innerHTML = "<p class=\"ask-msg\">The record is not answering right now. The case studies are the fastest way through it.</p>";
      });
  }

  /* Unified input (home only): when the record has no direct answer,
     the same text is offered to the composition classifier. The offer
     happens only where the composition mount point exists (the home
     page); compose.js listens for the event there. Answers and refusals
     never reach this point, and every other page behaves exactly as
     before. */
  function maybeClassify(q) {
    if (!document.getElementById("composition")) return;
    document.dispatchEvent(new CustomEvent("dc:problem", { detail: { text: q } }));
  }

  /* ---------- Search ---------- */
  var QWORDS = ["what", "how", "who", "when", "where", "why", "did", "does", "do", "is", "was", "were", "can", "could", "would", "should", "has", "have"];
  function isQuestion(q) {
    var t = (q || "").trim();
    if (!t) return false;
    if (t.charAt(t.length - 1) === "?") return true;
    var words = t.split(/\s+/);
    if (words.length >= 6) return true;
    return QWORDS.indexOf(words[0].toLowerCase().replace(/[^a-z]/g, "")) >= 0;
  }
  function getRecents() {
    try { return JSON.parse(window.localStorage.getItem("dc-recent-searches") || "[]"); } catch (e) { return []; }
  }
  function saveRecent(q) {
    try {
      var r = getRecents().filter(function (x) { return x !== q; });
      r.unshift(q);
      window.localStorage.setItem("dc-recent-searches", JSON.stringify(r.slice(0, 4)));
    } catch (e) {}
  }

  var activeIdx = -1;
  function panelItems() { return panel.querySelectorAll(".explore-hit, .explore-askrow, .explore-recent, .explore-starter"); }
  function setActive(i) {
    var items = panelItems();
    items.forEach(function (el) { el.classList.remove("active"); });
    activeIdx = i;
    if (i >= 0 && items[i]) items[i].classList.add("active");
  }
  function headRow(text) {
    var h = document.createElement("p");
    h.className = "explore-head"; h.textContent = text;
    return h;
  }
  /* Find overlay (engaged-UI revision, section 4; reshaped by
     the suggested-search fix, sections 4 and 4.3): the panel is
     an overlay anchored to the dock, outside every layout
     stack; it opens and closes without moving anything. Its
     contents compose from three sources: the current page's
     registered starters (rows, from the surface's model), the
     visitor's recent searches (rows, local), and Algolia's
     ranked record matches as the visitor types. */
  function clearTransientStatus() {
    try {
      if (window.DCSurface && window.DCSurface.clearTransientStatus) {
        window.DCSurface.clearTransientStatus();
      }
    } catch (e) { /* the node is the surface's; absence is fine */ }
  }
  function recentRow(r) {
    var b = document.createElement("button");
    b.type = "button"; b.className = "explore-recent"; b.textContent = r;
    b.addEventListener("click", function () {
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
    recents.forEach(function (r) { panel.appendChild(recentRow(r)); });
  }
  function showRecents() {
    if (!getRecents().length) { panel.hidden = true; return; }
    panel.innerHTML = "";
    appendRecents();
    panel.hidden = false;
    setActive(-1);
  }
  /* The starter rows: the model is compose.js's registration
     (starters.json under the ST8 gate), read at open time and
     never cached here, so a mid-visit swap is always current.
     A row tap is the lane tap this replaces: the panel hides,
     the input resets as a submit resets it, and the model's
     onTap — streamStarterTap — runs the engagement path.
     Rows render ONLY from this model; a search hit is never
     rendered as, or substituted for, one. */
  function startersModelNow() {
    try {
      if (window.DCSurface && window.DCSurface.active &&
          typeof window.DCSurface.currentStarters === "function") {
        var m = window.DCSurface.currentStarters();
        if (m && m.starters && m.starters.length) return m;
      }
    } catch (e) { /* no model: no starter rows */ }
    return null;
  }
  function appendStarters(model) {
    panel.appendChild(headRow("Ask my record"));
    model.starters.forEach(function (s) {
      var b = document.createElement("button");
      b.type = "button"; b.className = "explore-starter";
      b.textContent = s.text;
      b.addEventListener("click", function () {
        panel.hidden = true;
        ein.value = "";
        resetInputHeight();
        if (model.onTap) model.onTap(s);
      });
      panel.appendChild(b);
    });
  }
  /* The empty state (focus, or cleared back to empty): the
     starter section, then the recents beneath — both local;
     no network request fires on focus, ever. With no set
     current the panel does not open: recents do not open it
     on their own. Opening the overlay clears the transient
     status (fix section 6). */
  function showEmptyState() {
    var model = startersModelNow();
    if (!model) { panel.hidden = true; return; }
    panel.innerHTML = "";
    appendStarters(model);
    appendRecents();
    panel.hidden = false;
    setActive(-1);
    clearTransientStatus();
  }
  function appendAskSection(q) {
    /* The heading survives the chips' retirement (sheet
       section 6, strings 4-6; flag F3). */
    panel.appendChild(headRow("Ask my record"));
    var row = document.createElement("button");
    row.type = "button"; row.className = "explore-askrow";
    row.textContent = "Ask my record: \u201C" + q + "\u201D";
    row.addEventListener("click", function () {
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
  /* The typing composition (fix sheet section 4.3): the local
     ask row renders immediately; Algolia's matches join it
     when the response lands, in the response's own order —
     no client code computes ranking inputs. A response for a
     superseded query is discarded (sequence guard, on top of
     the shipped value guard); one for the still-current query
     renders whenever it arrives — the only threshold is a
     10,000ms connection-hygiene abort. Failure renders the
     ask row alone, never the no-results line, which renders
     only on a successful zero-hit response. The submit path
     never touches Algolia, so engagement cannot be blocked
     by search being down. */
  function composeTyping(q) {
    showAskRow(q);
    runSearch(q);
  }
  function runSearch(q) {
    var seq = ++searchSeq;
    var fetchOpts = {
      method: "POST",
      headers: { "content-type": "application/json", "X-Algolia-API-Key": ALGOLIA_SEARCH_KEY, "X-Algolia-Application-Id": ALGOLIA_APP },
      body: JSON.stringify({ query: q, hitsPerPage: 6, attributesToHighlight: [], clickAnalytics: true })
    };
    try {
      if (typeof AbortController !== "undefined") {
        var controller = new AbortController();
        fetchOpts.signal = controller.signal;
        setTimeout(function () {
          try { controller.abort(); } catch (e) {}
        }, 10000);
      }
    } catch (e) { /* no abort available; the guards still hold */ }
    fetch("https://" + ALGOLIA_APP + "-dsn.algolia.net/1/indexes/" + ALGOLIA_INDEX + "/query", fetchOpts)
      .then(function (r) { return r.json(); })
      .then(function (data) {
        if (seq !== searchSeq) return;
        if (ein.value.trim() !== q) return;
        var hits = data.hits || [], queryID = data.queryID;
        track("Search Query", { page: page, length: q.length, result_class: hits.length ? "results" : "none" });
        panel.innerHTML = "";
        if (!hits.length) {
          var none = document.createElement("p");
          none.className = "explore-none";
          none.textContent = "Nothing in the record matches that. Try a question instead: press Enter to ask.";
          panel.appendChild(none);
        }
        hits.forEach(function (h) {
          var a = document.createElement("a");
          a.className = "explore-hit"; a.href = h.url; extAttrs(a);
          var t = document.createElement("span"); t.className = "t"; t.textContent = h.type || "";
          var ti = document.createElement("span"); ti.className = "ti"; ti.textContent = h.title || "";
          var sm = document.createElement("span"); sm.className = "sm"; sm.textContent = h.summary || "";
          a.appendChild(t); a.appendChild(ti); a.appendChild(sm);
          a.addEventListener("click", function () {
            track("Search Result Click", { page: page, destination_type: h.type || "" });
            saveRecent(q);
            var aa = insights();
            if (aa && queryID) { try { aa("clickedObjectIDsAfterSearch", { eventName: "Search Result Clicked", index: ALGOLIA_INDEX, queryID: queryID, objectIDs: [h.objectID] }); } catch (e) {} }
          });
          panel.appendChild(a);
        });
        appendAskSection(q);
        if (hits.length && queryID) {
          var aa2 = insights();
          if (aa2) { try { aa2("viewedObjectIDsAfterSearch", { eventName: "Search Results Viewed", index: ALGOLIA_INDEX, queryID: queryID, objectIDs: hits.slice(0, 20).map(function (h) { return h.objectID; }) }); } catch (e) {} }
        }
        panel.hidden = false;
        setActive(-1);
      })
      .catch(function () {
        if (seq !== searchSeq) return;
        if (ein.value.trim() !== q) return;
        showAskRow(q);
      });
  }

  ein.addEventListener("focus", function () {
    var origin = "composer";
    try {
      if (window.DCSurface && window.DCSurface.consumeFocusOrigin) {
        origin = window.DCSurface.consumeFocusOrigin() || "composer";
      }
    } catch (e) { /* origin is measurement only */ }
    track("Explore Focus", { page: page, origin: origin });
    /* Suggested-search fix (sheet section 4): focus on the
       empty input opens the overlay with the current page's
       starter rows when a set is registered; with no set
       current it opens nothing, exactly as the revision
       left it. Focus changes nothing in the bar's structure
       or geometry — the overlay is outside every stack. */
    if (!ein.value.trim()) showEmptyState();
  });
  ein.addEventListener("input", function () {
    growInput();
    answerBox.hidden = true;
    var q = ein.value.trim();
    if (debounce) clearTimeout(debounce);
    /* The floor state machine (fix sheet section 4.3):
       below the floor (0-1 characters) the panel is
       local-only — the empty state at zero, the recents
       at one; at and above it the ask row renders at once
       and the matches join on the response. The starters
       drop away once typing starts (flag F8, as ruled). */
    if (q.length === 0) { showEmptyState(); return; }
    if (q.length < 2) { showRecents(); return; }
    showAskRow(q);
    debounce = setTimeout(function () { runSearch(q); }, 150);
  });
  /* Unified response (surface path only; build sheet P-1116-21,
     section 3.1): a plain Enter addresses the system and produces
     one unified response through the presenter. There is no
     isQuestion predicate, no find-hit gate, and no fall-through
     on this path: find suggestions render while typing and
     navigate only on explicit selection (a click, or an
     arrow-key highlight plus Enter, handled above). When the
     surface layer is off, absent, or declines, the layered
     triage below runs exactly as it always has. */
  function unifiedAccepted(q) {
    if (!(window.DCSurface && window.DCSurface.active &&
          typeof window.DCSurface.tryUnified === "function")) {
      return false;
    }
    var accepted = false;
    try { accepted = window.DCSurface.tryUnified(q) === true; }
    catch (e) { accepted = false; }
    if (!accepted) return false;
    saveRecent(q);
    panel.hidden = true;
    answerBox.hidden = true;
    ein.value = "";
    resetInputHeight();
    return true;
  }
  ein.addEventListener("keydown", function (ev) {
    var items = panelItems();
    if (ev.key === "ArrowDown" && items.length) { ev.preventDefault(); setActive(Math.min(activeIdx + 1, items.length - 1)); return; }
    if (ev.key === "ArrowUp" && items.length) { ev.preventDefault(); setActive(Math.max(activeIdx - 1, -1)); return; }
    if (ev.key === "Escape") { panel.hidden = true; return; }
    if (ev.key !== "Enter") return;
    /* Textarea discipline (sheet section 5): Enter during an
       IME composition confirms the composition, never submits;
       Shift+Enter inserts a newline and never submits. A plain
       Enter submits, exactly as the shipped input behaved. */
    if (ev.isComposing || ev.keyCode === 229) return;
    if (ev.shiftKey) return;
    ev.preventDefault();
    var q = ein.value.trim();
    if (q.length < 3) return;
    if (activeIdx >= 0 && items[activeIdx]) { items[activeIdx].click(); return; }
    if (unifiedAccepted(q)) return;
    if (isQuestion(q)) { saveRecent(q); ask(q, "unified"); return; }
    /* Suggested-search fix (sheet section 4.3): the first-hit
       fall-through and the zero-hit session-turn branch are
       deleted with the triage. Enter never navigates to an
       unhighlighted hit; a hit is taken only by explicit
       selection (a click, or the arrow-key highlight above). */
  });
  document.addEventListener("click", function (ev) { if (!bar.contains(ev.target)) panel.hidden = true; });

  /* Dynamic lists (Phase B): rendered from the same public index.
     Static HTML stays as the fallback; if the index does not answer,
     nothing changes. Lists show title + fixed summary only.
     Default cap (Douglas, Nov 15): show the 3 most relevant items plus
     a view-all row to the type hub. Personalization may override the
     cap later; until then every list follows this pattern. */
  function queryIndex(body) {
    return fetch("https://" + ALGOLIA_APP + "-dsn.algolia.net/1/indexes/" + ALGOLIA_INDEX + "/query", {
      method: "POST",
      headers: { "content-type": "application/json", "X-Algolia-API-Key": ALGOLIA_SEARCH_KEY, "X-Algolia-Application-Id": ALGOLIA_APP },
      body: JSON.stringify(body)
    }).then(function (r) { return r.json(); });
  }
  function listClick(surface, h) {
    track("Dynamic List Click", { surface: surface, destination_type: h.type || "" });
    var aa = insights();
    if (aa) { try { aa("clickedObjectIDs", { eventName: "List Item Clicked", index: ALGOLIA_INDEX, objectIDs: [h.objectID] }); } catch (e) {} }
  }
  function fmtDate(ts) {
    if (!ts) return "";
    try { return new Date(ts * 1000).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric", timeZone: "UTC" }); } catch (e) { return ""; }
  }
  function ensureCardCss() {
    if (document.getElementById("dl-card-css")) return;
    var st = document.createElement("style"); st.id = "dl-card-css";
    st.textContent = ".dl-card{list-style:none}" +
      ".dl-card-a{display:flex;gap:14px;text-decoration:none;border:1px solid var(--line,#ddd);border-radius:12px;padding:12px;background:var(--surface,var(--bg,#fff));color:inherit;transition:border-color .15s ease,transform .15s ease}" +
      ".dl-card-a:hover{border-color:var(--accent,#5b7a67);transform:translateY(-1px)}" +
      ".dl-img{width:112px;min-height:88px;object-fit:cover;border-radius:8px;flex:none}" +
      ".dl-body{display:flex;flex-direction:column;gap:4px;min-width:0}" +
      ".dl-meta{display:flex;gap:8px;align-items:center;font-size:11.5px;color:var(--muted,#777)}" +
      ".dl-tag{letter-spacing:.04em;text-transform:uppercase;border:1px solid var(--line,#ddd);border-radius:4px;padding:0 5px;font-weight:600}" +
      ".dl-title{font-family:Newsreader,Georgia,serif;font-size:18.5px;font-weight:600;line-height:1.25;color:var(--ink,inherit)}" +
      ".dl-sum{font-size:14px;line-height:1.5;color:var(--ink-2,#444);display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical;overflow:hidden}" +
      ".dl-cta{margin-top:auto;padding-top:2px;font-size:13.5px;font-weight:600;color:var(--accent,#5b7a67)}" +
      ".related-writing li.dl-card,.related-writing li.dynamic-more{padding:0;border-bottom:none}" +
      ".related-writing li.dynamic-more{padding:6px 2px 0}" +
      "@media (max-width:560px){.dl-img{width:84px}}";
    document.head.appendChild(st);
  }
  function renderEssayList(ul, hits, surface, hubUrl, hubLabel) {
    ensureCardCss();
    ul.innerHTML = "";
    hits.forEach(function (h) {
      var li = document.createElement("li");
      li.className = "dl-card";
      var a = document.createElement("a");
      a.className = "dl-card-a"; a.href = h.url; extAttrs(a);
      a.addEventListener("click", function () { listClick(surface, h); });
      if (h.image) {
        var im = document.createElement("img");
        im.className = "dl-img"; im.src = h.image; im.alt = ""; im.loading = "lazy";
        a.appendChild(im);
      }
      var body = document.createElement("span"); body.className = "dl-body";
      var meta = document.createElement("span"); meta.className = "dl-meta";
      var tag = document.createElement("span"); tag.className = "dl-tag";
      tag.textContent = h.type || "Essay"; meta.appendChild(tag);
      var d = fmtDate(h.date);
      if (d) { var ds = document.createElement("span"); ds.textContent = d; meta.appendChild(ds); }
      body.appendChild(meta);
      var ti = document.createElement("span"); ti.className = "dl-title";
      ti.textContent = h.title || ""; body.appendChild(ti);
      var su = document.createElement("span"); su.className = "dl-sum";
      su.textContent = h.summary || ""; body.appendChild(su);
      var ct = document.createElement("span"); ct.className = "dl-cta";
      ct.textContent = (h.type === "Essay" ? "Read the essay" : "Read more") + " \u2192";
      body.appendChild(ct);
      a.appendChild(body);
      ul.appendChild(li);
    });
    if (hits.length) {
      var aa3 = insights();
      if (aa3) { try { aa3("viewedObjectIDs", { eventName: "List Items Viewed", index: ALGOLIA_INDEX, objectIDs: hits.slice(0, 20).map(function (h) { return h.objectID; }) }); } catch (e) {} }
    }
    if (hubUrl) {
      var mli = document.createElement("li");
      mli.className = "dynamic-more";
      var ma = document.createElement("a");
      ma.href = hubUrl; ma.textContent = hubLabel || "View all"; extAttrs(ma);
      ma.addEventListener("click", function () { track("Dynamic List Click", { surface: surface, destination_type: "Hub" }); });
      mli.appendChild(ma);
      ul.appendChild(mli);
    }
  }
  var homeList = document.querySelector("ul.selected-writing[data-dynamic-list='essays']");
  if (homeList) {
    queryIndex({ query: "", filters: "type:Essay", hitsPerPage: 50, attributesToHighlight: [] })
      .then(function (data) {
        var hits = (data.hits || []).slice().sort(function (a, b) { return (b.date || 0) - (a.date || 0); });
        if (!hits.length) return;
        var shown = hits.slice(0, 3);
        renderEssayList(homeList, shown, "home_writing", "/writing/", "View all writing");
        track("Dynamic List Rendered", { surface: "home_writing", count: shown.length });
      })
      .catch(function () {});
  }
  var here = window.location.pathname;
  var staticRelated = document.querySelector("section.related-writing");
  if (staticRelated) { /* Static related section is baked into the page; the dynamic build stands down. */ }
  else
  if (/^\/writing\/[^/]+\/$/.test(here)) {
    var h1 = document.querySelector("h1");
    var relQ = h1 ? h1.textContent.trim() : "";
    if (relQ) {
      /* Related essays are ranked on the client from the full essay list:
         Algolia's default AND word matching returns only the essay itself
         for distinctive titles. Shared significant words score a match;
         the most recent essays fill any remaining slots. */
      queryIndex({ query: "", filters: "type:Essay", hitsPerPage: 50, attributesToHighlight: [] })
        .then(function (data) {
          var all = data.hits || [];
          var self = null;
          all.forEach(function (h) { if (h.url === here) self = h; });
          var stop = { the: 1, a: 1, an: 1, and: 1, of: 1, to: 1, is: 1, it: 1, in: 1, on: 1, for: 1, what: 1, why: 1, how: 1, your: 1, you: 1, are: 1, not: 1, do: 1, does: 1, from: 1, with: 1, about: 1, into: 1, its: 1, this: 1, that: 1, just: 1, actually: 1, means: 1 };
          function tokens(s) {
            var out = {}, parts = (s || "").toLowerCase().split(/[^a-z0-9]+/);
            parts.forEach(function (w) { if (w.length > 2 && !stop[w]) out[w] = 1; });
            return out;
          }
          var selfTitle = tokens(self ? self.title : relQ);
          var selfBody = tokens((self ? self.summary : "") + " " + (self && self.headings ? self.headings.join(" ") : ""));
          var others = all.filter(function (h) { return h.url !== here; });
          others.forEach(function (h) {
            var ht = tokens(h.title), hb = tokens((h.summary || "") + " " + (h.headings ? h.headings.join(" ") : "")), sc = 0;
            Object.keys(ht).forEach(function (w) { if (selfTitle[w]) sc += 3; if (selfBody[w]) sc += 1; });
            Object.keys(hb).forEach(function (w) { if (selfTitle[w]) sc += 2; });
            h._rel = sc;
          });
          others.sort(function (a, b) { return (b._rel - a._rel) || ((b.date || 0) - (a.date || 0)); });
          var hits = others.slice(0, 3);
          if (!hits.length) return;
          var st = document.createElement("style");
          st.textContent = ".related-writing{margin:34px 0 6px;padding-top:18px;border-top:1px solid var(--line,#ddd)}.related-writing h2{font-size:20px;margin:0 0 10px}.related-writing ul{list-style:none;margin:0;padding:0}.related-writing li{padding:9px 0;border-bottom:1px solid var(--line,#ddd);font-size:15.5px;line-height:1.6;color:var(--ink-2,#444)}.related-writing li:last-child{border-bottom:none}.related-writing a{font-weight:600;color:var(--ink,inherit)}.related-writing .bridge{margin:0 0 10px;font-size:15.5px;line-height:1.6;color:var(--ink-2,#444)}.related-writing .bridge-tag{display:inline-block;font-size:11px;letter-spacing:.04em;text-transform:uppercase;border:1px solid var(--line,#ddd);border-radius:4px;padding:0 5px;margin-right:8px;vertical-align:1px}";
          document.head.appendChild(st);
          var main = document.querySelector("main") || document.body;
          var sec = document.createElement("section");
          sec.className = "related-writing";
          sec.setAttribute("aria-label", "Related writing");
          var hd = document.createElement("h2"); hd.textContent = "Related writing";
          var ul = document.createElement("ul");
          sec.appendChild(hd); sec.appendChild(ul);
          renderEssayList(ul, hits, "related_writing", "/writing/", "All writing");
          main.appendChild(sec);
          track("Dynamic List Rendered", { surface: "related_writing", count: hits.length });
          if (BRIDGES_ENABLED) {
            var hostOid = here.replace(/^\/|\/$/g, "").replace(/\//g, "-");
            var itemIds = hits.map(function (h) { return h.objectID; }).sort();
            var sig = "related_writing|" + hostOid + "|" + itemIds.join(",");
            fetchBridges().then(function (doc) {
              var entry = doc && doc.bridges ? doc.bridges[sig] : null;
              track("Bridge Rendered", { surface: "related_writing", matched: !!entry });
              if (entry && entry.text) {
                var bp = document.createElement("p");
                bp.className = "bridge";
                bp.setAttribute("data-nosnippet", "");
                var tag = document.createElement("span");
                tag.className = "bridge-tag";
                tag.textContent = "AI-generated";
                bp.appendChild(tag);
                bp.appendChild(document.createTextNode(entry.text));
                sec.insertBefore(bp, ul);
              }
            });
          }
        })
        .catch(function () {});
    }
  }

  /* Selected writing bridge (home only): the checked one-line
     introduction for the four most recent essays, from bridges.json. */
  if ((window.location.pathname || "/") === "/" && BRIDGES_ENABLED) {
    var grid = document.querySelector("#writing .hub-grid");
    if (grid) {
      var cards = Array.prototype.slice.call(grid.querySelectorAll("a.hub-card-a[href^='/writing/']"));
      var oids = cards.map(function (a) {
        return "writing-" + a.getAttribute("href").replace(/^\/|\/$/g, "").replace(/\//g, "-").replace(/^writing-/, "");
      }).sort();
      if (oids.length) {
        var hsig = "selected_writing|home|" + oids.join(",");
        fetchBridges().then(function (doc) {
          var entry = doc && doc.bridges ? doc.bridges[hsig] : null;
          track("Bridge Rendered", { surface: "selected_writing", matched: !!entry });
          if (entry && entry.text && !document.querySelector(".selected-writing-bridge")) {
            var hst = document.createElement("style");
            hst.textContent = ".selected-writing-bridge{margin:2px 0 14px;font-size:15.5px;line-height:1.6;color:var(--ink-2,#444)}.selected-writing-bridge .bridge-tag{display:inline-block;font-size:11px;letter-spacing:.04em;text-transform:uppercase;border:1px solid var(--line,#ddd);border-radius:4px;padding:0 5px;margin-right:8px;vertical-align:1px}";
            document.head.appendChild(hst);
            var bp = document.createElement("p");
            bp.className = "selected-writing-bridge";
            bp.setAttribute("data-nosnippet", "");
            var tag = document.createElement("span");
            tag.className = "bridge-tag";
            tag.textContent = "AI-generated";
            bp.appendChild(tag);
            bp.appendChild(document.createTextNode(entry.text));
            grid.parentNode.insertBefore(bp, grid);
          }
        });
      }
    }
  }
})();
