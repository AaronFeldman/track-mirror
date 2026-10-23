(function trackMirrorPlayback() {
  const PREFIX = "[Track Mirror Playback]";
  const ENABLED_KEY = "track-mirror:playback-enabled";
  const TARGET_KEY = "track-mirror:target-friend";
  const TOPBAR_TEXT_CLASS = "track-mirror-topbar-visible-label";

  let enabled = localStorage.getItem(ENABLED_KEY) === "true";
  let selectedFriend = localStorage.getItem(TARGET_KEY) || "Amanda";
  let lastSeenUri = null;
  let lastPlayedUri = null;
  let lastResults = [];
  let lastStatus = "";
  let topbarButton = null;
  let refreshOpenModal = null;
  let dismissTimer = null;

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
    return (results || []).find(
      (item) => normalize(item.friend).toLowerCase() === wanted,
    ) || null;
  }

  function currentPlayerUri() {
    return Spicetify.Player?.data?.item?.uri || null;
  }

  function dismissControlModal(delay = 250) {
    clearTimeout(dismissTimer);
    dismissTimer = setTimeout(() => {
      Spicetify.PopupModal?.hide?.();
      dismissTimer = null;
    }, delay);
  }

  function setSelectedFriend(value) {
    selectedFriend = normalize(value) || selectedFriend;
    localStorage.setItem(TARGET_KEY, selectedFriend);
    const current = targetResult(lastResults);
    lastSeenUri = current?.uri || null;
    lastPlayedUri = null;
    renderControl(enabled ? "armed; waiting for change" : "");
    console.log(PREFIX, "target changed", {
      selectedFriend,
      baselineUri: lastSeenUri,
    });
  }

  function setEnabled(value) {
    enabled = Boolean(value);
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
  }

  function ensureVisibleTopbarLabel() {
    const element = topbarButton?.element;
    if (!element) return;

    Object.assign(element.style, {
      width: "auto",
      minWidth: "max-content",
      display: "inline-flex",
      alignItems: "center",
      gap: "6px",
      paddingInline: "10px",
      whiteSpace: "nowrap",
    });

    let label = element.querySelector(`.${TOPBAR_TEXT_CLASS}`);
    if (!label) {
      label = document.createElement("span");
      label.className = TOPBAR_TEXT_CLASS;
      Object.assign(label.style, {
        fontSize: "12px",
        fontWeight: "700",
        lineHeight: "1",
        pointerEvents: "none",
      });
      element.appendChild(label);
    }

    label.textContent = "Track Mirror";
  }

  function updateTopbarButton() {
    if (!topbarButton) return;
    topbarButton.label = enabled
      ? `Track Mirror: ON • ${selectedFriend}`
      : "Track Mirror: OFF";
    ensureVisibleTopbarLabel();
  }

  function controlPanelElement() {
    const React = Spicetify.React;

    function ControlPanel() {
      const [, setRevision] = React.useState(0);

      React.useEffect(() => {
        const rerender = () => setRevision((value) => value + 1);
        refreshOpenModal = rerender;
        return () => {
          if (refreshOpenModal === rerender) refreshOpenModal = null;
        };
      }, []);

      const names = friendNames(lastResults);
      if (
        selectedFriend &&
        !names.some((name) => name.toLowerCase() === selectedFriend.toLowerCase())
      ) {
        names.unshift(selectedFriend);
      }

      const options = names.length ? names : [selectedFriend || "No friends detected"];
      const stateText = enabled
        ? `Mirroring ${selectedFriend}`
        : "Mirroring is off";
      const statusText = lastStatus
        ? `${stateText} • ${lastStatus}`
        : stateText;

      return React.createElement(
        "div",
        {
          style: {
            display: "grid",
            gap: "12px",
            minWidth: "320px",
            padding: "4px 2px",
          },
        },
        React.createElement(
          "label",
          {
            style: {
              display: "grid",
              gap: "6px",
              fontSize: "13px",
              fontWeight: 600,
            },
          },
          "Friend to mirror",
          React.createElement(
            "select",
            {
              value: selectedFriend,
              onChange: (event) => {
                const mirroringWasEnabled = enabled;
                setSelectedFriend(event.target.value);
                if (mirroringWasEnabled) dismissControlModal();
              },
              style: {
                width: "100%",
                padding: "8px 10px",
                borderRadius: "8px",
                border: "1px solid rgba(255,255,255,0.20)",
                background: "var(--spice-card, rgba(35,35,35,0.98))",
                color: "var(--spice-text, white)",
                fontSize: "13px",
                cursor: "pointer",
              },
            },
            options.map((name) =>
              React.createElement("option", { key: name, value: name }, name),
            ),
          ),
        ),
        React.createElement(
          "button",
          {
            type: "button",
            onClick: () => {
              setEnabled(!enabled);
              dismissControlModal();
            },
            style: {
              width: "100%",
              padding: "9px 12px",
              borderRadius: "999px",
              border: "1px solid rgba(255,255,255,0.25)",
              background: "var(--spice-button, rgba(30,30,30,0.98))",
              color: "var(--spice-text, white)",
              fontSize: "13px",
              fontWeight: 700,
              cursor: "pointer",
            },
          },
          enabled ? "Mirroring ON" : "Mirroring OFF",
        ),
        React.createElement(
          "div",
          {
            style: {
              minHeight: "18px",
              fontSize: "12px",
              lineHeight: 1.4,
              opacity: 0.75,
            },
          },
          statusText,
        ),
        React.createElement(
          "div",
          {
            style: {
              fontSize: "11px",
              lineHeight: 1.4,
              opacity: 0.62,
            },
          },
          "Changes take effect immediately. This panel closes automatically after your action. Closing it never turns Track Mirror off.",
        ),
      );
    }

    return React.createElement(ControlPanel);
  }

  function openControlModal() {
    clearTimeout(dismissTimer);
    dismissTimer = null;
    Spicetify.PopupModal.display({
      title: "Track Mirror",
      content: controlPanelElement(),
    });
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

  function renderControl(extra = "") {
    lastStatus = extra;
    ensureTopbarButton();
    updateTopbarButton();
    if (refreshOpenModal) refreshOpenModal();
  }

  async function maybeMirror(results) {
    lastResults = results || [];
    if (refreshOpenModal) refreshOpenModal();

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
      console.log(PREFIX, "mirrored", {
        friend: selectedFriend,
        uri,
        parsed: result.parsed || null,
      });
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
      !window.Spicetify?.PopupModal?.display ||
      !window.Spicetify?.React?.createElement
    ) {
      setTimeout(start, 250);
      return;
    }

    const oldFloatingControl = document.getElementById(
      "track-mirror-playback-control",
    );
    if (oldFloatingControl) oldFloatingControl.remove();

    window.TrackMirrorPlayback = {
      get enabled() {
        return enabled;
      },
      get selectedFriend() {
        return selectedFriend;
      },
      setEnabled,
      setSelectedFriend,
      openControls: openControlModal,
      get lastSeenUri() {
        return lastSeenUri;
      },
      get lastPlayedUri() {
        return lastPlayedUri;
      },
    };

    window.addEventListener("track-mirror:dom-uri-results", (event) => {
      maybeMirror(event.detail || []);
    });

    const initial = window.TrackMirrorDomUriProbe?.lastResults || [];
    if (initial.length) {
      lastResults = initial;
      const names = friendNames(initial);
      if (
        !names.some(
          (name) => name.toLowerCase() === selectedFriend.toLowerCase(),
        ) && names.length
      ) {
        selectedFriend = names[0];
        localStorage.setItem(TARGET_KEY, selectedFriend);
      }
      lastSeenUri = targetResult(initial)?.uri || null;
    }

    renderControl(enabled ? "armed; waiting for change" : "");
    console.log(PREFIX, "loaded", {
      enabled,
      selectedFriend,
      baselineUri: lastSeenUri,
    });
  }

  start();
})();
