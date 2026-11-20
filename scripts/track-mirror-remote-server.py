#!/usr/bin/env python3
"""Tiny LAN control bridge for the Track Mirror Spicetify proof of concept.

The phone UI talks to this server over the local network. The Spicetify
extension talks to it over loopback, so no Spotify credentials or audio ever
pass through the bridge.
"""

from __future__ import annotations

import argparse
import ipaddress
import re
import json
import os
import secrets
import threading
import time
from http import HTTPStatus
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
from urllib.parse import parse_qs, urlsplit

APP_NAME = "track-mirror"
DEFAULT_PORT = 8765
EVENT_TTL_MS = 90_000
TRACK_URI_PATTERN = re.compile(r"spotify:track:[A-Za-z0-9]{22}\Z")
SPOTIFY_ORIGINS = {
    "https://xpui.app.spotify.com",
    "https://open.spotify.com",
}

CONFIG_HOME = Path(os.environ.get("XDG_CONFIG_HOME", Path.home() / ".config"))
STATE_HOME = Path(os.environ.get("XDG_STATE_HOME", Path.home() / ".local" / "state"))
CONFIG_DIR = CONFIG_HOME / APP_NAME
STATE_DIR = STATE_HOME / APP_NAME
TOKEN_FILE = CONFIG_DIR / "remote-token"
PID_FILE = STATE_DIR / "remote-server.pid"
SCRIPT_DIR = Path(__file__).resolve().parent
INDEX_CANDIDATES = (
    SCRIPT_DIR / "remote-index.html",
    SCRIPT_DIR.parent / "remote" / "index.html",
)

LOCK = threading.Lock()
STATE = {
    "friends": [],
    "selected_friend": None,
    "enabled": False,
    "updated_at": None,
    "command_id": 0,
    "command": None,
    "event_sequence": 0,
    "event": None,
    "event_updated_at": None,
}


def load_or_create_token() -> str:
    CONFIG_DIR.mkdir(parents=True, exist_ok=True)
    if TOKEN_FILE.exists():
        token = TOKEN_FILE.read_text(encoding="utf-8").strip()
        if token:
            return token

    token = secrets.token_urlsafe(24)
    TOKEN_FILE.write_text(token + "\n", encoding="utf-8")
    os.chmod(TOKEN_FILE, 0o600)
    return token


def client_is_loopback(address: str) -> bool:
    try:
        return ipaddress.ip_address(address).is_loopback
    except ValueError:
        return address in {"localhost", "::1"}


def now_ms() -> int:
    return int(time.time() * 1000)


def normalize_event(payload: dict) -> dict:
    """Validate only the minimal version-1 metadata required for a follower.

    The desktop adapter sees an existing, user-visible Following row. This
    endpoint neither queries a Spotify API nor infers playback position.
    """
    if type(payload.get("version")) is not int or payload["version"] != 1:
        raise ValueError("unsupported event version")
    listener = payload.get("source_listener_id")
    if not isinstance(listener, str) or not listener.strip():
        raise ValueError("source_listener_id is required")
    listener = " ".join(listener.split())
    if len(listener) > 128:
        raise ValueError("source_listener_id is too long")
    uri = payload.get("track_uri")
    if not isinstance(uri, str) or not TRACK_URI_PATTERN.fullmatch(uri):
        raise ValueError("track_uri must be an exact spotify:track URI")
    if payload.get("is_playing") is not True:
        raise ValueError("only displayed listening events are supported; pauses cannot be inferred")
    observed = payload.get("observed_at")
    if not isinstance(observed, str) or not observed.strip() or len(observed) > 64:
        raise ValueError("observed_at is required")
    provenance = payload.get("provenance")
    if provenance != "spotify-client-visible-following":
        raise ValueError("event provenance is not an allowed visible activity source")
    return {
        "version": 1,
        "source_listener_id": listener,
        "track_uri": uri,
        "is_playing": True,
        "observed_at": observed,
        "position_ms": None,
        "track_title": None,
        "artists": [],
        "album": None,
        "provenance": provenance,
        "confidence": "exact-track-uri-visible-activity",
    }


def clear_latest_event() -> None:
    """Call with LOCK held. Clear old activity when selection or arming changes."""
    STATE["event_sequence"] = int(STATE["event_sequence"]) + 1
    STATE["event"] = None
    STATE["event_updated_at"] = None


class TrackMirrorHandler(BaseHTTPRequestHandler):
    server_version = "TrackMirrorRemote/0.1"

    def log_message(self, fmt: str, *args: object) -> None:
        if not getattr(self.server, "quiet", False):
            super().log_message(fmt, *args)

    @property
    def token(self) -> str:
        return self.server.track_mirror_token  # type: ignore[attr-defined]

    def _cors(self) -> None:
        origin = self.headers.get("Origin", "")
        if origin in SPOTIFY_ORIGINS:
            self.send_header("Access-Control-Allow-Origin", origin)
            self.send_header("Vary", "Origin")
            self.send_header("Access-Control-Allow-Private-Network", "true")
        self.send_header("Access-Control-Allow-Headers", "Content-Type, Authorization, X-Track-Mirror-Token")
        self.send_header("Access-Control-Allow-Methods", "GET, POST, OPTIONS")
        self.send_header("Cache-Control", "no-store")

    def _json(self, status: int, payload: object) -> None:
        body = json.dumps(payload, separators=(",", ":")).encode("utf-8")
        self.send_response(status)
        self.send_header("Content-Type", "application/json; charset=utf-8")
        self.send_header("Content-Length", str(len(body)))
        self._cors()
        self.end_headers()
        self.wfile.write(body)

    def _authorized(self, query: dict[str, list[str]] | None = None) -> bool:
        if client_is_loopback(self.client_address[0]):
            return True

        auth = self.headers.get("Authorization", "")
        if auth.startswith("Bearer ") and secrets.compare_digest(auth[7:].strip(), self.token):
            return True

        header_token = self.headers.get("X-Track-Mirror-Token", "").strip()
        if header_token and secrets.compare_digest(header_token, self.token):
            return True

        if query:
            query_token = (query.get("token") or [""])[0]
            if query_token and secrets.compare_digest(query_token, self.token):
                return True

        return False

    def _require_auth(self, query: dict[str, list[str]] | None = None) -> bool:
        if self._authorized(query):
            return True
        self._json(HTTPStatus.UNAUTHORIZED, {"error": "pairing token required"})
        return False

    def _require_spotify_loopback(self) -> bool:
        if not client_is_loopback(self.client_address[0]):
            self._json(HTTPStatus.FORBIDDEN, {"error": "desktop bridge endpoint is loopback-only"})
            return False
        origin = self.headers.get("Origin", "")
        if origin and origin not in SPOTIFY_ORIGINS:
            self._json(HTTPStatus.FORBIDDEN, {"error": "desktop bridge origin is not allowed"})
            return False
        return True

    def _read_json(self) -> dict:
        length = int(self.headers.get("Content-Length", "0") or "0")
        if length <= 0:
            return {}
        if length > 64 * 1024:
            raise ValueError("request too large")
        raw = self.rfile.read(length)
        value = json.loads(raw.decode("utf-8"))
        if not isinstance(value, dict):
            raise ValueError("JSON body must be an object")
        return value

    def do_OPTIONS(self) -> None:  # noqa: N802
        origin = self.headers.get("Origin", "")
        if origin and origin not in SPOTIFY_ORIGINS:
            self.send_response(HTTPStatus.FORBIDDEN)
            self.end_headers()
            return
        self.send_response(HTTPStatus.NO_CONTENT)
        self._cors()
        self.end_headers()

    def do_GET(self) -> None:  # noqa: N802
        parsed = urlsplit(self.path)
        query = parse_qs(parsed.query)

        if parsed.path == "/api/health":
            self._json(HTTPStatus.OK, {"ok": True, "service": "track-mirror-remote"})
            return

        if parsed.path == "/":
            index_file = next((path for path in INDEX_CANDIDATES if path.exists()), None)
            if index_file is None:
                self._json(HTTPStatus.INTERNAL_SERVER_ERROR, {"error": "remote UI is missing"})
                return
            body = index_file.read_bytes()
            self.send_response(HTTPStatus.OK)
            self.send_header("Content-Type", "text/html; charset=utf-8")
            self.send_header("Content-Length", str(len(body)))
            self._cors()
            self.end_headers()
            self.wfile.write(body)
            return

        if parsed.path == "/api/state":
            if not self._require_auth(query):
                return
            with LOCK:
                payload = dict(STATE)
                payload.pop("command", None)
                payload.pop("event", None)
            self._json(HTTPStatus.OK, payload)
            return

        if parsed.path == "/api/event":
            if not self._require_auth(query):
                return
            try:
                after = int((query.get("after") or ["0"])[0])
            except ValueError:
                after = 0
            with LOCK:
                seq = int(STATE["event_sequence"])
                age = now_ms() - int(STATE["event_updated_at"] or 0)
                current = STATE["event"]
                event = (
                    dict(current)
                    if (STATE["enabled"] and current and seq > after
                        and 0 <= age < EVENT_TTL_MS)
                    else None
                )
            self._json(HTTPStatus.OK, {"sequence": seq, "event": event})
            return

        if parsed.path == "/api/command":
            if not self._require_spotify_loopback():
                return
            try:
                after = int((query.get("after") or ["0"])[0])
            except ValueError:
                after = 0
            with LOCK:
                command_id = int(STATE["command_id"])
                command = STATE["command"] if command_id > after else None
            self._json(HTTPStatus.OK, {"command_id": command_id, "command": command})
            return

        self._json(HTTPStatus.NOT_FOUND, {"error": "not found"})

    def do_POST(self) -> None:  # noqa: N802
        parsed = urlsplit(self.path)
        query = parse_qs(parsed.query)

        try:
            payload = self._read_json()
        except (ValueError, json.JSONDecodeError) as exc:
            self._json(HTTPStatus.BAD_REQUEST, {"error": str(exc)})
            return

        if parsed.path == "/api/event":
            if not self._require_spotify_loopback():
                return
            try:
                event = normalize_event(payload)
            except ValueError as exc:
                self._json(HTTPStatus.BAD_REQUEST, {"error": str(exc)})
                return
            with LOCK:
                not_following = (
                    not STATE["enabled"]
                    or event["source_listener_id"].casefold() != str(STATE["selected_friend"] or "").casefold()
                )
                if not_following:
                    seq = None
                else:
                    STATE["event_sequence"] = int(STATE["event_sequence"]) + 1
                    seq = int(STATE["event_sequence"])
                    event["sequence"] = seq
                    STATE["event"] = event
                    STATE["event_updated_at"] = now_ms()
            if seq is None:
                self._json(HTTPStatus.CONFLICT, {"error": "listener is not currently followed"})
                return
            self._json(HTTPStatus.OK, {"ok": True, "sequence": seq})
            return

        if parsed.path == "/api/state":
            if not self._require_spotify_loopback():
                return

            friends = payload.get("friends", [])
            selected = payload.get("selected_friend")
            enabled = bool(payload.get("enabled", False))
            if not isinstance(friends, list) or not all(isinstance(item, str) for item in friends):
                self._json(HTTPStatus.BAD_REQUEST, {"error": "friends must be an array of strings"})
                return
            if selected is not None and not isinstance(selected, str):
                self._json(HTTPStatus.BAD_REQUEST, {"error": "selected_friend must be a string or null"})
                return

            normalized_friends = []
            seen = set()
            for item in friends:
                name = " ".join(item.split()).strip()
                key = name.casefold()
                if name and key not in seen:
                    seen.add(key)
                    normalized_friends.append(name)

            with LOCK:
                new_selected = selected.strip() if isinstance(selected, str) and selected.strip() else None
                if not enabled or not STATE["enabled"] or new_selected != STATE["selected_friend"]:
                    if STATE["event"] is not None:
                        clear_latest_event()
                STATE["friends"] = normalized_friends
                STATE["selected_friend"] = new_selected
                STATE["enabled"] = enabled
                STATE["updated_at"] = now_ms()
            self._json(HTTPStatus.OK, {"ok": True})
            return

        if parsed.path == "/api/follow":
            if not self._require_auth(query):
                return
            friend = payload.get("friend")
            if not isinstance(friend, str) or not friend.strip():
                self._json(HTTPStatus.BAD_REQUEST, {"error": "friend is required"})
                return
            friend = " ".join(friend.split()).strip()
            with LOCK:
                STATE["command_id"] = int(STATE["command_id"]) + 1
                STATE["command"] = {"type": "follow", "friend": friend}
                clear_latest_event()
                STATE["selected_friend"] = friend
                STATE["enabled"] = True
                STATE["updated_at"] = now_ms()
                command_id = STATE["command_id"]
            self._json(HTTPStatus.OK, {"ok": True, "command_id": command_id})
            return

        if parsed.path == "/api/stop":
            if not self._require_auth(query):
                return
            with LOCK:
                STATE["command_id"] = int(STATE["command_id"]) + 1
                STATE["command"] = {"type": "stop"}
                clear_latest_event()
                STATE["enabled"] = False
                STATE["updated_at"] = now_ms()
                command_id = STATE["command_id"]
            self._json(HTTPStatus.OK, {"ok": True, "command_id": command_id})
            return

        self._json(HTTPStatus.NOT_FOUND, {"error": "not found"})


def main() -> int:
    parser = argparse.ArgumentParser(description="Track Mirror local-network remote control bridge")
    parser.add_argument("--host", default="0.0.0.0")
    parser.add_argument("--port", type=int, default=DEFAULT_PORT)
    parser.add_argument("--quiet", action="store_true")
    args = parser.parse_args()

    token = load_or_create_token()
    STATE_DIR.mkdir(parents=True, exist_ok=True)
    PID_FILE.write_text(f"{os.getpid()}\n", encoding="utf-8")

    server = ThreadingHTTPServer((args.host, args.port), TrackMirrorHandler)
    server.track_mirror_token = token  # type: ignore[attr-defined]
    server.quiet = args.quiet  # type: ignore[attr-defined]

    print(f"Track Mirror remote control listening on {args.host}:{args.port}", flush=True)
    print(f"Pairing token: {token}", flush=True)

    try:
        server.serve_forever(poll_interval=0.5)
    except KeyboardInterrupt:
        pass
    finally:
        server.server_close()
        try:
            if PID_FILE.read_text(encoding="utf-8").strip() == str(os.getpid()):
                PID_FILE.unlink()
        except OSError:
            pass
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
