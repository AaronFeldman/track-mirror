(function trackMirrorDomUriProbe() {
  const PREFIX = "[Track Mirror URI Probe]";
  const STATUS_ID = "track-mirror-uri-probe-status";

  function normalizeText(value) {
    return (value || "").replace(/\s+/g, " ").trim();
  }

  function normalizeKey(value) {
    return normalizeText(value)
      .normalize("NFKD")
      .replace(/[\u0300-\u036f]/g, "")
      .replace(/[’‘]/g, "'")
      .toLowerCase();
  }

  function activitySummary(obs) {
    const friendName = normalizeText(obs.friend?.name || "");
    let text = normalizeText(obs.rawText || "");
    if (friendName && text.toLowerCase().startsWith(friendName.toLowerCase())) {
      text = normalizeText(text.slice(friendName.length));
    }
    text = text.replace(/^\s*[•·|\-–—:]\s*/, "");
    text = text.replace(/\b(?:\d+\s*(?:min|mins|minute|minutes|hr|hrs|hour|hours)|now)\b\s*$/i, "").trim();
    return text;
  }

  function parseTrackArtist(obs) {
    if (obs.track?.name) {
      return {
        track: normalizeText(obs.track.name),
        artist: normalizeText(obs.artist?.name || ""),
      };
    }

    const summary = activitySummary(obs);
    for (const separator of [" — ", " – "]) {
      const index = summary.lastIndexOf(separator);
      if (index > 0) {
        const track = normalizeText(summary.slice(0, index));
        const artist = normalizeText(summary.slice(index + separator.length));
        if (track && artist) return { track, artist };
      }
    }
    return null;
  }

  function ensureBadge() {
    let badge = document.getElementById(STATUS_ID);
    if (badge) return badge;
    badge = document.createElement("div");
    badge.id = STATUS_ID;
    badge.setAttribute("role", "status");
    Object.assign(badge.style, {
      position: "fixed",
      right: "16px",
      bottom: "18px",
      zIndex: "999999",
      padding: "6px 10px",
      borderRadius: "10px",
      background: "rgba(20,20,20,0.92)",
      color: "white",
      fontSize: "11px",
      fontWeight: "600",
      boxShadow: "0 2px 10px rgba(0,0,0,0.35)",
      pointerEvents: "none",
      maxWidth: "760px",
      whiteSpace: "normal",
    });
    document.body.appendChild(badge);
    return badge;
  }

  function setBadge(text) {
    const badge = ensureBadge();
    if (badge.textContent !== text) badge.textContent = text;
  }

  function uriFromValue(value) {
    const text = String(value || "");
    let match = text.match(/spotify:track:([A-Za-z0-9]+)/);
    if (match) return `spotify:track:${match[1]}`;
    match = text.match(/(?:https?:\/\/open\.spotify\.com)?\/track\/([A-Za-z0-9]+)/);
    if (match) return `spotify:track:${match[1]}`;
    return null;
  }

  function inspectElementTree(root, parsed) {
    const wantedTrack = normalizeKey(parsed.track);
    const found = [];
    const nodes = [root, ...Array.from(root.querySelectorAll("*"))].slice(0, 400);

    for (const node of nodes) {
      if (!(node instanceof Element)) continue;
      const nodeText = normalizeKey(node.textContent || "");
      const values = [];
      if (node.tagName === "A") values.push(node.getAttribute("href"));
      for (const attr of Array.from(node.attributes || [])) values.push(attr.value);

      for (const value of values) {
        const uri = uriFromValue(value);
        if (!uri) continue;
        let score = 1;
        if (nodeText && nodeText === wantedTrack) score += 10;
        else if (nodeText && (nodeText.includes(wantedTrack) || wantedTrack.includes(nodeText))) score += 5;
        found.push({ uri, score, text: normalizeText(node.textContent || "") });
      }
    }

    found.sort((a, b) => b.score - a.score);
    return found[0] || null;
  }

  function findCandidateRow(friendName, parsed) {
    const friendKey = normalizeKey(friendName);
    const trackKey = normalizeKey(parsed.track);
    const artistKey = normalizeKey(parsed.artist);
    const selectors = "div, li, button, [role='listitem'], [role='button']";
    const candidates = [];

    for (const node of document.querySelectorAll(selectors)) {
      if (node.closest(`#${STATUS_ID}`) || node.closest("#track-mirror-status-badge") || node.closest("#track-mirror-resolver-status")) continue;
      const text = normalizeText(node.innerText || node.textContent);
      if (!text || text.length > 500) continue;
      const key = normalizeKey(text);
      if (!key.includes(friendKey) || !key.includes(trackKey)) continue;
      if (artistKey && !key.includes(artistKey)) continue;
      candidates.push({ node, length: text.length });
    }

    candidates.sort((a, b) => a.length - b.length);
    return candidates[0]?.node || null;
  }

  function probeObservation(obs) {
    const parsed = parseTrackArtist(obs);
    const friend = normalizeText(obs.friend?.name || "unknown");
    if (!parsed) return { friend, parsed: null, uri: null, reason: "unparseable" };

    if (obs.track?.href) {
      const direct = uriFromValue(obs.track.href);
      if (direct) return { friend, parsed, uri: direct, reason: "observation link" };
    }

    const row = findCandidateRow(friend, parsed);
    if (!row) return { friend, parsed, uri: null, reason: "row not found" };

    let current = row;
    for (let level = 0; current && level < 5; level += 1, current = current.parentElement) {
      const text = normalizeText(current.innerText || current.textContent);
      if (text.length > 1400) break;
      const found = inspectElementTree(current, parsed);
      if (found?.uri) return { friend, parsed, uri: found.uri, reason: `nearby DOM level ${level}` };
    }

    return { friend, parsed, uri: null, reason: "no embedded track URI nearby" };
  }

  function probe(observations) {
    const results = (observations || []).map(probeObservation);
    const details = results.map((r) => {
      const title = r.parsed ? `${r.parsed.track} — ${r.parsed.artist}` : "unknown track";
      return r.uri
        ? `${r.friend}: ${title} ✓ ${r.uri}`
        : `${r.friend}: ${title} ✗ ${r.reason}`;
    });
    setBadge(`Track Mirror URI probe • ${details.join(" | ")}`);
    window.TrackMirrorDomUriProbe.lastResults = results;
    window.dispatchEvent(new CustomEvent("track-mirror:dom-uri-results", { detail: results }));
    console.log(PREFIX, results);
    return results;
  }

  function start() {
    if (!window.Spicetify) {
      setTimeout(start, 250);
      return;
    }

    window.TrackMirrorDomUriProbe = { lastResults: [], probe };
    window.addEventListener("track-mirror:friend-activity", (event) => probe(event.detail || []));
    setBadge("Track Mirror URI probe: loaded; no catalog API calls");

    const initial = window.TrackMirrorFriendActivity?.getLastObservations?.() || [];
    if (initial.length) probe(initial);
  }

  start();
})();
