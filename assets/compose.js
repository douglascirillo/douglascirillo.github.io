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
   no-evidence answer exactly as it was.

   Increment 0 (full generative experience): a page that carries the
   mount with a data-compose-page attribute runs in page mode instead.
   On arrival the page's enumerated starting spec is validated
   against the page's payload slice (blocks-<type>s.json) and
   rendered in place ahead of the static body, which stays complete
   underneath. The v2 starting spec (Nov 16, 2026) is additive, not a
   restatement: the page's anchor at its short length (one line
   placing the page in the arc of the record), the paired sibling
   case study's proof, one principle or concept block, the fitting
   practice, and the contact block. The page's own proof is
   deliberately absent: the page is its own proof. A composition
   never links to the page it renders on (self-link ban): compose.py
   rejects a page spec that carries such a block, and the renderer
   strips any such link anyway, leaving the text standing.
   "View this page as published" dismisses the assembly. Page
   assemblies carry a self-describing share code
   (#a=v1.<page-slug>.<block>:<length>,...) that is re-validated on
   arrival; a code that fails validation serves the static page.
   Only fragments starting with a= are codes (any other fragment is
   a section link and is left untouched), and a default render
   writes no code: the URL carries one only for an assembly that
   differs from the page's starting spec (P-1116-02, edits 1, 3).
   No prompts or classification run in page mode in this increment.
   Kill switches: COMPOSE_PAGES[type] = false, or COMPOSITIONS_ENABLED
   = false for everything.

   Increment 1 (the persistent prompt field, design:
   site-generative/increment1-persistent-prompt-design.md): on pages
   listed in PROMPT_PAGES (default: none), the assembled view gains a
   session layer: a chips row of restorable states (chip zero is the
   published page), a prompt field at the foot of the assembly, and
   receipts rendered from session state. A submitted prompt goes to
   the Ask endpoint's compose_turn mode; the server re-validates and
   returns a whole spec, a pointer to a covering page, a release
   offer, or the null shape. Turns carry forward as validated specs,
   never as text the server re-reads. Scope widens only when the
   visitor confirms the named transition on screen. Session state
   lives in sessionStorage for the page and dies with the tab; no
   share code is ever written for a session build, and the URL stays
   the published page's. With PROMPT_PAGES empty the layer is inert
   and every page behaves exactly as Increment 0 left it. */
(function () {
  "use strict";
  var COMPOSITIONS_ENABLED = true;
  if (!COMPOSITIONS_ENABLED) return;

  // Increment 0 kill switch, per page type: a type set to false
  // leaves its pages exactly as published (no fetch, no assembly).
  var COMPOSE_PAGES = { "case-study": true };

  // Increment 1 allowlist, per page path: which pages may render
  // the prompt field. A separate switch from COMPOSE_PAGES because
  // the field is a different surface with a different risk (it
  // spends money per interaction). Pilot scope (Increment 1 Step 3
  // launch): the Lindblad Expeditions case study only. Emptying this
  // map is the client-side kill switch for the layer.
  var PROMPT_PAGES = { "/case-studies/lindblad-expeditions/": true };

  // Increment 1 session constants. The copy strings are Douglas's
  // decided values (Nov 16, 2026): the invitation, the placeholder,
  // the button, the pointer and confirmation lines, and the session
  // cap of 10 submitted prompts.
  var PROMPT_CAP = 10;
  var PROMPT_INVITATION = "This is a starting point. Prompt to rebuild it around your question.";
  var PROMPT_PLACEHOLDER = "Describe the view you need";
  var PROMPT_BUTTON = "Rebuild";
  var PROMPT_PENDING_LINE = "Rebuilding this view\u2026";
  var PROMPT_NONE_LINE = "That is not something the published record covers here. The view above is unchanged.";
  var PROMPT_CAP_LINE = "You have reached this session\u2019s prompt limit. Your builds above and the published page remain.";
  var PROMPT_START_LINE = "Assembled as a starting point.";

  /* ----- Surface build: the presenter seam (P-1116-19, E4/E5) -----
     One presenter is chosen once, here at boot. surface.js loads
     before this file and publishes window.DCSurface with
     active:true only when the control plane is live, so the
     choice is synchronous. LayeredPresenter runs the presentation
     code below exactly as it shipped through the increments;
     SurfacePresenter registers states, receipts, and turn
     dialogue with the control plane instead, and the canvas
     keeps only the composed blocks. If a surface call throws,
     trySurface flips the presenter to Layered for the rest of
     the visit and the caller re-renders through it: fail-open
     means the layered presentation appears, never missing
     furniture. The substrate (validation, weighting, share
     codes, ledger writes, events) is identical under both. */
  var PRESENTER = (window.DCSurface && window.DCSurface.active)
    ? "surface" : "layered";
  function surfaceOn() { return PRESENTER === "surface"; }
  function trySurface(fn) {
    try { return fn(window.DCSurface) === true; }
    catch (e) {
      PRESENTER = "layered";
      try {
        if (window.DCSurface && window.DCSurface.clearSession) {
          window.DCSurface.clearSession();
        }
      } catch (e2) { /* the band is best-effort on failure */ }
      return false;
    }
  }

  var NOTE_BUILT = "Built for this visit from the published record.";
  var lastHomeRender = null; // surface restore model for home views
  var pageSurfaceDismissed = false;

  function homeStatesModel(current, onRestoreView) {
    return {
      states: [{ name: "the published page" },
               { name: "the assembled view" }],
      current: current,
      onActivate: function (idx) {
        if (idx === 0) clearCompositionAny();
        else if (idx === 1 && onRestoreView) onRestoreView();
      }
    };
  }

  function clearCompositionAny() {
    clearComposition();
    if (surfaceOn()) {
      trySurface(function (S) {
        if (lastHomeRender) {
          S.registerStates(homeStatesModel(0, restoreHomeView));
        } else {
          S.clearStates();
        }
        S.setReceipt(null);
        return true;
      });
    }
  }

  function restoreHomeView() {
    var m = lastHomeRender;
    if (!m) return;
    if (m.kind === "spec") {
      renderSpec(m.spec, m.payload, m.cats, m.fresh);
    } else if (m.kind === "intent") {
      render(m.intent, m.sig, m.opts);
    }
  }

  function renderSpecSurface(S, spec, payload, historyCategories,
                             freshStartActive) {
    var el = slot();
    if (!el) return;
    lastHomeRender = {
      kind: "spec", spec: spec, payload: payload,
      cats: historyCategories, fresh: freshStartActive
    };
    var label = historyCategories
      ? ledgerCategoriesLabel(historyCategories) : null;
    var expanded = '<p class="composition-from-intent">' +
      CONNECTION_LINE + "</p>";
    if (freshStartActive) {
      expanded += '<p class="composition-from-intent">' +
        FRESH_START_CLAUSE + "</p>";
    } else if (label) {
      expanded += '<p class="composition-from-intent">' +
        "Assembled from the published record, weighted by " +
        esc(label) + " you opened here on earlier visits.</p>";
    }
    expanded += '<p class="composition-note">' + NOTE_BUILT + "</p>";
    el.innerHTML = '<h3 class="composition-h">The full picture</h3>' +
      renderFragmentHtml(spec, payload);
    el.hidden = false;
    el.setAttribute("data-render-key", specKey(spec));
    el.setAttribute("data-render-source", "classified");
    Array.prototype.forEach.call(
      document.querySelectorAll(".intent-btn"),
      function (b) { b.setAttribute("aria-pressed", "false"); });
    S.registerStates(homeStatesModel(1, restoreHomeView));
    S.setReceipt({
      historyLabel: label || null, aiFraming: false,
      expandedHtml: expanded,
      onRestore: function () { clearCompositionAny(); }
    });
    scrollSlotIntoView(el);
    track("Composition Rendered", { intent: null, via: "spec" });
    ledgerRecordComposition("/");
  }

  function renderIntentSurface(S, intent, sig, opts, entry, linksHtml) {
    var el = slot();
    if (!el) return;
    lastHomeRender = {
      kind: "intent", intent: intent, sig: sig, opts: opts
    };
    var expanded = "";
    if (opts && opts.connectionLine) {
      expanded += '<p class="composition-from-intent">' +
        opts.connectionLine + "</p>";
    } else if (opts && opts.classified) {
      expanded += '<p class="composition-from-intent">' +
        "Assembled from the intent you described.</p>";
    }
    expanded += '<p class="composition-note">' + NOTE_BUILT + "</p>";
    el.innerHTML = '<h3 class="composition-h">The full picture</h3>' +
      entry.html + linksHtml;
    el.hidden = false;
    el.setAttribute("data-render-key", "intent:" + intent);
    el.setAttribute("data-render-source",
      (opts && (opts.classified || opts.connectionLine))
        ? "classified" : "button");
    Array.prototype.forEach.call(
      document.querySelectorAll(".intent-btn"),
      function (b) {
        b.setAttribute("aria-pressed",
          b.getAttribute("data-intent") === "intent_" + intent
            ? "true" : "false");
      });
    try {
      history.replaceState(null, "", "#c=" + (sig || entry.sig));
    } catch (e) {}
    S.registerStates(homeStatesModel(1, restoreHomeView));
    S.setReceipt({
      historyLabel: null, aiFraming: false, expandedHtml: expanded,
      onRestore: function () { clearCompositionAny(); }
    });
    track("Composition Rendered", { intent: intent });
    if (!(opts && (opts.classified || opts.connectionLine))) {
      ledgerRecordIntent(intent);
    }
    ledgerRecordComposition("/");
  }

  function pageStatesModel(current) {
    return {
      states: [{ name: "the published page" },
               { name: "as you arrived" }],
      current: current,
      onActivate: function (idx) {
        if (idx === 0) dismissPageSurface();
        else if (idx === 1) restorePageSurface();
      }
    };
  }

  function renderPageSurface(S, el, page, pageEntry, view, spec,
                             source, historyCategories, eventSource) {
    pageSurfaceDismissed = false;
    var clause = historyCategories
      ? historyClauseLine(pageEntry.page_name, historyCategories)
      : "";
    lastPageRender = {
      el: el, page: page, entry: pageEntry, view: view, spec: spec,
      source: source, categories: clause ? historyCategories : null
    };
    el.innerHTML = '<h3 class="composition-h">The full picture</h3>' +
      renderFragmentHtml(spec, view, page);
    el.hidden = false;
    el.setAttribute("data-render-key", "page:" + page);
    el.setAttribute("data-render-source", source);
    if (!sameSpec(spec, pageEntry.starting_spec)) {
      try {
        history.replaceState(null, "",
          "#a=" + encodePageCode(page, spec));
      } catch (e) {}
    }
    var label = clause
      ? ledgerCategoriesLabel(historyCategories) : null;
    var expanded = '<p class="composition-from-intent">' +
      (clause || ("Assembled from the published record, starting " +
        "from " + esc(pageEntry.page_name) + ".")) + "</p>" +
      '<p class="composition-note">' + NOTE_BUILT + "</p>";
    S.registerStates(pageStatesModel(1));
    S.setReceipt({
      historyLabel: label || null, aiFraming: false,
      expandedHtml: expanded,
      onRestore: function () { dismissPageSurface(); }
    });
    track("Page Composition Rendered", {
      page: page, page_type: pageEntry.type,
      source: eventSource || source, block_count: spec.blocks.length
    });
    ledgerRecordComposition(page);
  }

  function dismissPageSurface() {
    var r = lastPageRender;
    if (!r || pageSurfaceDismissed) return;
    pageSurfaceDismissed = true;
    var el = r.el;
    el.hidden = true;
    el.innerHTML = "";
    el.removeAttribute("data-render-key");
    el.removeAttribute("data-render-source");
    if ((location.hash || "").indexOf("#a=") === 0) {
      try { history.replaceState(null, "", location.pathname); }
      catch (e) {}
    }
    track("Page Composition Dismissed", {
      page: r.page, page_type: r.entry.type, source: r.source
    });
    if (surfaceOn()) {
      trySurface(function (S) {
        S.setReceipt(null);
        S.registerStates(pageStatesModel(0));
        return true;
      });
    }
  }

  function restorePageSurface() {
    var r = lastPageRender;
    if (!r || !pageSurfaceDismissed) return;
    renderPageComposition(r.el, r.page, r.entry, r.view, r.spec,
      r.source, r.categories, "restore");
  }

  function sessionStateName(chip, idx) {
    if (idx === 0) return "the published page";
    if (chip.action === "start") return "as you arrived";
    return "rewrite " + chip.turn;
  }

  function sessionAreaSurfaceHtml(S) {
    if (S.dead) return "";
    var status = S.status
      ? '<p class="composition-from-intent prompt-status">' +
        esc(S.status) + "</p>" : "";
    if (S.ui === "pointer" && S.pending) {
      return status + '<div class="prompt-card"><p>That&rsquo;s ' +
        "covered in " + esc(S.pending.covering_name) +
        '.</p><p class="prompt-actions">' +
        '<a href="' + esc(S.pending.covering_page) + '">Open it</a>' +
        '<button type="button" id="prompt-build-here">Build it ' +
        "here instead</button></p></div>";
    }
    if (S.ui === "confirm") {
      return status + '<div class="prompt-card"><p>You&rsquo;re ' +
        "moving beyond " + esc(S.entry.page_name) +
        ". Build from the broader record instead?</p>" +
        '<p class="prompt-actions"><button type="button" ' +
        'id="prompt-release-confirm">Build from the broader ' +
        'record</button><button type="button" ' +
        'id="prompt-release-decline">Stay on this page</button>' +
        "</p></div>";
    }
    if (S.submits >= PROMPT_CAP) {
      return status + '<p class="composition-from-intent">' +
        PROMPT_CAP_LINE + "</p>";
    }
    return status + '<p class="composition-from-intent ' +
      'prompt-invitation-line">' + PROMPT_INVITATION + "</p>";
  }

  function wireTurnsArea(S) {
    var area = window.DCSurface.turnsArea();
    if (!area) return;
    var openHere = area.querySelector("#prompt-build-here");
    if (openHere) {
      openHere.addEventListener("click", function () {
        S.ui = "confirm";
        track("Prompt Release Offered", { page: S.page });
        renderSession();
      });
    }
    var confirmBtn = area.querySelector("#prompt-release-confirm");
    if (confirmBtn) {
      confirmBtn.addEventListener("click", function () {
        track("Prompt Release Confirmed", { page: S.page });
        confirmRelease(S);
      });
    }
    var declineBtn = area.querySelector("#prompt-release-decline");
    if (declineBtn) {
      declineBtn.addEventListener("click", function () {
        track("Prompt Release Declined", { page: S.page });
        S.ui = "field"; S.pending = null; S.status = "";
        renderSession();
      });
    }
  }

  function renderSessionSurface(SF, S) {
    var el = S.el;
    SF.registerTurnSubmit(function (text) {
      if (!pageSession || pageSession.dead) return false;
      submitPrompt(pageSession, text);
      return true;
    });
    var states = S.chips.map(function (chip, i) {
      return { name: sessionStateName(chip, i) };
    });
    SF.registerStates({
      states: states, current: S.current,
      onActivate: function (idx) { goChip(S, idx); }
    });
    var scopeChip = S.current === 0
      ? S.chips[S.lastBuilt || 1] : S.chips[S.current];
    SF.setScope(scopeChip && scopeChip.scope === "released"
      ? "Building from across the published record"
      : "Starting from " + S.entry.page_name);
    var area = SF.turnsArea();
    if (S.current === 0) {
      el.innerHTML = "";
      el.hidden = true;
      el.removeAttribute("data-render-key");
      el.removeAttribute("data-render-source");
      SF.setReceipt(null);
      if (area) {
        area.innerHTML = S.dead ? "" :
          '<p class="composition-from-intent ' +
          'prompt-invitation-line">' + PROMPT_INVITATION + "</p>";
      }
      SF.refreshBand();
      return;
    }
    var chip = S.chips[S.current];
    var clauseText = "";
    var cats = null;
    if (chip.action === "start") {
      var startCats = chip.categories || S.arrivalCategories;
      if (startCats) {
        clauseText = historyClauseLine(S.entry.page_name, startCats);
        if (clauseText) cats = startCats;
      }
    } else if (chip.freshStart) {
      clauseText = FRESH_START_CLAUSE;
    } else if (chip.categories) {
      clauseText = historyClauseLine(S.entry.page_name,
        chip.categories);
      if (clauseText) cats = chip.categories;
    }
    var expanded = '<p class="composition-from-intent">' +
      chipScopeLine(S, chip) + "</p>";
    if (clauseText) {
      expanded += '<p class="composition-from-intent">' +
        clauseText + "</p>";
    }
    expanded += '<p class="composition-from-intent ' +
      'prompt-turnline">' + chipTurnLine(chip) + "</p>" +
      '<p class="composition-note">' + NOTE_BUILT + "</p>";
    el.innerHTML = '<h3 class="composition-h">The full picture</h3>' +
      renderFragmentHtml(chip.spec, sessionViewFor(S, chip), S.page);
    el.hidden = false;
    el.setAttribute("data-render-key", "page:" + S.page);
    el.setAttribute("data-render-source", S.source);
    SF.setReceipt({
      historyLabel: cats ? ledgerCategoriesLabel(cats) : null,
      aiFraming: false, expandedHtml: expanded,
      onRestore: function () { goChip(S, 0); }
    });
    if (area) {
      area.innerHTML = sessionAreaSurfaceHtml(S);
      wireTurnsArea(S);
    }
    SF.refreshBand();
  }

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

  /* ----- Increment 3: on-device ledger integration -----
     Every DCLedger call is guarded and wrapped: a missing or inert
     ledger changes nothing, and measurement-and-ledger work never
     breaks the page. freshStartActive is a per-turn local at the
     call sites that have one (submitPrompt / handleTurnResponse /
     classifyProblem); the other call sites have no fresh-start
     context and guard on the ledger being enabled only. */
  function ledgerEnabled() {
    try {
      return !!(window.DCLedger && window.DCLedger.enabled);
    } catch (e) { return false; }
  }

  function ledgerRecordIntent(intent) {
    try {
      if (window.DCLedger && window.DCLedger.enabled &&
          typeof window.DCLedger.recordIntent === "function") {
        window.DCLedger.recordIntent(intent);
      }
    } catch (e) { /* the ledger never breaks the page */ }
  }

  function ledgerRecordComposition(pageKey) {
    try {
      if (window.DCLedger && window.DCLedger.enabled &&
          typeof window.DCLedger.recordComposition === "function") {
        window.DCLedger.recordComposition(pageKey);
      }
    } catch (e) { /* the ledger never breaks the page */ }
  }

  function ledgerRecordSpec(spec, page, scope) {
    try {
      if (window.DCLedger && window.DCLedger.enabled &&
          typeof window.DCLedger.recordSpec === "function") {
        window.DCLedger.recordSpec({
          blocks: spec.blocks.map(function (b) { return b.id; }),
          page: page, scope: scope
        });
      }
    } catch (e) { /* the ledger never breaks the page */ }
  }

  function ledgerCategoriesLabel(categories) {
    try {
      if (window.DCLedger && window.DCLedger.enabled && categories &&
          categories.length &&
          typeof window.DCLedger.categoriesLabel === "function") {
        var label = window.DCLedger.categoriesLabel(categories);
        return label ? String(label) : "";
      }
    } catch (e) { /* the ledger never breaks the page */ }
    return "";
  }

  var LEDGER_DOOR_BUTTON =
    '<p class="ledger-door"><button type="button" class="ledger-open">' +
    "What this site remembers on this device</button></p>";
  var FRESH_START_CLAUSE =
    "Built without your earlier reading here, as you asked.";

  function historyClauseLine(pageName, categories) {
    var label = ledgerCategoriesLabel(categories);
    if (!label) return "";
    return "Assembled from the published record, starting from " +
      esc(pageName) + ", weighted by " + esc(label) +
      " you opened here on earlier visits.";
  }

  function wireLedgerDoor(el) {
    try {
      Array.prototype.forEach.call(
        el.querySelectorAll(".ledger-open"),
        function (btn) {
          btn.addEventListener("click", function () {
            try {
              if (window.DCLedger && window.DCLedger.enabled &&
                  typeof window.DCLedger.openPanel === "function") {
                window.DCLedger.openPanel("receipt");
              }
            } catch (e) { /* the ledger never breaks the page */ }
          });
        });
    } catch (e) { /* the ledger never breaks the page */ }
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
    if (surfaceOn() && trySurface(function (S) {
      renderIntentSurface(S, intent, sig, opts, entry, linksHtml);
      return true;
    })) return;
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
    // Increment 3 writers: the intent pick and the composition
    // render write to the ledger at the same points their events
    // fire. A classified render records its intent once, in
    // renderClassifiedIntent, so render() skips the intent write
    // for classified renders to avoid counting it twice.
    if (!(opts && (opts.classified || opts.connectionLine))) {
      ledgerRecordIntent(intent);
    }
    ledgerRecordComposition("/");
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
    if (surfaceOn() && trySurface(function (S) {
      var area = S.turnsArea();
      if (area) {
        area.innerHTML = '<p class="composition-from-intent ' +
          'cp-pending-line">' + PENDING_LINE + "</p>";
        S.refreshBand();
      }
      return true;
    })) return;
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
    if (surfaceOn()) {
      trySurface(function (S) {
        var area = S.turnsArea();
        if (area && area.querySelector(".cp-pending-line")) {
          area.innerHTML = "";
        }
        S.setReceipt(null);
        S.clearStates();
        lastHomeRender = null;
        S.refreshBand();
        return true;
      });
    }
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
    // Increment 3 writer (classified path): recorded here, once;
    // render() skips its intent write for classified renders.
    ledgerRecordIntent(intent);
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

  // Port of compose.py's validate() plus the free-form additions
  // from the Stage 2 design (block-count cap, frame-or-contact
  // anchor, and the one-frame cap added Nov 16, 2026).
  // The payload itself carries only servable blocks: a withdrawn
  // record's block is absent, so a spec naming it fails as unknown.
  // Increment 0 generalizes the anchor rule: the anchor block of
  // the page the spec is assembled for (kind page_anchor, carried
  // in the payload's page_anchors array or inside a page slice)
  // also anchors, only when `page` names its own page and only in
  // first position; a page-anchor block anywhere else fails the
  // spec. Mirrors the Lambda validator and compose.py.
  function validateSpec(spec, payload, page) {
    if (!spec || !payload || !payload.blocks) return false;
    var items = spec.blocks;
    if (!Array.isArray(items)) return false;
    var maxBlocks = payload.max_blocks || 6;
    if (items.length < 1 || items.length > maxBlocks) return false;
    var byId = {};
    payload.blocks.forEach(function (b) { byId[b.id] = b; });
    (payload.page_anchors || []).forEach(function (b) { byId[b.id] = b; });
    // Page-only blocks (Increment 0 v2: the principle and concept
    // blocks assigned to case-study assemblies) resolve only in a
    // page context, mirroring the Lambda validator, so a home spec
    // can never select one (P-1116-04, risks 1-3). Page slices carry
    // them inside their blocks array, so page mode is unaffected.
    if (page) {
      (payload.page_blocks || []).forEach(function (b) { byId[b.id] = b; });
    }
    var anchors = {};
    (payload.anchor_kinds || ["intro", "intent_frame", "contact"])
      .forEach(function (k) { anchors[k] = true; });
    var seen = {};
    var anchored = false;
    var frames = 0;
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
      if (block.kind === "page_anchor") {
        if (!page || block.page !== page || i !== 0) return false;
        anchored = true;
      }
      if (block.kind === "intent_frame") frames++;
      if (block.kind === "contact" && i !== items.length - 1) return false;
    }
    if (!anchored) return false;
    // One-frame cap (Nov 16, 2026; mirror of the Lambda validator
    // and compose.py): at most one intent-frame block per spec.
    if (frames > 1) return false;
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
  // escaped; links come from the payload only. Self-link ban
  // (Increment 0 v2): a block whose link target is the page the
  // composition renders on renders without the link; the text
  // stands, the link affordance goes. `page` is the render page in
  // page mode; home renders pass nothing and the current path is
  // used (no block links to the home page, so it is a no-op there).
  function renderFragmentHtml(spec, payload, page) {
    var byId = {};
    payload.blocks.forEach(function (b) { byId[b.id] = b; });
    var here = page || location.pathname;
    return spec.blocks.map(function (item) {
      var block = byId[item.id];
      var text = block.lengths[item.length];
      var link = block.link;
      if (link && here && link === here) link = null;
      var paras = text.split("\n\n").map(function (p) {
        return "<p>" + esc(p) + "</p>";
      }).join("");
      if (block.kind === "proof" && link) {
        paras += '<p><a href="' + esc(link) + '"' + extAttr(link) + trackAttr(link, "Read the case study") + '>Read the case study' + extHint(link) + '</a></p>';
      }
      if (block.kind === "contact" && link) {
        paras = '<p><a href="' + esc(link) + '"' + extAttr(link) + trackAttr(link, "Start a conversation on LinkedIn") + '>' + esc(text) + extHint(link) + "</a></p>";
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

  function renderSpec(spec, payload, historyCategories, freshStartActive) {
    if (surfaceOn() && trySurface(function (S) {
      renderSpecSurface(S, spec, payload, historyCategories,
        freshStartActive);
      return true;
    })) return;
    var el = slot();
    if (!el) return;
    var historyHtml = "";
    if (freshStartActive) {
      historyHtml = '<p class="composition-from-intent">' +
        FRESH_START_CLAUSE + "</p>";
    } else if (historyCategories) {
      var historyLabel = ledgerCategoriesLabel(historyCategories);
      if (historyLabel) {
        historyHtml = '<p class="composition-from-intent">' +
          "Assembled from the published record, weighted by " +
          esc(historyLabel) +
          " you opened here on earlier visits.</p>" +
          LEDGER_DOOR_BUTTON;
      }
    }
    el.innerHTML =
      '<h3 class="composition-h">The full picture</h3>' +
      '<p class="composition-from-intent">' + CONNECTION_LINE + "</p>" +
      historyHtml +
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
    if (historyHtml) wireLedgerDoor(el);
    track("Composition Rendered", { intent: null, via: "spec" });
    ledgerRecordComposition("/");
  }

  /* ----- Increment 0: page composition (landing context) -----
     A mount carrying data-compose-page runs in page mode: fetch the
     page type's payload slice, take the spec from the share code if
     one is present (re-validated on arrival) else the enumerated
     starting spec, validate, and render in place ahead of the
     static body, which is never touched. Dismissal empties the
     mount and restores the pure published page. */
  var PAGE_SLICE_FILES = { "case-study": "/blocks-case-studies.json" };

  function pageSlug(path) {
    var parts = String(path || "").split("/").filter(function (s) { return s; });
    return parts.length ? parts[parts.length - 1] : "";
  }

  // Self-describing share code: version, the page's slug, and the
  // ordered block list. It carries no authority: the client
  // re-validates the decoded spec against the page's slice before
  // rendering anything, so the worst a forged or stale code yields
  // is a valid reordering of public blocks, or the plain page.
  function encodePageCode(page, spec) {
    return "v1." + pageSlug(page) + "." + spec.blocks.map(function (b) {
      return b.id + ":" + b.length;
    }).join(",");
  }

  function decodePageCode(code, sliceData) {
    var m = /^v1\.([^.]+)\.([A-Za-z0-9_:\-,]+)$/.exec(code || "");
    if (!m || !sliceData || !sliceData.pages) return null;
    var page = null;
    Object.keys(sliceData.pages).forEach(function (p) {
      if (pageSlug(p) === m[1]) page = p;
    });
    if (!page) return null;
    var bad = false;
    var items = m[2].split(",").map(function (pair) {
      var kv = pair.split(":");
      if (kv.length !== 2 || !kv[0] || !kv[1]) { bad = true; return null; }
      return { id: kv[0], length: kv[1] };
    });
    if (bad) return null;
    return { page: page, spec: { blocks: items } };
  }

  function sameSpec(a, b) {
    if (!a || !b || !a.blocks || !b.blocks) return false;
    if (a.blocks.length !== b.blocks.length) return false;
    for (var i = 0; i < a.blocks.length; i++) {
      if (a.blocks[i].id !== b.blocks[i].id ||
          a.blocks[i].length !== b.blocks[i].length) return false;
    }
    return true;
  }

  var lastPageRender = null;

  function renderPageComposition(el, page, pageEntry, view, spec, source,
                                 historyCategories, eventSource) {
    if (surfaceOn() && trySurface(function (S) {
      renderPageSurface(S, el, page, pageEntry, view, spec, source,
        historyCategories, eventSource);
      return true;
    })) return;
    var clause = historyCategories
      ? historyClauseLine(pageEntry.page_name, historyCategories) : "";
    var fromIntent = clause ||
      ("Assembled from the published record, starting from " +
       esc(pageEntry.page_name) + ".");
    lastPageRender = {
      el: el, page: page, entry: pageEntry, view: view, spec: spec,
      source: source, categories: clause ? historyCategories : null
    };
    el.innerHTML =
      '<h3 class="composition-h">The full picture</h3>' +
      '<p class="composition-from-intent">' + fromIntent + "</p>" +
      (clause ? LEDGER_DOOR_BUTTON : "") +
      renderFragmentHtml(spec, view, page) +
      '<p class="composition-note">Assembled for this visit. The page ' +
      "as published stands underneath, unchanged.</p>" +
      '<p class="intent-reset"><button type="button" id="page-published">' +
      "View this page as published</button></p>";
    el.hidden = false;
    el.setAttribute("data-render-key", "page:" + page);
    el.setAttribute("data-render-source", source);
    var btn = el.querySelector("#page-published");
    if (btn) btn.addEventListener("click", function () {
      el.hidden = true; el.innerHTML = "";
      el.removeAttribute("data-render-key");
      el.removeAttribute("data-render-source");
      // Clear the URL only when it carries one of our codes; a
      // section fragment in the URL is the visitor's, not ours.
      if ((location.hash || "").indexOf("#a=") === 0) {
        try { history.replaceState(null, "", location.pathname); } catch (e) {}
      }
      track("Page Composition Dismissed",
        { page: page, page_type: pageEntry.type, source: source });
    });
    // No code on a default render (P-1116-02, edit 3): the URL
    // carries a code only when the assembly differs from the page's
    // starting spec, so a later arrival by a coded URL is honestly
    // logged as share_code rather than as a default render.
    if (!sameSpec(spec, pageEntry.starting_spec)) {
      try {
        history.replaceState(null, "", "#a=" + encodePageCode(page, spec));
      } catch (e) {}
    }
    if (clause) wireLedgerDoor(el);
    track("Page Composition Rendered", {
      page: page, page_type: pageEntry.type, source: source,
      block_count: spec.blocks.length
    });
    ledgerRecordComposition(page);
  }

  function pageInit(el) {
    var page = el.getAttribute("data-compose-page");
    var type = el.getAttribute("data-compose-type");
    if (!page || !type || COMPOSE_PAGES[type] === false) return;
    var file = PAGE_SLICE_FILES[type];
    if (!file) return;
    el.setAttribute("aria-live", "polite");
    fetch(file)
      .then(function (r) { return r.ok ? r.json() : null; })
      .then(function (data) {
        if (!data || !data.pages || !data.pages[page]) return;
        var entry = data.pages[page];
        var view = {
          blocks: entry.blocks,
          max_blocks: data.max_blocks,
          anchor_kinds: data.anchor_kinds
        };
        // Only a fragment that starts with a= is a share code
        // (P-1116-02, edit 1). Any other fragment (a section deep
        // link, the #main and #ask-h in-page links the case-study
        // pages already carry) runs the starting spec silently: no
        // Fallback event, and the fragment and its scroll target
        // are left exactly as they were.
        var rawHash = location.hash || "";
        if (rawHash.indexOf("#a=") === 0) {
          var hm = /^#a=([A-Za-z0-9_.:\-,]+)$/.exec(rawHash);
          var decoded = hm ? decodePageCode(hm[1], data) : null;
          if (decoded && decoded.page === page &&
              validateSpec(decoded.spec, view, page)) {
            renderArrival(el, page, entry, view, decoded.spec,
              "share_code");
          } else {
            track("Page Composition Fallback",
              { page: page, page_type: type });
          }
          return;
        }
        var start = entry.starting_spec;
        if (start && validateSpec(start, view, page)) {
          // Increment 3 arrival weighting (plain arrivals only;
          // share-code arrivals above are never weighted). Wait for
          // the ledger, weight the validated starting spec, and
          // render the weighted spec only if it re-validates;
          // otherwise the plain starting spec renders as before.
          var freshStartActive = false;
          if (window.DCLedger && window.DCLedger.enabled &&
              !freshStartActive) {
            try {
              var readyResult = null;
              try {
                readyResult = window.DCLedger.ready();
              } catch (e) { readyResult = null; }
              if (readyResult && typeof readyResult.then === "function") {
                readyResult.then(function () {
                  try {
                    if (!(window.DCLedger && window.DCLedger.enabled &&
                          !freshStartActive)) {
                      renderArrival(el, page, entry, view, start,
                        "arrival");
                      return;
                    }
                    var weighted = null;
                    try {
                      weighted = window.DCLedger.weightArrival(start, page);
                    } catch (e) { weighted = null; }
                    if (weighted && weighted.spec &&
                        validateSpec(weighted.spec, view, page)) {
                      renderArrival(el, page, entry, view, weighted.spec,
                        "arrival", weighted.categories || null);
                    } else {
                      renderArrival(el, page, entry, view, start,
                        "arrival");
                    }
                  } catch (e) {
                    renderArrival(el, page, entry, view, start, "arrival");
                  }
                }, function () {
                  renderArrival(el, page, entry, view, start, "arrival");
                });
              } else {
                renderArrival(el, page, entry, view, start, "arrival");
              }
            } catch (e) {
              renderArrival(el, page, entry, view, start, "arrival");
            }
          } else {
            renderArrival(el, page, entry, view, start, "arrival");
          }
        }
      })
      .catch(function () { /* the static page serves, unchanged */ });
  }

  /* ----- Increment 1: the session layer (persistent prompt) -----
     Active only on PROMPT_PAGES pages, and only once an assembly
     has rendered: the field lives inside the assembled view, never
     on the published page. State model (design section 2): chips
     are the session's states; chip zero is the published page,
     chip one the starting view, and each served turn adds a chip
     carrying its validated spec, its action, its scope, and the
     visitor's own prompt (their words live only in their browser).
     Restoring a chip is local and free. A new prompt from a
     restored chip branches the row from that point. Scope is a
     property of a chip: a confirmed release creates released
     chips; the grounding rules never change. The server is
     stateless and re-validates everything it is sent; this layer
     validates every served spec again before rendering it. */

  function renderArrival(el, page, entry, view, spec, source,
                         historyCategories) {
    if (PROMPT_PAGES[page]) {
      initSession(el, page, entry, view, spec, source, historyCategories);
    } else {
      renderPageComposition(el, page, entry, view, spec, source,
        historyCategories);
    }
  }

  // The client's deterministic extension matcher (design section
  // 3): extension is an explicit instruction to keep the current
  // view and change part of it. Conservative on purpose: when in
  // doubt, the turn is a re-compose. The server treats the result
  // as a hint only; the validation path is identical either way.
  function matchTurnKind(text) {
    var t = String(text || "").trim().toLowerCase();
    if (/^(add|also|plus)\b/.test(t)) return "extend";
    if (/\balso include\b/.test(t)) return "extend";
    if (/^keep\b/.test(t) && /\b(add|include)\b/.test(t)) return "extend";
    if (/\bkeep this\b/.test(t) && /\badd\b/.test(t)) return "extend";
    return "recompose";
  }

  var pageSession = null;

  function sessionStoreKey(page) { return "dc.prompt." + page; }

  function saveSession(S) {
    try {
      sessionStorage.setItem(sessionStoreKey(S.page), JSON.stringify({
        chips: S.chips, current: S.current, submits: S.submits
      }));
    } catch (e) { /* storage unavailable: the session is in-memory */ }
  }

  function loadStoredSession(S) {
    try {
      var raw = sessionStorage.getItem(sessionStoreKey(S.page));
      if (!raw) return false;
      var data = JSON.parse(raw);
      if (!data || !Array.isArray(data.chips) || data.chips.length < 2) {
        return false;
      }
      // Stored state is re-validated before any of it renders: a
      // chip whose spec no longer validates is dropped, and a
      // session with nothing valid left is a fresh session.
      var chips = [data.chips[0]];
      for (var i = 1; i < data.chips.length; i++) {
        var chip = data.chips[i];
        if (chip && chip.spec &&
            validateSessionSpec(S, chip.spec, chip.scope)) {
          chips.push(chip);
        }
      }
      if (chips.length < 2) return false;
      S.chips = chips;
      S.current = Math.min(data.current || 1, chips.length - 1);
      S.submits = data.submits || 0;
      return true;
    } catch (e) { return false; }
  }

  // The client mirror of the server's scope gate: a page-scope
  // spec must validate against the page slice with the page anchor
  // leading and every block in the slice; a released spec must
  // validate against the home library under the home rules.
  function validateSessionSpec(S, spec, scope) {
    if (scope === "released") {
      if (!blocksPayload) return false;
      return validateSpec(spec, blocksPayload);
    }
    if (!validateSpec(spec, S.view, S.page)) return false;
    if (!spec.blocks.length ||
        spec.blocks[0].id !== S.entry.anchor) return false;
    var inSlice = {};
    S.view.blocks.forEach(function (b) { inSlice[b.id] = true; });
    return spec.blocks.every(function (b) { return inSlice[b.id]; });
  }

  function chipScopeLine(S, chip) {
    if (chip.scope === "released") {
      return "Assembled from the published record, beyond " +
        esc(S.entry.page_name) + ".";
    }
    return "Assembled from the published record, starting from " +
      esc(S.entry.page_name) + ".";
  }

  function chipTurnLine(chip) {
    if (chip.action === "start") return PROMPT_START_LINE;
    if (chip.action === "extend") {
      return "Added for: \u201C" + esc(chip.prompt || "") + "\u201D";
    }
    if (chip.action === "recompose") {
      return "Rebuilt for: \u201C" + esc(chip.prompt || "") + "\u201D";
    }
    return PROMPT_START_LINE;
  }

  function chipLabel(chip, idx) {
    if (idx === 0) return "Published page";
    if (chip.action === "start") return "Starting view";
    var words = String(chip.prompt || "").trim().split(/\s+/).slice(0, 4)
      .join(" ");
    return "Turn " + chip.turn + (words ? " \u00B7 " + words : "");
  }

  function initSession(el, page, entry, view, spec, source,
                       historyCategories) {
    var S = {
      el: el, page: page, entry: entry, view: view, source: source,
      chips: [{ turn: 0, action: "published", spec: null, scope: "page",
                prompt: null },
              { turn: 0, action: "start", spec: spec, scope: "page",
                prompt: null,
                categories: historyCategories || null }],
      current: 1, submits: 0, pending: null, ui: "field",
      status: "", docked: false, dead: false, inFlight: false,
      capFired: false, lastBuilt: 1,
      arrivalCategories: historyCategories || null
    };
    pageSession = S;
    var restored = loadStoredSession(S);
    S.lastBuilt = S.current;
    // The arrival assembly's own measurement stands either way;
    // a restored session re-renders its current chip instead of
    // the starting view.
    track("Page Composition Rendered", {
      page: page, page_type: entry.type, source: source,
      block_count: spec.blocks.length
    });
    ledgerRecordComposition(page);
    if (!restored && !sameSpec(spec, entry.starting_spec)) {
      try {
        history.replaceState(null, "", "#a=" + encodePageCode(page, spec));
      } catch (e) {}
    }
    renderSession();
  }

  function sessionViewFor(S, chip) {
    // renderFragmentHtml reads payload.blocks: the slice view for
    // page-scope chips, the home payload for released chips (its
    // blocks are the home library; page anchors are not in it and
    // never render from a released spec).
    if (chip.scope === "released" && blocksPayload) {
      return blocksPayload;
    }
    return S.view;
  }

  function renderSession() {
    var S = pageSession;
    if (!S) return;
    if (surfaceOn() && trySurface(function (SF) {
      renderSessionSurface(SF, S);
      return true;
    })) return;
    var el = S.el;
    var chipsHtml = '<div class="prompt-chips" role="list" ' +
      'aria-label="Build history">' + S.chips.map(function (chip, i) {
        return '<button type="button" class="prompt-chip" role="listitem"' +
          (i === S.current ? ' aria-current="true"' : "") +
          ' data-chip="' + i + '">' + esc(chipLabel(chip, i)) + "</button>";
      }).join("") + "</div>";
    if (S.current === 0) {
      // Chip zero: the published page. The field is gone; the
      // session strip is what remains, and any chip re-enters
      // without a model call.
      el.innerHTML = chipsHtml +
        '<p class="prompt-strip">You&rsquo;re viewing the published ' +
        'page &middot; <button type="button" id="prompt-resume">Resume ' +
        "building</button></p>";
      el.hidden = false;
      el.setAttribute("data-render-key", "page:" + S.page);
      el.setAttribute("data-render-source", S.source);
      wireSession(S);
      return;
    }
    var chip = S.chips[S.current];
    // Increment 3 receipts: the start chip carries the arrival
    // clause under its scope line; a turn chip carries its history
    // clause (or the fresh-start clause) under its turn line.
    var startClauseHtml = "";
    var turnClauseHtml = "";
    if (chip.action === "start") {
      var startCats = chip.categories || S.arrivalCategories;
      var startClause = startCats
        ? historyClauseLine(S.entry.page_name, startCats) : "";
      if (startClause) {
        startClauseHtml = '<p class="composition-from-intent">' +
          startClause + "</p>" + LEDGER_DOOR_BUTTON;
      }
    } else if (chip.freshStart) {
      turnClauseHtml = '<p class="composition-from-intent">' +
        FRESH_START_CLAUSE + "</p>";
    } else if (chip.categories) {
      var turnClause = historyClauseLine(S.entry.page_name,
        chip.categories);
      if (turnClause) {
        turnClauseHtml = '<p class="composition-from-intent">' +
          turnClause + "</p>" + LEDGER_DOOR_BUTTON;
      }
    }
    var html = chipsHtml +
      '<h3 class="composition-h">The full picture</h3>' +
      '<p class="composition-from-intent">' + chipScopeLine(S, chip) +
      "</p>" + startClauseHtml +
      '<p class="composition-from-intent prompt-turnline">' +
      chipTurnLine(chip) + "</p>" + turnClauseHtml +
      renderFragmentHtml(chip.spec, sessionViewFor(S, chip), S.page) +
      '<p class="composition-note">Assembled for this visit. The page ' +
      "as published stands underneath, unchanged.</p>" +
      '<p class="intent-reset"><button type="button" ' +
      'id="page-published">View this page as published</button></p>' +
      sessionAreaHtml(S);
    el.innerHTML = html;
    el.hidden = false;
    el.setAttribute("data-render-key", "page:" + S.page);
    el.setAttribute("data-render-source", S.source);
    if (startClauseHtml || turnClauseHtml) wireLedgerDoor(el);
    wireSession(S);
  }

  function sessionAreaHtml(S) {
    if (S.dead) return "";
    var status = S.status
      ? '<p class="composition-from-intent prompt-status">' +
        esc(S.status) + "</p>" : "";
    if (S.ui === "pointer" && S.pending) {
      return status + '<div class="prompt-card"><p>That&rsquo;s covered in ' +
        esc(S.pending.covering_name) + '.</p><p class="prompt-actions">' +
        '<a href="' + esc(S.pending.covering_page) + '">Open it</a>' +
        '<button type="button" id="prompt-build-here">Build it here ' +
        "instead</button></p></div>";
    }
    if (S.ui === "confirm") {
      return status + '<div class="prompt-card"><p>You&rsquo;re moving beyond ' +
        esc(S.entry.page_name) + ". Build from the broader record " +
        "instead?</p>" +
        '<p class="prompt-actions"><button type="button" ' +
        'id="prompt-release-confirm">Build from the broader record' +
        '</button><button type="button" id="prompt-release-decline">' +
        "Stay on this page</button></p></div>";
    }
    if (S.submits >= PROMPT_CAP) {
      return status + '<p class="composition-from-intent">' +
        PROMPT_CAP_LINE + "</p>";
    }
    var dock = S.docked ? " prompt-docked" : "";
    return status +
      '<form class="prompt-form' + dock + '" id="prompt-form">' +
      '<label class="prompt-invitation" for="prompt-input">' +
      PROMPT_INVITATION + "</label>" +
      '<span class="prompt-row"><input type="text" id="prompt-input" ' +
      'maxlength="300" placeholder="' + PROMPT_PLACEHOLDER + '" ' +
      'autocomplete="off"><button type="submit">' + PROMPT_BUTTON +
      '</button></span><button type="button" class="prompt-pill-btn">' +
      "Build on this view</button></form>";
  }

  function wireSession(S) {
    var el = S.el;
    Array.prototype.forEach.call(
      el.querySelectorAll(".prompt-chip"),
      function (btn) {
        btn.addEventListener("click", function () {
          goChip(S, parseInt(btn.getAttribute("data-chip"), 10));
        });
      });
    var publishedBtn = el.querySelector("#page-published");
    if (publishedBtn) {
      publishedBtn.addEventListener("click", function () {
        if ((location.hash || "").indexOf("#a=") === 0) {
          try { history.replaceState(null, "", location.pathname); }
          catch (e) {}
        }
        track("Page Composition Dismissed", {
          page: S.page, page_type: S.entry.type, source: S.source
        });
        goChip(S, 0);
      });
    }
    var resumeBtn = el.querySelector("#prompt-resume");
    if (resumeBtn) {
      resumeBtn.addEventListener("click", function () {
        goChip(S, S.lastBuilt || 1);
      });
    }
    var form = el.querySelector("#prompt-form");
    if (form) {
      form.addEventListener("submit", function (ev) {
        ev.preventDefault();
        var input = el.querySelector("#prompt-input");
        var text = (input && input.value || "").trim();
        if (text) submitPrompt(S, text);
      });
      var pillBtn = form.querySelector(".prompt-pill-btn");
      if (pillBtn) {
        pillBtn.addEventListener("click", function () {
          form.classList.remove("prompt-pill");
          var input = form.querySelector("#prompt-input");
          if (input) input.focus();
        });
      }
      // Once docked, the form collapses to a pill ("Build on this
      // view") while the visitor is reading deep in the static
      // body, and re-expands on tap (design section 5). Wired once
      // per session; the class lives on whichever form is current.
      if (S.docked && !S.scrollWired) {
        S.scrollWired = true;
        window.addEventListener("scroll", function () {
          var f = S.el.querySelector("#prompt-form.prompt-docked");
          if (!f) return;
          var rect = S.el.getBoundingClientRect();
          var away = rect.bottom < 0 || rect.top > window.innerHeight;
          f.classList.toggle("prompt-pill", !!away);
        }, { passive: true });
      }
    }
    var openHere = el.querySelector("#prompt-build-here");
    if (openHere) {
      openHere.addEventListener("click", function () {
        S.ui = "confirm";
        track("Prompt Release Offered", { page: S.page });
        renderSession();
      });
    }
    var confirmBtn = el.querySelector("#prompt-release-confirm");
    if (confirmBtn) {
      confirmBtn.addEventListener("click", function () {
        track("Prompt Release Confirmed", { page: S.page });
        confirmRelease(S);
      });
    }
    var declineBtn = el.querySelector("#prompt-release-decline");
    if (declineBtn) {
      declineBtn.addEventListener("click", function () {
        track("Prompt Release Declined", { page: S.page });
        S.ui = "field"; S.pending = null; S.status = "";
        renderSession();
      });
    }
  }

  function goChip(S, idx) {
    if (idx < 0 || idx >= S.chips.length) return;
    if (idx !== 0) S.lastBuilt = idx;
    S.current = idx;
    S.ui = "field"; S.pending = null; S.status = "";
    saveSession(S);
    renderSession();
    track("Prompt History Restored",
      { page: S.page, restored_turn: S.chips[idx].turn });
  }

  function priorSpecsFor(S) {
    var out = [];
    for (var i = 1; i < S.current; i++) {
      if (S.chips[i].spec) out.push({ spec: S.chips[i].spec });
    }
    return out;
  }

  function submitPrompt(S, text) {
    if (S.inFlight) return;
    var chip = S.chips[S.current];
    // Repeat discipline (design section 5): the identical prompt
    // against the identical current view is answered from the
    // chip state, with no model call and no submit counted.
    if (chip.prompt === text && S.current === S.chips.length - 1) {
      S.status = REPEAT_LINE;
      renderSession();
      return;
    }
    if (S.submits >= PROMPT_CAP) return;
    S.submits += 1;
    var turnNo = S.submits;
    var kind = matchTurnKind(text);
    // Increment 3 fresh start: a prompt in the fresh-start set is
    // built without weighting for this turn. The ledger itself is
    // not modified by the prompt; the event records only that the
    // class of request was made, never the prompt text.
    var freshStartActive = false;
    try {
      freshStartActive = !!(window.DCLedger && window.DCLedger.enabled &&
        typeof window.DCLedger.freshStart === "function" &&
        window.DCLedger.freshStart(text));
    } catch (e) { freshStartActive = false; }
    if (freshStartActive) {
      track("History Fresh Start Invoked", { page: S.page });
    }
    track("Prompt Submitted", {
      page: S.page, turn_number: turnNo, scope: chip.scope,
      turn_kind: kind
    });
    S.status = PROMPT_PENDING_LINE;
    S.inFlight = true;
    renderSession();
    var input = S.el.querySelector("#prompt-input");
    if (input) { input.disabled = true; }
    postTurn(S, {
      mode: "compose_turn", page: S.page, prompt: text,
      turn_kind: kind, scope: chip.scope, current_spec: chip.spec,
      prior_specs: priorSpecsFor(S), turn: turnNo
    }).then(function (data) {
      handleTurnResponse(S, data, {
        prompt: text, turn: turnNo, freshStart: freshStartActive
      });
    });
  }

  function postTurn(S, body) {
    return fetch(ASK_ENDPOINT, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(body)
    }).then(function (r) { return r.ok ? r.json() : null; })
      .then(function (data) {
        if (!data || data.type !== "turn") {
          // The turn surface is absent (an older Lambda behind a
          // newer client): the field hides and the page continues
          // as pure Increment 0 (design section 5).
          S.dead = true; S.ui = "field"; S.status = "";
          renderSession();
          return null;
        }
        return data;
      })
      .catch(function () {
        S.dead = true; S.ui = "field"; S.status = "";
        renderSession();
        return null;
      });
  }

  function handleTurnResponse(S, data, ctx) {
    S.inFlight = false;
    if (!data) return; // postTurn already applied the failure state
    if (data.action === "recompose" || data.action === "extend") {
      var spec = data.spec;
      var scope = data.scope || S.chips[S.current].scope;
      var apply = function () {
        if (!validateSessionSpec(S, spec, scope)) {
          // A served spec that fails the client gate is a contract
          // break: the failure discipline applies, the view and
          // the chips are exactly as they were. A fresh-start turn
          // carries its clause here instead of the none line.
          S.status = ctx.freshStart ? FRESH_START_CLAUSE
            : PROMPT_NONE_LINE;
          renderSession();
          return;
        }
        // Increment 3 turn weighting: reorder the validated spec
        // by ledger emphasis, re-validate, and keep the unweighted
        // spec if anything about the weighted one fails.
        var turnCategories = null;
        var freshStartActive = !!ctx.freshStart;
        try {
          if (window.DCLedger && window.DCLedger.enabled &&
              !freshStartActive &&
              typeof window.DCLedger.weightTurn === "function") {
            var weightedTurn = window.DCLedger.weightTurn(spec.blocks);
            if (weightedTurn && weightedTurn.blocks) {
              var weightedSpec = { blocks: weightedTurn.blocks };
              if (validateSessionSpec(S, weightedSpec, scope)) {
                spec = weightedSpec;
                turnCategories = weightedTurn.categories || null;
              }
            }
          }
        } catch (e) { /* the ledger never breaks the page */ }
        // A new prompt from a restored chip branches the row from
        // that point.
        S.chips = S.chips.slice(0, S.current + 1);
        S.chips.push({
          turn: ctx.turn, action: data.action, spec: spec,
          scope: scope, prompt: ctx.prompt,
          categories: turnCategories,
          freshStart: !!ctx.freshStart
        });
        S.current = S.chips.length - 1;
        S.lastBuilt = S.current;
        S.docked = true;
        S.ui = "field"; S.pending = null; S.status = "";
        saveSession(S);
        renderSession();
        track("Prompt Turn Rendered", {
          page: S.page, turn_number: ctx.turn, action: data.action,
          block_count: spec.blocks.length, scope: scope
        });
        // Increment 3 writer: the served spec, block IDs only.
        // A fresh-start turn skips the ledger write, as it skips
        // weighting: the prompt does not modify the ledger.
        if (!freshStartActive) {
          ledgerRecordSpec(spec, S.page, scope);
        }
        afterSubmit(S);
      };
      if (scope === "released" && !blocksPayload) {
        loadBlocks().then(apply);
      } else {
        apply();
      }
      return;
    }
    if (data.action === "pointer") {
      S.pending = {
        prompt: ctx.prompt, turn: ctx.turn,
        covering_page: data.covering_page,
        covering_name: data.covering_name,
        freshStart: !!ctx.freshStart
      };
      S.ui = "pointer";
      S.status = ctx.freshStart ? FRESH_START_CLAUSE : "";
      renderSession();
      track("Prompt Pointer Shown",
        { page: S.page, covering_page: data.covering_page });
      afterSubmit(S);
      return;
    }
    if (data.action === "release_offer") {
      S.pending = {
        prompt: ctx.prompt, turn: ctx.turn,
        freshStart: !!ctx.freshStart
      };
      S.ui = "confirm";
      S.status = ctx.freshStart ? FRESH_START_CLAUSE : "";
      renderSession();
      track("Prompt Release Offered", { page: S.page });
      afterSubmit(S);
      return;
    }
    // The null shape: the view, the chips, and the scroll position
    // are exactly as they were; one fixed line, naming no topic.
    // A fresh-start turn carries its clause instead of that line.
    S.ui = "field"; S.pending = null;
    S.status = ctx.freshStart ? FRESH_START_CLAUSE : PROMPT_NONE_LINE;
    renderSession();
    afterSubmit(S);
  }

  function afterSubmit(S) {
    if (S.submits >= PROMPT_CAP && !S.capFired) {
      S.capFired = true;
      track("Prompt Cap Reached", { page: S.page });
      if (S.ui === "field") renderSession();
    }
    saveSession(S);
  }

  function confirmRelease(S) {
    var pending = S.pending;
    if (!pending) { S.ui = "field"; renderSession(); return; }
    var chip = S.chips[S.current];
    S.ui = "field";
    S.status = PROMPT_PENDING_LINE;
    S.inFlight = true;
    renderSession();
    // The confirm re-send is the same prompt at the same turn
    // number, in the widened scope: not a new submitted prompt,
    // so the cap does not count it again.
    postTurn(S, {
      mode: "compose_turn", page: S.page, prompt: pending.prompt,
      turn_kind: "recompose", scope: "released",
      current_spec: chip.spec, prior_specs: priorSpecsFor(S),
      turn: pending.turn, release_confirm: true
    }).then(function (data) {
      S.pending = null;
      handleTurnResponse(S, data, {
        prompt: pending.prompt, turn: pending.turn,
        freshStart: !!pending.freshStart
      });
    });
  }

  function classifyProblem(text) {
    var seq = ++classifySeq;
    // Increment 3 fresh start, home path: a fresh-start text is
    // rendered without weighting, with its clause on the receipt.
    var freshStartActive = false;
    try {
      freshStartActive = !!(window.DCLedger && window.DCLedger.enabled &&
        typeof window.DCLedger.freshStart === "function" &&
        window.DCLedger.freshStart(text));
    } catch (e) { freshStartActive = false; }
    if (freshStartActive) {
      track("History Fresh Start Invoked", { page: "/" });
    }
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
              // Increment 3 turn weighting, home classify path:
              // weight the validated spec, re-validate, and fall
              // back to the unweighted spec on any failure.
              var specToRender = data.spec;
              var turnCategories = null;
              try {
                if (window.DCLedger && window.DCLedger.enabled &&
                    !freshStartActive &&
                    typeof window.DCLedger.weightTurn === "function") {
                  var weightedHome = window.DCLedger.weightTurn(
                    data.spec.blocks);
                  if (weightedHome && weightedHome.blocks) {
                    var weightedHomeSpec = {
                      blocks: weightedHome.blocks
                    };
                    if (validateSpec(weightedHomeSpec, payload)) {
                      specToRender = weightedHomeSpec;
                      turnCategories = weightedHome.categories || null;
                    }
                  }
                }
              } catch (e) { /* the ledger never breaks the page */ }
              if (!repeatIfSame(specKey(specToRender))) {
                renderSpec(specToRender, payload, turnCategories,
                  freshStartActive);
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
    if (el.hasAttribute("data-compose-page")) {
      // Surface build, session pages only: an Ask "none" routes
      // its text to the active session as a turn (build sheet
      // section 3, rule 3). Registered only under the surface
      // presenter; the layered path keeps today's behavior, in
      // which the event has no listener on page-mode pages.
      if (surfaceOn()) {
        document.addEventListener("dc:problem", function (ev) {
          var text = ev && ev.detail && ev.detail.text;
          if (text && pageSession) submitPrompt(pageSession, text);
        });
      }
      pageInit(el); return;
    }
    el.setAttribute("aria-live", "polite");
    document.addEventListener("dc:problem", function (ev) {
      var text = ev && ev.detail && ev.detail.text;
      if (text) classifyProblem(text);
    });
    document.addEventListener("dc:composition-cleared", function () {
      clearCompositionAny();
    });
    var btns = document.querySelectorAll(".intent-btn");
    Array.prototype.forEach.call(btns, function (btn) {
      btn.addEventListener("click", function () {
        load().then(function () { render(intentOfButton(btn)); });
      });
    });
    window.addEventListener("hashchange", function () {
      var hm = /#c=([0-9a-f]{24})/.exec(location.hash || "");
      if (!hm) { clearCompositionAny(); return; }
      load().then(function () {
        var e2 = bySig && bySig[hm[1]];
        if (e2) render(e2.intent, hm[1]);
        else clearCompositionAny();
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

  /* ----- Increment 3: clear rebuild -----
     When the ledger is cleared, a view that history shaped is
     rebuilt plain: weights are now empty. Page mode re-renders
     the plain starting spec; session mode rebuilds the start
     chip from the starting spec when that chip is on screen.
     Anything else is a no-op. */
  document.addEventListener("dc:ledger-cleared", function () {
    try {
      if (pageSession) {
        var S = pageSession;
        if (S.current > 0 && S.chips[S.current]) {
          var chip = S.chips[S.current];
          if (chip.action === "start" &&
              (chip.categories || S.arrivalCategories)) {
            chip.spec = S.entry.starting_spec;
            chip.categories = null;
            chip.freshStart = false;
            S.arrivalCategories = null;
            saveSession(S);
            renderSession();
          }
        }
        return;
      }
      if (lastPageRender && lastPageRender.categories) {
        var r = lastPageRender;
        renderPageComposition(r.el, r.page, r.entry, r.view,
          r.entry.starting_spec || r.spec, r.source);
      }
    } catch (e) { /* the ledger never breaks the page */ }
  });

  // Exposed for the eval harness: the shipped validator, exercised
  // against the shipped payload by run_specs_stage2.py, and the
  // page share-code codec, exercised by the jsdom page fixtures.
  window.DCCompose = {
    validateSpec: validateSpec,
    encodePageCode: encodePageCode,
    decodePageCode: decodePageCode,
    matchTurnKind: matchTurnKind
  };

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }
})();
