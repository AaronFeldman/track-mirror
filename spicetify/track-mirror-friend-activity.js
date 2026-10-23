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

  function activityLabelMatches(text) {
    const value = normalizeText(text).toLowerCase();
    return value.includes("friend activity") ||
      value.includes("friends activity") ||
      value.includes("listening activity");
  }

  function friendActivityRoots() {
    const roots = new Set();
    const selectors = [
      '[data-testid*="friend" i]',
      '[data-testid*="listening" i]',
      '[aria-label*="friend" i]',
      '[aria-label*="listening" i]',
      '[title*="friend" i]',
      '[title*="listening" i]',
      '[class*="friend" i]',
      '[class*="listening" i]',
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
        if (activityLabelMatches(node.textContent)) addAncestorRoots(roots, node, 9);
      });

    const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
    let textNode;
    let checked = 0;
    while ((textNode = walker.nextNode()) && checked < 10000) {
      checked += 1;
      const parent = textNode.parentElement;
      if (!parent || parent.id === STATUS_ID || parent.closest(`#${STATUS_ID}`)) continue;
      if (activityLabelMatches(textNode.nodeValue)) addAncestorRoots(roots, parent, 9);
    }

    return Array.from(roots);
  }

  function looksLikeActivityText(text) {
    const value = normalizeText(text);
    if (!value || value.length < 8 || value.length > 220) return false;
    if (/invite others to your jam|start a jam|listening activity/i.test(value)) return false;
    return /\b(?:\d+\s*(?:min|mins|minute|minutes|hr|hrs|hour|hours)|now)\b/i.test(value);
  }

  function textCandidateRows(roots) {
    const matches = [];
    for (const root of roots) {
      root.querySelectorAll("div, li, [role='listitem'], button").forEach((node) => {
        if (node.id === STATUS_ID || node.closest(`#${STATUS_ID}`)) return;
        const text = normalizeText(node.innerText || node.textContent);
        if (!looksLikeActivityText(text)) return;

        const hasSmallerMatch = Array.from(node.children || []).some((child) => {
          const childText = normalizeText(child.innerText || child.textContent);
          return looksLikeActivityText(childText);
        });
        if (!hasSmallerMatch) matches.push(node);
      });
    }
    return Array.from(new Set(matches));
  }

  function candidateRows(roots = friendActivityRoots()) {
    const linkedRows = [];
    for (const root of roots) {
      root.querySelectorAll("div, li, [role='listitem']").forEach((node) => {
        if (node.id === STATUS_ID || node.closest(`#${STATUS_ID}`)) return;
        const links = collectLinks(node);
        const kinds = new Set(links.map((l) => l.kind));
        if ((kinds.has("user") || node.getAttribute("role") === "listitem") && kinds.has("track")) {
          linkedRows.push(node);
        }
      });
    }

    const uniqueLinked = Array.from(new Set(linkedRows));
    return uniqueLinked.length ? uniqueLinked : textCandidateRows(roots);
  }

  function guessFriendName(rawText) {
    const beforeTime = rawText.split(/\b(?:\d+\s*(?:min|mins|minute|minutes|hr|hrs|hour|hours)|now)\b/i)[0];
    const name = normalizeText(beforeTime).replace(/[•·|]+$/g, "").trim();
    if (!name || name.length > 60) return null;
    return name;
  }

  function parseRow(row) {
    const links = collectLinks(row);
    const byKind = (kind) => links.find((l) => l.kind === kind) || null;
    const user = byKind("user");
    const track = byKind("track");
    const artist = byKind("artist");
    const playlist = byKind("playlist");
    const album = byKind("album");
    const rawText = normalizeText(row.innerText || row.textContent);

    if (track) {
      return {
        source: "spotify-listening-activity-dom-links",
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

    if (!looksLikeActivityText(rawText)) return null;
    return {
      source: "spotify-listening-activity-dom-text",
      observedAt: new Date().toISOString(),
      friend: { name: guessFriendName(rawText), href: null },
      track: null,
      artist: null,
      context: null,
      rawText,
    };
  }

  function dedupe(observations) {
    const byKey = new Map();

    for (const obs of observations) {
      const friendName = normalizeText(obs.friend?.name || "").toLowerCase();
      const linkedKey = obs.track?.href || obs.friend?.href;
      const key = linkedKey
        ? `linked:${linkedKey}`
        : friendName
          ? `friend:${friendName}`
          : `raw:${obs.rawText}`;

      const existing = byKey.get(key);
      if (!existing || (obs.rawText || "").length < (existing.rawText || "").length) {
        byKey.set(key, obs);
      }
    }

    return Array.from(byKey.values());
  }

  function visibleActivitySummary(obs) {
    const friendName = normalizeText(obs.friend?.name || "");
    let text = normalizeText(obs.rawText || "");

    if (friendName && text.toLowerCase().startsWith(friendName.toLowerCase())) {
      text = normalizeText(text.slice(friendName.length));
    }

    text = text.replace(/^\s*[•·|\-–—:]\s*/, "");
    text = text.replace(/\b(?:\d+\s*(?:min|mins|minute|minutes|hr|hrs|hour|hours)|now)\b\s*$/i, "").trim();

    if (obs.track?.name) {
      const pieces = [obs.track.name, obs.artist?.name].filter(Boolean);
      return pieces.join(" — ").slice(0, 110);
    }

    return text.slice(0, 110) || "activity text unavailable";
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
    badge.style.maxWidth = "620px";
    badge.style.whiteSpace = "normal";
    document.body.appendChild(badge);
    return badge;
  }

  function updateStatusBadge(panelFound, observations) {
    lastPanelFound = panelFound;
    lastCount = observations.length;
    const badge = ensureStatusBadge();
    if (!panelFound) {
      badge.textContent = "Track Mirror: loaded • Listening activity panel not found";
      return;
    }

    const details = observations.slice(0, 4).map((obs) => {
      const name = obs.friend?.name || "unknown";
      return `${name}: ${visibleActivitySummary(obs)}`;
    });

    const suffix = details.length ? ` • ${details.join(" | ")}` : "";
    badge.textContent = `Track Mirror: loaded • Listening activity panel found • friends: ${observations.length}${suffix}`;
  }

  function persist(observations) {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(observations));
    } catch (error) {
      console.warn(PREFIX, "Could not persist observations", error);
    }
  }

  function emit(observations) {
    const event = new CustomEvent("track-mirror:friend-activity", { detail: observations });
    window.dispatchEvent(event);
    log("Listening activity observations", observations);
  }

  function scan() {
    const roots = friendActivityRoots();
    const panelFound = roots.length > 0;
    const observations = dedupe(candidateRows(roots).map(parseRow).filter(Boolean));
    persist(observations);
    updateStatusBadge(panelFound, observations);
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

    log("Listening activity discovery adapter loaded");
    updateStatusBadge(false, []);
    scan();

    const observer = new MutationObserver(() => {
      if (!document.getElementById(STATUS_ID)) {
        ensureStatusBadge();
        updateStatusBadge(lastPanelFound, Array(lastCount).fill({}));
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
