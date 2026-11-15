/* Ask My Record: cited retrieval UI for douglascirillo.com.
   One shared file, loaded by every page. Set ASK_ENABLED to false to remove
   the feature site-wide with no other change. ASK_ENDPOINT is set at deploy.
   Context-aware: each page gets its own placeholder, example questions drawn
   from that page's records, and a next step matched to the page's job. The
   page path is sent with the question so the service can prefer that page's
   records when several answer equally well.
   Amplitude: ask_module_viewed, ask_submitted, ask_answered, ask_no_evidence,
   ask_refused, ask_next_click, ask_entry_click. Every event carries the page path. */
(function () {
  var ASK_ENABLED = true;
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
    ".ask{padding:44px 0 8px}",
    ".ask h2{font-family:\"Newsreader\", Georgia, serif;font-weight:500;font-size:28px;letter-spacing:-.01em;margin:0 0 8px}",
    ".ask .ask-sub{margin:0 0 16px;color:var(--ink-2);font-size:16px;line-height:1.55;max-width:38em}",
    ".ask form{display:flex;gap:8px;flex-wrap:wrap}",
    ".ask input{font:inherit;font-size:16px;flex:1 1 260px;padding:10px 14px;border:1px solid var(--line);border-radius:999px;background:transparent;color:var(--ink)}",
    ".ask button.ask-go{font:inherit;font-size:15px;padding:10px 18px;border:1px solid var(--accent);border-radius:999px;background:var(--accent);color:#fff;cursor:pointer}",
    "@media (prefers-color-scheme: dark){.ask button.ask-go{color:#101512}}",
    ".ask .ask-chips{display:flex;gap:8px;flex-wrap:wrap;margin:12px 0 0}",
    ".ask .ask-chip{font:inherit;font-size:13.5px;padding:6px 12px;border:1px solid var(--line);border-radius:999px;background:transparent;color:var(--ink-2);cursor:pointer;text-align:left}",
    ".ask .ask-chip:hover{border-color:var(--accent);color:var(--ink)}",
    ".ask .ask-note{margin:10px 0 0;font-size:13px;color:var(--muted)}",
    ".ask .ask-results{margin-top:18px}",
    ".ask .ask-item{padding:14px 18px;border:1px solid var(--line);border-radius:10px;margin:0 0 10px}",
    ".ask .ask-item p{margin:0 0 6px;font-size:16.5px;line-height:1.55}",
    ".ask .ask-item a{font-size:14px}",
    ".ask .ask-msg{font-size:16.5px;line-height:1.55}",
    ".ask .ask-next{margin-top:14px;font-size:15px}",
    ".ask-entry{display:flex;gap:10px;align-items:center;flex-wrap:wrap;padding:14px 18px;border:1px solid var(--line);border-radius:10px;margin:22px 0}",
    ".ask-entry .ask-entry-label{font-size:15px;color:var(--ink-2)}",
    ".ask-entry button{font:inherit;font-size:13.5px;padding:6px 12px;border:1px solid var(--line);border-radius:999px;background:transparent;color:var(--ink-2);cursor:pointer;text-align:left}",
    ".ask-entry button:hover{border-color:var(--accent);color:var(--ink)}",
    ".explore{margin:26px 0 4px;padding:18px 18px 10px;border:1px solid var(--line);border-radius:12px}",
    ".explore .explore-label{display:block;font-size:15px;color:var(--ink-2);margin:0 0 10px}",
    ".explore input{font:inherit;font-size:16px;width:100%;box-sizing:border-box;padding:11px 16px;border:1px solid var(--line);border-radius:999px;background:transparent;color:var(--ink)}",
    ".explore input:focus{outline:none;border-color:var(--accent)}",
    ".explore .explore-panel{margin-top:12px}",
    ".explore .explore-hit{display:block;padding:10px 14px;border:1px solid var(--line);border-radius:10px;margin:0 0 8px;text-decoration:none;color:var(--ink)}",
    ".explore .explore-hit:hover{border-color:var(--accent)}",
    ".explore .explore-hit .t{display:block;font-size:11.5px;text-transform:uppercase;letter-spacing:.07em;color:var(--muted);margin:0 0 2px}",
    ".explore .explore-hit .ti{display:block;font-size:16px;font-weight:600;margin:0 0 2px}",
    ".explore .explore-hit .sm{display:block;font-size:14px;color:var(--ink-2);line-height:1.45}",
    ".explore .explore-askrow{display:block;width:100%;text-align:left;font:inherit;font-size:15px;padding:10px 14px;border:1px solid var(--accent);border-radius:10px;background:transparent;color:var(--ink);cursor:pointer;margin:0 0 8px}",
    ".explore .explore-none{font-size:14.5px;color:var(--muted);margin:2px 0 10px}",
    ".explore .explore-chips{display:flex;gap:8px;flex-wrap:wrap;margin:2px 0 8px}",
    ".explore .ask-chip{font:inherit;font-size:13.5px;padding:6px 12px;border:1px solid var(--line);border-radius:999px;background:transparent;color:var(--ink-2);cursor:pointer;text-align:left}",
    ".explore .ask-chip:hover{border-color:var(--accent);color:var(--ink)}",
    ".aa-Form{display:flex;align-items:center;border:1px solid var(--line);border-radius:999px;padding:0 6px 0 16px;background:transparent}",
    ".aa-Form:focus-within{border-color:var(--accent)}",
    ".aa-Input{font:inherit;font-size:16px;flex:1;border:none;background:transparent;color:var(--ink);padding:11px 0;outline:none}",
    ".aa-SubmitButton,.aa-ClearButton,.aa-LoadingIndicator{border:none;background:transparent;color:var(--muted);cursor:pointer;padding:6px}",
    ".aa-DetachedSearchButtonIcon,.aa-SubmitIcon{fill:currentColor}",
    ".aa-Panel{margin-top:12px}",
    ".aa-PanelLayout{padding:0}",
    ".aa-Source{margin:0 0 10px}",
    ".aa-SourceHeader{font-size:11.5px;text-transform:uppercase;letter-spacing:.07em;color:var(--muted);margin:0 0 6px;padding:0 2px}",
    ".aa-List{list-style:none;margin:0;padding:0}",
    ".aa-Item{padding:10px 14px;border:1px solid var(--line);border-radius:10px;margin:0 0 8px;cursor:pointer;color:var(--ink)}",
    ".aa-Item[aria-selected=true]{border-color:var(--accent)}",
    ".aa-Item .t{display:block;font-size:11.5px;text-transform:uppercase;letter-spacing:.07em;color:var(--muted);margin:0 0 2px}",
    ".aa-Item .ti{display:block;font-size:16px;font-weight:600;margin:0 0 2px}",
    ".aa-Item .sm{display:block;font-size:14px;color:var(--ink-2);line-height:1.45}",
    ".aa-Item .askline{font-size:15px}",
    ".aa-ItemIcon{display:none}",
    ".aa-ItemContent{margin:0}",
    ".aa-ItemActionButton{display:none}"
  ].join("\n");
  var style = document.createElement("style");
  style.textContent = css;
  document.head.appendChild(style);

  var section = document.createElement("section");
  section.className = "ask";
  section.setAttribute("aria-labelledby", "ask-h");
  var chipsHtml = "";
  ctx.chips.forEach(function (c) {
    chipsHtml += "<button type=\"button\" class=\"ask-chip\"></button>";
  });
  section.innerHTML =
    "<h2 id=\"ask-h\">Ask my record</h2>" +
    "<p class=\"ask-sub\">Answers come only from what is published on this site, quoted word for word, with the source. If it is not in the record, the answer says so.</p>" +
    "<form id=\"ask-form\"><input id=\"ask-q\" type=\"text\" maxlength=\"300\" autocomplete=\"off\" aria-label=\"Ask a question about the published record\">" +
    "<button type=\"submit\" class=\"ask-go\">Ask</button></form>" +
    "<div class=\"ask-chips\" id=\"ask-chips\">" + chipsHtml + "</div>" +
    "<p class=\"ask-note\">Questions are kept for 90 days and read by Douglas to improve the record. Please leave out personal details.</p>" +
    "<div class=\"ask-results\" id=\"ask-results\" aria-live=\"polite\"></div>";

  var footer = document.querySelector("footer");
  if (footer && footer.parentNode) footer.parentNode.insertBefore(section, footer);
  else document.body.appendChild(section);

  var input = document.getElementById("ask-q");
  input.setAttribute("placeholder", ctx.placeholder);
  var chipEls = section.querySelectorAll(".ask-chip");
  ctx.chips.forEach(function (c, i) { if (chipEls[i]) chipEls[i].textContent = c; });

  function track(n, p) {
    if (window.amplitude && typeof window.amplitude.track === "function") {
      try { window.amplitude.track(n, p || {}); } catch (e) {}
    }
  }

  var viewed = false;
  function markViewed() {
    if (viewed) return;
    viewed = true;
    track("ask_module_viewed", { page: page });
  }
  if ("IntersectionObserver" in window) {
    var io = new IntersectionObserver(function (entries) {
      entries.forEach(function (en) { if (en.isIntersecting) { markViewed(); io.disconnect(); } });
    }, { threshold: 0.4 });
    io.observe(section);
  } else {
    markViewed();
  }

  var form = document.getElementById("ask-form");
  var results = document.getElementById("ask-results");

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

  function submit(q, via) {
    track("ask_submitted", { page: page, via: via });
    results.innerHTML = "<p class=\"ask-msg\">Checking the record\u2026</p>";
    fetch(ASK_ENDPOINT, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ question: q, page: page })
    })
      .then(function (r) { return r.json(); })
      .then(function (data) {
        results.innerHTML = "";
        if (data.type === "answer" && data.items && data.items.length) {
          track("ask_answered", { page: page, records: data.items.length });
          data.items.forEach(function (it) {
            var div = document.createElement("div");
            div.className = "ask-item";
            var p = document.createElement("p"); p.textContent = it.claim;
            var a = document.createElement("a"); a.href = it.source; a.textContent = "Read it in context";
            a.addEventListener("click", function () { track("ask_next_click", { page: page, kind: "source" }); });
            div.appendChild(p); div.appendChild(a);
            results.appendChild(div);
          });
          var ns = nextStep(); if (ns) results.appendChild(ns);
        } else if (data.type === "refusal") {
          track("ask_refused", { page: page });
          var p1 = document.createElement("p"); p1.className = "ask-msg"; p1.textContent = data.text;
          results.appendChild(p1);
        } else {
          track("ask_no_evidence", { page: page });
          var p2 = document.createElement("p"); p2.className = "ask-msg"; p2.textContent = data.text || "";
          results.appendChild(p2);
          if (data.link) {
            var a2 = document.createElement("a");
            a2.href = data.link; a2.textContent = "Browse the case studies";
            a2.addEventListener("click", function () { track("ask_next_click", { page: page, kind: "hub" }); });
            results.appendChild(a2);
          }
        }
      })
      .catch(function () {
        results.innerHTML = "<p class=\"ask-msg\">The record is not answering right now. The case studies are the fastest way through it.</p>";
      });
  }

  form.addEventListener("submit", function (ev) {
    ev.preventDefault();
    var q = input.value.trim();
    if (q.length < 3) return;
    submit(q, "typed");
  });
  chipEls.forEach(function (el) {
    el.addEventListener("click", function () {
      input.value = el.textContent;
      submit(el.textContent, "chip");
    });
  });

  /* Mid-page entry point: a slim bar after the first content section that
     routes to the module below. Skipped on the home page (the intent strip
     already does this job) and on the scorecard (the tool is the page). */
  if (page !== "/" && page !== "/scorecard/") {
    var main = document.querySelector("main");
    var firstSection = main ? main.querySelector("section") : null;
    if (firstSection && firstSection.parentNode) {
      var entry = document.createElement("div");
      entry.className = "ask-entry";
      var label = document.createElement("span");
      label.className = "ask-entry-label";
      label.textContent = "Questions about this page?";
      var chipBtn = document.createElement("button");
      chipBtn.type = "button";
      chipBtn.textContent = ctx.chips[0];
      var openBtn = document.createElement("button");
      openBtn.type = "button";
      openBtn.textContent = "Ask my record";
      entry.appendChild(label);
      entry.appendChild(chipBtn);
      entry.appendChild(openBtn);
      firstSection.parentNode.insertBefore(entry, firstSection.nextSibling);
      chipBtn.addEventListener("click", function () {
        track("ask_entry_click", { page: page, via: "entry_chip" });
        input.value = ctx.chips[0];
        section.scrollIntoView({ behavior: "smooth", block: "start" });
        submit(ctx.chips[0], "chip");
      });
      openBtn.addEventListener("click", function () {
        track("ask_entry_click", { page: page, via: "entry_open" });
        section.scrollIntoView({ behavior: "smooth", block: "start" });
        setTimeout(function () { input.focus({ preventScroll: true }); }, 450);
      });
    }
  }

  /* Unified explore bar (A1.1): one prominent input at the top of every page.
     Primary implementation is Algolia's own Autocomplete library over the
     public index, with curated suggestions (this page's questions), recent
     searches kept only in the visitor's browser, contextual boosting by the
     page's content type, and Algolia Insights click events under a
     session-scoped anonymous token. Question-shaped input routes to Ask My
     Record. If the Algolia libraries fail to load, a hand-rolled fallback
     with the same behavior takes over. */
  (function () {
    var main = document.querySelector("main");
    if (!main) return;
    var bar = document.createElement("div");
    bar.className = "explore";
    bar.innerHTML =
      "<span class=\"explore-label\">Search the record, or ask it a question.</span>" +
      "<div id=\"explore-ac\"></div>" +
      "<div id=\"explore-fallback\" hidden><input id=\"explore-q\" type=\"text\" maxlength=\"300\" autocomplete=\"off\" aria-label=\"Search the record or ask a question\">" +
      "<div class=\"explore-panel\" id=\"explore-panel\" hidden></div></div>";
    main.insertBefore(bar, main.firstChild);

    var QWORDS = ["what", "how", "who", "when", "where", "why", "did", "does", "do", "is", "was", "were", "can", "could", "would", "should", "has", "have"];
    function isQuestion(q) {
      var t = (q || "").trim();
      if (!t) return false;
      if (t.charAt(t.length - 1) === "?") return true;
      var words = t.split(/\s+/);
      if (words.length >= 6) return true;
      return QWORDS.indexOf(words[0].toLowerCase().replace(/[^a-z]/g, "")) >= 0;
    }
    function routeToAsk(q) {
      input.value = q;
      section.scrollIntoView({ behavior: "smooth", block: "start" });
      submit(q, "unified");
    }
    var TYPE_BY_PREFIX = [
      ["/case-studies/", "Case study"], ["/practice/", "Practice"],
      ["/writing/", "Essay"], ["/record/", "Record"],
      ["/speaking/", "Speaking"], ["/scorecard/", "Tool"]
    ];
    var boostType = null;
    TYPE_BY_PREFIX.forEach(function (pair) { if (page.indexOf(pair[0]) === 0) boostType = pair[1]; });
    var optionalFilters = boostType ? ["type:" + boostType + "<score=2>"] : [];

    var anonToken = null;
    try {
      anonToken = window.sessionStorage.getItem("dc_anon_token");
      if (!anonToken) {
        anonToken = "anon-" + Math.random().toString(36).slice(2) + Date.now().toString(36);
        window.sessionStorage.setItem("dc_anon_token", anonToken);
      }
    } catch (e) { anonToken = "anon-ephemeral"; }

    var CDN = [
      "https://cdn.jsdelivr.net/npm/algoliasearch@4/dist/algoliasearch-lite.umd.js",
      "https://cdn.jsdelivr.net/npm/@algolia/autocomplete-preset-algolia@1/dist/umd/index.production.min.js",
      "https://cdn.jsdelivr.net/npm/@algolia/autocomplete-plugin-recent-searches@1/dist/umd/index.production.min.js",
      "https://cdn.jsdelivr.net/npm/@algolia/autocomplete-plugin-algolia-insights@1/dist/umd/index.production.min.js",
      "https://cdn.jsdelivr.net/npm/search-insights@2/dist/search-insights.min.js",
      "https://cdn.jsdelivr.net/npm/@algolia/autocomplete-js@1/dist/umd/index.production.min.js"
    ];
    function loadAll(urls, done) {
      var left = urls.length, finished = false;
      function step() { left--; if (left === 0 && !finished) { finished = true; done(); } }
      urls.forEach(function (u) {
        var sc = document.createElement("script");
        sc.src = u; sc.async = true; sc.onload = step; sc.onerror = step;
        document.head.appendChild(sc);
      });
      setTimeout(function () { if (!finished) { finished = true; done(); } }, 6000);
    }

    function initInsights() {
      var lib = window.AlgoliaAnalytics;
      var aa = lib && (lib.default || lib);
      if (typeof aa !== "function") return null;
      try {
        aa("init", { appId: ALGOLIA_APP, apiKey: ALGOLIA_SEARCH_KEY });
        aa("setUserToken", anonToken);
      } catch (e) { return null; }
      return aa;
    }

    function initAutocomplete() {
      var acLib = window["@algolia/autocomplete-js"];
      var preset = window["@algolia/autocomplete-preset-algolia"];
      if (!acLib || !acLib.autocomplete || !acLib.html || !preset || !preset.getAlgoliaResults || typeof window.algoliasearch !== "function") return false;
      var recentLib = window["@algolia/autocomplete-plugin-recent-searches"];
      var insightsLib = window["@algolia/autocomplete-plugin-algolia-insights"];
      var searchClient = window.algoliasearch(ALGOLIA_APP, ALGOLIA_SEARCH_KEY);
      var plugins = [];
      var aa = initInsights();
      if (aa && insightsLib && insightsLib.createAlgoliaInsightsPlugin) {
        plugins.push(insightsLib.createAlgoliaInsightsPlugin({ insightsClient: aa }));
      }
      if (recentLib && recentLib.createRecentSearchesPlugin) {
        plugins.push(recentLib.createRecentSearchesPlugin({
          localStorage: { key: "dc-recent-searches", limit: 4 },
          transformSource: function (args) {
            args.source.templates.header = function () { return acLib.html`<span className="aa-SourceHeader">Recent searches</span>`; };
            return args.source;
          }
        }));
      }
      var lastTracked = "";
      acLib.autocomplete({
        container: "#explore-ac",
        placeholder: ctx.placeholder,
        plugins: plugins,
        openOnFocus: true,
        getSources: function (args) {
          var query = args.query || "";
          var sources = [];
          if (isQuestion(query)) {
            sources.push({
              sourceId: "ask",
              getItems: function () { return [{ label: query, objectID: "ask-route" }]; },
              onSelect: function (a) { routeToAsk(a.item.label); a.setIsOpen(false); },
              templates: {
                item: function (a) {
                  return acLib.html`<span className="askline">Ask my record: \u201C${a.item.label}\u201D</span>`;
                }
              }
            });
          }
          sources.push({
            sourceId: "pages",
            getItems: function () {
              return preset.getAlgoliaResults({
                searchClient: searchClient,
                queries: [{
                  indexName: ALGOLIA_INDEX,
                  params: { query: query, hitsPerPage: 6, clickAnalytics: true, optionalFilters: optionalFilters, attributesToHighlight: [] }
                }]
              });
            },
            onSelect: function (a) {
              track("search_result_click", { page: page, destination_type: a.item.type || "" });
              window.location.href = a.item.url;
            },
            templates: {
              header: function () { return query ? acLib.html`<span className="aa-SourceHeader">Pages and essays</span>` : null; },
              item: function (a) {
                return acLib.html`<span className="t">${a.item.type}</span><span className="ti">${a.item.title}</span><span className="sm">${a.item.summary}</span>`;
              },
              noResults: function () {
                return query && !isQuestion(query) ? acLib.html`<span className="sm">Nothing in the record matches that. Ask it as a question instead.</span>` : null;
              }
            }
          });
          if (!query) {
            sources.push({
              sourceId: "suggested",
              getItems: function () { return ctx.chips.map(function (c, i) { return { label: c, objectID: "chip-" + i }; }); },
              onSelect: function (a) { routeToAsk(a.item.label); a.setIsOpen(false); },
              templates: {
                header: function () { return acLib.html`<span className="aa-SourceHeader">Ask my record</span>`; },
                item: function (a) { return acLib.html`<span className="askline">${a.item.label}</span>`; }
              }
            });
          }
          return sources;
        },
        onSubmit: function (a) {
          var q = (a.state.query || "").trim();
          if (q.length >= 3 && isQuestion(q)) routeToAsk(q);
        },
        onStateChange: function (a) {
          var q = (a.state.query || "").trim();
          if (q.length >= 3 && q !== lastTracked) {
            lastTracked = q;
            var has = false;
            (a.state.collections || []).forEach(function (c) { if (c.source && c.source.sourceId === "pages" && c.items && c.items.length) has = true; });
            track("search_query", { page: page, length: q.length, result_class: has ? "results" : "none" });
          }
        }
      });
      return true;
    }

    /* Fallback: the A1 hand-rolled behavior, same routing and measurement. */
    function initFallback() {
      var wrap = document.getElementById("explore-fallback");
      wrap.hidden = false;
      var ein = document.getElementById("explore-q");
      ein.setAttribute("placeholder", ctx.placeholder);
      var panel = document.getElementById("explore-panel");
      var aa = initInsights();
      function showChips() {
        panel.innerHTML = "";
        var w = document.createElement("div");
        w.className = "explore-chips";
        ctx.chips.forEach(function (c) {
          var b = document.createElement("button");
          b.type = "button"; b.className = "ask-chip"; b.textContent = c;
          b.addEventListener("click", function () { routeToAsk(c); });
          w.appendChild(b);
        });
        panel.appendChild(w);
        panel.hidden = false;
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
                if (aa && queryID) { try { aa("clickedObjectIDsAfterSearch", { eventName: "Search Result Clicked", index: ALGOLIA_INDEX, queryID: queryID, objectIDs: [h.objectID] }); } catch (e) {} }
              });
              panel.appendChild(a);
            });
            panel.hidden = false;
          })
          .catch(function () { panel.hidden = true; });
      }
      ein.addEventListener("focus", function () {
        track("explore_focus", { page: page });
        if (!ein.value.trim()) showChips();
      });
      ein.addEventListener("input", function () {
        var q = ein.value.trim();
        if (debounce) clearTimeout(debounce);
        if (q.length < 3) { if (!q) showChips(); else panel.hidden = true; return; }
        if (isQuestion(q)) {
          panel.innerHTML = "";
          var row = document.createElement("button");
          row.type = "button"; row.className = "explore-askrow";
          row.textContent = "Ask my record: \u201C" + q + "\u201D";
          row.addEventListener("click", function () { routeToAsk(q); });
          panel.appendChild(row);
          panel.hidden = false;
          return;
        }
        debounce = setTimeout(function () { if (q !== lastQuery) { lastQuery = q; runSearch(q); } }, 300);
      });
      ein.addEventListener("keydown", function (ev) {
        if (ev.key !== "Enter") return;
        ev.preventDefault();
        var q = ein.value.trim();
        if (q.length < 3) return;
        if (isQuestion(q)) { routeToAsk(q); return; }
        var first = panel.querySelector(".explore-hit");
        if (first) window.location.href = first.getAttribute("href");
      });
      document.addEventListener("click", function (ev) { if (!bar.contains(ev.target)) panel.hidden = true; });
    }

    loadAll(CDN, function () {
      var ok = false;
      try { ok = initAutocomplete(); } catch (e) { ok = false; }
      if (!ok) {
        var ac = document.getElementById("explore-ac");
        if (ac) ac.innerHTML = "";
        initFallback();
      } else {
        track("explore_focus", { page: page });
      }
    });
  })();

})();
