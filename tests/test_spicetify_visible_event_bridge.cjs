"use strict";

// Model the non-invasive desktop bridge without a running Spotify client.
const assert = require("node:assert/strict");
const fs = require("node:fs");
const vm = require("node:vm");
const path = require("node:path");

const source = fs.readFileSync(
  path.join(__dirname, "..", "spicetify", "track-mirror-remote-bridge.js"),
  "utf8",
);
const first = "spotify:track:0123456789ABCDEFGHIJKL";
const second = "spotify:track:123456789ABCDEFGHIJKLM";
const calls = [];
const handlers = new Map();
const intervals = [];
const playback = { enabled: true, selectedFriend: "Amanda" };
const fakeWindow = {
  TrackMirrorPlayback: playback,
  TrackMirrorDomUriProbe: { lastResults: [{ friend: "Amanda", uri: first }] },
  addEventListener: (event, handler) => handlers.set(event, handler),
};
const fakeFetch = async (url, opts = {}) => {
  calls.push({ url: String(url), opts });
  return { ok: true, json: async () => ({ command_id: 0, command: null }) };
};
vm.runInNewContext(source, {
  window: fakeWindow,
  fetch: fakeFetch,
  setTimeout: () => { throw new Error("unavailable extension dependencies"); },
  setInterval: (callback) => { intervals.push(callback); return intervals.length; },
  console: { log() {}, warn() {} },
  Date,
  JSON,
  Set,
});
const flush = () => new Promise((resolve) => setImmediate(resolve));
const events = () => calls.filter((call) => call.url.endsWith("/api/event"))
  .map((call) => JSON.parse(call.opts.body));

(async () => {
  await flush();
  await flush();
  assert.equal(intervals.length, 2);
  assert.equal(events().length, 1);
  assert.equal(events()[0].source_listener_id, "Amanda");
  assert.equal(events()[0].track_uri, first);
  assert.equal(events()[0].provenance, "spotify-client-visible-following");

  handlers.get("track-mirror:dom-uri-results")();
  await flush();
  assert.equal(events().length, 1, "same visible track must be deduplicated");

  fakeWindow.TrackMirrorDomUriProbe.lastResults = [
    { friend: "Amanda", uri: second },
  ];
  handlers.get("track-mirror:dom-uri-results")();
  await flush();
  assert.equal(events().length, 2);
  assert.equal(events()[1].track_uri, second);

  playback.enabled = false;
  fakeWindow.TrackMirrorDomUriProbe.lastResults = [
    { friend: "Amanda", uri: first },
  ];
  handlers.get("track-mirror:dom-uri-results")();
  await flush();
  assert.equal(events().length, 2, "OFF must not publish activity");

  playback.enabled = true;
  playback.selectedFriend = "Solomon";
  fakeWindow.TrackMirrorDomUriProbe.lastResults = [
    { friend: "Amanda", uri: first },
    { friend: "Solomon", uri: first },
  ];
  handlers.get("track-mirror:dom-uri-results")();
  await flush();
  assert.equal(events().length, 3);
  assert.equal(events()[2].source_listener_id, "Solomon");

  fakeWindow.TrackMirrorDomUriProbe.lastResults = [
    { friend: "Solomon", uri: "spotify:episode:0123456789ABCDEFGHIJKL" },
  ];
  handlers.get("track-mirror:dom-uri-results")();
  await flush();
  assert.equal(events().length, 3, "non-track entity must not be forwarded");

  console.log("Desktop visibility bridge mock tests passed");
})().catch((error) => { console.error(error); process.exitCode = 1; });
