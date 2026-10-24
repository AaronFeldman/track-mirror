(function trackMirrorRemoteBridge() {
  const PREFIX = "[Track Mirror Remote]";
  const BASE_URL = "http://127.0.0.1:8765";
  const POLL_MS = 750;
  const STATE_MS = 1500;

  let lastCommandId = 0;
  let lastStateSignature = "";
  let started = false;

  function normalize(value) {
    return (value || "").replace(/\s+/g, " ").trim();
  }

  function friendNames() {
    const results = window.TrackMirrorDomUriProbe?.lastResults || [];
    const seen = new Set();
    const names = [];
    for (const item of results) {
      const name = normalize(item?.friend);
      const key = name.toLowerCase();
      if (name && !seen.has(key)) {
        seen.add(key);
        names.push(name);
      }
    }
    return names;
  }

  function currentState() {
    const playback = window.TrackMirrorPlayback;
    return {
      friends: friendNames(),
      selected_friend: normalize(playback?.selectedFriend) || null,
      enabled: Boolean(playback?.enabled),
    };
  }

  async function publishState(force = false) {
    if (!window.TrackMirrorPlayback) return;
    const state = currentState();
    const signature = JSON.stringify(state);
    if (!force && signature === lastStateSignature) return;

    try {
      const response = await fetch(`${BASE_URL}/api/state`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: signature,
        cache: "no-store",
      });
      if (response.ok) lastStateSignature = signature;
    } catch (_) {
      // The remote helper is optional. The working local Track Mirror path must
      // remain unaffected when the helper is not running.
    }
  }

  async function pollCommand() {
    const playback = window.TrackMirrorPlayback;
    if (!playback) return;

    try {
      const response = await fetch(`${BASE_URL}/api/command?after=${lastCommandId}`, {
        cache: "no-store",
      });
      if (!response.ok) return;
      const data = await response.json();
      const commandId = Number(data?.command_id || 0);
      if (!Number.isFinite(commandId) || commandId <= lastCommandId) return;

      lastCommandId = commandId;
      const command = data?.command;
      if (!command) return;

      if (command.type === "follow" && normalize(command.friend)) {
        playback.setSelectedFriend(command.friend);
        playback.setEnabled(true);
        console.log(PREFIX, "remote follow", command.friend);
      } else if (command.type === "stop") {
        playback.setEnabled(false);
        console.log(PREFIX, "remote stop");
      }

      await publishState(true);
    } catch (_) {
      // Retry quietly; remote control is additive to the local proof of concept.
    }
  }

  function start() {
    if (started) return;
    if (!window.TrackMirrorPlayback || !window.TrackMirrorDomUriProbe) {
      setTimeout(start, 250);
      return;
    }

    started = true;
    window.addEventListener("track-mirror:dom-uri-results", () => publishState());
    publishState(true);
    setInterval(pollCommand, POLL_MS);
    setInterval(() => publishState(), STATE_MS);
    console.log(PREFIX, "loaded", { baseUrl: BASE_URL });
  }

  start();
})();
