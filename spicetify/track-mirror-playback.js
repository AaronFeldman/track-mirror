(function trackMirrorPlayback() {
  const PREFIX = "[Track Mirror Playback]";
  const CONTROL_ID = "track-mirror-playback-control";
  const TARGET_FRIEND = "Amanda";
  const STORAGE_KEY = "track-mirror:playback-enabled";
  let enabled = localStorage.getItem(STORAGE_KEY) === "true";
  let lastSeenUri = null;
  let lastPlayedUri = null;
  let lastResults = [];

  function normalize(value) {
    return (value || "").replace(/\s+/g, " ").trim();
  }

  function targetResult(results) {
    return (results || []).find((item) => normalize(item.friend).toLowerCase() === TARGET_FRIEND.toLowerCase()) || null;
  }

  function currentPlayerUri() {
    return Spicetify.Player?.data?.item?.uri || null;
  }

  function ensureControl() {
    let control = document.getElementById(CONTROL_ID);
    if (control) return control;

    control = document.createElement("button");
    control.id = CONTROL_ID;
    control.type = "button";
    Object.assign(control.style, {
      position: "fixed",
      right: "16px",
      bottom: "122px",
      zIndex: "1000000",
      padding: "8px 12px",
      borderRadius: "999px",
      border: "1px solid rgba(255,255,255,0.28)",
      background: "rgba(20,20,20,0.94)",
      color: "white",
      fontSize: "12px",
      fontWeight: "700",
      cursor: "pointer",
      boxShadow: "0 2px 10px rgba(0,0,0,0.35)",
    });

    control.addEventListener("click", () => {
      enabled = !enabled;
      localStorage.setItem(STORAGE_KEY, enabled ? "true" : "false");
      if (enabled) {
        // Treat the currently displayed URI as baseline so enabling does not
        // immediately start possibly stale activity. We only react to the
        // next URI change after the user arms mirroring.
        const current = targetResult(lastResults);
        lastSeenUri = current?.uri || null;
      }
      renderControl();
      console.log(PREFIX, enabled ? "enabled" : "disabled", { baselineUri: lastSeenUri });
    });

    document.body.appendChild(control);
    return control;
  }

  function renderControl(extra = "") {
    const control = ensureControl();
    const state = enabled ? "ON" : "OFF";
    control.textContent = `Mirror ${TARGET_FRIEND}: ${state}${extra ? ` • ${extra}` : ""}`;
  }

  async function maybeMirror(results) {
    lastResults = results || [];
    const result = targetResult(lastResults);
    if (!result?.uri) {
      renderControl(enabled ? "waiting for track URI" : "");
      return;
    }

    const uri = result.uri;
    if (!enabled) {
      lastSeenUri = uri;
      renderControl();
      return;
    }

    if (lastSeenUri === null) {
      lastSeenUri = uri;
      renderControl("armed; waiting for change");
      return;
    }

    if (uri === lastSeenUri) {
      renderControl("armed; waiting for change");
      return;
    }

    lastSeenUri = uri;

    const current = currentPlayerUri();
    if (current === uri || lastPlayedUri === uri) {
      renderControl("already on mirrored track");
      return;
    }

    try {
      renderControl("switching…");
      await Spicetify.Player.playUri(uri);
      lastPlayedUri = uri;
      renderControl("mirrored latest change");
      console.log(PREFIX, "mirrored", { friend: TARGET_FRIEND, uri, parsed: result.parsed || null });
    } catch (error) {
      const message = normalize(error?.message || String(error)).slice(0, 90);
      renderControl(`playback error: ${message}`);
      console.warn(PREFIX, "playUri failed", uri, error);
    }
  }

  function start() {
    if (!window.Spicetify?.Player?.playUri) {
      setTimeout(start, 250);
      return;
    }

    window.TrackMirrorPlayback = {
      get enabled() { return enabled; },
      setEnabled(value) {
        enabled = Boolean(value);
        localStorage.setItem(STORAGE_KEY, enabled ? "true" : "false");
        const current = targetResult(lastResults);
        lastSeenUri = current?.uri || lastSeenUri;
        renderControl();
      },
      get lastSeenUri() { return lastSeenUri; },
      get lastPlayedUri() { return lastPlayedUri; },
    };

    window.addEventListener("track-mirror:dom-uri-results", (event) => {
      maybeMirror(event.detail || []);
    });

    const initial = window.TrackMirrorDomUriProbe?.lastResults || [];
    if (initial.length) {
      lastResults = initial;
      lastSeenUri = targetResult(initial)?.uri || null;
    }

    renderControl();
    console.log(PREFIX, "loaded", { enabled, target: TARGET_FRIEND, baselineUri: lastSeenUri });
  }

  start();
})();
