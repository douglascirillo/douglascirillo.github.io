/* Experience router (Amplitude demos build, Nov 2026).
   Assigns each consented visitor one demonstration experience and
   calls up the matching Amplitude guide on its surface. The guides
   are set to trigger None in the Amplitude builder; this module is
   the only thing that shows them.

   Consent: the router registers with DCAmplitude.whenReady, which
   fires only after the consent gate has released and the Amplitude
   SDK has initialized. Before that moment it stores nothing,
   identifies nothing, and tracks nothing. The one exception is
   hygiene: if the stored consent record says declined, the router's
   own storage is cleared on page load, so a change of mind removes
   the assignment everywhere. A demo link (?experience=<variant>) is
   read into memory at load and honored only after the gate releases;
   without consent a demo link does nothing.

   Demo mode never touches the natural assignment or the experience
   user property. It marks the visitor with separate demo properties
   so demo traffic stays out of the readout, and it resets the guide
   before showing it, so a walkthrough always starts clean.

   Nov 19, 2026 fix: the demo links stopped rendering guides even
   though the assignment fired and the engagement SDK booted (the
   SDK's own triggers, tooltip and survey, kept working). The show
   path is now hardened: the reset is awaited with a cap and lives
   in its own guard, so a reset that throws, rejects, or hangs can
   never eat the show; a failed show retries once; failures warn to
   the console instead of vanishing; and the wait for the
   engagement API runs 15s instead of 4s.

   TEMPORARY PROBE (Nov 19, 2026, later the same day): the hardening
   above did not restore rendering in fresh browsers, while the
   same links rendered in an established one. With ?dcprobe=1 on
   the URL, this file samples the engagement SDK's state twice a
   second for 30s and prints the timeline into a fixed panel, so a
   test browser that cannot open a console can still show exactly
   what the SDK looked like around the show call. The probe is
   inert without the parameter and is removed with the fix it
   informs.

   Nov 19, 2026 boot gate (the fix the probe informed): in a fresh
   browser the router called gs.show() about 1.4s before the
   engagement bundle finished booting, while its
   _analytics.hasBooted flag was still false. The call sat in the
   loader stub's queue; the queue drained as the real bundle took
   over and the show was never replayed: no render, no error, no
   Guide Viewed. Natively triggered guides (tooltip, survey) were
   unaffected because their triggers live downstream of boot. The
   readiness wait now requires the booted flag, not merely a
   callable show, before run() fires. */
(function () {
  var REGISTRY_VERSION = 4;
  var ASSIGN_KEY = "dc_experience_v1";
  var SHOWN_KEY = "dc_experience_shown_v1";
  var DEMO_KEY = "dc_experience_demo_v1";
  var CONSENT_KEY = "dc_ledger_consent_v1";

  var GUIDES = {
    "tour": { key: "guide-start-here-tour", surface: "home" },
    "scorecard-checklist": { key: "guide-scorecard-checklist", surface: "scorecard" },
    "product-tour": { key: "guide-conversation-tour", surface: "home" },
    "sothebys-hotspot": { key: "guide-sotheby-s-results-ho-2e4", surface: "sothebys" },
    "newsletter-banner": { key: "guide-newsletter-banner", surface: "any-except-scorecard" }
  };
  var VARIANTS = ["control", "tour", "scorecard-checklist", "product-tour", "sothebys-hotspot", "newsletter-banner"];

  function surfaceOf(path) {
    if (path === "/" || path === "/index.html") return "home";
    if (path === "/scorecard" || path === "/scorecard/" ||
        path === "/scorecard/index.html") return "scorecard";
    if (path === "/case-studies/sothebys" ||
        path === "/case-studies/sothebys/" ||
        path === "/case-studies/sothebys/index.html") return "sothebys";
    return null;
  }

  function storageGet(store, key) {
    try {
      var raw = store.getItem(key);
      return raw ? JSON.parse(raw) : null;
    } catch (e) { return null; }
  }
  function storageSet(store, key, value) {
    try {
      store.setItem(key, JSON.stringify(value));
      return true;
    } catch (e) { return false; }
  }
  function storageRemove(store, key) {
    try { store.removeItem(key); } catch (e) {}
  }

  /* Hygiene: a stored decline clears the router's storage. Runs at
     load, before anything else, and touches only the router's own
     keys. */
  (function clearOnDecline() {
    var rec = storageGet(window.localStorage, CONSENT_KEY);
    if (rec && rec.state === "declined") {
      storageRemove(window.localStorage, ASSIGN_KEY);
      storageRemove(window.localStorage, SHOWN_KEY);
      storageRemove(window.sessionStorage, DEMO_KEY);
    }
  })();

  /* Demo override: read into memory only. Nothing is written until
     the gate has released and the SDK is ready. */
  var demoParam = null;
  try {
    var params = new URLSearchParams(window.location.search);
    var wanted = params.get("experience");
    if (wanted && VARIANTS.indexOf(wanted) !== -1) demoParam = wanted;
  } catch (e) { demoParam = null; }

  /* Probe machinery (see the header note). probeMark is called
     from warn(), the readiness poll, and showGuide(); every call
     is a no-op unless the probe parameter is present. */
  var PROBE = false;
  try {
    PROBE = new URLSearchParams(window.location.search).get("dcprobe") === "1";
  } catch (e) { PROBE = false; }
  var probeLines = [];
  var probeT0 = Date.now();
  function probeState() {
    var e = window.engagement;
    var q = (e && e._q && typeof e._q.length === "number") ? e._q.length : -1;
    var real = !!(e && e._);
    var booted = !!(e && e._analytics && e._analytics.hasBooted);
    var showFn = (e && e.gs && typeof e.gs.show === "function") ? "fn" : "-";
    var dom = -1;
    try {
      dom = document.querySelectorAll(
        '[class*="amplitude" i],[id*="amplitude" i],' +
        '[class*="engagement" i],[id*="engagement" i],' +
        'iframe[src*="amplitude"]').length;
    } catch (err) {}
    var bt = false;
    try {
      var bodyText = document.body
        ? (document.body.innerText || document.body.textContent || "")
        : "";
      bt = bodyText.indexOf("From the Middle Seat, the newsletter") !== -1;
    } catch (err) {}
    return "q=" + q + " real=" + (real ? 1 : 0) +
           " booted=" + (booted ? 1 : 0) + " gs.show=" + showFn +
           " dom=" + dom + " bannerText=" + (bt ? 1 : 0);
  }
  function probeRender() {
    try {
      var el = document.getElementById("dc-probe");
      if (!el) {
        if (!document.body) return;
        el = document.createElement("pre");
        el.id = "dc-probe";
        el.setAttribute("style",
          "position:fixed;top:0;left:0;z-index:2147483647;" +
          "background:#ffffff;color:#000000;font:11px/1.45 monospace;" +
          "padding:8px;margin:0;max-height:70vh;overflow:auto;" +
          "white-space:pre-wrap;border:2px solid #cc0000;");
        document.body.appendChild(el);
      }
      el.textContent = probeLines.slice(-40).join("\n");
    } catch (err) {}
  }
  function probeMark(label) {
    if (!PROBE) return;
    try {
      probeLines.push(((Date.now() - probeT0) / 1000).toFixed(1) +
                      "s " + label + " | " + probeState());
      probeRender();
    } catch (err) {}
  }
  if (PROBE) {
    probeMark("probe start");
    var probeTicks = 0;
    var probeTimer = window.setInterval(function () {
      probeTicks += 1;
      probeMark("tick");
      if (probeTicks >= 60) window.clearInterval(probeTimer);
    }, 500);
  }

  if (!window.DCAmplitude ||
      typeof window.DCAmplitude.whenReady !== "function") return;

  window.DCAmplitude.whenReady(function () {
    probeMark("whenReady fired");
    /* Wait for the engagement API to exist AND to have booted.
       The loader stub exposes a callable gs.show almost at once,
       but a show issued before the real bundle finishes booting
       (window.engagement._analytics.hasBooted) sits in the stub's
       queue and is silently dropped in the handoff; the probe
       timeline of Nov 19, 2026 showed the show landing ~1.4s
       before boot in fresh browsers. If the API never boots, the
       router does nothing at all, including no assignment, so
       broken sessions never enter the readout. */
    var waited = 0;
    var timer = window.setInterval(function () {
      waited += 250;
      var gs = window.engagement && window.engagement.gs;
      var booted = !!(window.engagement &&
                      window.engagement._analytics &&
                      window.engagement._analytics.hasBooted);
      if (gs && typeof gs.show === "function" && booted) {
        window.clearInterval(timer);
        probeMark("gs booted; run()");
        run(gs);
      } else if (waited >= 15000) {
        window.clearInterval(timer);
        probeMark("gs never booted in 15s");
        warn("engagement API never booted; router stood down" +
             " (gs callable: " + !!(gs && typeof gs.show === "function") +
             ", _analytics: " +
             (window.engagement && window.engagement._analytics
                ? "present" : "absent") + ")");
      }
    }, 250);
  });

  function identify(props) {
    try {
      if (typeof window.amplitude.Identify === "function" &&
          typeof window.amplitude.identify === "function") {
        var id = new window.amplitude.Identify();
        for (var k in props) id.set(k, props[k]);
        window.amplitude.identify(id);
      }
    } catch (e) { /* Identification must never break the page. */ }
  }

  function trackAssigned(experience, source) {
    try {
      window.amplitude.track("Experience Assigned", {
        experience: experience,
        source: source,
        engagement_available: true,
        registry_version: REGISTRY_VERSION
      });
    } catch (e) {}
  }

  /* Failures here warn instead of vanishing: the Nov 19 break stayed
     invisible precisely because every error was swallowed. */
  function warn(msg) {
    probeMark("WARN " + msg);
    try {
      if (window.console && typeof window.console.warn === "function") {
        window.console.warn("[DCRouter] " + msg);
      }
    } catch (e) {}
  }

  /* The show lives in its own guard, apart from the reset: a reset
     that throws synchronously must not skip it. In demo mode the
     reset is awaited before the show, capped at 2s, so a hung reset
     cannot eat the show either. A failed show, thrown or rejected,
     retries once through the same path. */
  function showGuide(gs, guideKey, resetFirst) {
    probeMark("showGuide " + guideKey + " resetFirst=" + resetFirst);
    var show = function () {
      var attempts = 0;
      var attempt = function () {
        attempts += 1;
        probeMark("show attempt " + attempts + " for " + guideKey);
        try {
          var s = gs.show(guideKey);
          if (PROBE && s && typeof s.then === "function") {
            s.then(function () {
              probeMark("show resolved for " + guideKey);
            }, function () {});
          }
          if (s && typeof s.catch === "function") {
            s.catch(function () {
              warn("show rejected for " + guideKey);
              if (attempts < 2) window.setTimeout(attempt, 1000);
            });
          }
        } catch (e) {
          warn("show threw for " + guideKey);
          if (attempts < 2) window.setTimeout(attempt, 1000);
        }
      };
      attempt();
    };
    if (resetFirst && typeof gs.reset === "function") {
      var settled = false;
      var go = function () {
        if (!settled) {
          settled = true;
          probeMark("reset settled for " + guideKey);
          show();
        }
      };
      try {
        var r = gs.reset(guideKey, 0);
        if (r && typeof r.then === "function") {
          r.then(go, function () {
            warn("reset rejected for " + guideKey);
            go();
          });
          window.setTimeout(function () {
            if (!settled) warn("reset still pending after 2s for " + guideKey);
            go();
          }, 2000);
        } else {
          go();
        }
      } catch (e) {
        warn("reset threw for " + guideKey);
        go();
      }
    } else {
      show();
    }
  }

  /* Surface match: most guides live on one named surface; the
     banner variant lives on every page except the scorecard. */
  function onSurface(dg, surface, path) {
    if (!dg) return false;
    if (dg.surface === "any-except-scorecard") {
      return !(path === "/scorecard" || path === "/scorecard/" ||
               path === "/scorecard/index.html");
    }
    return surface === dg.surface;
  }

  function run(gs) {
    var surface = surfaceOf(window.location.pathname);

    /* Demo mode: session-scoped override, separate properties, the
       natural assignment is never read or written. */
    var demo = null;
    if (demoParam) {
      var fresh = true;
      var prior = storageGet(window.sessionStorage, DEMO_KEY);
      if (prior && prior.variant === demoParam && prior.fired) fresh = false;
      storageSet(window.sessionStorage, DEMO_KEY,
                 { variant: demoParam, fired: true });
      demo = demoParam;
      identify({ experience_demo: true, experience_demo_variant: demo });
      if (fresh) trackAssigned(demo, "demo_link");
    } else {
      var sess = storageGet(window.sessionStorage, DEMO_KEY);
      if (sess && VARIANTS.indexOf(sess.variant) !== -1) {
        demo = sess.variant;
        identify({ experience_demo: true, experience_demo_variant: demo });
      }
    }
    if (demo) {
      var dg = GUIDES[demo];
      if (dg && onSurface(dg, surface, window.location.pathname)) showGuide(gs, dg.key, true);
      return;
    }

    /* Natural mode: a stored assignment wins; otherwise draw evenly.
       If the assignment cannot be stored, nothing is assigned, shown,
       or fired, so a storage-less session never re-draws per page. */
    var variant = null;
    var rec = storageGet(window.localStorage, ASSIGN_KEY);
    if (rec && VARIANTS.indexOf(rec.variant) !== -1 &&
        rec.registry_version === REGISTRY_VERSION) {
      variant = rec.variant;
    } else {
      var drawn = VARIANTS[Math.floor(Math.random() * VARIANTS.length)];
      var stored = storageSet(window.localStorage, ASSIGN_KEY, {
        variant: drawn,
        registry_version: REGISTRY_VERSION,
        assigned_at: Date.now()
      });
      if (!stored) return;
      variant = drawn;
      trackAssigned(variant, "draw");
    }
    identify({ experience: variant });

    var guide = GUIDES[variant];
    if (!guide || !onSurface(guide, surface, window.location.pathname)) return;
    var shown = storageGet(window.localStorage, SHOWN_KEY) || {};
    if (shown[guide.key]) return;
    showGuide(gs, guide.key, false);
    shown[guide.key] = Date.now();
    storageSet(window.localStorage, SHOWN_KEY, shown);
  }
})();
