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

  function slot() { return document.getElementById("composition"); }

  function render(intent, sig) {
    var el = slot();
    if (!el || !byIntent) return;
    var entry = byIntent[intent];
    if (!entry) { el.hidden = true; el.innerHTML = ""; return; }
    el.innerHTML =
      '<h3 class="composition-h">The full picture</h3>' + entry.html +
      '<p class="composition-note">Assembled for this visit from the ' +
      "published record. The static pages underneath do not change.</p>";
    el.hidden = false;
    try {
      history.replaceState(null, "", "#c=" + (sig || entry.sig));
    } catch (e) {}
    track("composition_rendered", { intent: intent });
  }

  function intentOfButton(btn) {
    var raw = btn.getAttribute("data-intent") || "";
    return raw.replace(/^intent_/, "");
  }

  function init() {
    var el = slot();
    if (!el) return;
    var reset = document.getElementById("intent-reset");
    if (reset) {
      reset.addEventListener("click", function () {
        el.hidden = true;
        el.innerHTML = "";
        try { history.replaceState(null, "", location.pathname); } catch (e) {}
      });
    }
    var btns = document.querySelectorAll(".intent-btn");
    Array.prototype.forEach.call(btns, function (btn) {
      btn.addEventListener("click", function () {
        load().then(function () { render(intentOfButton(btn)); });
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
