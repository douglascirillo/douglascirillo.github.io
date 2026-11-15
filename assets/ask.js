/* The Record Bar: one input for douglascirillo.com (A1.2).
   A single prominent bar at the top of every page. Keyword-style input
   searches the site on Algolia (public index: titles and fixed summaries
   only). Question-style input asks the record: the Lambda selects records,
   code assembles the answer verbatim, and it renders in place, in the bar's
   own answer region. There is no second input and no jump.
   Set ASK_ENABLED to false to remove the feature site-wide.
   Amplitude events: ask_module_viewed, ask_submitted, ask_answered,
   ask_no_evidence, ask_refused, ask_next_click, search_query,
   search_result_click, explore_focus. Every event carries the page path.
   Amplitude <> Algolia pipe: Algolia Insights events carry the visitor's
   Amplitude anonymous device ID as the user token when Amplitude is
   present (PIPE_ENABLED), so search behavior and site behavior join on one
   anonymous ID in both systems. Otherwise a session-scoped token is used. */
(function () {
  var ASK_ENABLED = true;
  var PIPE_ENABLED = true;
  var ASK_ENDPOINT = "https://7i3yr1dzge.execute-api.us-east-1.amazonaws.com/ask";
  var ALGOLIA_APP = "AL1TQKLUI7";
  var ALGOLIA_SEARCH_KEY = "63308c453ec399e4360c003851faa733";
  var ALGOLIA_INDEX = "site_public";
  if (!ASK_ENABLED) return;

  var LINKEDIN = "https://www.linkedin.com/in/douglascirillo/";
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
    ".explore{margin:26px 0 4px;padding:18px 18px 12px;border:1px solid var(--line);border-radius:12px}",
    ".explore .explore-label{display:block;font-size:15px;color:var(--ink-2);margin:0 0 10px}",
    ".explore input{font:inherit;font-size:16px;width:100%;box-sizing:border-box;padding:11px 16px;border:1px solid var(--line);border-radius:999px;background:transparent;color:var(--ink)}",
    ".explore input:focus{outline:none;border-color:var(--accent)}",
    ".explore .explore-note{margin:10px 0 0;font-size:13px;color:var(--muted)}",
    ".explore .explore-panel{margin-top:12px}",
    ".explore .explore-hit{display:block;padding:10px 14px;border:1px solid var(--line);border-radius:10px;margin:0 0 8px;text-decoration:none;color:var(--ink)}",
    ".explore .explore-hit:hover,.explore .explore-hit.active{border-color:var(--accent)}",
    ".explore .explore-hit .t{display:block;font-size:11.5px;text-transform:uppercase;letter-spacing:.07em;color:var(--muted);margin:0 0 2px}",
    ".explore .explore-hit .ti{display:block;font-size:16px;font-weight:600;margin:0 0 2px}",
    ".explore .explore-hit .sm{display:block;font-size:14px;color:var(--ink-2);line-height:1.45}",
    ".explore .explore-askrow{display:block;width:100%;text-align:left;font:inherit;font-size:15px;padding:10px 14px;border:1px solid var(--accent);border-radius:10px;background:transparent;color:var(--ink);cursor:pointer;margin:0 0 8px}",
    ".explore .explore-askrow.active{background:var(--accent-light)}",
    ".explore .explore-none{font-size:14.5px;color:var(--muted);margin:2px 0 10px}",
    ".explore .explore-head{font-size:11.5px;text-transform:uppercase;letter-spacing:.07em;color:var(--muted);margin:4px 0 6px}",
    ".explore .explore-chips{display:flex;gap:8px;flex-wrap:wrap;margin:2px 0 8px}",
    ".explore .ask-chip{font:inherit;font-size:13.5px;padding:6px 12px;border:1px solid var(--line);border-radius:999px;background:transparent;color:var(--ink-2);cursor:pointer;text-align:left}",
    ".explore .ask-chip:hover{border-color:var(--accent);color:var(--ink)}",
    ".explore .explore-answer{margin-top:14px}",
    ".explore .ask-item{padding:14px 18px;border:1px solid var(--line);border-radius:10px;margin:0 0 10px}",
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

  /* ---------- the bar ---------- */
  var main = document.querySelector("main");
  if (!main) return;
  var bar = document.createElement("div");
  bar.className = "explore";
  bar.id = "ask-h";
  bar.innerHTML =
    "<span class=\"explore-label\">Search the record, or ask it a question.</span>" +
    "<input id=\"explore-q\" type=\"text\" maxlength=\"300\" autocomplete=\"off\" aria-label=\"Search the record or ask a question\">" +
    "<div class=\"explore-panel\" id=\"explore-panel\" hidden></div>" +
    "<div class=\"explore-answer\" id=\"explore-answer\" hidden></div>" +
    "<p class=\"explore-note\">Questions are kept for 90 days and read by Douglas to improve the record. Searches are measured by length and result only. Please leave out personal details.</p>";
  main.insertBefore(bar, main.firstChild);
  var ein = document.getElementById("explore-q");
  ein.setAttribute("placeholder", ctx.placeholder);
  var panel = document.getElementById("explore-panel");
  var answerBox = document.getElementById("explore-answer");

  var viewed = false;
  if ("IntersectionObserver" in window) {
    var io = new IntersectionObserver(function (entries) {
      entries.forEach(function (en) {
        if (en.isIntersecting && !viewed) { viewed = true; track("ask_module_viewed", { page: page }); io.disconnect(); }
      });
    }, { threshold: 0.4 });
    io.observe(bar);
  }

  /* Nav "Ask" link: focus the one input instead of jumping to a module. */
  document.querySelectorAll("a[href$=\"#ask-h\"]").forEach(function (a) {
    a.addEventListener("click", function (ev) {
      ev.preventDefault();
      bar.scrollIntoView({ behavior: "smooth", block: "start" });
      setTimeout(function () { ein.focus({ preventScroll: true }); }, 450);
    });
  });

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
    a.addEventListener("click", function () { track("ask_next_click", { page: page, kind: "cta" }); });
    p.appendChild(a);
    return p;
  }
  function ask(q, via) {
    track("ask_submitted", { page: page, via: via });
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
          track("ask_answered", { page: page, records: data.items.length });
          data.items.forEach(function (it) {
            var div = document.createElement("div");
            div.className = "ask-item";
            var p = document.createElement("p"); p.textContent = it.claim;
            var a = document.createElement("a"); a.href = it.source; a.textContent = "Read it in context";
            a.addEventListener("click", function () { track("ask_next_click", { page: page, kind: "source" }); });
            div.appendChild(p); div.appendChild(a);
            answerBox.appendChild(div);
          });
          var ns = nextStep(); if (ns) answerBox.appendChild(ns);
        } else if (data.type === "refusal") {
          track("ask_refused", { page: page });
          var p1 = document.createElement("p"); p1.className = "ask-msg"; p1.textContent = data.text;
          answerBox.appendChild(p1);
        } else {
          track("ask_no_evidence", { page: page });
          var p2 = document.createElement("p"); p2.className = "ask-msg"; p2.textContent = data.text || "";
          answerBox.appendChild(p2);
          if (data.link) {
            var a2 = document.createElement("a");
            a2.href = data.link; a2.textContent = "Browse the case studies";
            a2.addEventListener("click", function () { track("ask_next_click", { page: page, kind: "hub" }); });
            answerBox.appendChild(a2);
          }
        }
      })
      .catch(function () {
        answerBox.innerHTML = "<p class=\"ask-msg\">The record is not answering right now. The case studies are the fastest way through it.</p>";
      });
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
  var TYPE_BY_PREFIX = [
    ["/case-studies/", "Case study"], ["/practice/", "Practice"],
    ["/writing/", "Essay"], ["/record/", "Record"],
    ["/speaking/", "Speaking"], ["/scorecard/", "Tool"]
  ];
  var boostType = null;
  TYPE_BY_PREFIX.forEach(function (pair) { if (page.indexOf(pair[0]) === 0) boostType = pair[1]; });
  var optionalFilters = boostType ? ["type:" + boostType + "<score=2>"] : [];

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
  function panelItems() { return panel.querySelectorAll(".explore-hit, .explore-askrow"); }
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
  function showStart() {
    panel.innerHTML = "";
    var recents = getRecents();
    if (recents.length) {
      panel.appendChild(headRow("Recent searches"));
      var rw = document.createElement("div");
      rw.className = "explore-chips";
      recents.forEach(function (r) {
        var b = document.createElement("button");
        b.type = "button"; b.className = "ask-chip"; b.textContent = r;
        b.addEventListener("click", function () {
          ein.value = r;
          if (isQuestion(r)) ask(r, "unified"); else runSearch(r);
        });
        rw.appendChild(b);
      });
      panel.appendChild(rw);
    }
    panel.appendChild(headRow("Ask my record"));
    var w = document.createElement("div");
    w.className = "explore-chips";
    ctx.chips.forEach(function (c) {
      var b = document.createElement("button");
      b.type = "button"; b.className = "ask-chip"; b.textContent = c;
      b.addEventListener("click", function () { ein.value = c; ask(c, "chip"); });
      w.appendChild(b);
    });
    panel.appendChild(w);
    panel.hidden = false;
    setActive(-1);
  }
  function showAskRow(q) {
    panel.innerHTML = "";
    var row = document.createElement("button");
    row.type = "button"; row.className = "explore-askrow";
    row.textContent = "Ask my record: \u201C" + q + "\u201D";
    row.addEventListener("click", function () { ask(q, "unified"); });
    panel.appendChild(row);
    panel.hidden = false;
    setActive(-1);
  }
  var debounce = null, lastQuery = "";
  function runSearch(q) {
    fetch("https://" + ALGOLIA_APP + "-dsn.algolia.net/1/indexes/" + ALGOLIA_INDEX + "/query", {
      method: "POST",
      headers: { "content-type": "application/json", "X-Algolia-API-Key": ALGOLIA_SEARCH_KEY, "X-Algolia-Application-Id": ALGOLIA_APP },
      body: JSON.stringify({ query: q, hitsPerPage: 6, attributesToHighlight: [], clickAnalytics: true, optionalFilters: optionalFilters })
    })
      .then(function (r) { return r.json(); })
      .then(function (data) {
        if (ein.value.trim() !== q) return;
        var hits = data.hits || [], queryID = data.queryID;
        track("search_query", { page: page, length: q.length, result_class: hits.length ? "results" : "none" });
        panel.innerHTML = "";
        if (!hits.length) {
          var none = document.createElement("p");
          none.className = "explore-none";
          none.textContent = "Nothing in the record matches that. Try a question instead: press Enter to ask.";
          panel.appendChild(none);
        }
        hits.forEach(function (h) {
          var a = document.createElement("a");
          a.className = "explore-hit"; a.href = h.url;
          var t = document.createElement("span"); t.className = "t"; t.textContent = h.type || "";
          var ti = document.createElement("span"); ti.className = "ti"; ti.textContent = h.title || "";
          var sm = document.createElement("span"); sm.className = "sm"; sm.textContent = h.summary || "";
          a.appendChild(t); a.appendChild(ti); a.appendChild(sm);
          a.addEventListener("click", function () {
            track("search_result_click", { page: page, destination_type: h.type || "" });
            saveRecent(q);
            var aa = insights();
            if (aa && queryID) { try { aa("clickedObjectIDsAfterSearch", { eventName: "Search Result Clicked", index: ALGOLIA_INDEX, queryID: queryID, objectIDs: [h.objectID] }); } catch (e) {} }
          });
          panel.appendChild(a);
        });
        panel.hidden = false;
        setActive(-1);
      })
      .catch(function () { panel.hidden = true; });
  }

  ein.addEventListener("focus", function () {
    track("explore_focus", { page: page });
    if (!ein.value.trim() && answerBox.hidden) showStart();
  });
  ein.addEventListener("input", function () {
    answerBox.hidden = true;
    var q = ein.value.trim();
    if (debounce) clearTimeout(debounce);
    if (q.length < 3) { if (!q) showStart(); else panel.hidden = true; return; }
    if (isQuestion(q)) { showAskRow(q); return; }
    debounce = setTimeout(function () { if (q !== lastQuery) { lastQuery = q; runSearch(q); } }, 300);
  });
  ein.addEventListener("keydown", function (ev) {
    var items = panelItems();
    if (ev.key === "ArrowDown" && items.length) { ev.preventDefault(); setActive(Math.min(activeIdx + 1, items.length - 1)); return; }
    if (ev.key === "ArrowUp" && items.length) { ev.preventDefault(); setActive(Math.max(activeIdx - 1, -1)); return; }
    if (ev.key === "Escape") { panel.hidden = true; return; }
    if (ev.key !== "Enter") return;
    ev.preventDefault();
    var q = ein.value.trim();
    if (q.length < 3) return;
    if (activeIdx >= 0 && items[activeIdx]) { items[activeIdx].click(); return; }
    if (isQuestion(q)) { saveRecent(q); ask(q, "unified"); return; }
    var first = panel.querySelector(".explore-hit");
    if (first) { saveRecent(q); window.location.href = first.getAttribute("href"); }
  });
  document.addEventListener("click", function (ev) { if (!bar.contains(ev.target)) panel.hidden = true; });

  /* Dynamic lists (Phase B): rendered from the same public index.
     Static HTML stays as the fallback; if the index does not answer,
     nothing changes. Lists show title + fixed summary only. */
  function queryIndex(body) {
    return fetch("https://" + ALGOLIA_APP + "-dsn.algolia.net/1/indexes/" + ALGOLIA_INDEX + "/query", {
      method: "POST",
      headers: { "content-type": "application/json", "X-Algolia-API-Key": ALGOLIA_SEARCH_KEY, "X-Algolia-Application-Id": ALGOLIA_APP },
      body: JSON.stringify(body)
    }).then(function (r) { return r.json(); });
  }
  function listClick(surface, h) {
    track("dynamic_list_click", { surface: surface, destination_type: h.type || "" });
    var aa = insights();
    if (aa) { try { aa("clickedObjectIDs", { eventName: "List Item Clicked", index: ALGOLIA_INDEX, objectIDs: [h.objectID] }); } catch (e) {} }
  }
  function renderEssayList(ul, hits, surface) {
    ul.innerHTML = "";
    hits.forEach(function (h) {
      var li = document.createElement("li");
      var a = document.createElement("a");
      a.href = h.url; a.textContent = h.title || "";
      a.addEventListener("click", function () { listClick(surface, h); });
      li.appendChild(a);
      li.appendChild(document.createTextNode(": " + (h.summary || "")));
      ul.appendChild(li);
    });
  }
  var homeList = document.querySelector("ul.selected-writing[data-dynamic-list='essays']");
  if (homeList) {
    queryIndex({ query: "", filters: "type:Essay", hitsPerPage: 50, attributesToHighlight: [] })
      .then(function (data) {
        var hits = (data.hits || []).slice().sort(function (a, b) { return (b.date || 0) - (a.date || 0); });
        if (!hits.length) return;
        renderEssayList(homeList, hits, "home_writing");
        track("dynamic_list_rendered", { surface: "home_writing", count: hits.length });
      })
      .catch(function () {});
  }
  var here = window.location.pathname;
  if (/^\/writing\/[^/]+\/$/.test(here)) {
    var h1 = document.querySelector("h1");
    var relQ = h1 ? h1.textContent.trim() : "";
    if (relQ) {
      queryIndex({ query: relQ, filters: "type:Essay", hitsPerPage: 8, attributesToHighlight: [] })
        .then(function (data) {
          var hits = (data.hits || []).filter(function (h) { return h.url !== here; }).slice(0, 3);
          if (!hits.length) return;
          var st = document.createElement("style");
          st.textContent = ".related-writing{margin:34px 0 6px;padding-top:18px;border-top:1px solid var(--line,#ddd)}.related-writing h2{font-size:20px;margin:0 0 10px}.related-writing ul{list-style:none;margin:0;padding:0}.related-writing li{padding:9px 0;border-bottom:1px solid var(--line,#ddd);font-size:15.5px;line-height:1.6;color:var(--ink-2,#444)}.related-writing li:last-child{border-bottom:none}.related-writing a{font-weight:600;color:var(--ink,inherit)}";
          document.head.appendChild(st);
          var main = document.querySelector("main") || document.body;
          var sec = document.createElement("section");
          sec.className = "related-writing";
          sec.setAttribute("aria-label", "Related writing");
          var hd = document.createElement("h2"); hd.textContent = "Related writing";
          var ul = document.createElement("ul");
          sec.appendChild(hd); sec.appendChild(ul);
          renderEssayList(ul, hits, "related_writing");
          main.appendChild(sec);
          track("dynamic_list_rendered", { surface: "related_writing", count: hits.length });
        })
        .catch(function () {});
    }
  }
})();
