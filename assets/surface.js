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
   captures it. */
(function () {
  "use strict";

  var SURFACE_ENABLED = true;

  var statesModel = null;   // {states:[{name}], current, onActivate}
  var receiptModel = null;  // {historyLabel, aiFraming, expandedHtml, onRestore}
  var turnSubmitFn = null;
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
    refreshBand();
  }

  function refreshBand() {
    var band = $("cp-session");
    if (!band) return;
    var turns = $("cp-turns");
    var hasTurns = !!(turns && turns.innerHTML &&
      turns.innerHTML.replace(/<[^>]*>/g, "").trim());
    band.hidden = !(statesModel || receiptModel || hasTurns);
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
    consumeFocusOrigin: function () {
      var o = focusOrigin;
      focusOrigin = null;
      return o;
    },
    clearSession: function () {
      statesModel = null;
      receiptModel = null;
      turnSubmitFn = null;
      renderStates();
      renderReceipt();
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
  }
})();
