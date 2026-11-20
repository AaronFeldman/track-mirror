"""HTTP-level tests of the existing desktop-to-phone control and metadata bridge."""

import importlib.util
import json
import threading
import unittest
from http.server import ThreadingHTTPServer
from pathlib import Path
from unittest.mock import patch
from urllib.error import HTTPError
from urllib.request import Request, urlopen

SCRIPT = Path(__file__).resolve().parents[1] / "scripts" / "track-mirror-remote-server.py"
SPEC = importlib.util.spec_from_file_location("track_mirror_remote_server", SCRIPT)
mod = importlib.util.module_from_spec(SPEC)
SPEC.loader.exec_module(mod)

TRACK1 = "spotify:track:0123456789ABCDEFGHIJKL"
TRACK2 = "spotify:track:123456789ABCDEFGHIJKLM"


def fixture(listener="Amanda", uri=TRACK1):
    return {
        "version": 1,
        "source_listener_id": listener,
        "track_uri": uri,
        "is_playing": True,
        "observed_at": "2026-11-19T20:00:00Z",
        "provenance": "spotify-client-visible-following",
    }


class EventBridgeTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.server = ThreadingHTTPServer(("127.0.0.1", 0), mod.TrackMirrorHandler)
        cls.server.track_mirror_token = "test-pairing-secret"
        cls.server.quiet = True
        cls.base = "http://127.0.0.1:" + str(cls.server.server_port)
        cls.thread = threading.Thread(target=cls.server.serve_forever, daemon=True)
        cls.thread.start()

    @classmethod
    def tearDownClass(cls):
        cls.server.shutdown()
        cls.server.server_close()
        cls.thread.join(timeout=2)

    def setUp(self):
        with mod.LOCK:
            mod.STATE.update(
                friends=[],
                selected_friend=None,
                enabled=False,
                updated_at=None,
                command_id=0,
                command=None,
                event_sequence=0,
                event=None,
                event_updated_at=None,
            )

    def api(self, method, path, value=None, token=None):
        headers = {}
        data = None
        if value is not None:
            data = json.dumps(value).encode()
            headers["Content-Type"] = "application/json"
        if token is not None:
            headers["X-Track-Mirror-Token"] = token
        req = Request(self.base + path, data=data, headers=headers, method=method)
        try:
            with urlopen(req, timeout=2) as response:
                return response.status, json.loads(response.read())
        except HTTPError as exc:
            return exc.code, json.loads(exc.read())

    def set_following(self, listener="Amanda"):
        status, _ = self.api(
            "POST",
            "/api/state",
            dict(friends=["Amanda", "Solomon"], selected_friend=listener, enabled=True),
        )
        self.assertEqual(status, 200)

    def test_followed_track_is_published_as_portable_mirror_event(self):
        self.set_following()
        status, receipt = self.api("POST", "/api/event", fixture())
        self.assertEqual(status, 200)
        self.assertEqual(receipt["sequence"], 1)
        status, message = self.api("GET", "/api/event?after=0")
        self.assertEqual(status, 200)
        event = message["event"]
        self.assertEqual(event["track_uri"], TRACK1)
        self.assertEqual(event["source_listener_id"], "Amanda")
        self.assertEqual(event["version"], 1)
        self.assertTrue(event["is_playing"])
        self.assertIsNone(event["position_ms"])
        self.assertEqual(event["sequence"], 1)
        self.assertEqual(event["confidence"], "exact-track-uri-visible-activity")

        status, nothing = self.api("GET", "/api/event?after=1")
        self.assertEqual(status, 200)
        self.assertIsNone(nothing["event"])

        status, state = self.api("GET", "/api/state")
        self.assertEqual(status, 200)
        self.assertNotIn("event", state)

    def test_stopping_discards_activity_and_rejects_future_events(self):
        self.set_following()
        self.api("POST", "/api/event", fixture())
        status, _ = self.api("POST", "/api/stop", {})
        self.assertEqual(status, 200)
        status, result = self.api("GET", "/api/event?after=0")
        self.assertEqual(status, 200)
        self.assertIsNone(result["event"])
        status, _ = self.api("POST", "/api/event", fixture())
        self.assertEqual(status, 409)

    def test_switching_listener_prevents_leaking_previous_friend_activity(self):
        self.set_following()
        self.api("POST", "/api/event", fixture())
        status, _ = self.api("POST", "/api/follow", {"friend": "Solomon"})
        self.assertEqual(status, 200)
        self.assertIsNone(self.api("GET", "/api/event?after=0")[1]["event"])
        self.assertEqual(self.api("POST", "/api/event", fixture())[0], 409)
        self.assertEqual(
            self.api("POST", "/api/event", fixture("Solomon", TRACK2))[0], 200
        )
        latest = self.api("GET", "/api/event?after=0")[1]["event"]
        self.assertEqual(latest["source_listener_id"], "Solomon")
        self.assertEqual(latest["track_uri"], TRACK2)

    def test_unsupported_entity_and_unverified_pause_are_not_transmitted(self):
        self.set_following()
        self.assertEqual(
            self.api("POST", "/api/event", fixture(uri="spotify:episode:abcd"))[0], 400
        )
        fake_pause = fixture()
        fake_pause["is_playing"] = False
        self.assertEqual(self.api("POST", "/api/event", fake_pause)[0], 400)
        self.assertIsNone(self.api("GET", "/api/event?after=0")[1]["event"])

    def test_stale_activity_expires_instead_of_being_replayed(self):
        self.set_following()
        self.api("POST", "/api/event", fixture())
        with mod.LOCK:
            mod.STATE["event_updated_at"] = mod.now_ms() - mod.EVENT_TTL_MS - 1
        self.assertIsNone(self.api("GET", "/api/event?after=0")[1]["event"])

    def test_remote_read_requires_pairing_token(self):
        self.set_following()
        self.api("POST", "/api/event", fixture())
        # Server socket is loopback in tests; simulate a non-loopback peer
        # while checking authentication on the same wire endpoint.
        with patch.object(mod, "client_is_loopback", return_value=False):
            self.assertEqual(self.api("GET", "/api/event")[0], 401)
            status, reply = self.api(
                "GET", "/api/event", token="test-pairing-secret"
            )
            self.assertEqual(status, 200)
            self.assertEqual(reply["event"]["track_uri"], TRACK1)
            self.assertEqual(self.api("POST", "/api/event", fixture())[0], 403)


if __name__ == "__main__":
    unittest.main()
