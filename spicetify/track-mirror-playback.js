(function trackMirrorPlayback() {
  const PREFIX = "[Track Mirror Playback]";
  const CONTROL_ID = "track-mirror-playback-control";
  const SELECT_ID = "track-mirror-friend-select";
  const BUTTON_ID = "track-mirror-playback-toggle";
  const ENABLED_KEY = "track-mirror:playback-enabled";
  const TARGET_KEY = "track-mirror:target-friend";

  let enabled = localStorage.getItem(ENABLED_KEY) === "true";
  let selectedFriend = localStorage.getItem(TARGET_KEY) || "Amanda";
  let lastSeenUri = null;
  let lastPlayedUri = null;
  let lastResults = [];

  function normalize(value) {
    return (value || "").replace(/\s+/g, " ").trim();
  }

  function friendNames(results) {
    const names = (results || [])
      .map((item) => normalize(item.friend))
      .filter(Boolean);
    return Array.from(new Set(names));
  }

  function targetResult(results) {
    const wanted = normalize(selectedFriend).toLowerCase();
    return (results || []).find((item) => normalize(item.friend).toLowerCase() === wanted) || null;
  }

  function currentPlayerUri() {
    return Spicetify.Player?.data?.item?.uri || null;
  }

  function ensureControl() {
    let wrap = document.getElementById(CONTROL_ID);
    if (wrap) return wrap;

    wrap = document.createElement("div");
    wrap.id = CONTROL_ID;
    Object.assign(wrap.style, {
      position: "fixed",
      right: "16px",
      bottom: "122px",
      zIndex: "1000000",
      display: "flex",
      alignItems: "center",
      gap: "6px",
      padding: "6px",
      borderRadius: "14px",
      border: "1px solid rgba(255,255,255,0.20)",
      background: "rgba(20,20,20,0.94)",
      boxShadow: "0 2px 10px rgba(0,0,0,0.35)",
    });

    const select = document.createElement("select");
    select.id = SELECT_ID;
    Object.assign(select.style, {
      maxWidth: "180px",
      padding: "6px 8px",
      borderRadius: "10px",
      border: "1px solid rgba(255,255,255,0.22)",
      background: "rgba(35,35,35,0.98)",
      color: "white",
      fontSize: "12px",
      fontWeight: "600",
      cursor: "pointer",
    });

    select.addEventListener("change", () => {
      selectedFriend = select.value;
      localStorage.setItem(TARGET_KEY, selectedFriend);
      const current = targetResult(lastResults);
      lastSeenUri = current?.uri || null;
      lastPlayedUri = null;
      renderControl(enabled ? "armed; waiting for change" : "");
      console.log(PREFIX, "target changed", { selectedFriend, baselineUri: lastSeenUri });
    });

    const button = document.createElement("button");
    button.id = BUTTON_ID;
    button.type = "button";
    Object.assign(button.style, {
      padding: "7px 11px",
      borderRadius: "999px",
      border: "1px solid rgba(255,255,255,0.28)",
      background: "rgba(20,20,20,0.94)",
      color: "white",
      fontSize: "12px",
      fontWeight: "700",
      cursor: "pointer",
      whiteSpace: "nowrap",
    });

    button.addEventListener("click", () => {
      enabled = !enabled;
      localStorage.setItem(ENABLED_KEY, enabled ? "true" : "false");
      if (enabled) {
        const current = targetResult(lastResults);
        lastSeenUri = current?.uri || null;
      }
      renderControl(enabled ? "armed; waiting for change" : "");
      console.log(PREFIX, enabled ? "enabled" : "disabled", {
        selectedFriend,
        baselineUri: lastSeenUri,
      });
    });

    wrap.appendChild(select);
    wrap.appendChild(button);
    document.body.appendChild(wrap);
    return wrap;
  }

  function refreshFriendOptions() {
    ensureControl();
    const select = document.getElementById(SELECT_ID);
    if (!select) return;

    const names = friendNames(lastResults);
    if (selectedFriend && !names.some((name) => name.toLowerCase() === selectedFriend.toLowerCase())) {
      names.unshift(selectedFriend);
    }

    const currentOptions = Array.from(select.options).map((option) => option.value);
    if (currentOptions.length === names.length && currentOptions.every((value, index) => value === names[index])) {
      select.value = selectedFriend;
      return;
    }

    select.replaceChildren();
    for (const name of names) {
      const option = document.createElement("option");
      option.value = name;
      option.textContent = name;
      select.appendChild(option);
    }

    if (!names.length) {
      const option = document.createElement("option");
      option.value = selectedFriend || "";
      option.textContent = selectedFriend || "No friends detected";
      select.appendChild(option);
    }

    select.value = selectedFriend;
  }

  function renderControl(extra = "") {
    ensureControl();
    refreshFriendOptions();
    const button = document.getElementById(BUTTON_ID);
    if (!button) return;
    const state = enabled ? "ON" : "OFF";
    button.textContent = `Mirror: ${state}${extra ? ` • ${extra}` : ""}`;
    button.title = `Mirror ${selectedFriend}`;
  }

  async function maybeMirror(results) {
    lastResults = results || [];
    refreshFriendOptions();

    const result = targetResult(lastResults);
    if (!result?.uri) {
      renderControl(enabled ? `waiting for ${selectedFriend}` : "");
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
      console.log(PREFIX, "mirrored", { friend: selectedFriend, uri, parsed: result.parsed || null });
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
      get selectedFriend() { return selectedFriend; },
      setEnabled(value) {
        enabled = Boolean(value);
        localStorage.setItem(ENABLED_KEY, enabled ? "true" : "false");
        const current = targetResult(lastResults);
        lastSeenUri = current?.uri || lastSeenUri;
        renderControl(enabled ? "armed; waiting for change" : "");
      },
      setSelectedFriend(value) {
        selectedFriend = normalize(value) || selectedFriend;
        localStorage.setItem(TARGET_KEY, selectedFriend);
        const current = targetResult(lastResults);
        lastSeenUri = current?.uri || null;
        lastPlayedUri = null;
        renderControl(enabled ? "armed; waiting for change" : "");
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
      const names = friendNames(initial);
      if (!names.some((name) => name.toLowerCase() === selectedFriend.toLowerCase()) && names.length) {
        selectedFriend = names[0];
        localStorage.setItem(TARGET_KEY, selectedFriend);
      }
      lastSeenUri = targetResult(initial)?.uri || null;
    }

    renderControl(enabled ? "armed; waiting for change" : "");
    console.log(PREFIX, "loaded", { enabled, selectedFriend, baselineUri: lastSeenUri });
  }

  start();
})();
