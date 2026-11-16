/* The control plane (surface build, control-plane batch, Nov 16, 2026).
   Design: files/site-generative/surface-not-page-design.md (two-plane
   amendment A1 to A7) and files/site-generative/surface-build-sheet.md.

   The site splits into a finite control plane (header, footer, the
   composer, the state line, the receipt, the inspect door, the
   consent band) and a canvas (everything between, pure content).
   This module owns the plane's post-paint behavior: it relocates
   the ask.js record bar into the header's composer mount, renders
   the session band (restorable states + the collapsed receipt)
   from models compose.js registers, hosts the sticky slim
   composer (A7.1), and routes composer submits to a registered
   session turn (build sheet section 3).

   Discipline: the module publishes window.DCSurface with
   active:false first and flips it true only after relocation
   succeeds, so compose.js (loaded after this file) selects its
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
   textContent only, never markup. */
(function () {
  "use strict";

  var SURFACE_ENABLED = true;

  var statesModel = null;   // {states:[{name}], current, onActivate}
  var receiptModel = null;  // {historyLabel, aiFraming, expandedHtml, onRestore}
  var threadModel = null;   // {entries:[{label}], dropped, inert, onActivate}
  var threadOpen = false;
  var turnSubmitFn = null;
  var unifiedSubmitFn = null;
  var focusOrigin = null;
  var relocated = false;

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

  function renderReceipt() {
    var box = $("cp-receipt");
    if (!box) return;
    if (!receiptModel) {
      box.innerHTML = "";
      box.hidden = true;
      refreshBand();
      return;
    }
    var line = "Built from the published record";
    if (receiptModel.historyLabel) {
      line += ", weighted by " + esc(receiptModel.historyLabel) +
        " you opened here on earlier visits";
    }
    var collapsed = '<p class="cp-receipt-line">' + line +
      (receiptModel.aiFraming
        ? '<span aria-hidden="true"> \u00B7 </span>Framing written by AI'
        : "") +
      (receiptModel.historyLabel
        ? '<span aria-hidden="true"> \u00B7 </span>' + DOOR_BUTTON
        : "") +
      ' <button type="button" class="cp-why" aria-expanded="false">' +
      "Why this view?</button></p>";
    var expanded = '<div class="cp-receipt-full" hidden>' +
      (receiptModel.expandedHtml || "") +
      (receiptModel.historyLabel
        ? '<p class="ledger-door">' + DOOR_BUTTON + "</p>" : "") +
      '<div class="cp-states-fold" id="cp-states-fold"></div>' +
      threadFoldHtml() +
      (receiptModel.onRestore
        ? '<p class="cp-restore"><button type="button" ' +
          'class="cp-published">View this page as published</button></p>'
        : "") +
      "</div>";
    box.innerHTML = collapsed + expanded;
    box.hidden = false;
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
    if (pub && receiptModel.onRestore) {
      pub.addEventListener("click", function () {
        receiptModel.onRestore();
      });
    }
    wireDoor(box);
    renderStates();
    renderThread();
    refreshBand();
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
     the same label as the subheading. */
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

  function refreshBand() {
    var band = $("cp-session");
    if (!band) return;
    var turns = $("cp-turns");
    var hasTurns = !!(turns && turns.innerHTML &&
      turns.innerHTML.replace(/<[^>]*>/g, "").trim());
    var hasThread = !!(threadModel && threadModel.entries.length);
    band.hidden = !(statesModel || receiptModel || hasTurns ||
      hasThread);
  }

  var api = {
    active: false,
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
      turnSubmitFn = null;
      unifiedSubmitFn = null;
      renderStates();
      renderReceipt();
      renderThread();
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

  function relocateBar() {
    var mount = $("cp-composer");
    var bar = document.querySelector(".explore");
    if (!mount || !bar) return false;
    if (bar.parentNode === mount) { relocated = true; return true; }
    // Focus guard (P-1116-19, E7): if the visitor is already in
    // the input, carry focus and selection across the move.
    // Reserve the composer's resting height in the same task as
    // the move, so there is no intermediate paint and no shift;
    // the class is only ever added by this layer, so with the
    // layer off the mount stays at zero height (P-1116-19, E6/E7).
    mount.classList.add("cp-live");
    var input = bar.querySelector("#explore-q");
    var hadFocus = !!(input && document.activeElement === input);
    var selStart = null, selEnd = null;
    if (hadFocus) {
      try {
        selStart = input.selectionStart;
        selEnd = input.selectionEnd;
      } catch (e) { /* selection unreadable: focus still restored */ }
    }
    mount.appendChild(bar);
    relocated = true;
    if (hadFocus && input) {
      try {
        input.focus({ preventScroll: true });
        if (selStart !== null && input.setSelectionRange) {
          input.setSelectionRange(selStart, selEnd);
        }
      } catch (e) { /* focus restoration is best-effort */ }
    }
    return true;
  }

  function setupSlim() {
    var mount = $("cp-composer");
    var input = document.getElementById("explore-q");
    if (!mount || !input) return;
    var slim = document.createElement("div");
    slim.className = "cp-slim";
    slim.hidden = true;
    var btn = document.createElement("button");
    btn.type = "button";
    btn.className = "cp-slim-btn";
    slim.appendChild(btn);
    document.body.appendChild(slim);
    function syncLabel() {
      // The label tracks the input's current placeholder, and the
      // accessible name with it (P-1116-19, E13).
      var label = input.getAttribute("placeholder") ||
        "Search the record, or ask it a question.";
      btn.textContent = label;
      btn.setAttribute("aria-label",
        "Go to the composer: " + label);
    }
    syncLabel();
    btn.addEventListener("click", function () {
      focusOrigin = "slim";
      mount.scrollIntoView({ block: "start" });
      try { input.focus({ preventScroll: true }); }
      catch (e) { input.focus(); }
    });
    if ("IntersectionObserver" in window) {
      var io = new IntersectionObserver(function (entries) {
        entries.forEach(function (en) {
          var past = !en.isIntersecting &&
            en.boundingClientRect.top < 0;
          if (past) syncLabel();
          slim.hidden = !past;
        });
      }, { threshold: 0 });
      io.observe(mount);
    }
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
    if (!relocateBar()) return;
    setupSlim();
    setupShortcut();
    api.active = true;
  } catch (e) {
    // Fail open: the layered presentation stands, untouched.
    api.active = false;
    turnSubmitFn = null;
    unifiedSubmitFn = null;
  }
})();
