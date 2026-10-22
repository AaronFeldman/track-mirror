(function trackMirrorFriendActivity() {
  const PREFIX = "[Track Mirror]";
  const STORAGE_KEY = "track-mirror:last-observations";
  const SCAN_DEBOUNCE_MS = 200;
  let scanTimer = null;

  function log(...args) {
    console.log(PREFIX, ...args);
  }

  function normalizeText(value) {
    return (value || "").replace(/\s+/g, " ").trim();
  }

  function absoluteSpotifyHref(anchor) {
    if (!anchor) return null;
    const href = anchor.getAttribute("href");
    if (!href) return null;
    if (href.startsWith("spotify:")) return href;
    if (href.startsWith("/")) return `https://open.spotify.com${href}`;
    return href;
  }

  function classifyHref(href) {
    if (!href) return null;
    if (/\/track\//.test(href) || /^spotify:track:/.test(href)) return "track";
    if (/\/artist\//.test(href) || /^spotify:artist:/.test(href)) return "artist";
    if (/\/user\//.test(href) || /^spotify:user:/.test(href)) return "user";
    if (/\/playlist\//.test(href) || /^spotify:playlist:/.test(href)) return "playlist";
    if (/\/album\//.test(href) || /^spotify:album:/.test(href)) return "album";
    return null;
  }

  function collectLinks(root) {
    return Array.from(root.querySelectorAll("a[href]"))
      .map((a) => ({
        element: a,
        href: absoluteSpotifyHref(a),
        text: normalizeText(a.textContent),
      }))
      .map((item) => ({ ...item, kind: classifyHref(item.href) }))
      .filter((item) => item.kind);
  }

  function candidateRows() {
    const selectors = [
      '[data-testid*="friend"]',
      '[aria-label*="Friend"]',
      '[aria-label*="friend"]',
      'aside',
    ];

    const roots = new Set();
    for (const selector of selectors) {
      document.querySelectorAll(selector).forEach((node) => roots.add(node));
    }

    const rows = [];
    for (const root of roots) {
      root.querySelectorAll("div, li").forEach((node) => {
        const links = collectLinks(node);
        const kinds = new Set(links.map((l) => l.kind));
        if ((kinds.has("user") || node.getAttribute("role") === "listitem") && kinds.has("track")) {
          rows.push(node);
        }
      });
    }

    return Array.from(new Set(rows));
  }

  function parseRow(row) {
    const links = collectLinks(row);
    const byKind = (kind) => links.find((l) => l.kind === kind) || null;
    const user = byKind("user");
    const track = byKind("track");
    const artist = byKind("artist");
    const playlist = byKind("playlist");
    const album = byKind("album");
    const rawText = normalizeText(row.textContent);

    if (!track) return null;

    return {
      source: "spotify-friend-activity-dom",
      observedAt: new Date().toISOString(),
      friend: user ? { name: user.text || null, href: user.href } : null,
      track: { name: track.text || null, href: track.href },
      artist: artist ? { name: artist.text || null, href: artist.href } : null,
      context: playlist
        ? { type: "playlist", name: playlist.text || null, href: playlist.href }
        : album
          ? { type: "album", name: album.text || null, href: album.href }
          : null,
      rawText,
    };
  }

  function dedupe(observations) {
    const seen = new Set();
    return observations.filter((obs) => {
      const key = JSON.stringify([
        obs.friend?.href,
        obs.friend?.name,
        obs.track?.href,
        obs.track?.name,
        obs.artist?.href,
        obs.rawText,
      ]);
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });
  }

  function persist(observations) {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(observations));
    } catch (error) {
      console.warn(PREFIX, "Could not persist observations", error);
    }
  }

  function emit(observations) {
    const event = new CustomEvent("track-mirror:friend-activity", {
      detail: observations,
    });
    window.dispatchEvent(event);
    log("Friend Activity observations", observations);
  }

  function scan() {
    const observations = dedupe(candidateRows().map(parseRow).filter(Boolean));
    persist(observations);
    emit(observations);
    return observations;
  }

  function scheduleScan() {
    clearTimeout(scanTimer);
    scanTimer = setTimeout(scan, SCAN_DEBOUNCE_MS);
  }

  function start() {
    if (!window.Spicetify) {
      setTimeout(start, 250);
      return;
    }

    log("Friend Activity discovery adapter loaded");
    scan();

    const observer = new MutationObserver(scheduleScan);
    observer.observe(document.body, {
      childList: true,
      subtree: true,
      characterData: true,
    });

    window.TrackMirrorFriendActivity = {
      scan,
      getLastObservations() {
        try {
          return JSON.parse(localStorage.getItem(STORAGE_KEY) || "[]");
        } catch {
          return [];
        }
      },
    };
  }

  start();
})();
