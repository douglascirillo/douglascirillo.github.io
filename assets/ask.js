/* Ask My Record: Phase 2a cited retrieval UI for douglascirillo.com.
   One shared file, loaded by every page. Set ASK_ENABLED to false to remove
   the feature site-wide with no other change. ASK_ENDPOINT is set at deploy. */
(function () {
  var ASK_ENABLED = true;
  var ASK_ENDPOINT = "https://7i3yr1dzge.execute-api.us-east-1.amazonaws.com/ask";
  if (!ASK_ENABLED) return;

  var css = [
    ".ask{padding:44px 0 8px}",
    ".ask h2{font-family:\"Newsreader\", Georgia, serif;font-weight:500;font-size:28px;letter-spacing:-.01em;margin:0 0 8px}",
    ".ask .ask-sub{margin:0 0 16px;color:var(--ink-2);font-size:16px;line-height:1.55;max-width:38em}",
    ".ask form{display:flex;gap:8px;flex-wrap:wrap}",
    ".ask input{font:inherit;font-size:16px;flex:1 1 260px;padding:10px 14px;border:1px solid var(--line);border-radius:999px;background:transparent;color:var(--ink)}",
    ".ask button{font:inherit;font-size:15px;padding:10px 18px;border:1px solid var(--accent);border-radius:999px;background:var(--accent);color:#fff;cursor:pointer}",
    "@media (prefers-color-scheme: dark){.ask button{color:#101512}}",
    ".ask .ask-note{margin:10px 0 0;font-size:13px;color:var(--muted)}",
    ".ask .ask-results{margin-top:18px}",
    ".ask .ask-item{padding:14px 18px;border:1px solid var(--line);border-radius:10px;margin:0 0 10px}",
    ".ask .ask-item p{margin:0 0 6px;font-size:16.5px;line-height:1.55}",
    ".ask .ask-item a{font-size:14px}",
    ".ask .ask-msg{font-size:16.5px;line-height:1.55}"
  ].join("\n");
  var style = document.createElement("style");
  style.textContent = css;
  document.head.appendChild(style);

  var section = document.createElement("section");
  section.className = "ask";
  section.setAttribute("aria-labelledby", "ask-h");
  section.innerHTML =
    "<h2 id=\"ask-h\">Ask my record</h2>" +
    "<p class=\"ask-sub\">Answers come only from what is published on this site, quoted word for word, with the source. If it is not in the record, the answer says so.</p>" +
    "<form id=\"ask-form\"><input id=\"ask-q\" type=\"text\" maxlength=\"300\" autocomplete=\"off\" placeholder=\"What did he build at Sotheby&rsquo;s?\" aria-label=\"Ask a question about the published record\">" +
    "<button type=\"submit\">Ask</button></form>" +
    "<p class=\"ask-note\">Questions are kept for 90 days and read by Douglas to improve the record. Please leave out personal details.</p>" +
    "<div class=\"ask-results\" id=\"ask-results\" aria-live=\"polite\"></div>";

  var footer = document.querySelector("footer");
  if (footer && footer.parentNode) footer.parentNode.insertBefore(section, footer);
  else document.body.appendChild(section);

  function track(n, p) {
    if (window.amplitude && typeof window.amplitude.track === "function") {
      try { window.amplitude.track(n, p || {}); } catch (e) {}
    }
  }

  var form = document.getElementById("ask-form");
  var input = document.getElementById("ask-q");
  var results = document.getElementById("ask-results");

  form.addEventListener("submit", function (ev) {
    ev.preventDefault();
    var q = input.value.trim();
    if (q.length < 3) return;
    track("ask_submitted", {});
    results.innerHTML = "<p class=\"ask-msg\">Checking the record&hellip;</p>";
    fetch(ASK_ENDPOINT, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ question: q })
    })
      .then(function (r) { return r.json(); })
      .then(function (data) {
        if (data.type === "answer" && data.items && data.items.length) {
          track("ask_answered", {});
          results.innerHTML = "";
          data.items.forEach(function (it) {
            var div = document.createElement("div");
            div.className = "ask-item";
            var p = document.createElement("p"); p.textContent = it.claim;
            var a = document.createElement("a"); a.href = it.source; a.textContent = "Read it in context";
            a.addEventListener("click", function () { track("ask_next_click", {}); });
            div.appendChild(p); div.appendChild(a);
            results.appendChild(div);
          });
        } else if (data.type === "refusal") {
          track("ask_refused", {});
          var p1 = document.createElement("p"); p1.className = "ask-msg"; p1.textContent = data.text;
          results.innerHTML = ""; results.appendChild(p1);
        } else {
          track("ask_answered", {});
          var p2 = document.createElement("p"); p2.className = "ask-msg"; p2.textContent = data.text || "";
          results.innerHTML = ""; results.appendChild(p2);
          if (data.link) {
            var a2 = document.createElement("a");
            a2.href = data.link; a2.textContent = "Browse the case studies";
            a2.addEventListener("click", function () { track("ask_next_click", {}); });
            results.appendChild(a2);
          }
        }
      })
      .catch(function () {
        results.innerHTML = "<p class=\"ask-msg\">The record is not answering right now. The case studies are the fastest way through it.</p>";
      });
  });
})();
