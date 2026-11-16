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
   compositions.json.

   Unified input (Stage 1 + Stage 2): the home page has ONE text input,
   the record bar (ask.js). When a question gets the no-evidence answer,
   ask.js dispatches a "dc:problem" event with the same text and this
   file offers it to the Ask endpoint's classify mode. A matched intent
   renders exactly like a button click (manifest code included); a novel
   block spec is validated against /blocks.json and rendered for this
   visit only (no share code, the URL does not change). Refusals return
   in the same shape as a genuine no-match, so both leave the
   no-evidence answer exactly as it was. */
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
    if (el) {
      el.hidden = true; el.innerHTML = "";
      el.removeAttribute("data-render-key");
      el.removeAttribute("data-render-source");
    }
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
        return '<a href="' + l.href + '"' + extAttr(l.href) + trackAttr(l.href, l.label) + '>' + l.label + extHint(l.href) + "</a>";
      }).join("") + "</p>";
    }
    // A classified render (the visitor described the problem in their
    // own words and the classifier matched it) carries a line under the
    // heading that a button render does not: the connection line when
    // the unified input supplies one, else the stated-intent label.
    var fromIntent = "";
    if (opts && opts.connectionLine) {
      fromIntent = '<p class="composition-from-intent">' + opts.connectionLine + "</p>";
    } else if (opts && opts.classified) {
      fromIntent = '<p class="composition-from-intent">Assembled from the intent you described.</p>';
    }
    el.innerHTML =
      '<h3 class="composition-h">The full picture</h3>' + fromIntent + entry.html + linksHtml +
      '<p class="composition-note">Assembled for this visit from the ' +
      "published record. The static pages underneath do not change.</p>" +
      '<p class="intent-reset"><button type="button" id="intent-reset">See the full record instead</button></p>';
    el.hidden = false;
    el.setAttribute("data-render-key", "intent:" + intent);
    el.setAttribute("data-render-source",
      (opts && (opts.classified || opts.connectionLine)) ? "classified" : "button");
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
    track("Composition Rendered", { intent: intent });
  }

  function intentOfButton(btn) {
    var raw = btn.getAttribute("data-intent") || "";
    return raw.replace(/^intent_/, "");
  }

  /* ---------- Unified input: classify fall-through (Stage 1 + 2) ------
     ask.js owns the one input. On a no-evidence answer it dispatches
     "dc:problem" with the visitor's text; this listener offers the text
     to classify mode. Outcomes:
     - intent: render like a button click, with the connection line.
     - spec: validate against /blocks.json, render for this visit only.
     - null (which includes refusals, by the oracle design), disabled,
       or any error: the no-evidence answer stands exactly as rendered.
     A submission is never left looking dead: the slot shows a pending
     line while classify runs (unless a button composition is on
     screen), a match scrolls the composition into view, and a match
     for the composition already on screen updates its line instead of
     silently re-rendering identical HTML. */
  var ASK_ENDPOINT = "https://7i3yr1dzge.execute-api.us-east-1.amazonaws.com/ask";
  var CONNECTION_LINE = "No direct answer in the record. This view is assembled for the problem you described.";
  var REPEAT_LINE = "That maps to the view already on screen.";
  var PENDING_LINE = "Checking for a view that fits the problem you described.";
  var classifySeq = 0;

  function classifiedEvent(intent, outcome, source) {
    track("Composition Intent Classified",
      { intent_id: intent, outcome: outcome, source: source });
  }

  function scrollSlotIntoView(el) {
    try { if (el.scrollIntoView) el.scrollIntoView({ block: "nearest" }); } catch (e) {}
  }

  function showPending() {
    var el = slot();
    if (!el) return;
    // A composition already on screen (button or classified) stays
    // untouched while classify runs: replacing it with the pending
    // line would destroy the very render a repeat match needs to
    // acknowledge, and the answer box already shows the record being
    // checked. The pending line appears only when the slot is empty.
    if (!el.hidden) return;
    el.innerHTML = '<p class="composition-from-intent">' + PENDING_LINE + "</p>";
    el.hidden = false;
    el.setAttribute("data-render-key", "pending");
    el.setAttribute("data-render-source", "classified");
  }

  function hideSlot() {
    var el = slot();
    if (!el) return;
    el.hidden = true; el.innerHTML = "";
    el.removeAttribute("data-render-key");
    el.removeAttribute("data-render-source");
  }

  // True when the requested composition is already on screen: update
  // its connection line and scroll it into view rather than
  // re-rendering identical HTML with no visible acknowledgment.
  function repeatIfSame(key) {
    var el = slot();
    if (!el || el.hidden) return false;
    if (el.getAttribute("data-render-key") !== key) return false;
    var line = el.querySelector(".composition-from-intent");
    if (!line) return false;
    line.textContent = REPEAT_LINE;
    scrollSlotIntoView(el);
    return true;
  }

  function renderClassifiedIntent(intent) {
    if (repeatIfSame("intent:" + intent)) return;
    render(intent, null, { connectionLine: CONNECTION_LINE });
    scrollSlotIntoView(slot());
  }

  /* ----- Stage 2: blocks payload, validator port, spec renderer ----- */
  var blocksPayload = null;
  var blocksLoading = null;

  function loadBlocks() {
    if (blocksPayload) return Promise.resolve(blocksPayload);
    if (blocksLoading) return blocksLoading;
    blocksLoading = fetch("/blocks.json")
      .then(function (r) { return r.ok ? r.json() : null; })
      .then(function (data) {
        blocksPayload = (data && data.blocks) ? data : null;
        return blocksPayload;
      })
      .catch(function () { blocksPayload = null; return null; });
    return blocksLoading;
  }

  function esc(s) {
    return String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;")
      .replace(/>/g, "&gt;").replace(/"/g, "&quot;");
  }

  /* Outbound rule (Douglas, Nov 15): external links open in a new tab;
     internal links stay in the same tab. Returns the attribute string
     to splice into a built anchor tag. */
  function extAttr(href) {
    var m = /^https?:\/\/([^\/]+)/i.exec(href || "");
    return m && m[1].toLowerCase() !== "douglascirillo.com"
      ? ' target="_blank" rel="noopener"' : "";
  }

  /* Audit #3 follow-ups (D2, D3): a built external anchor gets the
     same treatment as a static one: the pages' delegated handler keys
     on data-outbound-link and reads data-link-label to fire
     "Outbound Link Click", and a visually hidden "(opens in new tab)"
     hint is announced to screen readers. Internal hrefs get neither. */
  function trackAttr(href, label) {
    return extAttr(href)
      ? ' data-outbound-link data-link-label="' +
        esc(String(label).replace(/&rsquo;/g, "'")) + '"' : "";
  }
  function extHint(href) {
    return extAttr(href)
      ? '<span class="visually-hidden">(opens in new tab)</span>' : "";
  }

  // Port of compose.py's validate() plus the two free-form additions
  // from the Stage 2 design (block-count cap, frame-or-contact anchor).
  // The payload itself carries only servable blocks: a withdrawn
  // record's block is absent, so a spec naming it fails as unknown.
  function validateSpec(spec, payload) {
    if (!spec || !payload || !payload.blocks) return false;
    var items = spec.blocks;
    if (!Array.isArray(items)) return false;
    var maxBlocks = payload.max_blocks || 6;
    if (items.length < 1 || items.length > maxBlocks) return false;
    var byId = {};
    payload.blocks.forEach(function (b) { byId[b.id] = b; });
    var anchors = {};
    (payload.anchor_kinds || ["intro", "intent_frame", "contact"])
      .forEach(function (k) { anchors[k] = true; });
    var seen = {};
    var anchored = false;
    for (var i = 0; i < items.length; i++) {
      var item = items[i] || {};
      var block = byId[item.id];
      if (!block) return false;                    // unknown block
      if (seen[item.id]) return false;             // duplicate block
      seen[item.id] = true;
      var text = block.lengths ? block.lengths[item.length] : undefined;
      if (typeof text !== "string") return false; // unapproved length
      var scope = block.scope_required || [];
      for (var j = 0; j < scope.length; j++) {
        if (text.indexOf(scope[j]) === -1) return false; // scope dropped
      }
      if (anchors[block.kind]) anchored = true;
      if (block.kind === "contact" && i !== items.length - 1) return false;
    }
    if (!anchored) return false;
    // Restricted-block placement rule (mirror of the Lambda validator
    // and compose.py; P-1115-16, edit 4): a block with forbidden_intents
    // (today only speaking-synapse) may appear only in a spec it leads
    // (first position) or one carrying the anchor frame of an intent it
    // is not forbidden on (for speaking-synapse, intent-frame-speaking).
    var frameIntent = {};
    payload.blocks.forEach(function (b) {
      if (b.kind === "intent_frame" && b.id.indexOf("intent-frame-") === 0) {
        frameIntent[b.id] = b.id.slice("intent-frame-".length).replace(/-/g, "_");
      }
    });
    for (var r = 0; r < items.length; r++) {
      var rb = byId[items[r].id];
      var forbidden = (rb && rb.forbidden_intents) || [];
      if (!forbidden.length || r === 0) continue;
      var okRestricted = false;
      Object.keys(frameIntent).forEach(function (fid) {
        if (seen[fid] && forbidden.indexOf(frameIntent[fid]) === -1) {
          okRestricted = true;
        }
      });
      if (!okRestricted) return false;
    }
    return true;
  }

  // Mirror of compose.py's render_fragment(): approved payload text,
  // escaped; links come from the payload only.
  function renderFragmentHtml(spec, payload) {
    var byId = {};
    payload.blocks.forEach(function (b) { byId[b.id] = b; });
    return spec.blocks.map(function (item) {
      var block = byId[item.id];
      var text = block.lengths[item.length];
      var paras = text.split("\n\n").map(function (p) {
        return "<p>" + esc(p) + "</p>";
      }).join("");
      if (block.kind === "proof" && block.link) {
        paras += '<p><a href="' + esc(block.link) + '"' + extAttr(block.link) + trackAttr(block.link, "Read the case study") + '>Read the case study' + extHint(block.link) + '</a></p>';
      }
      if (block.kind === "contact" && block.link) {
        paras = '<p><a href="' + esc(block.link) + '"' + extAttr(block.link) + trackAttr(block.link, "Start a conversation on LinkedIn") + '>' + esc(text) + extHint(block.link) + "</a></p>";
      }
      return '<section data-block="' + esc(block.id) + '" data-length="' +
        esc(item.length) + '">' + paras + "</section>";
    }).join("\n");
  }

  function specKey(spec) {
    return "spec:" + spec.blocks.map(function (b) {
      return b.id + ":" + b.length;
    }).join(",");
  }

  function renderSpec(spec, payload) {
    var el = slot();
    if (!el) return;
    el.innerHTML =
      '<h3 class="composition-h">The full picture</h3>' +
      '<p class="composition-from-intent">' + CONNECTION_LINE + "</p>" +
      renderFragmentHtml(spec, payload) +
      '<p class="composition-note">Assembled for this visit from the ' +
      "published record. The static pages underneath do not change.</p>" +
      '<p class="intent-reset"><button type="button" id="intent-reset">See the full record instead</button></p>';
    el.hidden = false;
    el.setAttribute("data-render-key", specKey(spec));
    el.setAttribute("data-render-source", "classified");
    var resetBtn = el.querySelector("#intent-reset");
    if (resetBtn) resetBtn.addEventListener("click", clearComposition);
    Array.prototype.forEach.call(
      document.querySelectorAll(".intent-btn"),
      function (b) { b.setAttribute("aria-pressed", "false"); });
    // No share code for a novel spec (manifest-only rule): the render
    // is session-only and the URL is not modified.
    scrollSlotIntoView(el);
    track("Composition Rendered", { intent: null, via: "spec" });
  }

  function classifyProblem(text) {
    var seq = ++classifySeq;
    showPending();
    fetch(ASK_ENDPOINT, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ mode: "classify", text: text })
    }).then(function (r) { return r.ok ? r.json() : null; })
      .then(function (data) {
        if (seq !== classifySeq) return; // a newer submission owns the slot
        if (!data || data.disabled || data.type !== "intent") {
          hideSlot();
          classifiedEvent(null, "not_matched", "typed_intent");
          return;
        }
        if (data.spec && data.spec.blocks) {
          loadBlocks().then(function (payload) {
            if (seq !== classifySeq) return;
            if (payload && validateSpec(data.spec, payload)) {
              if (!repeatIfSame(specKey(data.spec))) {
                renderSpec(data.spec, payload);
              }
              classifiedEvent(null, "matched", "typed_spec");
            } else {
              hideSlot();
              classifiedEvent(null, "not_matched", "typed_spec");
            }
          });
          return;
        }
        if (data.intent) {
          var intent = data.intent;
          load().then(function () {
            if (seq !== classifySeq) return;
            renderClassifiedIntent(intent);
            classifiedEvent(intent, "matched", "typed_intent");
          });
          return;
        }
        hideSlot();
        classifiedEvent(null, "not_matched", "typed_intent");
      })
      .catch(function () {
        if (seq !== classifySeq) return;
        hideSlot();
        classifiedEvent(null, "not_matched", "typed_intent");
      });
  }

  function init() {
    var el = slot();
    if (!el) return;
    el.setAttribute("aria-live", "polite");
    document.addEventListener("dc:problem", function (ev) {
      var text = ev && ev.detail && ev.detail.text;
      if (text) classifyProblem(text);
    });
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
          track("Composition Fallback", {});
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

  // Exposed for the eval harness: the shipped validator, exercised
  // against the shipped payload by run_specs_stage2.py.
  window.DCCompose = { validateSpec: validateSpec };

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }
})();
