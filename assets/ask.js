/* Ask My Record: cited retrieval UI for douglascirillo.com.
   One shared file, loaded by every page. Set ASK_ENABLED to false to remove
   the feature site-wide with no other change. ASK_ENDPOINT is set at deploy.
   Context-aware: each page gets its own placeholder, example questions drawn
   from that page's records, and a next step matched to the page's job. The
   page path is sent with the question so the service can prefer that page's
   records when several answer equally well.
   Amplitude: ask_module_viewed, ask_submitted, ask_answered, ask_no_evidence,
   ask_refused, ask_next_click. Every event carries the page path. */
(function () {
  var ASK_ENABLED = true;
  var ASK_ENDPOINT = "https://7i3yr1dzge.execute-api.us-east-1.amazonaws.com/ask";
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
      chips: ["How many websites did he replatform?", "What happened to digital ticket sales?", "What was MSG Go recognized for?"],
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
    ".ask .ask-next{margin-top:14px;font-size:15px}"
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
})();
