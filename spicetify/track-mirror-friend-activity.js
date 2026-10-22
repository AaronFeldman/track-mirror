(function trackMirrorFriendActivity() {
  const PREFIX = "[Track Mirror]";
  const STORAGE_KEY = "track-mirror:last-observations";
  const STATUS_ID = "track-mirror-status-badge";
  const SCAN_DEBOUNCE_MS = 200;
  let scanTimer = null;
  let lastCount = 0;
  let lastPanelFound = false;

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

  function addAncestorRoots(roots, node, levels = 7) {
    let current = node instanceof Element ? node : node.parentElement;
    for (let i = 0; current && i < levels; i += 1, current = current.parentElement) {
      if (current.id !== STATUS_ID && current !== document.body && current !== document.documentElement) {
        roots.add(current);
      }
    }
  }

  function friendActivityRoots() {
    const roots = new Set();
    const selectors = [
      '[data-testid*="friend" i]',
      '[aria-label*="friend" i]',
      '[title*="friend" i]',
      '[class*="friend" i]',
    ];

    for (const selector of selectors) {
      try {
        document.querySelectorAll(selector).forEach((node) => addAncestorRoots(roots, node));
      } catch (error) {
        console.warn(PREFIX, "Selector failed", selector, error);
      }
    }

    document.querySelectorAll("aside, section, [role='complementary'], h1, h2, h3, h4, button, [role='button']")
      .forEach((node) => {
        if (node.id === STATUS_ID || node.closest(`#${STATUS_ID}`)) return;
        const text = normalizeText(node.textContent).toLowerCase();
        if (text.includes("friend activity") || text.includes("friends activity")) {
          addAncestorRoots(roots, node, 9);
        }
      });

    const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
    let textNode;
    let checked = 0;
    while ((textNode = walker.nextNode()) && checked < 10000) {
      checked += 1;
      const parent = textNode.parentElement;
      if (!parent || parent.id === STATUS_ID || parent.closest(`#${STATUS_ID}`)) continue;
      const text = normalizeText(textNode.nodeValue).toLowerCase();
      if (text === "friend activity" || text === "friends activity" || text.includes("friend activity")) {
        addAncestorRoots(roots, parent, 9);
      }
    }

    return Array.from(roots);
  }

  function candidateRows(roots = friendActivityRoots()) {
    const rows = [];
    for (const root of roots) {
      root.querySelectorAll("div, li, [role='listitem']").forEach((node) => {
        if (node.id === STATUS_ID || node.closest(`#${STATUS_ID}`)) return;
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

  function rightSideDiagnostic() {
    const found = [];
    const seen = new Set();
    const xValues = [0.78, 0.86, 0.94].map((p) => Math.floor(window.innerWidth * p));
    const yValues = [0.12, 0.22, 0.34, 0.48, 0.62, 0.76].map((p) => Math.floor(window.innerHeight * p));

    for (const x of xValues) {
      for (const y of yValues) {
        for (const node of document.elementsFromPoint(x, y)) {
          if (!(node instanceof Element)) continue;
          if (node.id === STATUS_ID || node.closest(`#${STATUS_ID}`)) continue;
          const text = normalizeText(node.innerText || node.textContent);
          if (!text || text.length > 180 || seen.has(text)) continue;
          seen.add(text);
          found.push(text);
          if (found.length >= 4) break;
        }
        if (found.length >= 4) break;
      }
      if (found.length >= 4) break;
    }

    return found.join(" | ").slice(0, 220) || "no readable right-side text";
  }

  function ensureStatusBadge() {
    let badge = document.getElementById(STATUS_ID);
    if (badge) return badge;

    badge = document.createElement("div");
    badge.id = STATUS_ID;
    badge.setAttribute("role", "status");
    badge.style.position = "fixed";
    badge.style.right = "16px";
    badge.style.bottom = "88px";
    badge.style.zIndex = "999999";
    badge.style.padding = "8px 12px";
    badge.style.borderRadius = "12px";
    badge.style.background = "rgba(20,20,20,0.92)";
    badge.style.color = "white";
    badge.style.fontSize = "12px";
    badge.style.fontWeight = "600";
    badge.style.boxShadow = "0 2px 10px rgba(0,0,0,0.35)";
    badge.style.pointerEvents = "none";
    badge.style.maxWidth = "520px";
    badge.style.whiteSpace = "normal";
    document.body.appendChild(badge);
    return badge;
  }

  function updateStatusBadge(panelFound, count) {
    lastPanelFound = panelFound;
    lastCount = count;
    const badge = ensureStatusBadge();
    if (panelFound) {
      badge.textContent = `Track Mirror: loaded • Friend Activity panel found • observations: ${count}`;
    } else {
      badge.textContent = `Track Mirror: loaded • panel not found • right-side UI: ${rightSideDiagnostic()}`;
    }
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
    const roots = friendActivityRoots();
    const panelFound = roots.length > 0;
    const observations = dedupe(candidateRows(roots).map(parseRow).filter(Boolean));
    persist(observations);
    updateStatusBadge(panelFound, observations.length);
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
    updateStatusBadge(false, 0);
    scan();

    const observer = new MutationObserver(() => {
      if (!document.getElementById(STATUS_ID)) {
        ensureStatusBadge();
        updateStatusBadge(lastPanelFound, lastCount);
      }
      scheduleScan();
    });
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
