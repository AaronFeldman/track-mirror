(function trackMirrorPlayback() {
  const PREFIX = "[Track Mirror Playback]";
  const SELECT_ID = "track-mirror-friend-select";
  const BUTTON_ID = "track-mirror-playback-toggle";
  const STATUS_ID = "track-mirror-playback-status";
  const ENABLED_KEY = "track-mirror:playback-enabled";
  const TARGET_KEY = "track-mirror:target-friend";

  let enabled = localStorage.getItem(ENABLED_KEY) === "true";
  let selectedFriend = localStorage.getItem(TARGET_KEY) || "Amanda";
  let lastSeenUri = null;
  let lastPlayedUri = null;
  let lastResults = [];
  let lastStatus = "";
  let topbarButton = null;

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

  function updateTopbarButton() {
    if (!topbarButton) return;
    topbarButton.label = enabled
      ? `Track Mirror: ON • ${selectedFriend}`
      : "Track Mirror: OFF";
    if (topbarButton.tippy?.setContent) {
      topbarButton.tippy.setContent(topbarButton.label);
    }
  }

  function buildControlPanel() {
    const panel = document.createElement("div");
    Object.assign(panel.style, {
      display: "grid",
      gap: "12px",
      minWidth: "320px",
      padding: "4px 2px",
    });

    const friendLabel = document.createElement("label");
    friendLabel.textContent = "Friend to mirror";
    Object.assign(friendLabel.style, {
      display: "grid",
      gap: "6px",
      fontSize: "13px",
      fontWeight: "600",
    });

    const select = document.createElement("select");
    select.id = SELECT_ID;
    Object.assign(select.style, {
      width: "100%",
      padding: "8px 10px",
      borderRadius: "8px",
      border: "1px solid rgba(255,255,255,0.20)",
      background: "var(--spice-card, rgba(35,35,35,0.98))",
      color: "var(--spice-text, white)",
      fontSize: "13px",
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

    friendLabel.appendChild(select);

    const button = document.createElement("button");
    button.id = BUTTON_ID;
    button.type = "button";
    Object.assign(button.style, {
      width: "100%",
      padding: "9px 12px",
      borderRadius: "999px",
      border: "1px solid rgba(255,255,255,0.25)",
      background: "var(--spice-button, rgba(30,30,30,0.98))",
      color: "var(--spice-text, white)",
      fontSize: "13px",
      fontWeight: "700",
      cursor: "pointer",
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

    const status = document.createElement("div");
    status.id = STATUS_ID;
    Object.assign(status.style, {
      minHeight: "18px",
      fontSize: "12px",
      lineHeight: "1.4",
      opacity: "0.75",
    });

    const hint = document.createElement("div");
    hint.textContent = "These controls now live here instead of floating over Spotify content.";
    Object.assign(hint.style, {
      fontSize: "11px",
      lineHeight: "1.4",
      opacity: "0.55",
    });

    panel.appendChild(friendLabel);
    panel.appendChild(button);
    panel.appendChild(status);
    panel.appendChild(hint);

    return panel;
  }

  function openControlModal() {
    const content = buildControlPanel();
    Spicetify.PopupModal.display({
      title: "Track Mirror",
      content,
    });
    refreshFriendOptions();
    renderControl(lastStatus);
  }

  function ensureTopbarButton() {
    if (topbarButton) return topbarButton;

    topbarButton = new Spicetify.Topbar.Button(
      enabled ? `Track Mirror: ON • ${selectedFriend}` : "Track Mirror: OFF",
      "play",
      () => openControlModal(),
      false,
      true,
    );

    updateTopbarButton();
    return topbarButton;
  }

  function refreshFriendOptions() {
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
    lastStatus = extra;
    ensureTopbarButton();
    updateTopbarButton();
    refreshFriendOptions();

    const button = document.getElementById(BUTTON_ID);
    if (button) {
      button.textContent = enabled ? "Mirroring ON" : "Mirroring OFF";
      button.title = `Mirror ${selectedFriend}`;
    }

    const status = document.getElementById(STATUS_ID);
    if (status) {
      const state = enabled ? `Mirroring ${selectedFriend}` : "Mirroring is off";
      status.textContent = extra ? `${state} • ${extra}` : state;
    }
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
    if (
      !window.Spicetify?.Player?.playUri ||
      !window.Spicetify?.Topbar?.Button ||
      !window.Spicetify?.PopupModal?.display
    ) {
      setTimeout(start, 250);
      return;
    }

    const oldFloatingControl = document.getElementById("track-mirror-playback-control");
    if (oldFloatingControl) oldFloatingControl.remove();

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
      openControls() {
        openControlModal();
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
