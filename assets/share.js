/* share.js — the share row on content pages (essays, case studies, speaking
   spokes). Wires the row's three behaviors and reports one event:

     Share Click (properties: share_method, page, page_type)
       share_method: native_share | copy_link | linkedin | x | email
       page: the page path; page_type: essay | case_study | speaking

   The LinkedIn / X / Email entries are plain links and work without this
   script; the script only adds their measurement, the Copy link button,
   and the native Share button (shown only where the browser offers the
   Web Share API). Measurement runs through the same consent gate as
   everything else on the site: events register with DCAmplitude.whenReady,
   so nothing fires before consent and a declined visitor sends nothing,
   while the row itself keeps working either way. Share links are
   deliberately NOT marked data-outbound-link, so a share never
   double-counts as the shared snippet's generic Link Clicked event.
   The event and its properties are in the tracking plan
   (files/home-base-deploy/tracking-plan.md).
*/
(function () {
  "use strict";

  function track(method, pageType) {
    if (typeof window.DCAmplitude === "undefined" ||
        typeof window.DCAmplitude.whenReady !== "function") return;
    window.DCAmplitude.whenReady(function () {
      if (typeof window.amplitude !== "undefined" &&
          typeof window.amplitude.track === "function") {
        window.amplitude.track("Share Click", {
          share_method: method,
          page: window.location.pathname,
          page_type: pageType
        });
      }
    });
  }

  function canonicalUrl() {
    var link = document.querySelector('link[rel="canonical"]');
    if (link && link.href) return link.href;
    return window.location.href.split(/[?#]/)[0];
  }

  function init(block) {
    var pageType = block.getAttribute("data-page-type") || "";
    var url = canonicalUrl();

    var nativeBtn = block.querySelector("[data-share-native]");
    if (nativeBtn && typeof navigator !== "undefined" &&
        typeof navigator.share === "function") {
      nativeBtn.hidden = false;
      nativeBtn.addEventListener("click", function () {
        navigator.share({ title: document.title, url: url }).then(
          function () { track("native_share", pageType); },
          function () { /* dismissed sheet: no event, by design */ }
        );
      });
    }

    var copyBtn = block.querySelector("[data-share-copy]");
    if (copyBtn) {
      var label = copyBtn.textContent;
      copyBtn.addEventListener("click", function () {
        function done() {
          track("copy_link", pageType);
          copyBtn.textContent = "Copied";
          window.setTimeout(function () { copyBtn.textContent = label; }, 2000);
        }
        function failed() {
          copyBtn.textContent = "Copy failed";
          window.setTimeout(function () { copyBtn.textContent = label; }, 2000);
        }
        if (navigator.clipboard &&
            typeof navigator.clipboard.writeText === "function") {
          navigator.clipboard.writeText(url).then(done, function () {
            if (fallbackCopy(url)) { done(); } else { failed(); }
          });
        } else if (fallbackCopy(url)) {
          done();
        } else {
          failed();
        }
      });
    }

    var links = block.querySelectorAll("[data-share-method]");
    Array.prototype.forEach.call(links, function (a) {
      a.addEventListener("click", function () {
        track(a.getAttribute("data-share-method"), pageType);
      });
    });
  }

  function fallbackCopy(text) {
    try {
      var ta = document.createElement("textarea");
      ta.value = text;
      ta.setAttribute("readonly", "");
      ta.style.position = "absolute";
      ta.style.left = "-9999px";
      document.body.appendChild(ta);
      ta.select();
      var ok = document.execCommand("copy");
      document.body.removeChild(ta);
      return !!ok;
    } catch (e) {
      return false;
    }
  }

  var blocks = document.querySelectorAll("[data-share]");
  Array.prototype.forEach.call(blocks, init);
})();
