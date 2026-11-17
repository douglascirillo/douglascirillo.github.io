/* The conversation's renderer and session machinery (compose.js).

   What this file is, after the decommission (Nov 16, 2026;
   site-generative/decommission-build-sheet.md): the client half
   of the site's conversation. A page load stands up one context
   for the page — the engaged stream when the surface layer and
   its ENGAGED flag are on, a flat unified session when the
   stream is off — and this file renders that conversation's
   turns: answers from the record, composed views validated
   block by block against the published payloads (blocks.json
   for released scope, the page's slice in
   blocks-case-studies.json for page scope), pointers, and the
   per-turn receipts. The stream follows the visit across pages
   (sessionStorage, dc_stream_v1); a flat session is one page's
   state list (dc.prompt.<page>). Submits go to the Ask
   endpoint's unified mode; the server composes, this file
   validates and renders, in the server's order — no client
   weighting or re-ordering exists anywhere in the file.

   The ledger's one read: on a case study, the history
   categories the ledger reports preload the stream's opening
   state and are named in its opening receipt (section 6.2 of
   the decommission sheet). Nothing else reads the ledger, and
   no page element is shaped by it.

   What is NOT here anymore: the in-page generation layers —
   Phase 3b home compositions and their #c= share codes,
   Increment 0 starting views and their #a= codes, the
   Increment 1 in-page session layer, and the classify
   fall-through event. The pages serve exactly as published;
   composition lives in the conversation alone. The design
   documents that specified those layers stand as their record;
   the decommission sheet is the record of their removal. */
(function () {
  "use strict";

  // The per-page prompt cap for flat unified sessions. (The
  // stream keeps its own page and visit caps in its store.)
  var PROMPT_CAP = 10;

  /* ----- The presenter seam -----
     One presenter is chosen once, here at boot. surface.js loads
     before this file and publishes window.DCSurface with
     active:true only when the control plane is live, so the
     choice is synchronous. With the surface active, the flat
     sessions register states, receipts, and turn dialogue with
     the control plane and the canvas keeps only the composed
     blocks; the stream (streamOn) replaces the flat session
     when engaged mode is on. If a surface call throws,
     trySurface flips the presenter for the rest of the visit
     and the caller re-renders through it: fail-open degrades
     the conversation's furniture, never rearranges a page —
     there is no in-page presentation left to fall back to. */
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

  function track(name, props) {
    try {
      if (window.amplitude && typeof window.amplitude.track === "function") {
        window.amplitude.track(name, props || {});
      }
    } catch (e) { /* measurement never breaks the page */ }
  }

  /* ----- On-device ledger integration -----
     Every DCLedger call is guarded and wrapped: a missing or inert
     ledger changes nothing, and measurement-and-ledger work never
     breaks the page. The calls are the answer recorder and,
     on a case study, the history-categories read that preloads
     the stream's opening state; the fresh-start check is a
     per-turn local at the submit call sites. */
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

  var FRESH_START_CLAUSE =
    "Built without your earlier reading here, as you asked.";

  function historyClauseLine(pageName, categories) {
    var label = ledgerCategoriesLabel(categories);
    if (!label) return "";
    return "Assembled from the published record, starting from " +
      esc(pageName) + ", noting " + esc(label) +
      " you opened here on earlier visits.";
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


  var ASK_ENDPOINT = "https://7i3yr1dzge.execute-api.us-east-1.amazonaws.com/ask";
  var REPEAT_LINE = "That maps to the view already on screen.";

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
        ".cp-answer-twin-tag{font-size:12.5px;color:var(--muted,#777);margin:0 0 10px}" +
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

  /* Twin generation (stage G1): the generated body rides the
     answer as {paragraphs: [{text, cites}]}. Cleaned strictly:
     a malformed body is dropped whole, never partially rendered;
     the verbatim items beneath it are unaffected. */
  function cleanGen(raw) {
    if (!raw || !Array.isArray(raw.paragraphs) ||
        !raw.paragraphs.length) return null;
    var paras = [];
    for (var i = 0; i < raw.paragraphs.length; i++) {
      var p = raw.paragraphs[i];
      if (!p || typeof p.text !== "string" || !p.text) return null;
      paras.push({ text: p.text });
    }
    return { paragraphs: paras };
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
    var gen = cleanGen(raw.gen);
    if (!items.length && !gen) return null;
    return {
      items: items,
      framing: (typeof raw.framing === "string" && raw.framing)
        ? raw.framing : null,
      gen: gen
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
    if (answer.gen) {
      /* Twin generation (stage G1): the conversational answer
         first, the transparency label under it, then the
         verbatim claim lines it cites (there may be none).
         Label copy is the E6 draft, pending the flip batch's
         copy approval. */
      answer.gen.paragraphs.forEach(function (para) {
        html += '<p class="cp-answer-framing">' + esc(para.text) +
          "</p>";
      });
      html += '<p class="cp-answer-twin-tag">Answered by ' +
        "Douglas&rsquo;s digital twin. Career facts are cited " +
        "to the published record; the claims themselves are " +
        "below, word for word.</p>";
    } else if (answer.framing) {
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
          answer.gen ? "answer_gen"
            : (answer.framing ? "answer_prose" : "answer"));
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
                     link: e.link || null,
                     gen: e.gen || null });
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
      states: [{ action: "published", prompt: null, turn: 0,
                  spec: null, answer: null, pointer: null }],
      current: 0, submits: 0, inFlight: false,
      pending: null, dialogue: null, capFired: false
    };
  }

  function flatStateName(F, st, idx) {
    if (idx === 0) return "the published page";
    var pos = 0;
    for (var i = 1; i <= idx; i++) {
      pos += 1;
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
      // States written before the decommission whose actions
      // no longer exist — the "arrival" state (a page assembly
      // adopted as a restorable state) and "intent" states
      // (the removed home panel's compositions) — are dropped
      // at restore, never rendered (DC7).
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
    F.renderedState = st;
    if (st.action === "published") {
      F.renderedState = null;
      el = F.el || slot();
      if (el) {
        el.hidden = true; el.innerHTML = "";
        el.removeAttribute("data-render-key");
        el.removeAttribute("data-render-source");
      }
      SF.setReceipt(null);
      if (F.kind !== "home") SF.setScope(null);
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
        aiTwin: !!(st.answer && st.answer.gen),
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
            // The surface dialogue vocabulary has no "refused"
            // kind; a refusal re-shows as a status line (the
            // same dress its first render wears). Layer-3 fix:
            // the session path mapped this in its own callback;
            // the flat callback carried the outcome kind
            // through unmapped and the re-show rendered
            // nothing.
            F.dialogue = { kind: d.kind === "refused" ? "status"
                             : d.kind,
                           text: d.text, link: d.link };
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
    // fires for unified states. Published-state restores fire
    // nothing (the page-composition events that once measured
    // arrival restores retired with the arrival state in the
    // layer-3 decommission).
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
      /* Stage G1: a generated absence may ride the none outcome;
         the fixed text and link stay in the body as the fallback
         and the thread stores the generated text when it served. */
      var noneGen = cleanGen(data.gen);
      var noneText = noneGen
        ? noneGen.paragraphs.map(function (p) { return p.text; })
            .join("\n\n")
        : data.text;
      flatDialogue(F,
        { kind: "none", text: data.text, link: data.link || null,
          gen: noneGen },
        record ? { prompt: ctx.prompt, outcome: "none",
                   text: noneText, link: data.link || null,
                   gen: noneGen } : null);
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
      if (data.spec) {
        var candidate = data.spec;
        if (validateFlatSpec(F, candidate, scope)) {
          spec = candidate;
          specNew = true;
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
        // unchanged (its spec), never re-weighted at carry time.
        spec: specNew ? spec : st.spec,
        specNew: specNew,
        scope: specNew ? scope : (st.scope || scope),
        prompt: ctx.prompt, turn: ctx.turn,
        answer: answer, pointer: pointer,
        categories: null,
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

  /* A case study's flat session (the ENGAGED-off fallback):
     the page's registration without the arrival state — the
     published page is the only standing state, and unified
     turns validate against the page's slice as before. The
     arrival state the old session adopted is removed with
     the arrival pipeline (decommission sheet section 4.1). */
  function initPageFlat(page, entry, slice) {
    var view = {
      blocks: entry.blocks,
      max_blocks: slice.max_blocks,
      anchor_kinds: slice.anchor_kinds
    };
    var F = makeFlatSession({
      kind: "page", page: page, pageName: entry.page_name,
      entry: entry, view: view
    });
    flatSession = F;
    renderFlat(F);
    loadBlocks().then(function () {
      restoreFlatStore(F);
      renderFlat(F);
    });
    return F;
  }

  /* Boot (decommission sheet sections 4 and 5): no page
     composes itself anymore. What stands on a page load is
     the conversation's context for that page — the stream
     when engaged mode is on, a flat unified session when it
     is off — or, with the surface layer off, nothing at all:
     the layered Ask path serves its answers alone. The slice
     is the registry that tells a case study (a page context
     with a starting spec and a slice to validate against)
     from every other page. */
  function init() {
    var page = window.location.pathname;
    if (page.charAt(page.length - 1) !== "/") page += "/";
    if (!surfaceOn()) return;
    if (page === "/") {
      if (streamOn()) initStreamHome(null);
      else initHomeFlat(null);
      return;
    }
    loadSlice().then(function (slice) {
      var entry = slice && slice.pages ? slice.pages[page]
        : null;
      if (streamOn()) {
        if (entry) initStreamPage();
        else initStreamGeneric();
      } else {
        if (entry) initPageFlat(page, entry, slice);
        else initGenericFlat();
      }
    }).catch(function () {
      if (streamOn()) initStreamGeneric();
      else initGenericFlat();
    });
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
    streamExitedStarters(ctx);
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
      streamExitedStarters(ctx);
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

  /* An exited stand still offers the page's starters
     (fix round, Nov 17, 2026; the sidebar build's gate
     item 9, ruled by Douglas: starters are offered on
     focus when the conversation is exited). An arrival
     whose store stands exited, and an exit in place, both
     leave the visitor standing on the published page with
     the conversation kept but not presented; neither path
     registered a set there — maybeStreamStarters needs
     an opening turn, which the exited state never
     builds, and maybeStreamDockStarters refuses an
     engaged store — so focus opened an empty panel. The
     exited stand registers the page's current set, as
     the not-engaged dock registration does: the arrival
     is the new stand. A submit or a starter tap retires
     the set on the existing triggers and re-enters
     through the submit path (Flag C); the resolution
     re-checks the stand, so a re-entry or a clear that
     lands first is never overridden. */
  function streamExitedStarters(ctx) {
    loadStarters().then(function (m) {
      if (!m || ctx.streamEl) return;
      var st = streamReadStore();
      if (!st || !st.engaged || !st.exited) return;
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
    /* Retirement counts from this arrival's opening turn:
       the starters retire on the first submit from this
       page in this stand on it. Turns from an earlier
       stand on the same page in the same visit do not
       retire them — each return appends a fresh opening
       turn, and the starters belong to it (sidebar build,
       the home-starters fix: the layer-3 gate's item 11
       found a first submit from home suppressed home's
       starters for the rest of the visit). */
    var turns = ctx.store.turns;
    var openIdx = -1;
    for (var i = turns.length - 1; i >= 0; i--) {
      if (turns[i].kind === "opening" &&
          turns[i].page === ctx.page) {
        openIdx = i;
        break;
      }
    }
    var hasTurns = turns.slice(openIdx + 1).some(function (p) {
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
    if (plan.gen) {
      /* Stage G1: the generated absence renders in place of
         the fixed text; the case-studies link still follows. */
      d.innerHTML = plan.gen.paragraphs.map(function (p) {
        return "<p>" + esc(p.text) + "</p>";
      }).join("") +
        '<p class="cp-answer-twin-tag">Answered by ' +
        "Douglas&rsquo;s digital twin.</p>" +
        (plan.link
          ? '<p class="prompt-actions"><a href="' + esc(plan.link) +
            '">Browse the case studies</a></p>'
          : "");
      return d;
    }
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
      // Intent turns were created by the removed home panel;
      // a stored one replays as its answer and links — the
      // composition HTML came from the unpublished compositions
      // file, whose loader is removed with the panel
      // (decommission sheet sections 4.2 and 7).
      return answerElementHtml(plan.answer) +
        intentLinksHtml(plan.intent) +
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
      aiTwin: !!(plan.answer && plan.answer.gen),
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
      lead = plan.gen
        ? firstSentenceOf(plan.gen.paragraphs[0].text)
        : firstSentenceOf(plan.text);
    } else if (plan.answer) {
      lead = plan.answer.gen
        ? firstSentenceOf(plan.answer.gen.paragraphs[0].text)
        : (plan.answer.framing
          ? firstSentenceOf(plan.answer.framing)
          : firstSentenceOf(plan.answer.items[0].claim));
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
        link: data.link || null,
        /* Stage G1: a generated absence rides the none plan;
           the fixed text stays as the stored fallback. */
        gen: data.outcome === "none" ? cleanGen(data.gen) : null
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
      var spec = null, specNew = false;
      if (data.spec) {
        var candidate = data.spec;
        if (validateFlatSpec(streamVF(ctx), candidate, scope)) {
          spec = candidate;
          specNew = true;
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
        categories: null, freshStart: !!rctx.freshStart
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

  /* The stream's opening state on a case study, re-sourced
     (decommission sheet sections 4.1 and 6.2): the page's
     registration and the history categories the ledger
     reports are the whole of it. The entry and its starting
     spec come from the slice, unweighted — no spec is
     weighted, no code is minted, nothing renders into the
     page; the published page is adopted as the opening turn
     exactly as it stands. The opening receipt names the
     history categories when they exist, under the settled
     wording; that receipt is the categories' only reader. */
  function streamSetupPageArrival(ctx, slice) {
    var entry = slice && slice.pages ? slice.pages[ctx.page]
      : null;
    if (!entry) return;
    var view = {
      blocks: entry.blocks,
      max_blocks: slice.max_blocks,
      anchor_kinds: slice.anchor_kinds
    };
    ctx.entry = entry;
    ctx.view = view;
    ctx.pageName = entry.page_name || null;
    var start = entry.starting_spec;
    ctx.arrivalSpec = (start && validateSpec(start, view, ctx.page))
      ? start : null;
    var categories = null;
    try {
      if (window.DCLedger && window.DCLedger.enabled &&
          typeof window.DCLedger.historyCategories === "function") {
        categories = window.DCLedger.historyCategories();
      }
    } catch (e) { categories = null; }
    ctx.arrivalCategories = categories || null;
    var clause = categories
      ? historyClauseLine(ctx.pageName, categories) : null;
    ctx.arrivalReceiptModel = {
      historyLabel: categories
        ? ledgerCategoriesLabel(categories) : null,
      aiFraming: false,
      expandedHtml: clause
        ? '<p class="composition-from-intent">' + clause + "</p>"
        : "",
      onRestore: null
    };
  }

  function initStreamPage() {
    var page = window.location.pathname;
    if (page.charAt(page.length - 1) !== "/") page += "/";
    var ctx = makeStreamCtx({ kind: "page", page: page });
    streamCtx = ctx;
    registerStreamSubmit(ctx);
    var ledgerReady = null;
    try {
      ledgerReady = (window.DCLedger && window.DCLedger.ready)
        ? window.DCLedger.ready() : null;
    } catch (e) { ledgerReady = null; }
    Promise.all([loadSlice(),
      (ledgerReady && typeof ledgerReady.then === "function")
        ? ledgerReady : Promise.resolve()
    ]).then(function (results) {
      try { streamSetupPageArrival(ctx, results[0]); }
      catch (e) { /* the boot proceeds without the preload */ }
      streamBoot(ctx);
    }).catch(function () { streamBoot(ctx); });
    return ctx;
  }

  /* When the ledger is cleared, the opening receipt's history
     clause goes with the history: the model is rebuilt plain
     and re-attached wherever the opening turn stands. Nothing
     else in the conversation reads the ledger. */
  document.addEventListener("dc:ledger-cleared", function () {
    try {
      if (streamOn() && streamCtx && streamCtx.kind === "page" &&
          streamCtx.arrivalCategories) {
        var sc = streamCtx;
        sc.arrivalCategories = null;
        sc.arrivalReceiptModel = {
          historyLabel: null,
          aiFraming: false,
          expandedHtml: "",
          onRestore: null
        };
        attachStreamArrivalReceipt(sc);
      }
    } catch (e) { /* the ledger never breaks the page */ }
  });

  // Exposed for the eval harness: the shipped validator,
  // exercised against the shipped payload by
  // run_specs_stage2.py and validate_spec.js. (The page
  // share-code codec and the turn-kind matcher lost their
  // last callers with the in-page layers and are removed;
  // decommission sheet section 4.4.)
  window.DCCompose = {
    validateSpec: validateSpec
  };

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }
})();
