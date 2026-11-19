/* video.js — video playback measurement for embedded YouTube players.
   Loaded only on pages that carry a [data-dc-video] embed (the speaking
   spoke pages). Reports the standard playback set from the tracking
   plan (Video Playback Started / Progress / Paused / Completed)
   through the same consent-gated Amplitude instance as everything
   else: every event registers with DCAmplitude.whenReady, so nothing
   fires before consent, and a declined visitor sends nothing.
   The YouTube IFrame API script loads lazily, only when a video
   block approaches the viewport.
   Review notes (Claude, Nov 19, 2026, applied): the ticker accrues
   only while the player state is PLAYING and settles its final delta
   when it stops, so buffering and stalls do not inflate watch time;
   milestones fire only for playback actually reached, never for a
   seek jump; Progress 100 fires only on ENDED, beside Completed;
   Paused fires only when watched time advanced since the last
   Paused, which suppresses scrub-generated duplicates; Started is
   guarded once per video per visit by a sessionStorage key written
   only inside the post-consent callback. */
(function () {
  "use strict";

  var embeds = document.querySelectorAll("[data-dc-video]");
  if (!embeds.length) return;

  function track(name, props) {
    if (typeof window.DCAmplitude === "undefined" ||
        typeof window.DCAmplitude.whenReady !== "function") return;
    window.DCAmplitude.whenReady(function () {
      if (window.amplitude && typeof window.amplitude.track === "function") {
        window.amplitude.track(name, props);
      }
    });
  }

  var MILESTONES = [25, 50, 75];

  function bindPlayer(iframe) {
    var state = {
      started: false,
      ended: false,
      watchedSeconds: 0,
      lastTick: null,
      lastPosition: 0,
      lastPausedAtWatched: -1,
      timer: null,
      milestones: {}
    };
    var meta = {
      video_id: iframe.getAttribute("data-video-id") || "",
      video_title: iframe.getAttribute("data-video-title") || "",
      video_platform: "youtube",
      video_duration_seconds:
        parseInt(iframe.getAttribute("data-video-duration") || "0", 10) || 0
    };

    function baseProps() {
      return {
        video_id: meta.video_id,
        video_title: meta.video_title,
        video_platform: meta.video_platform
      };
    }

    var player = null;

    function fireStarted() {
      if (state.started) return;
      state.started = true;
      var props = baseProps();
      var duration = meta.video_duration_seconds ||
        Math.round(player.getDuration() || 0);
      if (duration > 0) props.video_duration_seconds = duration;
      var key = "dc_video_started_" + meta.video_id;
      if (typeof window.DCAmplitude === "undefined" ||
          typeof window.DCAmplitude.whenReady !== "function") return;
      window.DCAmplitude.whenReady(function () {
        var already = false;
        try { already = !!window.sessionStorage.getItem(key); } catch (e) {}
        if (already) return;
        try { window.sessionStorage.setItem(key, "1"); } catch (e) {}
        if (window.amplitude && typeof window.amplitude.track === "function") {
          window.amplitude.track("Video Playback Started", props);
        }
      });
    }

    function fireMilestone(percent) {
      if (state.milestones[percent]) return;
      state.milestones[percent] = true;
      var props = baseProps();
      props.progress_percent = percent;
      props.position_seconds = Math.round(player.getCurrentTime() || 0);
      track("Video Playback Progress", props);
    }

    function settleTick() {
      if (state.lastTick !== null) {
        state.watchedSeconds += (Date.now() - state.lastTick) / 1000;
        state.lastTick = Date.now();
      }
    }

    function startTicker() {
      if (state.timer !== null) return;
      state.lastTick = Date.now();
      state.lastPosition = player.getCurrentTime() || 0;
      state.timer = window.setInterval(function () {
        if (player.getPlayerState() !== window.YT.PlayerState.PLAYING) {
          state.lastTick = Date.now();
          return;
        }
        settleTick();
        var duration = player.getDuration() || 0;
        var position = player.getCurrentTime() || 0;
        var prevPosition = state.lastPosition;
        var jumped = position - prevPosition > 2;
        state.lastPosition = position;
        if (duration > 0 && !jumped) {
          /* A milestone fires only when continuous playback crosses
             it: previous position below it, current at or past it.
             Being positioned beyond a milestone (after a seek) never
             fires it. */
          var prevPercent = (prevPosition / duration) * 100;
          var percent = (position / duration) * 100;
          for (var i = 0; i < MILESTONES.length; i++) {
            if (prevPercent < MILESTONES[i] && percent >= MILESTONES[i]) {
              fireMilestone(MILESTONES[i]);
            }
          }
        }
      }, 250);
    }

    function stopTicker() {
      if (state.timer !== null) {
        settleTick();
        window.clearInterval(state.timer);
        state.timer = null;
      }
      state.lastTick = null;
    }

    function handlePlaying() {
      fireStarted();
      startTicker();
    }

    player = new window.YT.Player(iframe, {
      events: {
        onReady: function () {
          if (player.getPlayerState() === window.YT.PlayerState.PLAYING) {
            handlePlaying();
          }
        },
        onStateChange: function (event) {
          var YT = window.YT;
          if (event.data === YT.PlayerState.PLAYING) {
            handlePlaying();
          } else if (event.data === YT.PlayerState.PAUSED) {
            stopTicker();
            if (state.started && !state.ended &&
                state.watchedSeconds > state.lastPausedAtWatched) {
              state.lastPausedAtWatched = state.watchedSeconds;
              var pausedProps = baseProps();
              pausedProps.position_seconds =
                Math.round(player.getCurrentTime() || 0);
              pausedProps.total_watched_seconds =
                Math.round(state.watchedSeconds);
              track("Video Playback Paused", pausedProps);
            }
          } else if (event.data === YT.PlayerState.BUFFERING) {
            stopTicker();
          } else if (event.data === YT.PlayerState.ENDED) {
            stopTicker();
            if (state.started && !state.ended) {
              state.ended = true;
              fireMilestone(100);
              var completedProps = baseProps();
              completedProps.total_watched_seconds =
                Math.round(state.watchedSeconds);
              track("Video Playback Completed", completedProps);
            }
          }
        }
      }
    });
  }

  function bindAll() {
    embeds.forEach(function (iframe) {
      try { bindPlayer(iframe); } catch (e) { /* one bad embed blocks none */ }
    });
  }

  var apiRequested = false;
  function loadApiAndBind() {
    if (apiRequested) return;
    apiRequested = true;
    if (window.YT && window.YT.Player) { bindAll(); return; }
    var previous = window.onYouTubeIframeAPIReady;
    window.onYouTubeIframeAPIReady = function () {
      if (typeof previous === "function") previous();
      bindAll();
    };
    var tag = document.createElement("script");
    tag.src = "https://www.youtube.com/iframe_api";
    tag.async = true;
    document.head.appendChild(tag);
  }

  if ("IntersectionObserver" in window) {
    var observer = new IntersectionObserver(function (entries) {
      entries.forEach(function (entry) {
        if (entry.isIntersecting) {
          loadApiAndBind();
          observer.disconnect();
        }
      });
    }, { rootMargin: "400px" });
    observer.observe(embeds[0]);
  } else {
    loadApiAndBind();
  }
})();
