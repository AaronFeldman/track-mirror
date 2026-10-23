(function trackMirrorTrackResolver() {
  const PREFIX = "[Track Mirror Resolver]";
  const STATUS_ID = "track-mirror-resolver-status";
  const CACHE = new Map();
  let latestObservations = [];

  function normalizeText(value) {
    return (value || "").replace(/\s+/g, " ").trim();
  }

  function normalizeKey(value) {
    return normalizeText(value)
      .normalize("NFKD")
      .replace(/[\u0300-\u036f]/g, "")
      .replace(/[’‘]/g, "'")
      .replace(/[“”]/g, '"')
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

    if (obs.track?.name) {
      return [obs.track.name, obs.artist?.name].filter(Boolean).join(" — ");
    }

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
    const separators = [" — ", " – "];
    for (const separator of separators) {
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
    badge.style.position = "fixed";
    badge.style.right = "16px";
    badge.style.bottom = "52px";
    badge.style.zIndex = "999999";
    badge.style.padding = "6px 10px";
    badge.style.borderRadius = "10px";
    badge.style.background = "rgba(20,20,20,0.92)";
    badge.style.color = "white";
    badge.style.fontSize = "11px";
    badge.style.fontWeight = "600";
    badge.style.boxShadow = "0 2px 10px rgba(0,0,0,0.35)";
    badge.style.pointerEvents = "none";
    badge.style.maxWidth = "720px";
    badge.style.whiteSpace = "normal";
    document.body.appendChild(badge);
    return badge;
  }

  function setBadge(text) {
    const badge = ensureBadge();
    if (badge.textContent !== text) badge.textContent = text;
  }

  function similarityScore(item, parsed) {
    const wantedTrack = normalizeKey(parsed.track);
    const wantedArtist = normalizeKey(parsed.artist);
    const itemTrack = normalizeKey(item?.name || "");
    const artists = (item?.artists || []).map((a) => normalizeKey(a?.name || ""));

    let score = 0;
    if (itemTrack === wantedTrack) score += 8;
    else if (itemTrack.includes(wantedTrack) || wantedTrack.includes(itemTrack)) score += 4;

    if (artists.includes(wantedArtist)) score += 8;
    else if (artists.some((name) => name.includes(wantedArtist) || wantedArtist.includes(name))) score += 4;

    return score;
  }

  async function searchSpotify(parsed) {
    const queries = [
      `${parsed.track} ${parsed.artist}`,
      `track:${parsed.track} artist:${parsed.artist}`,
      parsed.track,
    ];

    let lastError = null;
    for (const query of queries) {
      const url = `https://api.spotify.com/v1/search?q=${encodeURIComponent(query)}&type=track&limit=10`;
      try {
        const response = await Spicetify.CosmosAsync.get(url);
        const items = response?.tracks?.items || [];
        if (items.length) return { items, error: null };
      } catch (error) {
        lastError = error;
      }
    }

    return { items: [], error: lastError };
  }

  async function resolveTrack(parsed) {
    const key = `${normalizeKey(parsed.track)}\n${normalizeKey(parsed.artist)}`;
    if (CACHE.has(key)) return CACHE.get(key);

    const promise = (async () => {
      const { items, error } = await searchSpotify(parsed);
      if (error && !items.length) {
        return {
          ok: false,
          error: normalizeText(error?.message || error?.statusText || String(error)).slice(0, 120),
          track: null,
        };
      }

      if (!items.length) return { ok: false, error: "no catalog results", track: null };

      const ranked = items
        .map((item) => ({ item, score: similarityScore(item, parsed) }))
        .sort((a, b) => b.score - a.score);

      const best = ranked[0];
      if (!best || best.score < 8) {
        return {
          ok: false,
          error: `no confident match (best score ${best?.score ?? 0})`,
          track: best?.item || null,
        };
      }

      const match = best.item;
      return {
        ok: true,
        error: null,
        track: {
          id: match.id || null,
          uri: match.uri || null,
          name: match.name || null,
          artists: (match.artists || []).map((a) => a.name).filter(Boolean),
          externalUrl: match.external_urls?.spotify || null,
        },
      };
    })().catch((error) => ({
      ok: false,
      error: normalizeText(error?.message || String(error)).slice(0, 120),
      track: null,
    }));

    CACHE.set(key, promise);
    return promise;
  }

  async function resolveObservations(observations) {
    latestObservations = observations || [];
    const candidates = latestObservations
      .map((obs) => ({ obs, parsed: parseTrackArtist(obs) }))
      .filter((entry) => entry.parsed);

    if (!candidates.length) {
      setBadge("Track Mirror resolver: no parseable tracks yet");
      return;
    }

    setBadge(`Track Mirror resolver: resolving ${candidates.length} track${candidates.length === 1 ? "" : "s"}…`);

    const resolved = await Promise.all(candidates.map(async ({ obs, parsed }) => ({
      obs,
      parsed,
      result: await resolveTrack(parsed),
    })));

    const details = resolved.map(({ obs, parsed, result }) => {
      const friend = obs.friend?.name || "unknown";
      if (!result?.ok) return `${friend}: ${parsed.track} — ${parsed.artist} ✗ ${result?.error || "unknown error"}`;
      return `${friend}: ${result.track.name} — ${result.track.artists.join(", ")} ✓ Spotify`;
    });

    setBadge(`Track Mirror resolver • ${details.join(" | ")}`);

    const payload = resolved.map(({ obs, parsed, result }) => ({
      friend: obs.friend || null,
      displayed: parsed,
      resolvedTrack: result?.ok ? result.track : null,
      resolutionError: result?.ok ? null : result?.error || "unknown error",
      observedAt: obs.observedAt || new Date().toISOString(),
    }));

    window.dispatchEvent(new CustomEvent("track-mirror:resolved-activity", { detail: payload }));
    window.TrackMirrorTrackResolver.lastResolved = payload;
    console.log(PREFIX, "Resolved listening activity", payload);
  }

  function start() {
    if (!window.Spicetify?.CosmosAsync) {
      setTimeout(start, 250);
      return;
    }

    window.TrackMirrorTrackResolver = {
      lastResolved: [],
      resolveObservations,
      resolveTrack,
    };

    window.addEventListener("track-mirror:friend-activity", (event) => {
      resolveObservations(event.detail || []);
    });

    setBadge("Track Mirror resolver: loaded");

    const initial = window.TrackMirrorFriendActivity?.getLastObservations?.() || [];
    if (initial.length) resolveObservations(initial);
  }

  start();
})();
