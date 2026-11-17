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
  /* Engaged-mode batch (Nov 16, 2026; build sheet section 12):
     the StreamPresenter is selected when the surface layer is
     active and surface.js's ENGAGED flag is on, read at boot
     through DCSurface.engaged. With the flag off, every branch
     below is inert and the shipped presenters run untouched. */
  function streamOn() {
    return !!(window.DCSurface && window.DCSurface.active &&
      window.DCSurface.engaged);
  }
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

  /* NOTE_BUILT (the "Built for this visit" note) was dropped
     from every expanded receipt by the engaged-UI revision
     (D4): it restated the collapsed line it sat under. The
     collapsed line itself is untouched (S4). */
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
        "from " + esc(pageEntry.page_name) + ".")) + "</p>";
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
    if (S.ui === "pending") {
      // Unified flight: the pending line alone; the canvas holds
      // until the whole validated plan returns.
      return status;
    }
    if (S.ui === "dialogue" && S.dialogue) {
      // Unified terminal dialogue (sheet section 6): refusals and
      // the failure, disabled, cap, and repeat lines render word
      // for word here; no state, no cap spent.
      if (S.dialogue.kind === "none") {
        return status +
          '<p class="composition-from-intent prompt-status">' +
          esc(S.dialogue.text || "") + "</p>" +
          (S.dialogue.link
            ? '<p class="prompt-actions"><a href="' +
              esc(S.dialogue.link) +
              '">Browse the case studies</a></p>'
            : "");
      }
      return status +
        '<p class="composition-from-intent prompt-status">' +
        esc(S.dialogue.text || "") + "</p>";
    }
    if (S.ui === "upointer" && S.pending) {
      return status + '<div class="prompt-card"><p>That&rsquo;s ' +
        "covered in " + esc(S.pending.covering_name) +
        '.</p><p class="prompt-actions">' +
        '<a href="' + esc(S.pending.covering_page) + '">Open it</a>' +
        '<button type="button" id="prompt-build-here">Build it ' +
        "here instead</button></p></div>";
    }
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
        if (S.pending && S.pending.unified) {
          // Unified pointer dialogue: building here is a new
          // unified submit against the local view, not a release
          // (build sheet section 3.2). It spends cap only if the
          // response produces a state.
          var prompt = S.pending.prompt;
          S.pending = null; S.ui = "field"; S.status = "";
          submitUnifiedSession(S, prompt, { buildHere: true });
          return;
        }
        S.ui = "confirm";
        track("Prompt Release Offered", { page: S.page });
        renderSession();
      });
    }
    var confirmBtn = area.querySelector("#prompt-release-confirm");
    if (confirmBtn) {
      confirmBtn.addEventListener("click", function () {
        track("Prompt Release Confirmed", { page: S.page });
        if (S.pending && S.pending.unified) {
          confirmUnifiedSession(S);
        } else {
          confirmRelease(S);
        }
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
    SF.registerUnifiedSubmit(function (text) {
      if (!pageSession || pageSession.dead) return false;
      submitUnifiedSession(pageSession, text);
      return true;
    });
    registerSessionThread(SF, S);
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
        if (S.dead) {
          area.innerHTML = "";
        } else if (S.ui === "dialogue" || S.ui === "upointer" ||
                   S.ui === "confirm" || S.ui === "pending") {
          // A unified dialogue outcome lands the same way from
          // the published view as from any other state.
          area.innerHTML = sessionAreaSurfaceHtml(S);
          wireTurnsArea(S);
        } else {
          area.innerHTML =
            '<p class="composition-from-intent ' +
            'prompt-invitation-line">' + PROMPT_INVITATION + "</p>";
        }
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
    /* D4 (engaged-UI revision): the account line drops when
       the history clause rides in the same expansion — cats
       is set exactly then, and the clause already names the
       starting point. When no history clause rides, the
       account line stays: it is the only line naming where
       the view started from. */
    var expanded = "";
    if (!cats) {
      expanded += '<p class="composition-from-intent">' +
        chipScopeLine(S, chip) + "</p>";
    }
    if (clauseText) {
      expanded += '<p class="composition-from-intent">' +
        clauseText + "</p>";
    }
    expanded += '<p class="composition-from-intent ' +
      'prompt-turnline">' + chipTurnLine(chip) + "</p>";
    el.innerHTML = '<h3 class="composition-h">The full picture</h3>' +
      answerElementHtml(chip.answer) +
      (chip.spec
        ? renderFragmentHtml(chip.spec, sessionViewFor(S, chip),
            S.page)
        : "") +
      pointerElementHtml(chip.pointer);
    el.hidden = false;
    el.setAttribute("data-render-key", "page:" + S.page);
    el.setAttribute("data-render-source", S.source);
    SF.setReceipt({
      historyLabel: cats ? ledgerCategoriesLabel(cats) : null,
      // S4, re-pointed by the unified batch: the collapsed
      // receipt's framing segment is live exactly when the
      // current state's answer includes framing.
      aiFraming: !!(chip.answer && chip.answer.framing),
      expandedHtml: expanded,
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
    /* The catalog is the payload's full block set, mirroring
       validateSpec: blocks.json carries its page anchors and
       page blocks in their own arrays, and a spec validated
       on its own page (whose slice folds them into blocks)
       must still resolve when it re-renders against the
       shared payload — a case-study turn replayed on home
       threw here before the fix batch (Nov 16, 2026).
       Selection policy stays in validateSpec; the renderer
       only resolves what a validated spec names. */
    (payload.page_anchors || []).forEach(function (b) {
      byId[b.id] = b;
    });
    (payload.page_blocks || []).forEach(function (b) {
      byId[b.id] = b;
    });
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
    if (streamOn()) {
      streamRenderArrival(el, page, entry, view, spec, source,
        historyCategories);
      return;
    }
    if (PROMPT_PAGES[page]) {
      initSession(el, page, entry, view, spec, source, historyCategories);
    } else {
      renderPageComposition(el, page, entry, view, spec, source,
        historyCategories);
      // Unified batch: a non-converting case study still takes
      // unified submits; the flat session adopts the arrival view
      // the render above just produced (surface path only).
      if (surfaceOn()) {
        initPageFlat(el, page, entry, view, spec, source,
          historyCategories);
      }
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
      // session with nothing valid left is a fresh session. A
      // unified answer-only chip carries no spec of its own (its
      // blocks were the standing state's, carried forward); it is
      // kept on its answer's shape instead.
      var chips = [data.chips[0]];
      for (var i = 1; i < data.chips.length; i++) {
        var chip = data.chips[i];
        if (!chip) continue;
        if (chip.spec &&
            validateSessionSpec(S, chip.spec, chip.scope)) {
          chips.push(chip);
        } else if (chip.action === "unified" && !chip.spec &&
                   cleanAnswer(chip.answer)) {
          chips.push(chip);
        }
      }
      if (chips.length < 2) return false;
      S.chips = chips;
      S.current = Math.min(data.current || 1, chips.length - 1);
      S.submits = data.submits || 0;
      // Thread order: chips written before the unified batch
      // carry no sequence; assign in order.
      S.chips.forEach(function (chip) {
        if (chip.prompt && !chip.seq) {
          chip.seq = threadNextSeq(S.page);
        }
      });
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
    if (chip.action === "unified") {
      // The receipt lines for unified states, by mixture (build
      // sheet section 5): a pointer inside a mixed state names
      // itself in the canvas, so the answer+composition line
      // stands for that mixture.
      var q = "\u201C" + esc(chip.prompt || "") + "\u201D";
      if (chip.answer && chip.specNew) {
        return "Answered and rebuilt for: " + q;
      }
      if (chip.answer && chip.pointer) {
        return "Answered and pointed for: " + q;
      }
      if (chip.answer) return "Answered for: " + q;
      if (chip.pointer) return "Rebuilt and pointed for: " + q;
      return "Rebuilt for: " + q;
    }
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
      answerElementHtml(chip.answer) +
      (chip.spec
        ? renderFragmentHtml(chip.spec, sessionViewFor(S, chip),
            S.page)
        : "") +
      pointerElementHtml(chip.pointer) +
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

  function goChip(S, idx, viaThread) {
    if (idx < 0 || idx >= S.chips.length) return;
    if (idx !== 0) S.lastBuilt = idx;
    S.current = idx;
    S.ui = "field"; S.pending = null; S.status = "";
    S.dialogue = null;
    saveSession(S);
    renderSession();
    track("Prompt History Restored", {
      page: S.page, restored_turn: S.chips[idx].turn,
      via: viaThread ? "thread" : "state_line"
    });
    if (viaThread) focusCanvasHeading(S.el);
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
      turn_kind: kind, path: "layered"
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

  /* ----- Unified response (surface path; Nov 16, 2026) -----
     Design: surface-not-page-design.md amendment U1 to U8; build
     sheet P-1116-21. On the surface path the composer submit is
     replaced: no isQuestion predicate, no find-hit gate, no
     fall-through. One submit produces one response from the
     Lambda's unified mode: an answer element, a composition, a
     pointer, or a release offer, in any mixture, rendered as ONE
     new state; or a terminal dialogue outcome (refusal,
     no-evidence, pointer-only, disabled, failure) in the turns
     area, creating no state and spending no cap. The cap
     decrements exactly once per state-producing response. The
     layered path above is untouched and remains the kill state.
     Every substantive submit also lands in the thread (sheet
     section 4): the visitor's own prompts, verbatim, state and
     dialogue alike; refused prompts included, verbatim, by
     Douglas's ruling. */

  var UNIFIED_PENDING_LINE = "Building your response\u2026";
  var UNIFIED_CAP_LINE = "You have reached this session\u2019s prompt limit. Your views and the published page remain.";
  var UNIFIED_FAILURE_LINE = "That did not go through. Nothing was built. Try again.";
  var UNIFIED_DISABLED_LINE = "The rebuilding is off right now. The published record stands as it is.";
  /* The answer element's framing label was removed by the
     engaged-UI revision (D5): the receipt's "Framing written
     by AI" segment is the turn's one AI disclosure. */
  var THREAD_DIALOGUE_KEY = "dc_thread_dialogue_v1";
  var UNIFIED_TIMEOUT_MS = 25000;

  (function injectUnifiedCss() {
    try {
      if (document.getElementById("cp-unified-css")) return;
      var st = document.createElement("style");
      st.id = "cp-unified-css";
      /* Engaged-UI revision (section 5.2): one type size for
         a turn's prose; claims are paragraph lines with the
         citation inline; the pointer is a filled link row,
         not a bordered box. */
      st.textContent =
        ".cp-answer{margin:0 0 6px}" +
        ".cp-answer-framing{font-size:16px;line-height:1.55;margin:0 0 10px}" +
        ".cp-answer-claim{font-size:16px;line-height:1.55;margin:0 0 8px}" +
        ".cp-answer-claim a{font-size:14px;white-space:nowrap}" +
        ".cp-pointer{background:var(--surface);border-radius:10px;padding:10px 14px;margin:0 0 8px}" +
        ".cp-pointer p{margin:0 0 4px}" +
        ".cp-pointer p:last-child{margin:0}" +
        ".cp-composed{margin:22px 0 4px}" +
        ".cp-composed-h{font-family:Newsreader,Georgia,serif;font-size:21px;margin:0 0 10px}";
      document.head.appendChild(st);
    } catch (e) { /* styles are best-effort */ }
  })();

  function newRequestId() {
    return "req-" + Date.now().toString(36) + "-" +
      Math.floor(Math.random() * 4294967296).toString(36);
  }

  function postUnified(body) {
    var opts = {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(body)
    };
    try {
      if (typeof AbortController !== "undefined") {
        var ctrl = new AbortController();
        opts.signal = ctrl.signal;
        setTimeout(function () {
          try { ctrl.abort(); } catch (e) {}
        }, UNIFIED_TIMEOUT_MS);
      }
    } catch (e) { /* no timeout control: the fetch stands */ }
    return fetch(ASK_ENDPOINT, opts)
      .then(function (r) { return r.ok ? r.json() : null; })
      .then(function (data) {
        if (!data || data.type !== "unified") return null;
        return data;
      })
      .catch(function () { return null; });
  }

  function cleanAnswer(raw) {
    if (!raw || !Array.isArray(raw.items)) return null;
    var items = [];
    raw.items.forEach(function (it) {
      if (it && typeof it.claim === "string" &&
          typeof it.source === "string") {
        items.push({
          id: typeof it.id === "string" ? it.id : null,
          claim: it.claim, source: it.source
        });
      }
    });
    if (!items.length) return null;
    return {
      items: items,
      framing: (typeof raw.framing === "string" && raw.framing)
        ? raw.framing : null
    };
  }

  function cleanPointer(raw) {
    if (!raw || typeof raw.covering_page !== "string" ||
        typeof raw.covering_name !== "string") return null;
    return { covering_page: raw.covering_page,
             covering_name: raw.covering_name };
  }

  /* The shared answer renderer (engaged-UI revision,
     section 5.2, D5/D9): framing as a plain paragraph with
     no label above it; claims as paragraph lines in the
     prose flow, each followed by its "Read it in context"
     link inline. The claims themselves stay verbatim.
     Serves both paths, so the fallback's canvas answers
     take the same dress. */
  function answerElementHtml(answer) {
    if (!answer) return "";
    var html = '<div class="cp-answer">';
    if (answer.framing) {
      html += '<p class="cp-answer-framing">' + esc(answer.framing) +
        "</p>";
    }
    answer.items.forEach(function (it) {
      html += '<p class="cp-answer-claim">' + esc(it.claim) +
        ' <a href="' + esc(contextHref(it)) +
        '">Read it in context</a></p>';
    });
    return html + "</div>";
  }

  function pointerElementHtml(pointer) {
    if (!pointer) return "";
    return '<div class="cp-pointer"><p>That&rsquo;s covered in ' +
      esc(pointer.covering_name) + '.</p><p><a href="' +
      esc(pointer.covering_page) + '">Open it</a></p></div>';
  }

  function ledgerRecordAnswer(answer) {
    try {
      if (!(window.DCLedger && window.DCLedger.enabled)) return;
      var ids = [];
      answer.items.forEach(function (it) {
        if (it.id) ids.push(it.id);
      });
      if (ids.length &&
          typeof window.DCLedger.recordAskRecords === "function") {
        window.DCLedger.recordAskRecords(ids);
      }
      if (typeof window.DCLedger.recordAskOutcome === "function") {
        window.DCLedger.recordAskOutcome(
          answer.framing ? "answer_prose" : "answer");
      }
    } catch (e) { /* the ledger never breaks the page */ }
  }

  function focusCanvasHeading(el) {
    if (!el) return;
    var h = el.querySelector("h1, h2, h3");
    if (!h) return;
    try {
      if (!h.hasAttribute("tabindex")) {
        h.setAttribute("tabindex", "-1");
      }
      h.focus({ preventScroll: true });
    } catch (e) { /* focus is best-effort */ }
  }

  function freshStartFor(text, page) {
    var active = false;
    try {
      active = !!(window.DCLedger && window.DCLedger.enabled &&
        typeof window.DCLedger.freshStart === "function" &&
        window.DCLedger.freshStart(text));
    } catch (e) { active = false; }
    if (active) {
      track("History Fresh Start Invoked", { page: page });
    }
    return active;
  }

  /* ---- The thread's dialogue store (sheet section 4) ----
     Dialogue outcomes live in one sessionStorage object under
     dc_thread_dialogue_v1, keyed by page, holding the visitor's
     own prompt text and the outcome class, on-device only, never
     transmitted. It also carries the page's sequence counter, so
     state entries (from the session store) and dialogue entries
     interleave in submit order. Capped at the session cap;
     oldest dropped first; state entries are never dropped. */
  function threadStore() {
    try {
      var raw = sessionStorage.getItem(THREAD_DIALOGUE_KEY);
      if (raw) {
        var d = JSON.parse(raw);
        if (d && d.pages) return d;
      }
    } catch (e) { /* storage unavailable: thread is in-memory */ }
    return { v: 1, pages: {} };
  }

  function threadSave(store) {
    try {
      sessionStorage.setItem(THREAD_DIALOGUE_KEY,
        JSON.stringify(store));
    } catch (e) { /* the thread is best-effort */ }
  }

  function threadRecord(store, page) {
    if (!store.pages[page]) {
      store.pages[page] = { entries: [], dropped: 0, nextSeq: 1 };
    }
    return store.pages[page];
  }

  function threadNextSeq(page) {
    var store = threadStore();
    var rec = threadRecord(store, page);
    var seq = rec.nextSeq || 1;
    rec.nextSeq = seq + 1;
    threadSave(store);
    return seq;
  }

  function threadAddDialogue(page, entry) {
    var store = threadStore();
    var rec = threadRecord(store, page);
    entry.seq = rec.nextSeq || 1;
    rec.nextSeq = entry.seq + 1;
    rec.entries.push(entry);
    while (rec.entries.length > PROMPT_CAP) {
      rec.entries.shift();
      rec.dropped = (rec.dropped || 0) + 1;
    }
    threadSave(store);
    return entry;
  }

  function threadDialogue(page) {
    var rec = threadStore().pages[page];
    if (!rec) return { entries: [], dropped: 0 };
    return { entries: rec.entries || [], dropped: rec.dropped || 0 };
  }

  // Merge a session's state entries ({seq, label, kind:"state",
  // ...}) with the stored dialogue entries into the surface's
  // thread model, in submit order.
  function buildThreadModel(page, stateEntries, opts) {
    var dlg = threadDialogue(page);
    var all = stateEntries.slice();
    dlg.entries.forEach(function (e) {
      all.push({ seq: e.seq || 0, label: e.prompt,
                 kind: "dialogue", entry: e });
    });
    all.sort(function (a, b) { return (a.seq || 0) - (b.seq || 0); });
    var model = {
      entries: all.map(function (e) { return { label: e.label }; }),
      dropped: dlg.dropped > 0,
      inert: !!opts.inert,
      onActivate: function (idx) { opts.activate(all[idx]); }
    };
    return model.entries.length ? model : null;
  }

  // Shared activation for dialogue entries: fixed-text outcomes
  // re-show; transient outcomes (timeout, failure, disabled)
  // restore the prompt to the composer without submitting.
  function threadActivateDialogue(merged, showDialogue) {
    if (!merged || merged.kind !== "dialogue") return false;
    var e = merged.entry;
    if (e.outcome === "refused" || e.outcome === "none") {
      showDialogue({ kind: e.outcome, text: e.text,
                     link: e.link || null });
    } else if (e.outcome === "pointer") {
      showDialogue({ kind: "pointer",
                     covering_page: e.covering_page,
                     covering_name: e.covering_name,
                     prompt: e.prompt });
    } else {
      var input = document.getElementById("explore-q");
      if (input) {
        input.value = e.prompt;
        try { input.focus(); } catch (err) {}
      }
    }
    return true;
  }

  /* ---- Unified submits on the Lindblad session ---- */

  function registerSessionThread(SF, S) {
    var stateEntries = [];
    S.chips.forEach(function (chip, i) {
      if (i === 0 || !chip.prompt) return;
      stateEntries.push({ seq: chip.seq || 0, label: chip.prompt,
                          kind: "state", chipIdx: i });
    });
    var model = buildThreadModel(S.page, stateEntries, {
      inert: S.inFlight,
      activate: function (merged) {
        if (!merged) return;
        if (merged.kind === "state") {
          goChip(S, merged.chipIdx, true);
          return;
        }
        threadActivateDialogue(merged, function (d) {
          if (d.kind === "pointer") {
            S.pending = {
              prompt: d.prompt, turn: S.submits + 1,
              covering_page: d.covering_page,
              covering_name: d.covering_name, unified: true
            };
            S.ui = "upointer"; S.dialogue = null;
          } else {
            S.ui = "dialogue";
            S.dialogue = { kind: d.kind, text: d.text,
                           link: d.link };
          }
          S.status = "";
          renderSession();
        });
      }
    });
    SF.registerThread(model);
  }

  function submitUnifiedSession(S, text, opts) {
    opts = opts || {};
    if (S.inFlight || S.dead) return;
    var chip = S.chips[S.current];
    if (!opts.buildHere && !opts.releaseConfirm) {
      // Repeat discipline, as turns: the repeat line, no call,
      // no thread entry, the original entry stands.
      if (chip.prompt === text &&
          S.current === S.chips.length - 1) {
        S.ui = "dialogue"; S.pending = null;
        S.dialogue = { kind: "status", text: REPEAT_LINE };
        renderSession();
        return;
      }
      if (S.submits >= PROMPT_CAP) {
        S.ui = "dialogue"; S.pending = null;
        S.dialogue = { kind: "status", text: UNIFIED_CAP_LINE };
        renderSession();
        return;
      }
    }
    // A new submit replaces whatever dialogue is showing (S11).
    S.pending = null;
    S.dialogue = null;
    var freshStartActive = freshStartFor(text, S.page);
    var turnNo = opts.releaseConfirm ? (opts.turnNo || S.submits + 1)
      : S.submits + 1;
    var requestId = newRequestId();
    if (!opts.releaseConfirm) {
      track("Prompt Submitted", {
        page: S.page, turn_number: turnNo, scope: chip.scope,
        path: "surface", request_id: requestId
      });
    }
    S.inFlight = true;
    S.ui = "pending";
    S.status = UNIFIED_PENDING_LINE;
    renderSession();
    postUnified({
      mode: "unified", text: text, page: S.page,
      current_spec: chip.spec, prior_specs: priorSpecsFor(S),
      turn: turnNo,
      scope: opts.releaseConfirm ? "released" : chip.scope,
      release_confirm: !!opts.releaseConfirm,
      build_here: !!opts.buildHere,
      request_id: requestId
    }).then(function (data) {
      S.inFlight = false;
      handleUnifiedSessionResponse(S, data, {
        prompt: text, turn: turnNo, requestId: requestId,
        freshStart: freshStartActive,
        releaseConfirm: !!opts.releaseConfirm
      });
    });
  }

  function unifiedSessionDialogue(S, dialogue, threadEntry) {
    S.ui = "dialogue"; S.pending = null; S.status = "";
    S.dialogue = dialogue;
    if (threadEntry) threadAddDialogue(S.page, threadEntry);
    renderSession();
  }

  function handleUnifiedSessionResponse(S, data, ctx) {
    if (!data) {
      // Timeout or network failure: a dialogue line, no state,
      // no cap; the session itself is unharmed.
      if (!ctx.releaseConfirm) {
        unifiedSessionDialogue(S,
          { kind: "status", text: UNIFIED_FAILURE_LINE },
          { prompt: ctx.prompt, outcome: "failure" });
      } else {
        S.ui = "dialogue"; S.pending = null; S.status = "";
        S.dialogue = { kind: "status", text: UNIFIED_FAILURE_LINE };
        renderSession();
      }
      return;
    }
    if (data.outcome === "disabled") {
      unifiedSessionDialogue(S,
        { kind: "status", text: UNIFIED_DISABLED_LINE },
        ctx.releaseConfirm ? null
          : { prompt: ctx.prompt, outcome: "disabled" });
      return;
    }
    if (data.outcome === "refused") {
      unifiedSessionDialogue(S,
        { kind: "status", text: data.text || UNIFIED_FAILURE_LINE },
        ctx.releaseConfirm ? null
          : { prompt: ctx.prompt, outcome: "refused",
              text: data.text });
      return;
    }
    if (data.outcome === "none") {
      unifiedSessionDialogue(S,
        { kind: "none", text: data.text, link: data.link || null },
        ctx.releaseConfirm ? null
          : { prompt: ctx.prompt, outcome: "none",
              text: data.text, link: data.link || null });
      return;
    }
    if (data.outcome === "pointer_only") {
      var p = cleanPointer(data.pointer);
      if (!p) {
        unifiedSessionDialogue(S,
          { kind: "status", text: UNIFIED_FAILURE_LINE },
          { prompt: ctx.prompt, outcome: "failure" });
        return;
      }
      S.pending = {
        prompt: ctx.prompt, turn: ctx.turn,
        covering_page: p.covering_page,
        covering_name: p.covering_name,
        unified: true, freshStart: !!ctx.freshStart
      };
      S.ui = "upointer"; S.status = ""; S.dialogue = null;
      if (!ctx.releaseConfirm) {
        threadAddDialogue(S.page, {
          prompt: ctx.prompt, outcome: "pointer",
          covering_page: p.covering_page,
          covering_name: p.covering_name
        });
        track("Prompt Pointer Shown", {
          page: S.page, covering_page: p.covering_page,
          placement: "dialogue", request_id: ctx.requestId
        });
      }
      renderSession();
      return;
    }
    if (data.outcome === "release_offer") {
      S.pending = {
        prompt: ctx.prompt, turn: ctx.turn, unified: true,
        freshStart: !!ctx.freshStart
      };
      S.ui = "confirm"; S.status = ""; S.dialogue = null;
      track("Prompt Release Offered", { page: S.page });
      renderSession();
      return;
    }
    if (data.outcome === "state") {
      applyUnifiedSessionState(S, data, ctx);
      return;
    }
    unifiedSessionDialogue(S,
      { kind: "status", text: UNIFIED_FAILURE_LINE },
      ctx.releaseConfirm ? null
        : { prompt: ctx.prompt, outcome: "failure" });
  }

  function applyUnifiedSessionState(S, data, ctx) {
    var chip = S.chips[S.current];
    var answer = cleanAnswer(data.answer);
    var scope = data.scope === "released" ? "released" : chip.scope;
    var apply = function () {
      var spec = null;
      var specNew = false;
      var turnCategories = null;
      if (data.spec) {
        var candidate = data.spec;
        if (validateSessionSpec(S, candidate, scope)) {
          spec = candidate;
          specNew = true;
          // Ledger weighting, exactly as turns: weight the
          // validated spec, re-validate, keep the unweighted
          // spec on any failure. A fresh start skips both.
          try {
            if (window.DCLedger && window.DCLedger.enabled &&
                !ctx.freshStart &&
                typeof window.DCLedger.weightTurn === "function") {
              var weighted = window.DCLedger.weightTurn(spec.blocks);
              if (weighted && weighted.blocks) {
                var wSpec = { blocks: weighted.blocks };
                if (validateSessionSpec(S, wSpec, scope)) {
                  spec = wSpec;
                  turnCategories = weighted.categories || null;
                }
              }
            }
          } catch (e) { /* the ledger never breaks the page */ }
        }
        // A spec that fails the client gate is dropped, never
        // re-asked; the answer, if any, still serves.
      }
      if (!specNew && !answer && !cleanPointer(data.pointer)) {
        unifiedSessionDialogue(S,
          { kind: "status", text: UNIFIED_FAILURE_LINE },
          ctx.releaseConfirm ? null
            : { prompt: ctx.prompt, outcome: "failure" });
        return;
      }
      var pointer = cleanPointer(data.pointer);
      var mixture = answer && specNew ? "mixed"
        : answer ? "answer" : "composition";
      var newChip = {
        turn: ctx.turn, action: "unified", mixture: mixture,
        // Answer-only: the current state's blocks carry forward
        // unchanged, never re-weighted at carry time.
        spec: specNew ? spec : chip.spec,
        specNew: specNew,
        scope: specNew ? scope : chip.scope,
        prompt: ctx.prompt, answer: answer, pointer: pointer,
        categories: turnCategories,
        freshStart: !!ctx.freshStart,
        seq: threadNextSeq(S.page)
      };
      S.chips = S.chips.slice(0, S.current + 1);
      S.chips.push(newChip);
      S.current = S.chips.length - 1;
      S.lastBuilt = S.current;
      S.docked = true;
      S.ui = "field"; S.pending = null; S.status = "";
      S.dialogue = null;
      // Exactly one decrement per state-producing response; the
      // release-confirm state counts here, once, for the pair.
      S.submits += 1;
      saveSession(S);
      renderSession();
      track("Prompt Turn Rendered", {
        page: S.page, turn_number: ctx.turn,
        action: specNew ? "recompose" : "answer",
        block_count: newChip.spec ? newChip.spec.blocks.length : 0,
        scope: newChip.scope, mixture: mixture,
        request_id: ctx.requestId
      });
      if (pointer) {
        track("Prompt Pointer Shown", {
          page: S.page, covering_page: pointer.covering_page,
          placement: "state", request_id: ctx.requestId
        });
      }
      if (specNew && !ctx.freshStart) {
        ledgerRecordSpec(spec, S.page, newChip.scope);
      }
      if (answer) ledgerRecordAnswer(answer);
      if (S.submits >= PROMPT_CAP && !S.capFired) {
        S.capFired = true;
        track("Prompt Cap Reached", { page: S.page });
        renderSession();
      }
    };
    if (scope === "released" && !blocksPayload) {
      loadBlocks().then(apply);
    } else {
      apply();
    }
  }

  function confirmUnifiedSession(S) {
    var pending = S.pending;
    if (!pending) { S.ui = "field"; renderSession(); return; }
    S.pending = null;
    submitUnifiedSession(S, pending.prompt, {
      releaseConfirm: true, turnNo: pending.turn
    });
  }

  /* ---- Flat unified sessions: home, the non-converting case
     studies (Decision 16 pages whose bodies have not converted),
     and every other page. One state list per page: the published
     page, the arrival view where the page composes one, then one
     state per state-producing response. The first composed state
     is "the assembled view"; later ones are rewrites. Responses
     render in the page's composed region, around the fixed body,
     never interleaved with it. ---- */

  var flatSession = null;

  function flatStoreKey(page) { return "dc.prompt." + page; }

  function makeFlatSession(cfg) {
    return {
      kind: cfg.kind, page: cfg.page,
      pageName: cfg.pageName || null,
      el: cfg.el || null, entry: cfg.entry || null,
      view: cfg.view || null,
      arrivalSource: cfg.arrivalSource || "arrival",
      states: [{ action: "published", prompt: null, turn: 0,
                  spec: null, answer: null, pointer: null }],
      current: 0, submits: 0, inFlight: false,
      pending: null, dialogue: null, capFired: false,
      arrivalOnScreen: false
    };
  }

  function flatStateName(F, st, idx) {
    if (idx === 0) return "the published page";
    if (st.action === "arrival") return "as you arrived";
    var pos = 0;
    for (var i = 1; i <= idx; i++) {
      if (F.states[i].action !== "arrival") pos += 1;
    }
    return pos <= 1 ? "the assembled view" : "rewrite " + pos;
  }

  function flatReceiptLine(st) {
    var q = "\u201C" + esc(st.prompt || "") + "\u201D";
    if (st.answer && st.specNew) return "Answered and rebuilt for: " + q;
    if (st.answer && st.pointer) return "Answered and pointed for: " + q;
    if (st.answer) return "Answered for: " + q;
    if (st.pointer) return "Rebuilt and pointed for: " + q;
    return "Rebuilt for: " + q;
  }

  function saveFlat(F) {
    try {
      sessionStorage.setItem(flatStoreKey(F.page), JSON.stringify({
        states: F.states, current: F.current, submits: F.submits
      }));
    } catch (e) { /* storage unavailable: in-memory session */ }
  }

  function restoreFlatStore(F) {
    var data = null;
    try {
      var raw = sessionStorage.getItem(flatStoreKey(F.page));
      if (raw) data = JSON.parse(raw);
    } catch (e) { data = null; }
    if (!data || !Array.isArray(data.states)) return false;
    var kept = [F.states[0]];
    var adopted = false;
    data.states.forEach(function (st, i) {
      if (i === 0 || !st) return;
      if (st.action === "arrival") {
        // The arrival belongs to this visit's render, not the
        // store; the fresh arrival state already stands.
        if (F.kind === "page" && kept.length === 1) {
          kept.push(F.states[1]);
        }
        return;
      }
      if (st.action === "intent") { kept.push(st); adopted = true; return; }
      if (st.action !== "unified") return;
      if (st.spec && !validateFlatSpec(F, st.spec, st.scope)) {
        if (!cleanAnswer(st.answer)) return;
        st = Object.assign({}, st, { spec: null, specNew: false,
                                     mixture: "answer" });
      }
      if (!st.spec && !cleanAnswer(st.answer)) return;
      kept.push(st);
      adopted = true;
    });
    if (F.kind === "page" && kept.length === 1 && F.states[1]) {
      kept.push(F.states[1]);
    }
    if (!adopted) return false;
    F.states = kept;
    F.current = Math.min(
      typeof data.current === "number" ? data.current : 1,
      kept.length - 1);
    F.submits = data.submits || 0;
    F.states.forEach(function (st) {
      if (st.prompt && !st.seq) st.seq = threadNextSeq(F.page);
    });
    return true;
  }

  function validateFlatSpec(F, spec, scope) {
    if (!spec || !Array.isArray(spec.blocks) || !spec.blocks.length) {
      return null;
    }
    if (scope === "released" || F.kind === "home") {
      if (!blocksPayload) return null;
      return validateSpec(spec, blocksPayload) ? spec : null;
    }
    if (F.kind === "page") {
      if (!validateSpec(spec, F.view, F.page)) return null;
      if (spec.blocks[0].id !== F.entry.anchor) return null;
      var inSlice = {};
      F.view.blocks.forEach(function (b) { inSlice[b.id] = true; });
      return spec.blocks.every(function (b) { return inSlice[b.id]; })
        ? spec : null;
    }
    return null; // a generic page has no library of its own
  }

  function flatRegion(F) {
    var el = F.el || slot();
    if (el) { F.el = el; return el; }
    el = document.createElement("section");
    el.className = "composition cp-composed";
    el.id = "composition";
    el.setAttribute("aria-label", "Assembled from the record");
    el.hidden = true;
    var main = document.querySelector("main");
    if (main) main.insertBefore(el, main.firstChild);
    else document.body.appendChild(el);
    F.el = el;
    return el;
  }

  function intentLinksHtml(intent) {
    var links = LINKS[intent] || [];
    if (!links.length) return "";
    return '<p class="intent-links">' + links.map(function (l) {
      return '<a href="' + l.href + '"' + extAttr(l.href) +
        trackAttr(l.href, l.label) + ">" + l.label +
        extHint(l.href) + "</a>";
    }).join("") + "</p>";
  }

  function renderFlat(F) {
    if (!surfaceOn()) return;
    trySurface(function (SF) {
      renderFlatSurface(SF, F);
      return true;
    });
  }

  function renderFlatSurface(SF, F) {
    SF.registerUnifiedSubmit(function (text) {
      if (flatSession !== F) return false;
      submitUnifiedFlat(F, text);
      return true;
    });
    var st = F.states[F.current];
    var el = null;
    if (st.action !== "intent" &&
        !(st.action === "unified" && st.intent)) {
      F.renderedState = st;
    }
    if (st.action === "arrival") {
      if (!F.arrivalOnScreen) {
        renderPageComposition(F.el, F.page, F.entry, F.view,
          st.spec, F.arrivalSource, st.categories || null,
          "restore");
        F.arrivalOnScreen = true;
      }
      el = F.el;
    } else {
      F.arrivalOnScreen = false;
      if (st.action === "published") {
        F.renderedState = null;
        if (F.kind === "page") {
          dismissPageSurface();
        } else {
          el = F.el || slot();
          if (el) {
            el.hidden = true; el.innerHTML = "";
            el.removeAttribute("data-render-key");
            el.removeAttribute("data-render-source");
          }
          SF.setReceipt(null);
        }
        if (F.kind !== "home") SF.setScope(null);
      } else if (st.action === "intent") {
        if (F.renderedState !== st) {
          renderFlatIntent(SF, F, st);
          F.renderedState = st;
        }
        el = F.el;
      } else if (st.action === "unified" && st.intent) {
        // An answer carried over an intent view: the answer
        // element leads the same intent composition, unchanged.
        if (F.renderedState !== st) {
          renderFlatUnifiedIntent(SF, F, st);
          F.renderedState = st;
        }
        el = F.el;
      } else {
        el = flatRegion(F);
        var heading = F.kind === "generic"
          ? '<h3 class="cp-composed-h">The full picture</h3>'
          : '<h3 class="composition-h">The full picture</h3>';
        el.innerHTML = heading + answerElementHtml(st.answer) +
          (st.spec
            ? renderFragmentHtml(st.spec,
                st.scope === "released" || F.kind !== "page"
                  ? blocksPayload : F.view,
                F.kind === "page" ? F.page : undefined)
            : "") +
          pointerElementHtml(st.pointer);
        el.hidden = false;
        el.setAttribute("data-render-key", "unified:" + F.page);
        el.setAttribute("data-render-source", "unified");
        SF.setReceipt({
          historyLabel: null,
          aiFraming: !!(st.answer && st.answer.framing),
          expandedHtml:
            '<p class="composition-from-intent">' +
            flatReceiptLine(st) + "</p>",
          onRestore: function () { goFlat(F, 0); }
        });
        if (F.kind !== "home") {
          SF.setScope(st.scope === "released"
            ? "Building from across the published record"
            : "Starting from " + F.pageName);
        }
      }
    }
    if (F.states.length > 1) {
      SF.registerStates({
        states: F.states.map(function (s, i) {
          return { name: flatStateName(F, s, i) };
        }),
        current: F.current,
        onActivate: function (idx) { goFlat(F, idx); }
      });
    } else {
      SF.clearStates();
    }
    registerFlatThread(SF, F);
    // Turns area: pending replaces dialogue in flight; a dialogue
    // outcome replaces the pending line; a state clears both.
    if (F.inFlight) {
      SF.showDialogue("status", { text: UNIFIED_PENDING_LINE });
    } else if (F.dialogue) {
      SF.showDialogue(F.dialogue.kind, F.dialogue);
      wireFlatDialogue(F);
    } else if (F.submits >= PROMPT_CAP && F.states.length > 1) {
      SF.showDialogue("status", { text: UNIFIED_CAP_LINE });
    } else {
      SF.showDialogue("clear");
    }
    SF.refreshBand();
  }

  function renderFlatIntent(SF, F, st) {
    var el = F.el || slot();
    if (!el) return;
    F.el = el;
    var finish = function () {
      var entry = byIntent && byIntent[st.intent];
      if (!entry) return;
      el.innerHTML = '<h3 class="composition-h">The full picture</h3>' +
        entry.html + intentLinksHtml(st.intent);
      el.hidden = false;
      el.setAttribute("data-render-key", "intent:" + st.intent);
      el.setAttribute("data-render-source", "button");
      Array.prototype.forEach.call(
        document.querySelectorAll(".intent-btn"),
        function (b) {
          b.setAttribute("aria-pressed",
            b.getAttribute("data-intent") === "intent_" + st.intent
              ? "true" : "false");
        });
      try {
        history.replaceState(null, "", "#c=" + (st.sig || entry.sig));
      } catch (e) {}
      SF.setReceipt({
        historyLabel: null, aiFraming: false,
        expandedHtml: "",
        onRestore: function () { goFlat(F, 0); }
      });
      track("Composition Rendered", { intent: st.intent });
    };
    if (byIntent) finish();
    else load().then(finish);
  }

  function renderFlatUnifiedIntent(SF, F, st) {
    var el = F.el || slot();
    if (!el) return;
    F.el = el;
    var finish = function () {
      var entry = byIntent && byIntent[st.intent];
      if (!entry) return;
      el.innerHTML = '<h3 class="composition-h">The full picture</h3>' +
        answerElementHtml(st.answer) + entry.html +
        intentLinksHtml(st.intent) + pointerElementHtml(st.pointer);
      el.hidden = false;
      el.setAttribute("data-render-key", "intent:" + st.intent);
      el.setAttribute("data-render-source", "unified");
      SF.setReceipt({
        historyLabel: null,
        aiFraming: !!(st.answer && st.answer.framing),
        expandedHtml:
          '<p class="composition-from-intent">' +
          flatReceiptLine(st) + "</p>",
        onRestore: function () { goFlat(F, 0); }
      });
    };
    if (byIntent) finish();
    else load().then(finish);
  }

  function wireFlatDialogue(F) {
    var area = window.DCSurface.turnsArea();
    if (!area) return;
    var bh = area.querySelector("#prompt-build-here");
    if (bh) {
      bh.addEventListener("click", function () {
        var p = F.pending;
        F.pending = null; F.dialogue = null;
        if (p) submitUnifiedFlat(F, p.prompt, { buildHere: true });
      });
    }
    var cf = area.querySelector("#prompt-release-confirm");
    if (cf) {
      cf.addEventListener("click", function () {
        track("Prompt Release Confirmed", { page: F.page });
        confirmUnifiedFlat(F);
      });
    }
    var dc = area.querySelector("#prompt-release-decline");
    if (dc) {
      dc.addEventListener("click", function () {
        track("Prompt Release Declined", { page: F.page });
        F.pending = null; F.dialogue = null;
        renderFlat(F);
      });
    }
  }

  function registerFlatThread(SF, F) {
    var stateEntries = [];
    F.states.forEach(function (st, i) {
      if (i === 0 || !st.prompt) return;
      stateEntries.push({ seq: st.seq || 0, label: st.prompt,
                          kind: "state", stateIdx: i });
    });
    var model = buildThreadModel(F.page, stateEntries, {
      inert: F.inFlight,
      activate: function (merged) {
        if (!merged) return;
        if (merged.kind === "state") {
          goFlat(F, merged.stateIdx, true);
          return;
        }
        threadActivateDialogue(merged, function (d) {
          if (d.kind === "pointer") {
            F.pending = {
              prompt: d.prompt, turn: F.submits + 1,
              covering_page: d.covering_page,
              covering_name: d.covering_name
            };
            F.dialogue = { kind: "pointer",
              covering_page: d.covering_page,
              covering_name: d.covering_name };
          } else {
            F.dialogue = { kind: d.kind, text: d.text,
                           link: d.link };
          }
          renderFlat(F);
        });
      }
    });
    SF.registerThread(model);
  }

  function goFlat(F, idx, viaThread) {
    if (idx < 0 || idx >= F.states.length) return;
    F.current = idx;
    F.pending = null;
    F.dialogue = null;
    saveFlat(F);
    renderFlat(F);
    // Prompt History Restored belongs to the prompt series: it
    // fires for unified states. Arrival and published restores
    // on page-kind pages are measured by the page-composition
    // events, and home intent restores by Composition Rendered.
    if (F.states[idx].action === "unified") {
      track("Prompt History Restored", {
        page: F.page, restored_turn: F.states[idx].turn || 0,
        via: viaThread ? "thread" : "state_line"
      });
    }
    if (viaThread) focusCanvasHeading(F.el || slot());
  }

  function flatPriorSpecs(F) {
    var out = [];
    for (var i = 1; i < F.current; i++) {
      if (F.states[i].spec) out.push({ spec: F.states[i].spec });
    }
    return out;
  }

  function submitUnifiedFlat(F, text, opts) {
    opts = opts || {};
    if (F.inFlight) return;
    var st = F.states[F.current];
    if (!opts.buildHere && !opts.releaseConfirm) {
      if (st.prompt === text &&
          F.current === F.states.length - 1) {
        F.dialogue = { kind: "status", text: REPEAT_LINE };
        renderFlat(F);
        return;
      }
      if (F.submits >= PROMPT_CAP) {
        F.dialogue = { kind: "status", text: UNIFIED_CAP_LINE };
        renderFlat(F);
        return;
      }
    }
    F.pending = null;
    F.dialogue = null;
    var freshStartActive = freshStartFor(text, F.page);
    var turnNo = opts.releaseConfirm ? (opts.turnNo || F.submits + 1)
      : F.submits + 1;
    var requestId = newRequestId();
    var scope = opts.releaseConfirm ? "released"
      : (st.scope || (F.kind === "home" ? "released" : "page"));
    if (!opts.releaseConfirm) {
      track("Prompt Submitted", {
        page: F.page, turn_number: turnNo, scope: scope,
        path: "surface", request_id: requestId
      });
    }
    F.inFlight = true;
    renderFlat(F);
    postUnified({
      mode: "unified", text: text, page: F.page,
      current_spec: st.spec || null,
      prior_specs: flatPriorSpecs(F),
      turn: turnNo, scope: scope,
      release_confirm: !!opts.releaseConfirm,
      build_here: !!opts.buildHere,
      request_id: requestId
    }).then(function (data) {
      F.inFlight = false;
      handleUnifiedFlatResponse(F, data, {
        prompt: text, turn: turnNo, requestId: requestId,
        freshStart: freshStartActive,
        releaseConfirm: !!opts.releaseConfirm
      });
    });
  }

  function flatDialogue(F, dialogue, threadEntry) {
    F.pending = null;
    F.dialogue = dialogue;
    if (threadEntry) threadAddDialogue(F.page, threadEntry);
    renderFlat(F);
  }

  function handleUnifiedFlatResponse(F, data, ctx) {
    var record = !ctx.releaseConfirm;
    if (!data) {
      flatDialogue(F,
        { kind: "status", text: UNIFIED_FAILURE_LINE },
        record ? { prompt: ctx.prompt, outcome: "failure" } : null);
      return;
    }
    if (data.outcome === "disabled") {
      flatDialogue(F,
        { kind: "status", text: UNIFIED_DISABLED_LINE },
        record ? { prompt: ctx.prompt, outcome: "disabled" } : null);
      return;
    }
    if (data.outcome === "refused") {
      flatDialogue(F,
        { kind: "status", text: data.text || UNIFIED_FAILURE_LINE },
        record ? { prompt: ctx.prompt, outcome: "refused",
                   text: data.text } : null);
      return;
    }
    if (data.outcome === "none") {
      flatDialogue(F,
        { kind: "none", text: data.text, link: data.link || null },
        record ? { prompt: ctx.prompt, outcome: "none",
                   text: data.text, link: data.link || null } : null);
      return;
    }
    if (data.outcome === "pointer_only") {
      var p = cleanPointer(data.pointer);
      if (!p) {
        flatDialogue(F,
          { kind: "status", text: UNIFIED_FAILURE_LINE },
          record ? { prompt: ctx.prompt, outcome: "failure" } : null);
        return;
      }
      F.pending = {
        prompt: ctx.prompt, turn: ctx.turn,
        covering_page: p.covering_page,
        covering_name: p.covering_name
      };
      F.dialogue = { kind: "pointer",
        covering_page: p.covering_page,
        covering_name: p.covering_name };
      if (record) {
        threadAddDialogue(F.page, {
          prompt: ctx.prompt, outcome: "pointer",
          covering_page: p.covering_page,
          covering_name: p.covering_name
        });
        track("Prompt Pointer Shown", {
          page: F.page, covering_page: p.covering_page,
          placement: "dialogue", request_id: ctx.requestId
        });
      }
      renderFlat(F);
      return;
    }
    if (data.outcome === "release_offer") {
      F.pending = { prompt: ctx.prompt, turn: ctx.turn };
      F.dialogue = { kind: "release", page_name: F.pageName };
      track("Prompt Release Offered", { page: F.page });
      renderFlat(F);
      return;
    }
    if (data.outcome === "state") {
      applyUnifiedFlatState(F, data, ctx);
      return;
    }
    flatDialogue(F,
      { kind: "status", text: UNIFIED_FAILURE_LINE },
      record ? { prompt: ctx.prompt, outcome: "failure" } : null);
  }

  function applyUnifiedFlatState(F, data, ctx) {
    var st = F.states[F.current];
    var answer = cleanAnswer(data.answer);
    var scope = data.scope === "released" ? "released"
      : (F.kind === "home" ? "released" : (st.scope || "page"));
    var apply = function () {
      var spec = null;
      var specNew = false;
      var turnCategories = null;
      if (data.spec) {
        var candidate = data.spec;
        if (validateFlatSpec(F, candidate, scope)) {
          spec = candidate;
          specNew = true;
          try {
            if (window.DCLedger && window.DCLedger.enabled &&
                !ctx.freshStart &&
                typeof window.DCLedger.weightTurn === "function") {
              var weighted = window.DCLedger.weightTurn(spec.blocks);
              if (weighted && weighted.blocks) {
                var wSpec = { blocks: weighted.blocks };
                if (validateFlatSpec(F, wSpec, scope)) {
                  spec = wSpec;
                  turnCategories = weighted.categories || null;
                }
              }
            }
          } catch (e) { /* the ledger never breaks the page */ }
        }
      }
      var pointer = cleanPointer(data.pointer);
      if (!specNew && !answer && !pointer) {
        flatDialogue(F,
          { kind: "status", text: UNIFIED_FAILURE_LINE },
          ctx.releaseConfirm ? null
            : { prompt: ctx.prompt, outcome: "failure" });
        return;
      }
      var mixture = answer && specNew ? "mixed"
        : answer ? "answer" : "composition";
      var newState = {
        action: "unified", mixture: mixture,
        // Answer-only: the current state's view carries forward
        // unchanged (its spec, or its intent on home), never
        // re-weighted at carry time.
        spec: specNew ? spec
          : (st.action === "intent" ? null : st.spec),
        intent: specNew ? null
          : (st.action === "intent" ? st.intent : null),
        sig: specNew ? null
          : (st.action === "intent" ? st.sig : null),
        specNew: specNew,
        scope: specNew ? scope : (st.scope || scope),
        prompt: ctx.prompt, turn: ctx.turn,
        answer: answer, pointer: pointer,
        categories: turnCategories,
        freshStart: !!ctx.freshStart,
        seq: threadNextSeq(F.page)
      };
      F.states = F.states.slice(0, F.current + 1);
      F.states.push(newState);
      F.current = F.states.length - 1;
      F.pending = null;
      F.dialogue = null;
      F.submits += 1;
      saveFlat(F);
      renderFlat(F);
      track("Prompt Turn Rendered", {
        page: F.page, turn_number: ctx.turn,
        action: specNew ? "recompose" : "answer",
        block_count: newState.spec ? newState.spec.blocks.length : 0,
        scope: newState.scope, mixture: mixture,
        request_id: ctx.requestId
      });
      if (pointer) {
        track("Prompt Pointer Shown", {
          page: F.page, covering_page: pointer.covering_page,
          placement: "state", request_id: ctx.requestId
        });
      }
      if (specNew && !ctx.freshStart) {
        ledgerRecordSpec(spec, F.page, newState.scope);
      }
      if (answer) ledgerRecordAnswer(answer);
      if (F.submits >= PROMPT_CAP && !F.capFired) {
        F.capFired = true;
        track("Prompt Cap Reached", { page: F.page });
        renderFlat(F);
      }
    };
    if ((scope === "released" || F.kind === "home") &&
        !blocksPayload) {
      loadBlocks().then(apply);
    } else {
      apply();
    }
  }

  function confirmUnifiedFlat(F) {
    var pending = F.pending;
    if (!pending) { F.dialogue = null; renderFlat(F); return; }
    F.pending = null;
    F.dialogue = null;
    submitUnifiedFlat(F, pending.prompt, {
      releaseConfirm: true, turnNo: pending.turn
    });
  }

  function homeStripSelect(F, intent) {
    load().then(function () {
      var entry = byIntent && byIntent[intent];
      if (!entry) return;
      var idx = -1;
      for (var i = 1; i < F.states.length; i++) {
        if (F.states[i].action === "intent") { idx = i; break; }
      }
      if (idx < 0) {
        F.states.push({
          action: "intent", intent: intent, sig: entry.sig,
          prompt: null, turn: 0, spec: null, answer: null,
          pointer: null, scope: "released", seq: 0
        });
        idx = F.states.length - 1;
      } else {
        F.states[idx].intent = intent;
        F.states[idx].sig = entry.sig;
        F.renderedState = null; // same object, new content
      }
      F.current = idx;
      F.pending = null;
      F.dialogue = null;
      saveFlat(F);
      renderFlat(F);
      track("Composition Rendered", { intent: intent });
      ledgerRecordIntent(intent);
      ledgerRecordComposition("/");
    });
  }

  function initHomeFlat(el) {
    var F = makeFlatSession({ kind: "home", page: "/", el: el });
    flatSession = F;
    // Render once now so the unified submit handler is registered
    // before the payloads land; restore re-renders after.
    renderFlat(F);
    loadBlocks().then(function () {
      restoreFlatStore(F);
      renderFlat(F);
    });
    return F;
  }

  function initPageFlat(el, page, entry, view, spec, source,
                        historyCategories) {
    var F = makeFlatSession({
      kind: "page", page: page, pageName: entry.page_name,
      el: el, entry: entry, view: view, arrivalSource: source
    });
    F.states.push({
      action: "arrival", prompt: null, turn: 0, spec: spec,
      answer: null, pointer: null, scope: "page",
      categories: historyCategories || null, seq: 0
    });
    F.current = 1;
    F.arrivalOnScreen = true;
    flatSession = F;
    renderFlat(F);
    loadBlocks().then(function () {
      restoreFlatStore(F);
      renderFlat(F);
    });
    return F;
  }

  function initGenericFlat() {
    var page = window.location.pathname;
    if (page.charAt(page.length - 1) !== "/") page += "/";
    var F = makeFlatSession({
      kind: "generic", page: page, pageName: "this page"
    });
    flatSession = F;
    renderFlat(F);
    loadBlocks().then(function () {
      restoreFlatStore(F);
      renderFlat(F);
    });
    return F;
  }

  function init() {
    var el = slot();
    if (!el) {
      // No composition mount: on the surface path a generic flat
      // session still serves composer submits (unified batch);
      // the composed region is created on the first state.
      if (surfaceOn()) {
        if (streamOn()) initStreamGeneric();
        else initGenericFlat();
      }
      return;
    }
    if (el.hasAttribute("data-compose-page")) {
      // Surface build, session pages only: an Ask "none" routes
      // its text to the active session (build sheet section 3,
      // rule 3). Under the unified batch the route lands on the
      // unified submit; ask.js no longer dispatches the event on
      // the surface path, so this is a backstop for stale callers.
      // Registered only under the surface presenter; the layered
      // path keeps today's behavior, in which the event has no
      // listener on page-mode pages.
      if (surfaceOn()) {
        document.addEventListener("dc:problem", function (ev) {
          var text = ev && ev.detail && ev.detail.text;
          if (text && pageSession) {
            submitUnifiedSession(pageSession, text);
          }
        });
      }
      pageInit(el); return;
    }
    el.setAttribute("aria-live", "polite");
    var homeFlat = surfaceOn()
      ? (streamOn() ? initStreamHome(el) : initHomeFlat(el)) : null;
    document.addEventListener("dc:problem", function (ev) {
      var text = ev && ev.detail && ev.detail.text;
      if (!text) return;
      if (homeFlat) {
        if (homeFlat.isStream) streamSubmitText(homeFlat, text);
        else submitUnifiedFlat(homeFlat, text);
      }
      else classifyProblem(text);
    });
    document.addEventListener("dc:composition-cleared", function () {
      if (homeFlat) {
        if (!homeFlat.isStream) goFlat(homeFlat, 0);
      }
      else clearCompositionAny();
    });
    var btns = document.querySelectorAll(".intent-btn");
    Array.prototype.forEach.call(btns, function (btn) {
      btn.addEventListener("click", function () {
        if (homeFlat) {
          if (homeFlat.isStream) streamIntentTap(homeFlat, btn);
          else homeStripSelect(homeFlat, intentOfButton(btn));
          return;
        }
        load().then(function () { render(intentOfButton(btn)); });
      });
    });
    window.addEventListener("hashchange", function () {
      var hm = /#c=([0-9a-f]{24})/.exec(location.hash || "");
      if (homeFlat && homeFlat.isStream) {
        // Share codes are an arrival mechanism: while the
        // stream stands, a hash change does not re-shape the
        // conversation. Before engagement it renders plainly.
        if (homeFlat.streamEl) return;
        if (!hm) { streamClearHomeShare(homeFlat); return; }
        streamHomeShare(homeFlat, hm[1]);
        return;
      }
      if (homeFlat) {
        if (!hm) { goFlat(homeFlat, 0); return; }
        load().then(function () {
          var e2 = bySig && bySig[hm[1]];
          if (e2) homeStripSelect(homeFlat, e2.intent);
          else goFlat(homeFlat, 0);
        });
        return;
      }
      if (!hm) { clearCompositionAny(); return; }
      load().then(function () {
        var e2 = bySig && bySig[hm[1]];
        if (e2) render(e2.intent, hm[1]);
        else clearCompositionAny();
      });
    });
    var m = /#c=([0-9a-f]{24})/.exec(location.hash || "");
    if (m) {
      if (homeFlat && homeFlat.isStream) {
        streamHomeShare(homeFlat, m[1]);
        if (el.scrollIntoView) {
          el.scrollIntoView({ block: "nearest" });
        }
        return;
      }
      load().then(function () {
        var entry = bySig && bySig[m[1]];
        if (!entry) {
          track("Composition Fallback", {});
          return;
        }
        if (homeFlat) {
          homeStripSelect(homeFlat, entry.intent);
          if (el.scrollIntoView) {
            el.scrollIntoView({ block: "nearest" });
          }
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

  /* ============================================================
     Engaged mode: the StreamPresenter (Nov 16, 2026; engaged-mode
     amendment E1 to E10, build sheet P-1116-29 as approved).
     Selected when the surface layer is active and ENGAGED is on
     (streamOn). On engagement the published page is adopted as
     the opening turn of a conversation stream in the canvas;
     submits append prompt and response turns; the stream follows
     the visit across pages through one sessionStorage store
     (dc_stream_v1); the receipt goes per-turn; restore, exit,
     and clear are dock controls. The renderers, the validator,
     the weighting, the accounting discipline, and the events
     are the unified batch's, shared, not forked. Flag off, none
     of this runs and dc_stream_v1 is never read.
     ============================================================ */

  var STREAM_KEY = "dc_stream_v1";
  var STREAM_MAX_PLANS = 48;
  var STREAM_MAX_BYTES = 512 * 1024;
  var STREAM_PAGE_CAP = 10;
  var STREAM_VISIT_CAP = 30;
  var VISIT_CAP_LINE = "You have reached this visit\u2019s prompt " +
    "limit. Your views and the published pages remain.";
  var STREAM_DROPPED_LINE = "Earlier turns are not kept.";

  var streamCtx = null;

  function streamSF() { return window.DCSurface; }

  function makeStreamCtx(cfg) {
    return {
      isStream: true, kind: cfg.kind, page: cfg.page,
      pageName: cfg.pageName || null, el: cfg.el || null,
      entry: cfg.entry || null, view: cfg.view || null,
      arrivalSpec: null, arrivalSource: "arrival",
      arrivalCategories: null, arrivalReceiptModel: null,
      arrivalDismissed: false,
      segSpec: null,
      segScope: cfg.kind === "home" ? "released" : "page",
      segIntent: null, segSig: null, segLastPrompt: null,
      segContentTurns: 0,
      inFlight: false, pendingRelease: null, triggerNext: null,
      store: null, streamEl: null, openingArticle: null,
      openingBody: null, adoptedRun: null, collapsed: false,
      pendingEls: null, failureEls: null
    };
  }

  function streamVF(ctx) {
    return { kind: ctx.kind, page: ctx.page,
             pageName: ctx.pageName, view: ctx.view,
             entry: ctx.entry };
  }

  function registerStreamSubmit(ctx) {
    trySurface(function (SF) {
      SF.registerUnifiedSubmit(function (text) {
        if (streamCtx !== ctx) return false;
        streamSubmitText(ctx, text);
        return true;
      });
      return true;
    });
  }

  /* ---- The visit store (sheet section 4) ---- */

  function streamNormalizeStore(d) {
    if (!d || d.v !== 1 || !Array.isArray(d.turns)) return null;
    if (!d.caps || typeof d.caps !== "object") {
      d.caps = { pages: {}, visit: 0 };
    }
    if (!d.caps.pages || typeof d.caps.pages !== "object") {
      d.caps.pages = {};
    }
    if (typeof d.caps.visit !== "number") d.caps.visit = 0;
    if (!d.caps.fired || typeof d.caps.fired !== "object") {
      d.caps.fired = { pages: {}, visit: false };
    }
    if (!d.caps.fired.pages) d.caps.fired.pages = {};
    if (typeof d.seq !== "number") d.seq = d.turns.length + 1;
    if (typeof d.dropped !== "number") d.dropped = 0;
    return d;
  }

  function streamReadStore() {
    try {
      var raw = sessionStorage.getItem(STREAM_KEY);
      if (!raw) return null;
      return streamNormalizeStore(JSON.parse(raw));
    } catch (e) { return null; }
  }

  function streamNewStore() {
    return {
      v: 1, engaged: true, exited: false, seq: 1, dropped: 0,
      caps: { pages: {}, visit: 0,
              fired: { pages: {}, visit: false } },
      engagedFired: false, turns: []
    };
  }

  /* Eviction (sheet section 4): oldest prompt-plus-response
     pairs first, whole, never mid-turn; then oldest opening
     cards that are not the current page's; the newest pair is
     never evicted. The caps and the dropped count live outside
     turns and are never evicted. */
  function streamEvict(store, currentPage) {
    var guard = 0;
    while (guard++ < 300) {
      var size = 0;
      try { size = JSON.stringify(store).length; } catch (e) {}
      if (store.turns.length <= STREAM_MAX_PLANS &&
          size <= STREAM_MAX_BYTES) return;
      var turns = store.turns;
      var pairAt = -1, pairs = 0;
      for (var i = 0; i + 1 < turns.length; i++) {
        if (turns[i].kind === "prompt" &&
            (turns[i + 1].kind === "response" ||
             turns[i + 1].kind === "dialogue")) {
          if (pairAt < 0) pairAt = i;
          pairs += 1;
        }
      }
      if (pairs > 1 && pairAt >= 0) {
        turns.splice(pairAt, 2);
        store.dropped += 2;
        continue;
      }
      var droppedOne = false;
      for (var j = 0; j < turns.length; j++) {
        var p = turns[j];
        if (p.kind === "opening" && p.page !== currentPage &&
            j !== turns.length - 1) {
          turns.splice(j, 1);
          store.dropped += 1;
          droppedOne = true;
          break;
        }
      }
      if (droppedOne) continue;
      for (var k = 0; k + 1 < turns.length; k++) {
        if (turns[k].kind === "prompt") {
          turns.splice(k, 1);
          store.dropped += 1;
          droppedOne = true;
          break;
        }
      }
      if (!droppedOne) return;
    }
  }

  function streamSaveStore(store, currentPage) {
    streamEvict(store, currentPage);
    try {
      sessionStorage.setItem(STREAM_KEY, JSON.stringify(store));
      return true;
    } catch (e) {
      // Storage exception: evict and retry once; the stream
      // continues in memory if the write still fails.
      streamEvict(store, currentPage);
      try {
        sessionStorage.setItem(STREAM_KEY, JSON.stringify(store));
        return true;
      } catch (e2) { return false; }
    }
  }

  function streamAppendPlan(ctx, store, plan) {
    plan.seq = store.seq;
    store.seq += 1;
    store.turns.push(plan);
    streamSaveStore(store, ctx.page);
    return plan;
  }

  /* ---- Payload loaders for the stream (starters, slices) ---- */

  var startersPayload = null, startersLoading = null;
  function loadStarters() {
    if (startersPayload) return Promise.resolve(startersPayload);
    if (startersLoading) return startersLoading;
    startersLoading = fetch("/starters.json")
      .then(function (r) { return r.ok ? r.json() : null; })
      .then(function (d) {
        startersPayload = (d && typeof d === "object") ? d : null;
        return startersPayload;
      })
      .catch(function () { startersPayload = null; return null; });
    return startersLoading;
  }

  var slicePayload = null, sliceLoading = null;
  function loadSlice() {
    if (slicePayload) return Promise.resolve(slicePayload);
    if (sliceLoading) return sliceLoading;
    sliceLoading = fetch("/blocks-case-studies.json")
      .then(function (r) { return r.ok ? r.json() : null; })
      .then(function (d) {
        slicePayload = (d && d.pages) ? d : null;
        return slicePayload;
      })
      .catch(function () { slicePayload = null; return null; });
    return sliceLoading;
  }

  /* ---- Context anchors (fix batch, Nov 16, 2026) ----
     Each record in /record.json may carry an additive
     "anchor": the id of the section heading on its source
     page where the claim lives. The Lambda serves items
     with the bare source (its own registry copy is
     unchanged), so the fragment is resolved here, from the
     published registry: by record id when the item carries
     one, else by the deterministic {claim, source} match
     ask.js's ledger writes already use. The map loads once,
     alongside the stream payloads, and never blocks a
     render: an unresolved item links to the bare source,
     exactly as before. */
  var recordAnchors = null, recordAnchorsLoading = null;
  function loadRecordAnchors() {
    if (recordAnchors) return Promise.resolve(recordAnchors);
    if (recordAnchorsLoading) return recordAnchorsLoading;
    recordAnchorsLoading = fetch("/record.json")
      .then(function (r) { return r.ok ? r.json() : null; })
      .then(function (d) {
        if (!d || !Array.isArray(d.records)) return null;
        var byId = {}, byKey = {};
        d.records.forEach(function (rec) {
          if (!rec || typeof rec.anchor !== "string" ||
              !rec.anchor) return;
          if (typeof rec.id === "string") byId[rec.id] = rec.anchor;
          if (typeof rec.claim === "string" &&
              typeof rec.source === "string") {
            byKey[rec.claim + "\n" + rec.source] = rec.anchor;
          }
        });
        recordAnchors = { byId: byId, byKey: byKey };
        return recordAnchors;
      })
      .catch(function () { recordAnchors = null; return null; });
    return recordAnchorsLoading;
  }

  function contextHref(it) {
    if (!it || typeof it.source !== "string") return "";
    if (!recordAnchors) return it.source;
    var anchor = null;
    if (typeof it.id === "string" && recordAnchors.byId[it.id]) {
      anchor = recordAnchors.byId[it.id];
    } else if (typeof it.claim === "string") {
      anchor = recordAnchors.byKey[it.claim + "\n" + it.source] ||
        null;
    }
    return anchor ? it.source + "#" + anchor : it.source;
  }

  /* ---- Segment runtime: the page's chain within the visit ---- */

  function seedStreamSeg(ctx, store) {
    ctx.segSpec = ctx.kind === "page" ? ctx.arrivalSpec : null;
    ctx.segScope = ctx.kind === "home" ? "released" : "page";
    ctx.segIntent = null;
    ctx.segSig = null;
    ctx.segLastPrompt = null;
    ctx.segContentTurns = 0;
    store.turns.forEach(function (p) {
      if (p.page !== ctx.page || p.kind !== "response") return;
      if (p.mixture === "pointer") return;
      if (p.mixture === "intent") {
        ctx.segIntent = p.intent;
        ctx.segSig = p.sig;
        ctx.segSpec = null;
        return;
      }
      ctx.segSpec = p.spec || null;
      ctx.segScope = p.scope || ctx.segScope;
      ctx.segIntent = p.intent || null;
      ctx.segSig = p.sig || null;
      ctx.segLastPrompt = p.prompt || null;
      ctx.segContentTurns += 1;
    });
  }

  /* The unified request's spec chain for this page's segment:
     the arrival spec heads a case study's chain; each content
     turn contributes its effective spec; an intent turn marks
     its position with a null (its view carries no spec). The
     last position is the current spec; the rest are priors. */
  function streamChain(ctx, store) {
    var all = [];
    if (ctx.kind === "page" && ctx.arrivalSpec) {
      all.push(ctx.arrivalSpec);
    }
    if (store) {
      store.turns.forEach(function (p) {
        if (p.page !== ctx.page || p.kind !== "response" ||
            p.mixture === "pointer") return;
        all.push(p.mixture === "intent" ? null : (p.spec || null));
      });
    }
    var priors = [];
    for (var i = 0; i + 1 < all.length; i++) {
      if (all[i]) priors.push({ spec: all[i] });
    }
    return {
      current: all.length ? all[all.length - 1] : null,
      priors: priors
    };
  }

  function streamTailIsContentFor(ctx) {
    var turns = ctx.store ? ctx.store.turns : [];
    for (var i = turns.length - 1; i >= 0; i--) {
      var p = turns[i];
      if (p.page !== ctx.page) continue;
      /* Dialogue turns (a refusal, a repeat notice) and the
         prompt turns in front of them do not change the
         standing view; the walk continues past them to the
         last content turn. */
      if (p.kind === "dialogue" || p.kind === "prompt") continue;
      if (p.kind === "response") {
        return p.mixture !== "pointer" &&
          p.prompt === ctx.segLastPrompt;
      }
      return false;
    }
    return false;
  }

  /* ---- Adoption (sheet section 2.2) ----
     The canvas run: the contiguous element siblings between
     the header and the footer in their shared parent. On most
     pages that is <main> alone; on home it is the definition,
     the intent region, and <main>, so the entry region joins
     the opening turn as section 3.6 rules. The nodes move;
     nothing is copied, re-rendered, or re-fetched, and the
     recorded run restores exactly on exit. */

  function streamCanvasRun() {
    var main = document.querySelector("main");
    if (!main || !main.parentNode) return null;
    var parent = main.parentNode;
    var kids = Array.prototype.slice.call(parent.children);
    var start = 0, end = kids.length;
    kids.forEach(function (k, i) {
      if (k.tagName === "HEADER") start = i + 1;
      if (k.tagName === "FOOTER" && end === kids.length) end = i;
    });
    var nodes = kids.slice(start, end).filter(function (n) {
      return n.id !== "cp-stream";
    });
    if (!nodes.length) return null;
    return { parent: parent,
             anchor: end < kids.length ? kids[end] : null,
             nodes: nodes };
  }

  function capFirst(s) {
    return s ? s.charAt(0).toUpperCase() + s.slice(1) : s;
  }

  function streamPageDisplayName(ctx) {
    var h1 = document.querySelector("h1");
    var t = h1 && h1.textContent ? h1.textContent.trim() : "";
    if (t) return t;
    return (document.title || "").split("|")[0].trim() || ctx.page;
  }

  function streamOpeningPlan(ctx) {
    if (ctx.kind === "page" && ctx.entry) {
      var orient = null;
      if (ctx.view && ctx.view.blocks) {
        ctx.view.blocks.forEach(function (b) {
          if (b.id === ctx.entry.anchor && b.lengths) {
            orient = b.lengths.short || null;
          }
        });
      }
      return { kind: "opening", page: ctx.page,
               name: ctx.entry.page_name,
               title: capFirst(ctx.entry.page_name),
               orientation: orient };
    }
    var name = streamPageDisplayName(ctx);
    return { kind: "opening", page: ctx.page, name: name,
             title: name, orientation: null };
  }

  function streamMarkerEl(plan) {
    var p = document.createElement("p");
    p.className = "stream-marker";
    p.textContent = "Continuing on " + plan.name;
    return p;
  }

  function streamCardHeadEl(plan, expandable, ctx) {
    var head = document.createElement("div");
    head.className = "stream-card-head";
    var h = document.createElement("h2");
    h.className = "stream-card-title";
    h.textContent = plan.title;
    head.appendChild(h);
    if (plan.orientation) {
      var o = document.createElement("p");
      o.className = "stream-card-orient";
      o.textContent = plan.orientation;
      head.appendChild(o);
    }
    if (expandable) {
      var b = document.createElement("button");
      b.type = "button";
      b.className = "stream-expand";
      b.setAttribute("aria-expanded", "true");
      b.textContent = "Read the whole page";
      b.addEventListener("click", function () {
        setStreamOpeningCollapsed(ctx, !ctx.collapsed, false);
      });
      head.appendChild(b);
    }
    return head;
  }

  function streamOpeningCardEl(plan, marker) {
    var art = document.createElement("article");
    art.className = "stream-opening stream-opening-card";
    art.setAttribute("data-page", plan.page);
    if (marker) art.appendChild(streamMarkerEl(plan));
    art.appendChild(streamCardHeadEl(plan, false, null));
    return art;
  }

  function buildAdoptedOpening(ctx, plan, run, marker) {
    var art = document.createElement("article");
    art.className = "stream-opening";
    art.setAttribute("data-page", plan.page);
    if (marker) art.appendChild(streamMarkerEl(plan));
    art.appendChild(streamCardHeadEl(plan, true, ctx));
    var rc = document.createElement("div");
    rc.className = "stream-arrival-receipt";
    rc.hidden = true;
    art.appendChild(rc);
    var body = document.createElement("div");
    body.className = "stream-opening-body";
    run.nodes.forEach(function (n) { body.appendChild(n); });
    art.appendChild(body);
    ctx.openingBody = body;
    return art;
  }

  function streamDroppedEl() {
    var p = document.createElement("p");
    p.className = "stream-dropped";
    p.textContent = STREAM_DROPPED_LINE;
    return p;
  }

  function firstStreamResponseTop(ctx) {
    if (!ctx.streamEl) return null;
    var el = ctx.streamEl.querySelector(".stream-response");
    return el ? el.offsetTop : null;
  }

  /* The collapse (sheet section 2.3): same task as the first
     content-bearing turn's render, scroll-anchored on the
     first response turn; the stream root carries
     overflow-anchor: none so exactly this one adjustment
     acts. Expanding reverses it in place. */
  function setStreamOpeningCollapsed(ctx, collapsed, instant) {
    if (!ctx.openingBody || !ctx.openingArticle) return;
    var before = (!instant && collapsed)
      ? firstStreamResponseTop(ctx) : null;
    ctx.openingBody.hidden = collapsed;
    ctx.collapsed = collapsed;
    ctx.openingArticle.classList.toggle(
      "stream-opening-collapsed", collapsed);
    var btn = ctx.openingArticle.querySelector(".stream-expand");
    if (btn) {
      btn.setAttribute("aria-expanded", collapsed ? "false" : "true");
    }
    if (before != null) {
      var after = firstStreamResponseTop(ctx);
      if (after != null && after !== before) {
        try { window.scrollBy(0, after - before); } catch (e) {}
      }
    }
  }

  function collapseStreamOpeningAfterTurn(ctx) {
    if (!ctx.collapsed) {
      setStreamOpeningCollapsed(ctx, true, false);
    }
  }

  function attachStreamArrivalReceipt(ctx) {
    if (!ctx.arrivalReceiptModel || ctx.arrivalDismissed ||
        !ctx.openingArticle) return;
    var rc = ctx.openingArticle.querySelector(
      ".stream-arrival-receipt");
    if (rc) {
      streamSF().setReceiptIn(rc, ctx.arrivalReceiptModel);
      streamSF().setReceipt(null);
    }
  }

  /* D3 (engaged-UI revision, section 6 string 7): the scope
     label is removed on the engaged path — the opening turn
     already names where the conversation started. This
     stays as the stream's single scope call site, now a
     no-op; exit and clear still clear the label directly,
     and the fallback's scope behavior is untouched (it
     never calls this). */
  function updateStreamScope(ctx) { }

  function streamControlsModel(ctx) {
    return {
      exited: false,
      onRestore: function () { streamRestore(ctx); },
      onExit: function () { streamExit(ctx); },
      onClear: function () { streamClear(ctx); }
    };
  }

  function streamExitedControlsModel(ctx) {
    return {
      exited: true,
      onClear: function () { streamClear(ctx); }
    };
  }

  /* Builds the stream in this document from the store,
     adopting the canvas into the current page's opening turn.
     Resolves false when the canvas cannot be adopted. */
  function buildStreamDomNow(ctx, store) {
    var run = streamCanvasRun();
    if (!run) return false;
    var adoptedIdx = -1;
    for (var i = store.turns.length - 1; i >= 0; i--) {
      if (store.turns[i].kind === "opening") {
        if (store.turns[i].page === ctx.page) adoptedIdx = i;
        break;
      }
    }
    if (adoptedIdx < 0) {
      var plan = streamOpeningPlan(ctx);
      plan.seq = store.seq;
      store.seq += 1;
      store.turns.push(plan);
      adoptedIdx = store.turns.length - 1;
    }
    var section = document.createElement("section");
    section.id = "cp-stream";
    section.className = "cp-stream";
    run.parent.insertBefore(section, run.nodes[0]);
    if (store.dropped > 0) section.appendChild(streamDroppedEl());
    var seenOpening = false;
    store.turns.forEach(function (p, idx) {
      var marker = false;
      if (p.kind === "opening") {
        marker = seenOpening;
        seenOpening = true;
      }
      if (idx === adoptedIdx) {
        ctx.openingArticle = buildAdoptedOpening(ctx, p, run,
          marker);
        section.appendChild(ctx.openingArticle);
      } else if (p.kind === "opening") {
        section.appendChild(streamOpeningCardEl(p, marker));
      } else if (p.kind === "prompt") {
        section.appendChild(streamPromptEl(p));
      } else if (p.kind === "response") {
        section.appendChild(streamResponseEl(ctx, p));
      } else if (p.kind === "dialogue") {
        section.appendChild(streamDialogueEl(p));
      }
    });
    ctx.streamEl = section;
    /* Context links (fix batch, Nov 16, 2026): a "Read it in
       context" click leaves the conversation for the
       published page, at the claim's section. Delegated on
       the section so turns appended later are covered; the
       claim paragraph is the link's identifying home. */
    section.addEventListener("click", function (ev) {
      var t = ev.target;
      var a = t && t.closest ? t.closest("a") : null;
      if (!a) return;
      if (!a.closest || !a.closest(".cp-answer-claim")) return;
      streamContextClick(ctx, a, ev);
    });
    ctx.adoptedRun = run;
    var hasContent = store.turns.slice(adoptedIdx + 1).some(
      function (p) { return p.kind === "response"; });
    if (hasContent) setStreamOpeningCollapsed(ctx, true, true);
    attachStreamArrivalReceipt(ctx);
    streamSF().registerControls(streamControlsModel(ctx));
    streamSF().registerStarters(null);
    updateStreamScope(ctx);
    return true;
  }

  /* Engagement construction (sheet sections 2.2, 5): store
     created or re-entered, stream built, Conversation Engaged
     fired once per visit. Payloads land first so stored turns
     re-render locally with no model call. */
  function ensureStreamDom(ctx, trigger) {
    if (ctx.streamEl) return Promise.resolve(true);
    var store = ctx.store || streamReadStore() || streamNewStore();
    ctx.store = store;
    store.engaged = true;
    store.exited = false;
    if (!store.engagedFired) {
      track("Conversation Engaged", {
        page: ctx.page, trigger: trigger || "typed"
      });
      store.engagedFired = true;
    }
    var jobs = [loadBlocks(), loadSlice(), loadRecordAnchors()];
    if (store.turns.some(function (p) {
      return p.mixture === "intent";
    })) {
      jobs.push(load());
    }
    return Promise.all(jobs).then(function () {
      var ok = buildStreamDomNow(ctx, store);
      streamSaveStore(store, ctx.page);
      return ok;
    }).catch(function () {
      return buildStreamDomNow(ctx, store);
    });
  }

  function restoreStreamDom(ctx) {
    if (!ctx.streamEl || !ctx.adoptedRun) return;
    var run = ctx.adoptedRun;
    run.nodes.forEach(function (n) {
      run.parent.insertBefore(n, run.anchor);
    });
    if (ctx.streamEl.parentNode) {
      ctx.streamEl.parentNode.removeChild(ctx.streamEl);
    }
    ctx.streamEl = null;
    ctx.openingArticle = null;
    ctx.openingBody = null;
    ctx.adoptedRun = null;
    ctx.collapsed = false;
    ctx.releaseEl = null;
  }

  /* ---- Restore, exit, clear (sheet section 6) ---- */

  function streamRestore(ctx) {
    if (!ctx.openingArticle) return;
    setStreamOpeningCollapsed(ctx, false, false);
    try {
      if (ctx.openingArticle.scrollIntoView) {
        ctx.openingArticle.scrollIntoView({ block: "start" });
      }
    } catch (e) { /* scroll is best-effort */ }
  }

  /* A context navigation (fix batch, Nov 16, 2026): the
     visitor is leaving the conversation to read the claim
     where it lives, so the exit is written first and the
     arrival — this page restored, or the target page fresh —
     renders the published page, never the restored stream
     (the E9.4 split: exit keeps the visit's turns; only the
     presentation ends). Same page: exit in place and land
     on the anchor (the headings carry the shell's
     scroll-margin, so the sticky bar does not cover them).
     Other page: the default navigation proceeds with the
     exited store already saved. */
  function streamContextClick(ctx, a, ev) {
    var url;
    try { url = new URL(a.getAttribute("href"), location.href); }
    catch (e) { return; }
    if (url.origin !== location.origin) return;
    var store = ctx.store || streamReadStore();
    if (!store || !store.engaged || store.exited) return;
    if (url.pathname === location.pathname) {
      ev.preventDefault();
      streamExit(ctx);
      var id = url.hash ? url.hash.slice(1) : "";
      var target = id ? document.getElementById(id) : null;
      if (target && target.scrollIntoView) {
        try { history.pushState(null, "", url.hash); }
        catch (e) { /* the URL update is cosmetic */ }
        try { target.scrollIntoView({ block: "start" }); }
        catch (e) { /* landing is best-effort */ }
      }
    } else {
      store.exited = true;
      streamSaveStore(store, ctx.page);
      track("Conversation Exited", { page: ctx.page });
    }
  }

  function streamExit(ctx) {
    var store = ctx.store;
    if (store) {
      store.exited = true;
      streamSaveStore(store, ctx.page);
    }
    restoreStreamDom(ctx);
    track("Conversation Exited", { page: ctx.page });
    streamSF().registerControls(streamExitedControlsModel(ctx));
    streamSF().setScope(null);
    /* Suggested-search fix (sheet section 5.1): the arrival
       receipt is no longer registered with the dock on exit
       either — the receipt lives on the opening turn alone. */
  }

  function streamClear(ctx) {
    var store = ctx.store || streamReadStore();
    if (ctx.streamEl) restoreStreamDom(ctx);
    var remainder = {
      v: 1, engaged: false, exited: false,
      seq: store ? store.seq : 1, dropped: 0,
      caps: store ? store.caps
        : { pages: {}, visit: 0,
            fired: { pages: {}, visit: false } },
      engagedFired: store ? !!store.engagedFired : false,
      turns: []
    };
    ctx.store = remainder;
    try {
      sessionStorage.setItem(STREAM_KEY, JSON.stringify(remainder));
    } catch (e) { /* the caps remainder is best-effort */ }
    ctx.pendingRelease = null;
    ctx.segSpec = ctx.kind === "page" ? ctx.arrivalSpec : null;
    ctx.segScope = ctx.kind === "home" ? "released" : "page";
    ctx.segIntent = null;
    ctx.segSig = null;
    ctx.segLastPrompt = null;
    ctx.segContentTurns = 0;
    streamSF().registerControls(null);
    streamSF().setScope(null);
    streamSF().registerStarters(null);
    track("Conversation Cleared", { page: ctx.page });
    maybeStreamDockStarters(ctx);
  }

  /* ---- Boot (sheet section 5) ---- */

  function streamBoot(ctx) {
    var store = streamReadStore();
    ctx.store = store;
    if (store && store.engaged && !store.exited) {
      seedStreamSeg(ctx, store);
      ensureStreamDom(ctx, "typed").then(function (ok) {
        if (!ok) return;
        try {
          if (ctx.openingArticle &&
              ctx.openingArticle.scrollIntoView) {
            ctx.openingArticle.scrollIntoView({ block: "start" });
          }
        } catch (e) { /* landing is best-effort */ }
        maybeStreamStarters(ctx);
      });
      return;
    }
    if (store && store.engaged && store.exited) {
      seedStreamSeg(ctx, store);
      streamSF().registerControls(streamExitedControlsModel(ctx));
      return;
    }
    maybeStreamDockStarters(ctx);
  }

  /* Bfcache (sheet section 5): the document arrives as it was
     left, stream included; the boot does not re-run and does
     not re-append. The controls re-sync from the store. */
  window.addEventListener("pageshow", function (ev) {
    if (!ev.persisted || !streamOn() || !streamCtx) return;
    var store = streamReadStore();
    if (!store) return;
    streamCtx.store = store;
    if (store.engaged && !store.exited && streamCtx.streamEl) {
      streamSF().registerControls(streamControlsModel(streamCtx));
    } else if (store.engaged && store.exited) {
      streamSF().registerControls(
        streamExitedControlsModel(streamCtx));
    }
  });

  /* ---- Starters (sheet section 7) ---- */

  function streamStarterTap(ctx, starter) {
    track("Starter Prompt Tapped", {
      page: ctx.page, starter_id: starter.id
    });
    ctx.triggerNext = "starter";
    var accepted = false;
    try {
      accepted = streamSF().tryUnified(starter.text) === true;
    } catch (e) { accepted = false; }
    if (!accepted && !ctx.inFlight) {
      streamSubmitText(ctx, starter.text);
    }
  }

  function maybeStreamDockStarters(ctx) {
    loadStarters().then(function (m) {
      if (!m || ctx.streamEl) return;
      var st = streamReadStore();
      if (st && st.engaged) return;
      var set = m[ctx.page];
      if (set && set.length) {
        streamSF().registerStarters({
          starters: set,
          onTap: function (s) { streamStarterTap(ctx, s); }
        });
      }
    });
  }

  /* A page reached mid-visit registers its starters with the
     surface, as the arrival page's dock set does, until the
     first submit from that page (E9.3); the registration is
     the page's current set, which the overlay offers while
     the visit stands on this page. Since the suggested-search
     fix (sheet section 5.4) the registration is model-only:
     nothing renders in the opening turn, and retirement is
     the registration's release, on the same triggers as
     before (the page's first submit, restore, clear, exit,
     dismiss). */
  function maybeStreamStarters(ctx) {
    if (!ctx.openingArticle || !ctx.store) return;
    var hasTurns = ctx.store.turns.some(function (p) {
      return p.page === ctx.page && p.kind !== "opening";
    });
    if (hasTurns) return;
    loadStarters().then(function (m) {
      if (!m || !ctx.openingArticle) return;
      var set = m[ctx.page];
      if (!set || !set.length) return;
      streamSF().registerStarters({
        starters: set,
        onTap: function (s) { streamStarterTap(ctx, s); }
      });
    });
  }

  function retireStreamStarters(ctx) {
    streamSF().registerStarters(null);
  }

  /* ---- Turn rendering (sheet sections 3, 9, 10) ---- */

  function streamPromptEl(plan) {
    var d = document.createElement("div");
    d.className = "stream-prompt";
    d.textContent = plan.text;
    return d;
  }

  function streamDialogueEl(plan) {
    var d = document.createElement("div");
    d.className = "stream-response stream-dialogue";
    d.innerHTML = "<p>" + esc(plan.text) + "</p>" +
      (plan.link
        ? '<p class="prompt-actions"><a href="' + esc(plan.link) +
          '">Browse the case studies</a></p>'
        : "");
    return d;
  }

  function streamSpecPayload(ctx, plan) {
    if (plan.scope === "released" || ctx.kind !== "page") {
      return blocksPayload;
    }
    if (!plan.page || plan.page === ctx.page) return ctx.view;
    // A prior page's composition turn re-renders from that
    // page's own slice, the payload its spec validated against.
    var pg = slicePayload && slicePayload.pages &&
      slicePayload.pages[plan.page];
    return pg || blocksPayload;
  }

  /* Stream turn markup (engaged-UI revision, section 5):
     no heading inside a turn — a featured turn reads as a
     written answer built from the record's blocks, and the
     aria-live lead is the first block sentence (section
     5.3). The canvas composition renderers keep their
     heading; this renderer serves stream turns only. */
  function streamResponseHtml(ctx, plan) {
    if (plan.intent && !plan.specNew) {
      var entry = byIntent && byIntent[plan.intent];
      return answerElementHtml(plan.answer) +
        (entry ? entry.html : "") + intentLinksHtml(plan.intent) +
        (plan.pointer
          ? streamPointerCardHtml(plan.pointer, false) : "");
    }
    var html = answerElementHtml(plan.answer);
    if (plan.specNew && plan.spec) {
      html += renderFragmentHtml(plan.spec,
        streamSpecPayload(ctx, plan),
        ctx.kind === "page" ? (plan.page || ctx.page) : undefined);
    }
    if (plan.pointer) {
      html += streamPointerCardHtml(plan.pointer,
        plan.mixture === "pointer");
    }
    return html;
  }

  /* The pointer page card (sheet section 3.4): the covering
     page's title, its orientation line from the published
     payloads, and the open action. No generated summary is
     requested, rendered, or stored. */
  function streamPointerCardHtml(pointer, withBuildHere) {
    return '<div class="cp-pointer stream-pointer-card">' +
      '<p class="stream-pointer-title">' +
      esc(capFirst(pointer.covering_name)) + "</p>" +
      '<p class="stream-pointer-sub" hidden></p>' +
      '<p class="prompt-actions"><a href="' +
      esc(pointer.covering_page) + '">Open it</a>' +
      (withBuildHere
        ? '<button type="button" class="stream-build-here">' +
          "Build it here instead</button>"
        : "") +
      "</p></div>";
  }

  function streamPointerSubstance(pointer) {
    return loadSlice().then(function (slice) {
      var pg = slice && slice.pages &&
        slice.pages[pointer.covering_page];
      if (pg && pg.blocks) {
        var found = null;
        pg.blocks.forEach(function (b) {
          if (b.id === pg.anchor && b.lengths) {
            found = b.lengths.short || null;
          }
        });
        if (found) return found;
      }
      return loadBlocks().then(function (bp) {
        if (bp && bp.page_anchors) {
          var out = null;
          bp.page_anchors.forEach(function (a) {
            if (a.page === pointer.covering_page && a.lengths) {
              out = a.lengths.short || null;
            }
          });
          return out;
        }
        return null;
      });
    }).catch(function () { return null; });
  }

  function fillStreamPointerSubstance(rootEl, plan) {
    if (!plan.pointer) return;
    var sub = rootEl.querySelector(".stream-pointer-sub");
    if (!sub) return;
    streamPointerSubstance(plan.pointer).then(function (text) {
      if (text) {
        sub.textContent = text;
        sub.hidden = false;
      } else if (sub.parentNode) {
        sub.parentNode.removeChild(sub);
      }
    });
  }

  function streamTurnReceiptModel(ctx, plan) {
    var expanded;
    if (plan.mixture === "intent") {
      expanded = "";
    } else {
      var parts = [];
      /* D4 (engaged-UI revision): the account line drops when
         the history clause rides in the same expansion — the
         clause already names the starting point. A fresh
         start carries no history clause, so its account line
         stays. */
      var hasHistoryClause = !plan.freshStart && !!plan.categories;
      if (ctx.kind === "page" && ctx.pageName && !hasHistoryClause) {
        parts.push('<p class="composition-from-intent">' +
          (plan.scope === "released"
            ? "Assembled from the published record, beyond " +
              esc(ctx.pageName) + "."
            : "Assembled from the published record, starting " +
              "from " + esc(ctx.pageName) + ".") + "</p>");
      }
      if (plan.freshStart) {
        parts.push('<p class="composition-from-intent">' +
          FRESH_START_CLAUSE + "</p>");
      } else if (plan.categories) {
        var cl = historyClauseLine(ctx.pageName, plan.categories);
        if (cl) {
          parts.push('<p class="composition-from-intent">' +
            cl + "</p>");
        }
      }
      parts.push('<p class="composition-from-intent ' +
        'prompt-turnline">' + flatReceiptLine(plan) + "</p>");
      expanded = parts.join("");
    }
    return {
      historyLabel: plan.categories
        ? ledgerCategoriesLabel(plan.categories) : null,
      aiFraming: !!(plan.answer && plan.answer.framing),
      expandedHtml: expanded,
      onRestore: null
    };
  }

  function streamResponseEl(ctx, plan) {
    var d = document.createElement("div");
    d.className = "stream-response";
    d.innerHTML = streamResponseHtml(ctx, plan);
    fillStreamPointerSubstance(d, plan);
    var bh = d.querySelector(".stream-build-here");
    if (bh) {
      bh.addEventListener("click", function () {
        streamSubmitText(ctx, plan.prompt, { buildHere: true });
      });
    }
    if (plan.mixture !== "pointer") {
      var rc = document.createElement("div");
      rc.className = "stream-receipt";
      d.appendChild(rc);
      streamSF().setReceiptIn(rc, streamTurnReceiptModel(ctx, plan));
    }
    return d;
  }

  function firstSentenceOf(text) {
    var t = String(text || "").trim();
    var m = /^[^.!?]+[.!?]/.exec(t);
    return m ? m[0] : t;
  }

  /* The composition turn's announce lead (engaged-UI
     revision, section 5.3): the turn's first block
     sentence, from the same payload the turn rendered
     against. Falls back to the intent entry's first
     sentence for intent turns. */
  function streamSpecLead(plan) {
    try {
      var ctx = streamCtx;
      if (ctx && plan.specNew && plan.spec &&
          plan.spec.blocks && plan.spec.blocks.length) {
        var payload = streamSpecPayload(ctx, plan);
        if (payload && payload.blocks) {
          var item = plan.spec.blocks[0];
          var block = null;
          payload.blocks.forEach(function (b) {
            if (b.id === item.id) block = b;
          });
          if (block && block.lengths) {
            var text = block.lengths[item.length] ||
              block.lengths.full || "";
            var lead = firstSentenceOf(
              String(text).split("\n\n")[0]);
            if (lead) return lead;
          }
        }
      }
      if (plan.mixture === "intent" && plan.intent) {
        var entry = byIntent && byIntent[plan.intent];
        if (entry && entry.html) {
          var plain = String(entry.html)
            .replace(/<[^>]*>/g, " ").replace(/\s+/g, " ").trim();
          var s = firstSentenceOf(plain);
          if (s) return s;
        }
      }
    } catch (e) { /* the lead is best-effort */ }
    return null;
  }

  /* Announce arrival plus lead, never the whole turn (sheet
     section 10.1): the framing's first sentence, the
     composition's first block sentence, the card's title,
     or the fixed text's first sentence, once per response
     turn. */
  function streamAnnounce(plan) {
    var lead = null;
    if (plan.kind === "dialogue") {
      lead = firstSentenceOf(plan.text);
    } else if (plan.answer) {
      lead = plan.answer.framing
        ? firstSentenceOf(plan.answer.framing)
        : firstSentenceOf(plan.answer.items[0].claim);
    } else if (plan.specNew || plan.mixture === "intent") {
      lead = streamSpecLead(plan);
    } else if (plan.pointer) {
      lead = capFirst(plan.pointer.covering_name);
    }
    if (lead) streamSF().announce(lead);
  }

  /* D8 (engaged-UI revision, section 5.5): focus no longer
     moves to a new turn. The caret stays in the input; the
     turn scrolls into view and announce() speaks its lead. */
  function streamScrollTurn(el) {
    if (!el) return;
    try {
      if (el.scrollIntoView) {
        el.scrollIntoView({ block: "nearest" });
      }
    } catch (e) { /* scroll is best-effort */ }
  }

  function clearStreamFailure(ctx) {
    if (ctx.failureEls) {
      ctx.failureEls.forEach(function (n) {
        if (n && n.parentNode) n.parentNode.removeChild(n);
      });
      ctx.failureEls = null;
    }
  }

  /* One home for dialogue (engaged-UI revision, section
     5.4): the per-page and visit cap lines render in-stream
     as dialogue turns on the engaged path, stored like a
     refusal — they are part of the conversation's history.
     When no stream stands (a cap met before the stream
     builds), the line renders in the transient dock status
     (suggested-search fix, sheet section 5.2): shown once,
     cleared on the next interaction, never stored. */
  function streamCapDialogue(ctx, text) {
    if (ctx.streamEl && ctx.store) {
      var plan = streamAppendPlan(ctx, ctx.store, {
        kind: "dialogue", page: ctx.page,
        outcome: "cap", text: text, link: null
      });
      var el = streamDialogueEl(plan);
      ctx.streamEl.appendChild(el);
      streamAnnounce(plan);
      streamScrollTurn(el);
    } else {
      streamSF().showTransientStatus(text);
    }
  }

  /* ---- The submit (sheet section 2.4) ---- */

  function streamSubmitText(ctx, text, opts) {
    opts = opts || {};
    if (ctx.inFlight) return;
    var SF = streamSF();
    clearStreamFailure(ctx);
    /* A new submit retires an unanswered release offer, as
       the dock card cleared on the next submit. */
    dropStreamRelease(ctx);
    if (!opts.releaseConfirm) ctx.pendingRelease = null;
    retireStreamStarters(ctx);
    if (!ctx.store) ctx.store = streamReadStore();
    if (!opts.releaseConfirm && !opts.buildHere) {
      if (ctx.segLastPrompt === text &&
          streamTailIsContentFor(ctx)) {
        /* A repeat is a dialogue turn in the stream, like a
           refusal: the prompt renders, then the line. No
           request, no cap spend. (The turns-area rendering
           this replaces was the flat path's behavior; the
           engaged path keeps dialogue in the conversation.) */
        SF.showDialogue("clear");
        if (ctx.streamEl && ctx.store) {
          var rplan = streamAppendPlan(ctx, ctx.store, {
            kind: "prompt", page: ctx.page, text: text
          });
          ctx.streamEl.appendChild(streamPromptEl(rplan));
          var rdplan = streamAppendPlan(ctx, ctx.store, {
            kind: "dialogue", page: ctx.page,
            outcome: "repeat", text: REPEAT_LINE, link: null
          });
          var rdel = streamDialogueEl(rdplan);
          ctx.streamEl.appendChild(rdel);
          streamAnnounce(rdplan);
          streamScrollTurn(rdel);
        } else {
          /* Fix batch (Nov 16, 2026): the repeat line joins
             the failure and cap lines in the transient dock
             status — the last pre-stream showDialogue write,
             re-routed per Douglas's ruling on the
             suggested-search sheet's deviation 3. Shown once,
             cleared on the next interaction, never stored. */
          SF.showTransientStatus(REPEAT_LINE);
        }
        return;
      }
      var caps = ctx.store ? ctx.store.caps
        : { pages: {}, visit: 0 };
      if ((caps.pages[ctx.page] || 0) >= STREAM_PAGE_CAP) {
        streamCapDialogue(ctx, UNIFIED_CAP_LINE);
        return;
      }
      if ((caps.visit || 0) >= STREAM_VISIT_CAP) {
        streamCapDialogue(ctx, VISIT_CAP_LINE);
        return;
      }
    }
    var trigger = ctx.triggerNext || "typed";
    ctx.triggerNext = null;
    var freshStartActive = freshStartFor(text, ctx.page);
    var turnNo = ctx.segContentTurns + 1;
    if (opts.releaseConfirm && opts.turnNo) turnNo = opts.turnNo;
    var requestId = newRequestId();
    var scope = opts.releaseConfirm ? "released"
      : (ctx.segScope || (ctx.kind === "home" ? "released" : "page"));
    if (!opts.releaseConfirm) {
      track("Prompt Submitted", {
        page: ctx.page, turn_number: turnNo, scope: scope,
        path: "surface", request_id: requestId
      });
    }
    SF.showDialogue("clear");
    ctx.inFlight = true;
    var chain = streamChain(ctx, ctx.store);
    var dataPromise = postUnified({
      mode: "unified", text: text, page: ctx.page,
      current_spec: chain.current, prior_specs: chain.priors,
      turn: turnNo, scope: scope,
      release_confirm: !!opts.releaseConfirm,
      build_here: !!opts.buildHere,
      request_id: requestId
    });
    var domPromise = ensureStreamDom(ctx, trigger).then(
      function (ok) {
        if (!ok || !ctx.streamEl) return false;
        var promptPlan = null, promptEl = null;
        if (!opts.buildHere) {
          promptPlan = streamAppendPlan(ctx, ctx.store, {
            kind: "prompt", page: ctx.page, text: text
          });
          promptEl = streamPromptEl(promptPlan);
          ctx.streamEl.appendChild(promptEl);
        }
        var skeletonEl = document.createElement("div");
        skeletonEl.className = "stream-response stream-pending";
        skeletonEl.innerHTML =
          '<p class="composition-from-intent prompt-status">' +
          UNIFIED_PENDING_LINE + "</p>";
        ctx.streamEl.appendChild(skeletonEl);
        ctx.pendingEls = { promptPlan: promptPlan,
                           promptEl: promptEl,
                           skeletonEl: skeletonEl };
        try {
          if (skeletonEl.scrollIntoView) {
            skeletonEl.scrollIntoView({ block: "nearest" });
          }
        } catch (e) { /* scroll is best-effort */ }
        return true;
      });
    function failTransient() {
      /* Suggested-search fix (sheet sections 5.2 and 6): a
         failure before the stream stands renders the line
         in the transient dock status, and the prompt text
         returns to the composer, as Flag B rules. */
      SF.showTransientStatus(UNIFIED_FAILURE_LINE);
      var ein = document.getElementById("explore-q");
      if (ein) ein.value = text;
    }
    Promise.all([domPromise, dataPromise]).then(function (res) {
      ctx.inFlight = false;
      if (!res[0]) {
        failTransient();
        return;
      }
      handleStreamResponse(ctx, res[1], {
        prompt: text, turn: turnNo, requestId: requestId,
        freshStart: freshStartActive,
        releaseConfirm: !!opts.releaseConfirm,
        buildHere: !!opts.buildHere, scope: scope
      });
    }).catch(function () {
      ctx.inFlight = false;
      failTransient();
    });
  }

  function handleStreamResponse(ctx, data, rctx) {
    var SF = streamSF();
    var els = ctx.pendingEls || {};
    ctx.pendingEls = null;
    function dropSkeleton() {
      if (els.skeletonEl && els.skeletonEl.parentNode) {
        els.skeletonEl.parentNode.removeChild(els.skeletonEl);
      }
    }
    /* Flag B (Douglas's ruling, Nov 16, 2026): on an outright
       failure the failure line anchors in-stream under the
       prompt, nothing is stored (not even the prompt turn),
       and the prompt text returns to the composer. The two
       transient nodes clear on the next submit. With no
       prompt element to anchor under (a first submit whose
       stream DOM never built), the line renders in the
       transient dock status instead (suggested-search fix,
       sheet section 5.2). */
    function failFlagB() {
      dropSkeleton();
      if (els.promptPlan && ctx.store) {
        var ix = ctx.store.turns.indexOf(els.promptPlan);
        if (ix >= 0) {
          ctx.store.turns.splice(ix, 1);
          streamSaveStore(ctx.store, ctx.page);
        }
      }
      if (els.promptEl && els.promptEl.parentNode) {
        var f = document.createElement("p");
        f.className = "composition-from-intent prompt-status " +
          "stream-failure";
        f.textContent = UNIFIED_FAILURE_LINE;
        els.promptEl.parentNode.insertBefore(f,
          els.promptEl.nextSibling);
        ctx.failureEls = [els.promptEl, f];
      } else {
        SF.showTransientStatus(UNIFIED_FAILURE_LINE);
      }
      var ein = document.getElementById("explore-q");
      if (ein) ein.value = rctx.prompt;
    }
    rctx.fail = failFlagB;
    if (!data) { failFlagB(); return; }
    if (data.outcome === "disabled") {
      dropSkeleton();
      /* Section 5.4: the disabled line renders in-stream as
         a dialogue turn; the prompt turn stays stored, as
         with a refusal. */
      var displan = streamAppendPlan(ctx, ctx.store, {
        kind: "dialogue", page: ctx.page,
        outcome: "disabled", text: UNIFIED_DISABLED_LINE,
        link: null
      });
      var disel = streamDialogueEl(displan);
      ctx.streamEl.appendChild(disel);
      streamAnnounce(displan);
      streamScrollTurn(disel);
      return;
    }
    if (data.outcome === "refused" || data.outcome === "none") {
      dropSkeleton();
      var dplan = streamAppendPlan(ctx, ctx.store, {
        kind: "dialogue", page: ctx.page,
        outcome: data.outcome,
        text: data.text || UNIFIED_FAILURE_LINE,
        link: data.link || null
      });
      var del = streamDialogueEl(dplan);
      ctx.streamEl.appendChild(del);
      streamAnnounce(dplan);
      streamScrollTurn(del);
      return;
    }
    if (data.outcome === "pointer_only") {
      var p = cleanPointer(data.pointer);
      if (!p) { failFlagB(); return; }
      dropSkeleton();
      var pplan = streamAppendPlan(ctx, ctx.store, {
        kind: "response", page: ctx.page, mixture: "pointer",
        scope: rctx.scope, answer: null, spec: null,
        specNew: false, pointer: p, prompt: rctx.prompt,
        categories: null, freshStart: false
      });
      var pel = streamResponseEl(ctx, pplan);
      ctx.streamEl.appendChild(pel);
      collapseStreamOpeningAfterTurn(ctx);
      track("Prompt Pointer Shown", {
        page: ctx.page, covering_page: p.covering_page,
        placement: "stream", request_id: rctx.requestId
      });
      streamAnnounce(pplan);
      streamScrollTurn(pel);
      return;
    }
    if (data.outcome === "release_offer") {
      dropSkeleton();
      ctx.pendingRelease = { prompt: rctx.prompt, turn: rctx.turn };
      /* D7 (engaged-UI revision, section 5.4): the release
         confirmation renders in-stream, at the position the
         response would have filled. */
      var relEl = streamReleaseEl(ctx);
      ctx.streamEl.appendChild(relEl);
      ctx.releaseEl = relEl;
      streamSF().announce(firstSentenceOf(
        "You\u2019re moving beyond " + ctx.pageName +
        ". Build from the broader record instead?"));
      streamScrollTurn(relEl);
      track("Prompt Release Offered", { page: ctx.page });
      return;
    }
    if (data.outcome === "state") {
      applyStreamState(ctx, data, rctx, els);
      return;
    }
    failFlagB();
  }

  /* The release confirmation (D7, engaged-UI revision,
     section 5.4): a dialogue turn in the stream, rendered
     from the same pending state as the dock card used
     (ctx.pendingRelease) and never stored as a plan — an
     unanswered offer drops with the page's pending state on
     navigation, as the card did. Copy and events are the
     settled ones; the buttons carry the settled ids and are
     wired from the element itself. The fallback keeps the
     dock card (surface's showDialogue "release", wired by
     wireFlatDialogue). */
  function streamReleaseEl(ctx) {
    var d = document.createElement("div");
    d.className = "stream-response stream-dialogue stream-release";
    d.innerHTML = '<div class="prompt-card"><p>You&rsquo;re ' +
      "moving beyond " + esc(ctx.pageName) +
      ". Build from the broader record instead?</p>" +
      '<p class="prompt-actions"><button type="button" ' +
      'id="prompt-release-confirm">Build from the broader ' +
      'record</button><button type="button" ' +
      'id="prompt-release-decline">Stay on this page</button>' +
      "</p></div>";
    var cf = d.querySelector("#prompt-release-confirm");
    if (cf) {
      cf.addEventListener("click", function () {
        track("Prompt Release Confirmed", { page: ctx.page });
        var pr = ctx.pendingRelease;
        ctx.pendingRelease = null;
        dropStreamRelease(ctx);
        if (pr) {
          streamSubmitText(ctx, pr.prompt, {
            releaseConfirm: true, turnNo: pr.turn
          });
        }
      });
    }
    var dc = d.querySelector("#prompt-release-decline");
    if (dc) {
      dc.addEventListener("click", function () {
        track("Prompt Release Declined", { page: ctx.page });
        ctx.pendingRelease = null;
        dropStreamRelease(ctx);
      });
    }
    return d;
  }

  function dropStreamRelease(ctx) {
    if (ctx.releaseEl && ctx.releaseEl.parentNode) {
      ctx.releaseEl.parentNode.removeChild(ctx.releaseEl);
    }
    ctx.releaseEl = null;
  }

  function applyStreamState(ctx, data, rctx, els) {
    var answer = cleanAnswer(data.answer);
    var scope = data.scope === "released" ? "released"
      : (ctx.kind === "home" ? "released"
        : (ctx.segScope || "page"));
    var apply = function () {
      var spec = null, specNew = false, turnCategories = null;
      if (data.spec) {
        var candidate = data.spec;
        if (validateFlatSpec(streamVF(ctx), candidate, scope)) {
          spec = candidate;
          specNew = true;
          try {
            if (window.DCLedger && window.DCLedger.enabled &&
                !rctx.freshStart &&
                typeof window.DCLedger.weightTurn === "function") {
              var weighted = window.DCLedger.weightTurn(spec.blocks);
              if (weighted && weighted.blocks) {
                var wSpec = { blocks: weighted.blocks };
                if (validateFlatSpec(streamVF(ctx), wSpec, scope)) {
                  spec = wSpec;
                  turnCategories = weighted.categories || null;
                }
              }
            }
          } catch (e) { /* the ledger never breaks the page */ }
        }
      }
      var pointer = cleanPointer(data.pointer);
      if (!specNew && !answer && !pointer) {
        rctx.fail();
        return;
      }
      var mixture = answer && specNew ? "mixed"
        : answer ? "answer" : "composition";
      var plan = streamAppendPlan(ctx, ctx.store, {
        kind: "response", page: ctx.page, mixture: mixture,
        scope: specNew ? scope : (ctx.segScope || scope),
        answer: answer,
        spec: specNew ? spec
          : (ctx.segIntent ? null : ctx.segSpec),
        specNew: specNew,
        intent: specNew ? null : (ctx.segIntent || null),
        sig: specNew ? null : (ctx.segSig || null),
        pointer: pointer, prompt: rctx.prompt,
        categories: turnCategories, freshStart: !!rctx.freshStart
      });
      /* Cap accounting (sheet section 8): exactly once per
         content-bearing response, in the task that appends
         its turn plan. */
      var caps = ctx.store.caps;
      caps.pages[ctx.page] = (caps.pages[ctx.page] || 0) + 1;
      caps.visit = (caps.visit || 0) + 1;
      if (caps.pages[ctx.page] >= STREAM_PAGE_CAP &&
          !caps.fired.pages[ctx.page]) {
        caps.fired.pages[ctx.page] = true;
        track("Prompt Cap Reached", { page: ctx.page,
          scope: "page" });
      }
      if (caps.visit >= STREAM_VISIT_CAP && !caps.fired.visit) {
        caps.fired.visit = true;
        track("Prompt Cap Reached", { page: ctx.page,
          scope: "visit" });
      }
      streamSaveStore(ctx.store, ctx.page);
      ctx.segSpec = plan.spec;
      ctx.segScope = plan.scope;
      ctx.segIntent = plan.intent;
      ctx.segSig = plan.sig;
      ctx.segLastPrompt = rctx.prompt;
      ctx.segContentTurns += 1;
      if (els.skeletonEl && els.skeletonEl.parentNode) {
        els.skeletonEl.parentNode.removeChild(els.skeletonEl);
      }
      var el = streamResponseEl(ctx, plan);
      ctx.streamEl.appendChild(el);
      collapseStreamOpeningAfterTurn(ctx);
      updateStreamScope(ctx);
      track("Prompt Turn Rendered", {
        page: ctx.page, turn_number: rctx.turn,
        action: specNew ? "recompose" : "answer",
        block_count: specNew ? spec.blocks.length : 0,
        scope: plan.scope, mixture: mixture,
        request_id: rctx.requestId
      });
      if (pointer) {
        track("Prompt Pointer Shown", {
          page: ctx.page, covering_page: pointer.covering_page,
          placement: "stream", request_id: rctx.requestId
        });
      }
      if (specNew && !rctx.freshStart) {
        ledgerRecordSpec(spec, ctx.page, plan.scope);
      }
      if (answer) ledgerRecordAnswer(answer);
      streamAnnounce(plan);
      streamScrollTurn(el);
    };
    if ((scope === "released" || ctx.kind === "home") &&
        !blocksPayload) {
      loadBlocks().then(apply);
    } else {
      apply();
    }
  }

  /* ---- Home intent turns (sheet section 3.6) ---- */

  function streamIntentTap(ctx, btn) {
    var intent = intentOfButton(btn);
    var label = (btn.textContent || "").trim();
    clearStreamFailure(ctx);
    retireStreamStarters(ctx);
    load().then(function () {
      var entry = byIntent && byIntent[intent];
      if (!entry) return;
      ensureStreamDom(ctx, "intent").then(function (ok) {
        if (!ok || !ctx.streamEl) return;
        streamAppendPlan(ctx, ctx.store, {
          kind: "prompt", page: ctx.page, text: label
        });
        ctx.streamEl.appendChild(streamPromptEl({ text: label }));
        var plan = streamAppendPlan(ctx, ctx.store, {
          kind: "response", page: ctx.page, mixture: "intent",
          scope: "released", answer: null, spec: null,
          specNew: false, intent: intent, sig: entry.sig,
          pointer: null, prompt: label, categories: null,
          freshStart: false
        });
        var el = streamResponseEl(ctx, plan);
        ctx.streamEl.appendChild(el);
        ctx.segIntent = intent;
        ctx.segSig = entry.sig;
        ctx.segSpec = null;
        Array.prototype.forEach.call(
          document.querySelectorAll(".intent-btn"),
          function (b) {
            b.setAttribute("aria-pressed",
              b.getAttribute("data-intent") === "intent_" + intent
                ? "true" : "false");
          });
        try {
          history.replaceState(null, "", "#c=" + entry.sig);
        } catch (e) { /* share state is best-effort */ }
        track("Composition Rendered", { intent: intent });
        ledgerRecordIntent(intent);
        ledgerRecordComposition("/");
        collapseStreamOpeningAfterTurn(ctx);
        streamAnnounce(plan);
        streamScrollTurn(el);
      });
    });
  }

  /* ---- Arrival rendering on the engaged path ---- */

  function streamRenderArrival(el, page, entry, view, spec, source,
                               historyCategories) {
    var ctx = makeStreamCtx({
      kind: "page", page: page, pageName: entry.page_name,
      el: el, entry: entry, view: view
    });
    ctx.arrivalSpec = spec;
    ctx.arrivalSource = source;
    ctx.segSpec = spec;
    streamCtx = ctx;
    registerStreamSubmit(ctx);
    renderStreamArrivalInto(ctx, spec, source, historyCategories);
    streamBoot(ctx);
  }

  /* The arrival composition in default mode (sheet section
     12.2): the starting view renders as today, accounted by
     its receipt alone — no state line, no thread. While the
     stream stands, the receipt attaches to the opening turn. */
  function renderStreamArrivalInto(ctx, spec, source,
                                   historyCategories) {
    var el = ctx.el, entry = ctx.entry, view = ctx.view,
        page = ctx.page;
    pageSurfaceDismissed = false;
    var clause = historyCategories
      ? historyClauseLine(entry.page_name, historyCategories) : "";
    ctx.arrivalCategories = clause ? historyCategories : null;
    lastPageRender = {
      el: el, page: page, entry: entry, view: view, spec: spec,
      source: source, categories: ctx.arrivalCategories
    };
    el.innerHTML = '<h3 class="composition-h">The full picture</h3>' +
      renderFragmentHtml(spec, view, page);
    el.hidden = false;
    el.setAttribute("data-render-key", "page:" + page);
    el.setAttribute("data-render-source", source);
    if (!sameSpec(spec, entry.starting_spec)) {
      try {
        history.replaceState(null, "",
          "#a=" + encodePageCode(page, spec));
      } catch (e) { /* share state is best-effort */ }
    }
    var label = clause
      ? ledgerCategoriesLabel(historyCategories) : null;
    var expanded = '<p class="composition-from-intent">' +
      (clause || ("Assembled from the published record, " +
        "starting from " + esc(entry.page_name) + ".")) + "</p>";
    ctx.arrivalReceiptModel = {
      historyLabel: label || null, aiFraming: false,
      expandedHtml: expanded,
      onRestore: function () { streamDismissArrival(ctx); }
    };
    ctx.arrivalDismissed = false;
    /* Suggested-search fix (sheet section 5.1): pre-engagement
       the arrival receipt is not registered with the dock in
       any state — it attaches to the opening turn at
       engagement (attachStreamArrivalReceipt), and nowhere
       else. The model is still built here for that attach. */
    if (ctx.streamEl && ctx.openingArticle) {
      var rc = ctx.openingArticle.querySelector(
        ".stream-arrival-receipt");
      if (rc) streamSF().setReceiptIn(rc, ctx.arrivalReceiptModel);
    }
    track("Page Composition Rendered", {
      page: page, page_type: entry.type, source: source,
      block_count: spec.blocks.length
    });
    ledgerRecordComposition(page);
  }

  function streamDismissArrival(ctx) {
    var el = ctx.el;
    if (!el || ctx.arrivalDismissed) return;
    ctx.arrivalDismissed = true;
    el.hidden = true;
    el.innerHTML = "";
    el.removeAttribute("data-render-key");
    el.removeAttribute("data-render-source");
    if ((location.hash || "").indexOf("#a=") === 0) {
      try {
        history.replaceState(null, "", location.pathname);
      } catch (e) { /* share state is best-effort */ }
    }
    track("Page Composition Dismissed", {
      page: ctx.page, page_type: ctx.entry.type,
      source: ctx.arrivalSource
    });
    if (ctx.streamEl && ctx.openingArticle) {
      var rc = ctx.openingArticle.querySelector(
        ".stream-arrival-receipt");
      if (rc) streamSF().setReceiptIn(rc, null);
    }
  }

  /* Home's shared-composition arrival in default mode: the
     composition renders plainly in the slot (it is part of the
     canvas the opening turn will adopt). Per the
     suggested-search fix (sheet section 5.1), its receipt
     model is built but not registered with the dock; the
     model's onRestore (streamClearHomeShare) still clears
     the dock receipt, as a clear is not a registration. */
  function streamHomeShare(ctx, sig) {
    load().then(function () {
      var entry = bySig && bySig[sig];
      var el = ctx.el || slot();
      if (!entry) {
        track("Composition Fallback", {});
        return;
      }
      if (!el) return;
      el.innerHTML = '<h3 class="composition-h">The full ' +
        "picture</h3>" + entry.html + intentLinksHtml(entry.intent);
      el.hidden = false;
      el.setAttribute("data-render-key", "intent:" + entry.intent);
      el.setAttribute("data-render-source", "share");
      ctx.arrivalReceiptModel = {
        historyLabel: null, aiFraming: false,
        expandedHtml: "",
        onRestore: function () { streamClearHomeShare(ctx); }
      };
      track("Composition Rendered", { intent: entry.intent });
      ledgerRecordIntent(entry.intent);
      ledgerRecordComposition("/");
    });
  }

  function streamClearHomeShare(ctx) {
    var el = ctx.el || slot();
    if (el) {
      el.hidden = true;
      el.innerHTML = "";
      el.removeAttribute("data-render-key");
      el.removeAttribute("data-render-source");
    }
    ctx.arrivalReceiptModel = null;
    streamSF().setReceipt(null);
    try {
      history.replaceState(null, "", location.pathname);
    } catch (e) { /* share state is best-effort */ }
  }

  function initStreamHome(el) {
    var ctx = makeStreamCtx({ kind: "home", page: "/", el: el });
    streamCtx = ctx;
    registerStreamSubmit(ctx);
    streamBoot(ctx);
    return ctx;
  }

  function initStreamGeneric() {
    var page = window.location.pathname;
    if (page.charAt(page.length - 1) !== "/") page += "/";
    var ctx = makeStreamCtx({
      kind: "generic", page: page, pageName: "this page"
    });
    streamCtx = ctx;
    registerStreamSubmit(ctx);
    streamBoot(ctx);
    return ctx;
  }


  /* ----- Increment 3: clear rebuild -----
     When the ledger is cleared, a view that history shaped is
     rebuilt plain: weights are now empty. Page mode re-renders
     the plain starting spec; session mode rebuilds the start
     chip from the starting spec when that chip is on screen.
     Anything else is a no-op. */
  document.addEventListener("dc:ledger-cleared", function () {
    try {
      if (streamOn() && streamCtx && streamCtx.kind === "page" &&
          streamCtx.arrivalCategories) {
        // Engaged path: the arrival view re-renders plain, in
        // whichever locus holds it (the dock in default mode,
        // the opening turn while the stream stands).
        var sc = streamCtx;
        renderStreamArrivalInto(sc,
          sc.entry.starting_spec || sc.arrivalSpec,
          sc.arrivalSource, null);
        return;
      }
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
