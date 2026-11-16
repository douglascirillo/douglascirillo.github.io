/* Phase 3b session compositions (client renderer).
   Renders a precomputed composition under the home page intent panel when
   a visitor selects an intent, and restores one from a shared URL of the
   form /#c=<signature>. The compositions themselves are built offline by
   compose.py into /compositions.json, keyed by a hash of the canonical
   block list. An unknown or tampered signature matches nothing and the
   static page serves unchanged (the fallback). Composition HTML is a
   build-time artifact rendered from approved block texts by our own
   pipeline, the same trust level as the page itself.
   Kill switch: COMPOSITIONS_ENABLED = false, or ship an empty
   compositions.json. */
(function () {
  "use strict";
  var COMPOSITIONS_ENABLED = true;
  if (!COMPOSITIONS_ENABLED) return;

  var byIntent = null; // intent -> {sig, html}
  var bySig = null;    // sig -> {intent, html}
  var loading = null;

  function track(name, props) {
    try {
      if (window.amplitude && typeof window.amplitude.track === "function") {
        window.amplitude.track(name, props || {});
      }
    } catch (e) { /* measurement never breaks the page */ }
  }

  function load() {
    if (byIntent) return Promise.resolve(byIntent);
    if (loading) return loading;
    loading = fetch("/compositions.json")
      .then(function (r) { return r.ok ? r.json() : null; })
      .then(function (data) {
        byIntent = {}; bySig = {};
        if (data && data.compositions) {
          Object.keys(data.compositions).forEach(function (sig) {
            var entry = data.compositions[sig];
            bySig[sig] = entry;
            byIntent[entry.intent] = { sig: sig, html: entry.html };
          });
        }
        return byIntent;
      })
      .catch(function () { byIntent = {}; bySig = {}; return byIntent; });
    return loading;
  }

  var LINKS = {
    search_decline: [{ href: "/case-studies/a-place-for-mom/", label: "The A Place for Mom case study" }, { href: "/practice/ai-readiness-and-answer-discoverability/", label: "AI readiness and answer discoverability" }, { href: "https://www.linkedin.com/in/douglascirillo/", label: "Start a conversation on LinkedIn" }],
    cdp: [{ href: "/case-studies/sothebys/", label: "The Sotheby&rsquo;s case study" }, { href: "/practice/composable-martech-and-customer-data/", label: "Composable martech and customer data" }, { href: "https://www.linkedin.com/in/douglascirillo/", label: "Start a conversation on LinkedIn" }],
    replatform: [{ href: "/case-studies/ae-networks/", label: "The A+E Networks case study" }, { href: "/case-studies/lindblad-expeditions/", label: "The Lindblad case study" }, { href: "/practice/digital-experience-strategy/", label: "Digital experience strategy" }],
    team: [{ href: "/case-studies/madison-square-garden/", label: "The Madison Square Garden case study" }, { href: "/case-studies/gangverk/", label: "The Gangverk case study" }, { href: "https://www.linkedin.com/in/douglascirillo/", label: "Start a conversation on LinkedIn" }],
    speaking: [{ href: "/speaking/", label: "Speaking and media" }, { href: "https://youtu.be/1bVX-cdZekI", label: "Watch the talk" }, { href: "https://www.linkedin.com/in/douglascirillo/", label: "Start a conversation on LinkedIn" }],
    coherence: [{ href: "/practice/digital-experience-strategy/", label: "Digital experience strategy" }, { href: "/case-studies/madison-square-garden/", label: "The Madison Square Garden case study" }, { href: "https://www.linkedin.com/in/douglascirillo/", label: "Start a conversation on LinkedIn" }],
    measurement: [{ href: "/scorecard/", label: "Take the scorecard" }, { href: "/practice/experimentation-and-measurement/", label: "Experimentation and measurement" }, { href: "https://www.linkedin.com/in/douglascirillo/", label: "Start a conversation on LinkedIn" }]
  };

  function slot() { return document.getElementById("composition"); }

  function clearComposition() {
    var el = slot();
    if (el) { el.hidden = true; el.innerHTML = ""; }
    Array.prototype.forEach.call(
      document.querySelectorAll(".intent-btn"),
      function (b) { b.setAttribute("aria-pressed", "false"); });
    try { history.replaceState(null, "", location.pathname); } catch (e) {}
  }

  function render(intent, sig, opts) {
    var el = slot();
    if (!el || !byIntent) return;
    var entry = byIntent[intent];
    if (!entry) { el.hidden = true; el.innerHTML = ""; return; }
    var links = LINKS[intent] || [];
    var linksHtml = "";
    if (links.length) {
      linksHtml = '<p class="intent-links">' + links.map(function (l) {
        return '<a href="' + l.href + '">' + l.label + "</a>";
      }).join("") + "</p>";
    }
    // A classified render (Stage 1: the visitor described the problem in
    // their own words and the classifier matched it) carries a distinct
    // line under the heading. Button renders do not.
    var fromIntent = (opts && opts.classified)
      ? '<p class="composition-from-intent">Assembled from the intent you described.</p>'
      : "";
    el.innerHTML =
      '<h3 class="composition-h">The full picture</h3>' + fromIntent + entry.html + linksHtml +
      '<p class="composition-note">Assembled for this visit from the ' +
      "published record. The static pages underneath do not change.</p>" +
      '<p class="intent-reset"><button type="button" id="intent-reset">See the full record instead</button></p>';
    el.hidden = false;
    var resetBtn = el.querySelector("#intent-reset");
    if (resetBtn) resetBtn.addEventListener("click", clearComposition);
    Array.prototype.forEach.call(
      document.querySelectorAll(".intent-btn"),
      function (b) {
        b.setAttribute("aria-pressed",
          b.getAttribute("data-intent") === "intent_" + intent ? "true" : "false");
      });
    try {
      history.replaceState(null, "", "#c=" + (sig || entry.sig));
    } catch (e) {}
    track("composition_rendered", { intent: intent });
  }

  function intentOfButton(btn) {
    var raw = btn.getAttribute("data-intent") || "";
    return raw.replace(/^intent_/, "");
  }

  /* Stage 1 intent classification: the free-text field in the entry card
     posts the visitor's stated problem to the Ask endpoint in classify
     mode. A matched intent renders exactly like a button click, plus the
     stated-intent label. The endpoint returns refusals in the same shape
     as a genuine no-match, so both show the same quiet line and the
     client cannot distinguish them. A disabled classifier or any error
     changes nothing on the page. */
  var ASK_ENDPOINT = "https://7i3yr1dzge.execute-api.us-east-1.amazonaws.com/ask";

  function wireClassify() {
    var form = document.getElementById("intent-freeform");
    if (!form) return;
    var input = document.getElementById("intent-text");
    var go = document.getElementById("intent-go");
    var noneLine = document.getElementById("intent-none");
    function classifiedEvent(intent, outcome) {
      track("composition_intent_classified",
        { intent_id: intent, outcome: outcome });
    }

    form.addEventListener("submit", function (ev) {
      ev.preventDefault();
      var text = (input.value || "").trim();
      if (text.length < 3) return;
      if (go) go.disabled = true;
      fetch(ASK_ENDPOINT, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ mode: "classify", text: text })
      }).then(function (r) { return r.ok ? r.json() : null; })
        .then(function (data) {
          if (go) go.disabled = false;
          if (!data || data.disabled) {
            classifiedEvent(null, "not_matched");
            return;
          }
          if (data.type === "intent" && data.intent) {
            var intent = data.intent;
            if (noneLine) noneLine.hidden = true;
            classifiedEvent(intent, "matched");
            load().then(function () { render(intent, null, { classified: true }); });
            return;
          }
          if (data.type === "intent") {
            if (noneLine) noneLine.hidden = false;
            classifiedEvent(null, "not_matched");
            return;
          }
          classifiedEvent(null, "not_matched");
        })
        .catch(function () {
          if (go) go.disabled = false;
          classifiedEvent(null, "not_matched");
        });
    });
    // A button click supersedes a pending no-match line.
    Array.prototype.forEach.call(
      document.querySelectorAll(".intent-btn"),
      function (b) {
        b.addEventListener("click", function () {
          if (noneLine) noneLine.hidden = true;
        });
      });
  }

  function init() {
    var el = slot();
    if (!el) return;
    wireClassify();
    el.setAttribute("aria-live", "polite");
    var btns = document.querySelectorAll(".intent-btn");
    Array.prototype.forEach.call(btns, function (btn) {
      btn.addEventListener("click", function () {
        load().then(function () { render(intentOfButton(btn)); });
      });
    });
    window.addEventListener("hashchange", function () {
      var hm = /#c=([0-9a-f]{24})/.exec(location.hash || "");
      if (!hm) { clearComposition(); return; }
      load().then(function () {
        var e2 = bySig && bySig[hm[1]];
        if (e2) render(e2.intent, hm[1]);
        else clearComposition();
      });
    });
    var m = /#c=([0-9a-f]{24})/.exec(location.hash || "");
    if (m) {
      load().then(function () {
        var entry = bySig && bySig[m[1]];
        if (!entry) {
          track("composition_fallback", {});
          return;
        }
        var target = document.querySelector(
          '.intent-btn[data-intent="intent_' + entry.intent + '"]'
        );
        if (target) target.click();
        render(entry.intent, m[1]);
        if (el.scrollIntoView) el.scrollIntoView({ block: "nearest" });
      });
    }
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }
})();
