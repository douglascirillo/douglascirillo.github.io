(function() {
"use strict";
var SURFACE_ENABLED = true;
var ENGAGED_ENABLED = true;
var statesModel = null;
var receiptModel = null;
var threadModel = null;
var threadOpen = false;
var startersModel = null;
var controlsModel = null;
var turnSubmitFn = null;
var unifiedSubmitFn = null;
var focusOrigin = null;
var dockEl = null;
function $(id) {
return document.getElementById(id);
}
function esc(s) {
return String(s == null ? "" : s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}
function wireDoor(root) {
if (!root) return;
Array.prototype.forEach.call(root.querySelectorAll(".ledger-open"), function(btn) {
btn.addEventListener("click", function() {
try {
if (window.DCLedger && window.DCLedger.enabled && typeof window.DCLedger.openPanel === "function") {
window.DCLedger.openPanel("receipt");
}
} catch (e) {}
});
});
}
var DOOR_BUTTON = '<button type="button" class="ledger-open cp-door">' + "What this site remembers on this device</button>";
function statesHtml(model, folded) {
var parts = model.states.map(function(st, i) {
if (i === model.current) {
return '<span class="cp-state-current" aria-current="true">' + esc(st.name) + "</span>";
}
return '<button type="button" class="cp-state" data-state="' + i + '">' + esc(st.name) + "</button>";
});
return '<span class="cp-states-label">Viewing:</span> ' + parts.join('<span aria-hidden="true"> · </span>');
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
Array.prototype.forEach.call(root.querySelectorAll(".cp-state"), function(btn) {
btn.addEventListener("click", function() {
if (!statesModel || !statesModel.onActivate) return;
var idx = parseInt(btn.getAttribute("data-state"), 10);
statesModel.onActivate(idx);
});
});
}
function receiptHtml(model, fold) {
var line = "Built from the published record";
if (model.historyLabel) {
line += ", noting " + esc(model.historyLabel) + " you opened here on earlier visits";
}
var collapsed = '<p class="cp-receipt-line">' + line + (model.aiTwin ? '<span aria-hidden="true"> · </span>Answered by his digital twin' : model.aiFraming ? '<span aria-hidden="true"> · </span>Framing written by AI' : "") + (model.historyLabel ? '<span aria-hidden="true"> · </span>' + DOOR_BUTTON : "") + ' <button type="button" class="cp-why" aria-expanded="false">' + "Why this view?</button></p>";
var expanded = '<div class="cp-receipt-full" hidden>' + (model.expandedHtml || "") + (model.historyLabel ? '<p class="ledger-door">' + DOOR_BUTTON + "</p>" : "") + (fold ? '<div class="cp-states-fold" id="cp-states-fold"></div>' + threadFoldHtml() : "") + (model.onRestore ? '<p class="cp-restore"><button type="button" ' + 'class="cp-published">View this page as published</button></p>' : "") + "</div>";
return collapsed + expanded;
}
function wireReceipt(box, model) {
var why = box.querySelector(".cp-why");
var full = box.querySelector(".cp-receipt-full");
if (why && full) {
why.addEventListener("click", function() {
var open = full.hidden;
full.hidden = !open;
why.setAttribute("aria-expanded", open ? "true" : "false");
});
}
var pub = box.querySelector(".cp-published");
if (pub && model.onRestore) {
pub.addEventListener("click", function() {
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
var THREAD_LABEL = "Your prompts this visit";
var THREAD_DROPPED_LINE = "Earlier prompts are not kept.";
function threadListEl(model, fold) {
var ol = document.createElement("ol");
ol.className = "cp-thread-list";
model.entries.forEach(function(entry, i) {
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
return '<div class="cp-thread-fold"><p class="cp-thread-fold-h">' + THREAD_LABEL + '</p><div class="cp-thread-fold-list"></div></div>';
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
toggle.textContent = THREAD_LABEL + " · " + threadModel.entries.length;
toggle.addEventListener("click", function() {
threadOpen = !threadOpen;
renderThread();
});
box.appendChild(toggle);
if (threadOpen) box.appendChild(threadListEl(threadModel, false));
box.hidden = false;
if (band) {
band.classList.toggle("cp-has-fold", !!receiptModel);
}
var foldList = document.querySelector("#cp-receipt .cp-thread-fold-list");
if (!foldList && receiptModel) {
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
Array.prototype.forEach.call(root.querySelectorAll(".cp-thread-entry"), function(btn) {
btn.addEventListener("click", function() {
if (!threadModel || threadModel.inert || !threadModel.onActivate) return;
threadModel.onActivate(parseInt(btn.getAttribute("data-thread"), 10));
});
});
}
function refreshLane() {
var lane = $("cp-lane");
if (lane) lane.hidden = !controlsModel;
}
function renderControls() {
var row = $("cp-controls");
if (!row) return;
if (!controlsModel) {
refreshLane();
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
b.addEventListener("click", function() {
if (controlsModel && controlsModel[key]) controlsModel[key]();
});
return b;
}
if (!controlsModel.exited) {
row.appendChild(btn("Start of this page", "onRestore"));
row.appendChild(btn("Exit to the published page", "onExit"));
}
row.appendChild(btn("Clear the conversation", "onClear"));
refreshLane();
if (document.body) document.body.classList.toggle("cp-engaged", !controlsModel.exited);
refreshBand();
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
var hasTurns = !!(turns && turns.innerHTML && turns.innerHTML.replace(/<[^>]*>/g, "").trim());
var hasThread = !!(threadModel && threadModel.entries.length);
band.hidden = !(statesModel || receiptModel || hasTurns || hasThread);
}
var api = {
active: false,
engaged: false,
registerStarters: function(model) {
startersModel = model || null;
},
currentStarters: function() {
return startersModel;
},
showTransientStatus: function(text) {
var node = $("cp-transient");
if (!node) return;
node.textContent = text || "";
node.hidden = !text;
},
clearTransientStatus: function() {
var node = $("cp-transient");
if (!node) return;
node.textContent = "";
node.hidden = true;
},
registerControls: function(model) {
controlsModel = model || null;
renderControls();
},
announce: announce,
setReceiptIn: renderReceiptInto,
registerStates: function(model) {
statesModel = model || null;
renderStates();
},
clearStates: function() {
statesModel = null;
renderStates();
},
setReceipt: function(model) {
receiptModel = model || null;
renderReceipt();
},
setScope: function(text) {
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
turnsArea: function() {
return $("cp-turns");
},
refreshBand: refreshBand,
registerTurnSubmit: function(fn) {
turnSubmitFn = fn || null;
},
tryTurn: function(text) {
if (!api.active || !turnSubmitFn) return false;
try {
return turnSubmitFn(text) === true;
} catch (e) {
return false;
}
},
registerUnifiedSubmit: function(fn) {
unifiedSubmitFn = fn || null;
},
tryUnified: function(text) {
if (!api.active || !unifiedSubmitFn) return false;
try {
return unifiedSubmitFn(text) === true;
} catch (e) {
return false;
}
},
registerThread: function(model) {
threadModel = model || null;
if (!threadModel) threadOpen = false;
renderThread();
},
showDialogue: function(kind, payload) {
var area = $("cp-turns");
if (!area) return null;
payload = payload || {};
if (kind === "clear") {
area.innerHTML = "";
refreshBand();
return area;
}
if (kind === "status") {
area.innerHTML = '<p class="composition-from-intent ' + 'prompt-status">' + esc(payload.text || "") + "</p>";
} else if (kind === "none") {
var noneHtml;
if (payload.gen && payload.gen.paragraphs) {
noneHtml = payload.gen.paragraphs.map(function(p) {
return '<p class="composition-from-intent ' + 'prompt-status">' + esc(p.text) + "</p>";
}).join("") + '<p class="composition-from-intent ' + 'prompt-status">Answered by Douglas&rsquo;s digital ' + "twin.</p>";
} else {
noneHtml = '<p class="composition-from-intent ' + 'prompt-status">' + esc(payload.text || "") + "</p>";
}
area.innerHTML = noneHtml + (payload.link ? '<p class="prompt-actions"><a href="' + esc(payload.link) + '">Browse the case studies</a></p>' : "");
} else if (kind === "pointer") {
area.innerHTML = '<div class="prompt-card"><p>That&rsquo;s ' + "covered in " + esc(payload.covering_name) + '.</p><p class="prompt-actions">' + '<a href="' + esc(payload.covering_page) + '">Open it</a>' + '<button type="button" id="prompt-build-here">Build it ' + "here instead</button></p></div>";
} else if (kind === "release") {
area.innerHTML = '<div class="prompt-card"><p>You&rsquo;re ' + "moving beyond " + esc(payload.page_name) + ". Build from the broader record instead?</p>" + '<p class="prompt-actions"><button type="button" ' + 'id="prompt-release-confirm">Build from the broader ' + 'record</button><button type="button" ' + 'id="prompt-release-decline">Stay on this page</button>' + "</p></div>";
}
refreshBand();
return area;
},
consumeFocusOrigin: function() {
var o = focusOrigin;
focusOrigin = null;
return o;
},
clearSession: function() {
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
isHuman = !!document.documentElement && document.documentElement.getAttribute("data-botcls") === "human";
} catch (e) {
isHuman = false;
}
if (!isHuman) return;
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
var laneControls = document.createElement("div");
laneControls.className = "cp-controls";
laneControls.id = "cp-controls";
lane.appendChild(laneControls);
inner.appendChild(consent);
inner.appendChild(session);
bar.appendChild(lane);
bar.appendChild(scope);
bar.appendChild(composer);
inner.appendChild(bar);
dock.appendChild(inner);
var transient = document.createElement("div");
transient.className = "cp-transient";
transient.id = "cp-transient";
transient.setAttribute("aria-live", "polite");
transient.hidden = true;
dock.appendChild(transient);
dock.addEventListener("keydown", api.clearTransientStatus, true);
dock.addEventListener("pointerdown", api.clearTransientStatus, true);
document.body.appendChild(dock);
dockEl = dock;
return true;
}
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
try {
doc.style.scrollPaddingBottom = h + "px";
} catch (e) {}
lastReserved = h;
}
function scheduleReservation() {
if (reserveQueued) return;
reserveQueued = true;
var run = function() {
reserveQueued = false;
applyReservation();
};
if (typeof window.requestAnimationFrame === "function") {
window.requestAnimationFrame(run);
} else {
run();
}
}
function positionDock() {
if (!dockEl) return;
var vv = window.visualViewport;
if (!vv) return;
var cap = Math.round(vv.height * .4);
if (cap > 0) {
dockEl.style.setProperty("--cp-dock-cap", cap + "px");
}
var layoutH = window.innerHeight || 0;
var off = Math.max(0, Math.round(layoutH - vv.height - (vv.offsetTop || 0)));
dockEl.style.transform = off > 0 ? "translateY(" + -off + "px)" : "";
}
function setupDockWatch() {
positionDock();
applyReservation();
if (typeof window.ResizeObserver === "function" && dockEl) {
try {
var ro = new window.ResizeObserver(function() {
scheduleReservation();
});
ro.observe(dockEl);
} catch (e) {}
}
window.addEventListener("resize", function() {
positionDock();
scheduleReservation();
});
var vv = window.visualViewport;
if (vv && typeof vv.addEventListener === "function") {
vv.addEventListener("resize", function() {
positionDock();
scheduleReservation();
});
vv.addEventListener("scroll", function() {
positionDock();
});
}
}
function setupSkipLink() {
var first = document.querySelector(".skip-link");
if (!first || !first.parentNode) return;
var a = document.createElement("a");
a.className = "skip-link";
a.href = "#explore-q";
a.textContent = "Skip to the composer";
a.addEventListener("click", function(ev) {
ev.preventDefault();
var input = document.getElementById("explore-q");
if (!input) return;
focusOrigin = "composer";
try {
input.focus({
preventScroll: true
});
} catch (e) {
input.focus();
}
});
first.parentNode.insertBefore(a, first.nextSibling);
}
function setupShortcut() {
document.addEventListener("keydown", function(ev) {
if (ev.key !== "/" || ev.metaKey || ev.ctrlKey || ev.altKey) {
return;
}
if (document.documentElement && document.documentElement.classList.contains("shell-open")) {
return;
}
var t = ev.target;
if (!t) return;
var tag = (t.tagName || "").toLowerCase();
if (tag === "input" || tag === "textarea" || tag === "select" || t.isContentEditable) {
return;
}
var input = document.getElementById("explore-q");
if (!input) return;
ev.preventDefault();
focusOrigin = "composer";
input.focus();
});
}
function setupDrawer() {
var nav = $("shell-nav");
var trigger = $("shell-trigger");
if (!nav || !trigger) return;
var closeBtn = $("shell-close");
var scrim = $("shell-scrim");
var root = document.documentElement;
var open = false;
var collapsed = false;
var wasDesktop = null;
var inerted = [];
var mq = null;
try {
mq = typeof window.matchMedia === "function" ? window.matchMedia("(min-width: 1024px)") : null;
} catch (e) {
mq = null;
}
function desktop() {
return !!(mq && mq.matches);
}
function focusEl(el) {
if (!el) return;
try {
el.focus({
preventScroll: true
});
} catch (e) {
el.focus();
}
}
function setExp(on) {
trigger.setAttribute("aria-expanded", on ? "true" : "false");
}
function setInert(on) {
var i, el;
if (on) {
inerted = [];
if (!document.body) return;
for (i = 0; i < document.body.children.length; i++) {
el = document.body.children[i];
if (el === nav || el === scrim) continue;
if (el.tagName === "SCRIPT" || el.tagName === "STYLE") {
continue;
}
try {
el.inert = true;
} catch (e) {}
try {
el.setAttribute("inert", "");
} catch (e) {}
inerted.push(el);
}
} else {
for (i = 0; i < inerted.length; i++) {
el = inerted[i];
try {
el.inert = false;
} catch (e) {}
try {
el.removeAttribute("inert");
} catch (e) {}
}
inerted = [];
}
}
function readCollapsed() {
try {
return !!(window.localStorage && window.localStorage.getItem("dc_shell_v1") === "collapsed");
} catch (e) {
return false;
}
}
function writeCollapsed(on) {
try {
if (!window.localStorage) return;
if (on) window.localStorage.setItem("dc_shell_v1", "collapsed"); else window.localStorage.removeItem("dc_shell_v1");
} catch (e) {}
}
var lockedY = null;
function lockScroll() {
if (lockedY !== null || !document.body) return;
var y = 0;
try {
y = window.scrollY || window.pageYOffset || 0;
} catch (e) {
y = 0;
}
lockedY = y;
document.body.style.position = "fixed";
document.body.style.top = -y + "px";
document.body.style.left = "0";
document.body.style.right = "0";
}
function unlockScroll() {
if (lockedY === null) return;
var y = lockedY;
lockedY = null;
if (document.body) {
document.body.style.position = "";
document.body.style.top = "";
document.body.style.left = "";
document.body.style.right = "";
}
try {
window.scrollTo(0, y);
} catch (e) {}
}
function openDrawer() {
if (open) return;
open = true;
root.classList.add("shell-open");
setExp(true);
if (scrim) scrim.hidden = false;
setInert(true);
lockScroll();
focusEl(nav.querySelector(".shell-list a"));
}
function closeDrawer(refocus) {
if (!open) return;
open = false;
root.classList.remove("shell-open");
setExp(false);
if (scrim) scrim.hidden = true;
setInert(false);
unlockScroll();
if (refocus) focusEl(trigger);
}
function setCollapsed(on, user) {
if (!desktop() || collapsed === on) return;
var y = 0;
try {
y = window.scrollY || window.pageYOffset || 0;
} catch (e) {
y = 0;
}
collapsed = on;
root.classList.toggle("shell-collapsed", on);
setExp(!on);
if (user) {
writeCollapsed(on);
try {
window.scrollTo(0, Math.max(0, y + (on ? 44 : -44)));
} catch (e) {}
focusEl(on ? trigger : closeBtn);
}
}
function reconcile() {
if (closeBtn) {
closeBtn.setAttribute("aria-label", desktop() ? "Close sidebar" : "Close menu");
}
var desk = desktop();
if (wasDesktop === desk) return;
wasDesktop = desk;
if (desk) {
var wasOpen = open;
if (wasOpen) closeDrawer(false);
collapsed = wasOpen ? false : readCollapsed();
root.classList.toggle("shell-collapsed", collapsed);
setExp(!collapsed);
} else {
collapsed = false;
root.classList.remove("shell-collapsed");
if (!open && document.activeElement && nav.contains(document.activeElement)) {
focusEl(trigger);
}
setExp(open);
}
}
trigger.addEventListener("click", function() {
if (desktop()) {
if (collapsed) setCollapsed(false, true);
} else openDrawer();
});
if (closeBtn) {
closeBtn.addEventListener("click", function() {
if (desktop()) setCollapsed(true, true); else closeDrawer(true);
});
}
if (scrim) {
scrim.addEventListener("click", function() {
closeDrawer(true);
});
}
document.addEventListener("keydown", function(ev) {
if (!open) return;
if (ev.key === "Escape") {
ev.preventDefault();
closeDrawer(true);
return;
}
if (ev.key !== "Tab") return;
var f = Array.prototype.slice.call(nav.querySelectorAll("a[href], button"));
if (!f.length) return;
var active = document.activeElement;
if (ev.shiftKey) {
if (active === f[0] || !nav.contains(active)) {
ev.preventDefault();
f[f.length - 1].focus();
}
} else if (active === f[f.length - 1] || !nav.contains(active)) {
ev.preventDefault();
f[0].focus();
}
});
nav.addEventListener("click", function(ev) {
var t = ev.target;
var a = t && t.closest ? t.closest("a[href]") : null;
if (!a || !nav.contains(a)) return;
var href = a.getAttribute("href") || "";
if (href.charAt(0) === "#") {
var target = document.getElementById(href.slice(1));
closeDrawer(false);
if (target) {
if (!target.hasAttribute("tabindex")) {
target.setAttribute("tabindex", "-1");
}
focusEl(target);
}
} else {
closeDrawer(false);
}
});
setExp(false);
trigger.setAttribute("aria-controls", "shell-nav");
reconcile();
if (mq) {
try {
if (mq.addEventListener) mq.addEventListener("change", reconcile); else if (mq.addListener) mq.addListener(reconcile);
} catch (e) {}
}
root.classList.add("shell-on");
}
try {
if (!buildDock()) return;
setupDockWatch();
setupSkipLink();
setupShortcut();
try {
setupDrawer();
} catch (e) {}
api.active = true;
if (ENGAGED_ENABLED) api.engaged = true;
} catch (e) {
api.active = false;
turnSubmitFn = null;
unifiedSubmitFn = null;
}
})();
