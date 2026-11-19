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
   before showing it, so a walkthrough always starts clean. */
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

  if (!window.DCAmplitude ||
      typeof window.DCAmplitude.whenReady !== "function") return;

  window.DCAmplitude.whenReady(function () {
    /* Wait for the engagement API to exist. The plugin is registered
       before init, but its bundle defines the API on its own clock;
       if it never arrives, the router does nothing at all, including
       no assignment, so broken sessions never enter the readout. */
    var waited = 0;
    var timer = window.setInterval(function () {
      waited += 250;
      var gs = window.engagement && window.engagement.gs;
      if (gs && typeof gs.show === "function") {
        window.clearInterval(timer);
        run(gs);
      } else if (waited >= 4000) {
        window.clearInterval(timer);
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

  function showGuide(gs, guideKey, resetFirst) {
    try {
      if (resetFirst && typeof gs.reset === "function") {
        var r = gs.reset(guideKey, 0);
        if (r && typeof r.catch === "function") r.catch(function () {});
      }
      var s = gs.show(guideKey);
      if (s && typeof s.catch === "function") s.catch(function () {});
    } catch (e) { /* A guide must never break the page. */ }
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
