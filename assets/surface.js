/* The control plane (surface build, control-plane batch, Nov 16, 2026;
   docked-composer batch, Nov 16, 2026).
   Design: files/site-generative/surface-not-page-design.md (two-plane
   amendment A1 to A7, unified-response amendment U1 to U8, docked-
   composer amendment D1 to D8) and files/site-generative/
   dock-build-sheet.md (P-1116-26).

   The site splits into a finite control plane (header, footer, the
   composer, the state line, the receipt, the inspect door, the
   consent band) and a canvas (everything between, pure content).
   This module owns the plane: it builds the dock at the end of the
   body and moves the control-plane stack into it (the consent mount,
   the session band, the scope label, the composer mount, in that
   order), reserves the dock's height on the canvas so no content
   ever reads beneath it, and renders the session band (restorable
   states + the collapsed receipt) from models compose.js registers.
   The static mount block stays byte-identical in the header; the
   relocation happens here, synchronously, because this file now
   executes as a classic script ahead of ledger.js and ask.js, so
   the dock stands before either writes into it and before the
   first post-parse paint. The slim sticky composer is retired
   (D8.5): a docked composer never scrolls away.

   Discipline: the module publishes window.DCSurface with
   active:false first and flips it true only after the dock is
   built, so compose.js (deferred, still last) selects its
   presenter once, at boot: LayeredPresenter when this layer is
   off, absent, bot-gated, or failed; SurfacePresenter when
   active. Any throw during init leaves the site exactly as the
   layered build presents it. Bot-classified sessions (the
   data-botcls stamp, the same gate the ledger uses) never enter.
   No logging to the browser console, ever: Session Replay
   captures it.

   Unified response batch (Nov 16, 2026; design amendment U1 to
   U8, build sheet P-1116-21): the plane gains the thread, the
   session's running list of the visitor's own prompts, rendered
   from a model compose.js registers (registerThread), and the
   unified turns-area discipline: dialogue outcomes (refusals,
   no-evidence, pointer-only, release confirmations, status
   lines) render through showDialogue, never as states. The
   unified submit hook (registerUnifiedSubmit / tryUnified)
   mirrors the turn hook exactly: gated on this layer being
   active, fail-open to the layered triage when absent. Thread
   entries are the visitor's own words: they render through
   textContent only, never markup.

   Engaged-mode batch (Nov 16, 2026; amendment E1 to E10,
   build sheet sections 6, 7, 9, 10, 12): behind the
   ENGAGED_ENABLED flag, exposed read-only as
   DCSurface.engaged, the plane gains the stream controls
   row (#cp-controls), the dock starter row (#cp-starters),
   the live region (#cp-live-region) behind announce(), and
   receipt rendering into a supplied container
   (setReceiptIn). With the flag off none of these render
   and every shipped API behaves exactly as shipped.

   Engaged-UI revision batch (Nov 16, 2026;
   engaged-ui-revision-build-sheet.md, decisions D1 to
   D9, ruling F7): the dock gains a fixed context lane
   above the input lane — one slot built at dock
   construction holding two pre-built tenants, the
   starters (#cp-starters) before engagement and the
   session controls (#cp-controls) after, swapped by
   visibility so the lane's height is its tallest
   tenant's height in every state. The reservation
   counts the input lane at its grown maximum, so
   typing never moves the page; the dock cap constrains
   the session band alone. */
(function () {
  "use strict";

  var SURFACE_ENABLED = true;
  var ENGAGED_ENABLED = true;

  var statesModel = null;   // {states:[{name}], current, onActivate}
  var receiptModel = null;  // {historyLabel, aiFraming, expandedHtml, onRestore}
  var threadModel = null;   // {entries:[{label}], dropped, inert, onActivate}
  var threadOpen = false;
  var startersModel = null; // engaged batch: {starters, onTap}
  var controlsModel = null; // engaged batch: {exited, on*}
  var turnSubmitFn = null;
  var unifiedSubmitFn = null;
  var focusOrigin = null;
  var dockEl = null;

  function $(id) { return document.getElementById(id); }

  function esc(s) {
    return String(s == null ? "" : s)
      .replace(/&/g, "&amp;").replace(/</g, "&lt;")
      .replace(/>/g, "&gt;").replace(/"/g, "&quot;");
  }

  function wireDoor(root) {
    if (!root) return;
    Array.prototype.forEach.call(
      root.querySelectorAll(".ledger-open"),
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
  }

  var DOOR_BUTTON =
    '<button type="button" class="ledger-open cp-door">' +
    "What this site remembers on this device</button>";

  function statesHtml(model, folded) {
    var parts = model.states.map(function (st, i) {
      if (i === model.current) {
        return '<span class="cp-state-current" aria-current="true">' +
          esc(st.name) + "</span>";
      }
      return '<button type="button" class="cp-state" data-state="' +
        i + '">' + esc(st.name) + "</button>";
    });
    return '<span class="cp-states-label">Viewing:</span> ' +
      parts.join('<span aria-hidden="true"> \u00B7 </span>');
  }

  function renderStates() {
    var line = $("cp-states");
    var fold = $("cp-states-fold");
    if (line) {
      if (statesModel && statesModel.states.length > 1) {
        line.innerHTML = statesHtml(statesModel, false);
        line.hidden = false;
        wireStates(line);
      } else {
        line.innerHTML = "";
        line.hidden = true;
      }
    }
    if (fold) {
      if (statesModel && statesModel.states.length > 1) {
        fold.innerHTML = statesHtml(statesModel, true);
        wireStates(fold);
      } else {
        fold.innerHTML = "";
      }
    }
    refreshBand();
  }

  function wireStates(root) {
    Array.prototype.forEach.call(
      root.querySelectorAll(".cp-state"),
      function (btn) {
        btn.addEventListener("click", function () {
          if (!statesModel || !statesModel.onActivate) return;
          var idx = parseInt(btn.getAttribute("data-state"), 10);
          statesModel.onActivate(idx);
        });
      });
  }

  /* The receipt's markup and wiring, shared by the dock node
     and a supplied container inside a stream turn
     (renderReceiptInto, sheet section 9). The dock form
     (fold) carries the states and thread folds; a turn's
     receipt carries neither. */
  function receiptHtml(model, fold) {
    var line = "Built from the published record";
    if (model.historyLabel) {
      line += ", weighted by " + esc(model.historyLabel) +
        " you opened here on earlier visits";
    }
    var collapsed = '<p class="cp-receipt-line">' + line +
      (model.aiFraming
        ? '<span aria-hidden="true"> \u00B7 </span>Framing written by AI'
        : "") +
      (model.historyLabel
        ? '<span aria-hidden="true"> \u00B7 </span>' + DOOR_BUTTON
        : "") +
      ' <button type="button" class="cp-why" aria-expanded="false">' +
      "Why this view?</button></p>";
    var expanded = '<div class="cp-receipt-full" hidden>' +
      (model.expandedHtml || "") +
      (model.historyLabel
        ? '<p class="ledger-door">' + DOOR_BUTTON + "</p>" : "") +
      (fold ? '<div class="cp-states-fold" id="cp-states-fold"></div>' +
        threadFoldHtml() : "") +
      (model.onRestore
        ? '<p class="cp-restore"><button type="button" ' +
          'class="cp-published">View this page as published</button></p>'
        : "") +
      "</div>";
    return collapsed + expanded;
  }

  function wireReceipt(box, model) {
    var why = box.querySelector(".cp-why");
    var full = box.querySelector(".cp-receipt-full");
    if (why && full) {
      why.addEventListener("click", function () {
        var open = full.hidden;
        full.hidden = !open;
        why.setAttribute("aria-expanded", open ? "true" : "false");
      });
    }
    var pub = box.querySelector(".cp-published");
    if (pub && model.onRestore) {
      pub.addEventListener("click", function () {
        model.onRestore();
      });
    }
    wireDoor(box);
  }

  function renderReceipt() {
    var box = $("cp-receipt");
    if (!box) return;
    if (!receiptModel) {
      box.innerHTML = "";
      box.hidden = true;
      refreshBand();
      return;
    }
    box.innerHTML = receiptHtml(receiptModel, true);
    box.hidden = false;
    wireReceipt(box, receiptModel);
    renderStates();
    renderThread();
    refreshBand();
  }

  function renderReceiptInto(container, model) {
    if (!container) return;
    if (!model) {
      container.innerHTML = "";
      container.hidden = true;
      return;
    }
    container.innerHTML = receiptHtml(model, false);
    container.hidden = false;
    wireReceipt(container, model);
  }

  /* ---- The thread (unified batch, sheet section 4) ----
     The session's prompts, in order, verbatim. Entries render
     through textContent only: a prompt is the visitor's own
     text and is never markup here. Collapsed, the thread is one
     muted toggle line carrying the label and the count of the
     entries actually rendered; expanded, it lists the entries,
     newest last, and ends with the dropped-entry line when any
     dialogue entry has been dropped. On small screens it folds
     into the expanded receipt (threadFoldHtml, CSS-gated), with
     the same label as the subheading. In the dock the expanded
     list grows upward within the stack's cap and scrolls
     internally past its share (D8.3, D8.7). */
  var THREAD_LABEL = "Your prompts this visit";
  var THREAD_DROPPED_LINE = "Earlier prompts are not kept.";

  function threadListEl(model, fold) {
    var ol = document.createElement("ol");
    ol.className = "cp-thread-list";
    model.entries.forEach(function (entry, i) {
      var li = document.createElement("li");
      var btn = document.createElement("button");
      btn.type = "button";
      btn.className = "cp-thread-entry";
      btn.setAttribute("data-thread", i);
      if (fold) btn.setAttribute("data-thread-fold", "1");
      if (model.inert) btn.setAttribute("aria-disabled", "true");
      btn.textContent = entry.label;
      li.appendChild(btn);
      ol.appendChild(li);
    });
    if (model.dropped) {
      var dli = document.createElement("li");
      dli.className = "cp-thread-dropped";
      dli.textContent = THREAD_DROPPED_LINE;
      ol.appendChild(dli);
    }
    return ol;
  }

  function threadFoldHtml() {
    if (!threadModel || !threadModel.entries.length) return "";
    return '<div class="cp-thread-fold"><p class="cp-thread-fold-h">' +
      THREAD_LABEL + '</p><div class="cp-thread-fold-list"></div></div>';
  }

  function renderThread() {
    var box = $("cp-thread");
    if (!box) return;
    var band = $("cp-session");
    if (!threadModel || !threadModel.entries.length) {
      box.innerHTML = "";
      box.hidden = true;
      if (band) band.classList.remove("cp-has-fold");
      refreshBand();
      return;
    }
    box.innerHTML = "";
    var toggle = document.createElement("button");
    toggle.type = "button";
    toggle.className = "cp-thread-toggle";
    toggle.setAttribute("aria-expanded", threadOpen ? "true" : "false");
    toggle.textContent = THREAD_LABEL + " \u00B7 " +
      threadModel.entries.length;
    toggle.addEventListener("click", function () {
      threadOpen = !threadOpen;
      renderThread();
    });
    box.appendChild(toggle);
    if (threadOpen) box.appendChild(threadListEl(threadModel, false));
    box.hidden = false;
    // The receipt fold mirrors the list whenever a receipt is up.
    if (band) {
      band.classList.toggle("cp-has-fold", !!receiptModel);
    }
    var foldList = document.querySelector(
      "#cp-receipt .cp-thread-fold-list");
    if (!foldList && receiptModel) {
      // The receipt was rendered before the thread had entries:
      // rebuild it so the fold exists, then render again into it.
      renderReceipt();
      return;
    }
    if (foldList) {
      foldList.innerHTML = "";
      foldList.appendChild(threadListEl(threadModel, true));
    }
    wireThreadEntries($("cp-session"));
    refreshBand();
  }

  function wireThreadEntries(root) {
    if (!root || !threadModel) return;
    Array.prototype.forEach.call(
      root.querySelectorAll(".cp-thread-entry"),
      function (btn) {
        btn.addEventListener("click", function () {
          if (!threadModel || threadModel.inert ||
              !threadModel.onActivate) return;
          threadModel.onActivate(
            parseInt(btn.getAttribute("data-thread"), 10));
        });
      });
  }

  /* ---- Engaged-mode plane furniture (sheet sections 6, 7,
     10; context lane per the engaged-UI revision, section
     3.1) ---- The lane's two tenant containers are built
     once at dock construction (buildDock); the renders below
     write into them and toggle visibility, never rebuild or
     re-insert them. The tenants never coexist: turning one
     on turns the other off. A tenant that is off keeps its
     nodes and loses only visibility, so the lane's height
     is its tallest tenant's height in every state and the
     swap moves nothing. The lane itself hides only when
     neither tenant is on. The controls' labels are the
     approved strings. While exited the controls carry
     Clear alone: Exit hides itself (section 6), and Restore
     hides too — re-entry happens through the next submit
     (flagged item C, ruled Nov 16, 2026). */
  function setLaneTenant(id, on) {
    var t = $(id);
    if (!t) return;
    t.classList.toggle("cp-lane-on", !!on);
    if (on) {
      var other = $(id === "cp-starters" ? "cp-controls" :
                    "cp-starters");
      if (other) other.classList.remove("cp-lane-on");
    }
    var lane = $("cp-lane");
    if (lane) {
      var s = $("cp-starters"), c = $("cp-controls");
      lane.hidden = !((s && s.classList.contains("cp-lane-on")) ||
                      (c && c.classList.contains("cp-lane-on")));
    }
  }

  function renderControls() {
    var row = $("cp-controls");
    if (!row) return;
    if (!controlsModel) {
      setLaneTenant("cp-controls", false);
      if (document.body) document.body.classList.remove("cp-engaged");
      refreshBand();
      return;
    }
    row.innerHTML = "";
    function btn(label, key) {
      var b = document.createElement("button");
      b.type = "button";
      b.className = "cp-control";
      b.textContent = label;
      b.addEventListener("click", function () {
        if (controlsModel && controlsModel[key]) controlsModel[key]();
      });
      return b;
    }
    if (!controlsModel.exited) {
      row.appendChild(btn("Start of this page", "onRestore"));
      row.appendChild(btn("Exit to the published page", "onExit"));
    }
    row.appendChild(btn("Clear the conversation", "onClear"));
    setLaneTenant("cp-controls", true);
    if (document.body) document.body.classList.toggle("cp-engaged", !controlsModel.exited);
    refreshBand();
  }

  function renderStarters() {
    var row = $("cp-starters");
    if (!row) return;
    if (!startersModel || !startersModel.starters ||
        !startersModel.starters.length) {
      setLaneTenant("cp-starters", false);
      return;
    }
    row.innerHTML = "";
    startersModel.starters.forEach(function (s) {
      var b = document.createElement("button");
      b.type = "button";
      b.className = "cp-starter";
      b.textContent = s.text;
      b.addEventListener("click", function () {
        if (startersModel && startersModel.onTap) startersModel.onTap(s);
      });
      row.appendChild(b);
    });
    setLaneTenant("cp-starters", true);
  }

  function announce(text) {
    if (!text) return;
    var el = $("cp-live-region");
    if (!el) {
      el = document.createElement("div");
      el.id = "cp-live-region";
      el.className = "cp-live-region";
      el.setAttribute("aria-live", "polite");
      (dockEl || document.body).appendChild(el);
    }
    el.textContent = text;
  }

  function refreshBand() {
    var band = $("cp-session");
    if (!band) return;
    var turns = $("cp-turns");
    var hasTurns = !!(turns && turns.innerHTML &&
      turns.innerHTML.replace(/<[^>]*>/g, "").trim());
    var hasThread = !!(threadModel && threadModel.entries.length);
    /* Engaged-UI revision: the controls live in the context
       lane now, not the band; they are no longer a reason to
       show the session band. */
    band.hidden = !(statesModel || receiptModel || hasTurns ||
      hasThread);
  }

  var api = {
    active: false,
    engaged: false,
    registerStarters: function (model) {
      startersModel = model || null; renderStarters();
    },
    registerControls: function (model) {
      controlsModel = model || null; renderControls();
    },
    announce: announce,
    setReceiptIn: renderReceiptInto,
    registerStates: function (model) {
      statesModel = model || null;
      renderStates();
    },
    clearStates: function () {
      statesModel = null;
      renderStates();
    },
    setReceipt: function (model) {
      receiptModel = model || null;
      renderReceipt();
    },
    setScope: function (text) {
      var el = $("cp-scope");
      if (!el) return;
      if (text) {
        el.textContent = text;
        el.hidden = false;
      } else {
        el.textContent = "";
        el.hidden = true;
      }
    },
    turnsArea: function () { return $("cp-turns"); },
    refreshBand: refreshBand,
    registerTurnSubmit: function (fn) { turnSubmitFn = fn || null; },
    tryTurn: function (text) {
      if (!api.active || !turnSubmitFn) return false;
      try { return turnSubmitFn(text) === true; }
      catch (e) { return false; }
    },
    registerUnifiedSubmit: function (fn) {
      unifiedSubmitFn = fn || null;
    },
    tryUnified: function (text) {
      if (!api.active || !unifiedSubmitFn) return false;
      try { return unifiedSubmitFn(text) === true; }
      catch (e) { return false; }
    },
    registerThread: function (model) {
      threadModel = model || null;
      if (!threadModel) threadOpen = false;
      renderThread();
    },
    /* The unified turns-area discipline (sheet section 6):
       dialogue renders here, in the plane, and never as a state.
       Kinds: "status" (a plain line: pending, refusal, failure,
       disabled, cap), "none" (the no-evidence text plus its
       link), "pointer" (the settled pointer card), "release"
       (the settled release confirmation), "clear". Buttons carry
       the settled ids; compose.js wires them. A terminal outcome
       leaves the canvas, the state line, and the receipt exactly
       as they were; the area clears on the next submit. */
    showDialogue: function (kind, payload) {
      var area = $("cp-turns");
      if (!area) return null;
      payload = payload || {};
      if (kind === "clear") {
        area.innerHTML = "";
        refreshBand();
        return area;
      }
      if (kind === "status") {
        area.innerHTML = '<p class="composition-from-intent ' +
          'prompt-status">' + esc(payload.text || "") + "</p>";
      } else if (kind === "none") {
        area.innerHTML = '<p class="composition-from-intent ' +
          'prompt-status">' + esc(payload.text || "") + "</p>" +
          (payload.link
            ? '<p class="prompt-actions"><a href="' +
              esc(payload.link) + '">Browse the case studies</a></p>'
            : "");
      } else if (kind === "pointer") {
        area.innerHTML = '<div class="prompt-card"><p>That&rsquo;s ' +
          "covered in " + esc(payload.covering_name) +
          '.</p><p class="prompt-actions">' +
          '<a href="' + esc(payload.covering_page) + '">Open it</a>' +
          '<button type="button" id="prompt-build-here">Build it ' +
          "here instead</button></p></div>";
      } else if (kind === "release") {
        area.innerHTML = '<div class="prompt-card"><p>You&rsquo;re ' +
          "moving beyond " + esc(payload.page_name) +
          ". Build from the broader record instead?</p>" +
          '<p class="prompt-actions"><button type="button" ' +
          'id="prompt-release-confirm">Build from the broader ' +
          'record</button><button type="button" ' +
          'id="prompt-release-decline">Stay on this page</button>' +
          "</p></div>";
      }
      refreshBand();
      return area;
    },
    consumeFocusOrigin: function () {
      var o = focusOrigin;
      focusOrigin = null;
      return o;
    },
    clearSession: function () {
      statesModel = null;
      receiptModel = null;
      threadModel = null;
      threadOpen = false;
      startersModel = null;
      controlsModel = null;
      turnSubmitFn = null;
      unifiedSubmitFn = null;
      renderStates();
      renderReceipt();
      renderThread();
      renderStarters();
      renderControls();
      var turns = $("cp-turns");
      if (turns) turns.innerHTML = "";
      api.setScope(null);
      refreshBand();
    }
  };
  window.DCSurface = api;

  if (!SURFACE_ENABLED) return;

  var isHuman = false;
  try {
    isHuman = !!document.documentElement &&
      document.documentElement.getAttribute("data-botcls") === "human";
  } catch (e) { isHuman = false; }
  if (!isHuman) return;

  /* ---- The dock (docked-composer batch, sheet sections 3-7;
     context lane per the engaged-UI revision, section 3.1) ----
     The static mounts stay in the header, byte-identical; this
     builds one dock element at the end of the body and moves the
     four mount children into it, in one synchronous task, so no
     intermediate state is paintable: the consent mount and the
     session band into the inner stack; into the bar, the context
     lane first (built here, with its two tenant containers),
     then the scope label and the composer mount, the scope label
     above the composer (D8.6). If any mount is missing the
     document is left untouched and the layer stays off. */
  function buildDock() {
    var consent = $("cp-consent");
    var session = $("cp-session");
    var scope = $("cp-scope");
    var composer = $("cp-composer");
    if (!consent || !session || !scope || !composer) return false;
    if (!document.body) return false;
    var dock = document.createElement("div");
    dock.className = "cp-dock";
    dock.id = "cp-dock";
    dock.setAttribute("role", "region");
    dock.setAttribute("aria-label", "Ask this site");
    var inner = document.createElement("div");
    inner.className = "cp-dock-inner";
    var bar = document.createElement("div");
    bar.className = "cp-dock-bar";
    var lane = document.createElement("div");
    lane.className = "cp-lane";
    lane.id = "cp-lane";
    lane.hidden = true;
    var laneStarters = document.createElement("div");
    laneStarters.className = "cp-starters";
    laneStarters.id = "cp-starters";
    var laneControls = document.createElement("div");
    laneControls.className = "cp-controls";
    laneControls.id = "cp-controls";
    lane.appendChild(laneStarters);
    lane.appendChild(laneControls);
    inner.appendChild(consent);
    inner.appendChild(session);
    bar.appendChild(lane);
    bar.appendChild(scope);
    bar.appendChild(composer);
    inner.appendChild(bar);
    dock.appendChild(inner);
    document.body.appendChild(dock);
    dockEl = dock;
    return true;
  }

  /* ---- Canvas reservation (sheet section 6; re-scoped by
     the engaged-UI revision, sections 3.2 and 3.4) ----
     The dock reserves its own height: body padding-bottom and
     the document's scroll-padding-bottom track the dock's
     measured height, so the footer's last line scrolls fully
     into view above the dock and anchors land clear of it. The
     input lane is reserved at its maximum in every computation
     (F7): ask.js publishes the textarea's grown maximum on the
     element (_qMaxH), and the reservation counts the lane at
     that height whether or not the current text fills it, so
     typing changes only the input's own height, inside the
     reservation, and never moves the page. There is no
     compensating scroll adjustment: the reserved total is
     invariant across focus, typing, and the lane swap. One
     ResizeObserver on the dock, animation-frame-debounced,
     writing only on a change of at least 1px; the CP CSS sets
     overflow-anchor: none on the document element. */
  var lastReserved = -1;
  var reserveQueued = false;

  function applyReservation() {
    if (!dockEl || !document.body) return;
    var h = dockEl.offsetHeight || 0;
    var ein = $("explore-q");
    if (ein && ein._qMaxH) {
      var cur = ein.offsetHeight || 0;
      if (ein._qMaxH > cur) h += ein._qMaxH - cur;
    }
    if (lastReserved >= 0 && Math.abs(h - lastReserved) < 1) return;
    var doc = document.documentElement;
    document.body.style.paddingBottom = h + "px";
    try { doc.style.scrollPaddingBottom = h + "px"; } catch (e) {}
    lastReserved = h;
  }

  function scheduleReservation() {
    if (reserveQueued) return;
    reserveQueued = true;
    var run = function () {
      reserveQueued = false;
      applyReservation();
    };
    if (typeof window.requestAnimationFrame === "function") {
      window.requestAnimationFrame(run);
    } else {
      run();
    }
  }

  /* The dock's position is held against the visual viewport
     (sheet sections 4 and 6; engaged-UI revision section 3.4):
     position only — the dock sits above the keyboard, as
     today — and the cap property (40 percent of
     visualViewport.height, refreshed on its resize) now
     constrains the session band alone (CP CSS), never the
     bar's internal layout, which is identical at every
     viewport size and keyboard state. When the visual
     viewport diverges from the layout viewport (an open
     mobile keyboard, iOS Safari's toolbars) the dock is
     offset by the divergence so it tracks what the visitor
     actually sees. interactive-widget is not relied on.
     Where visualViewport is unavailable, the CSS 40dvh
     fallback stands alone. */
  function positionDock() {
    if (!dockEl) return;
    var vv = window.visualViewport;
    if (!vv) return;
    var cap = Math.round(vv.height * 0.4);
    if (cap > 0) {
      dockEl.style.setProperty("--cp-dock-cap", cap + "px");
    }
    var layoutH = window.innerHeight || 0;
    var off = Math.max(0, Math.round(
      layoutH - vv.height - (vv.offsetTop || 0)));
    dockEl.style.transform =
      off > 0 ? "translateY(" + (-off) + "px)" : "";
  }

  function setupDockWatch() {
    positionDock();
    applyReservation();
    if (typeof window.ResizeObserver === "function" && dockEl) {
      try {
        var ro = new window.ResizeObserver(function () {
          scheduleReservation();
        });
        ro.observe(dockEl);
      } catch (e) { /* the resize listener below still tracks */ }
    }
    window.addEventListener("resize", function () {
      positionDock();
      scheduleReservation();
    });
    var vv = window.visualViewport;
    if (vv && typeof vv.addEventListener === "function") {
      vv.addEventListener("resize", function () {
        positionDock();
        scheduleReservation();
      });
      vv.addEventListener("scroll", function () {
        positionDock();
      });
    }
  }

  /* ---- Skip link (sheet section 7) ----
     Injected on activation only, directly after the shipped
     "Skip to content" link, styled by its rules. Its target is
     resolved at click time: ask.js has not run when this file
     executes, so the composer is looked up when it is needed. */
  function setupSkipLink() {
    var first = document.querySelector(".skip-link");
    if (!first || !first.parentNode) return;
    var a = document.createElement("a");
    a.className = "skip-link";
    a.href = "#explore-q";
    a.textContent = "Skip to the composer";
    a.addEventListener("click", function (ev) {
      ev.preventDefault();
      var input = document.getElementById("explore-q");
      if (!input) return;
      focusOrigin = "composer";
      try { input.focus({ preventScroll: true }); }
      catch (e) { input.focus(); }
    });
    first.parentNode.insertBefore(a, first.nextSibling);
  }

  function setupShortcut() {
    document.addEventListener("keydown", function (ev) {
      if (ev.key !== "/" || ev.metaKey || ev.ctrlKey || ev.altKey) {
        return;
      }
      var t = ev.target;
      if (!t) return;
      var tag = (t.tagName || "").toLowerCase();
      if (tag === "input" || tag === "textarea" || tag === "select" ||
          t.isContentEditable) {
        return;
      }
      var input = document.getElementById("explore-q");
      if (!input) return;
      ev.preventDefault();
      focusOrigin = "composer";
      input.focus();
    });
  }

  try {
    if (!buildDock()) return;
    setupDockWatch();
    setupSkipLink();
    setupShortcut();
    api.active = true;
    if (ENGAGED_ENABLED) api.engaged = true;
  } catch (e) {
    // Fail open: the layered presentation stands, untouched.
    api.active = false;
    turnSubmitFn = null;
    unifiedSubmitFn = null;
  }
})();
