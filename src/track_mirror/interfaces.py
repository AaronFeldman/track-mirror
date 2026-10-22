from __future__ import annotations

from typing import Protocol

from .models import PlaybackState


class SourceAdapter(Protocol):
    """Reads playback state from a selected source listener."""

    def read_state(self) -> PlaybackState | None:
        ...


class PlaybackAdapter(Protocol):
    """Controls the follower's own Spotify client."""

    def play_track(self, track_uri: str, position_ms: int | None = None) -> None:
        ...

    def pause(self) -> None:
        ...

    def resume(self) -> None:
        ...

    def seek(self, position_ms: int) -> None:
        ...
