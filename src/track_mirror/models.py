from __future__ import annotations

from dataclasses import dataclass
from datetime import datetime


@dataclass(frozen=True, slots=True)
class PlaybackState:
    """Normalized playback state observed from a source listener."""

    source_listener: str
    track_id: str | None
    track_uri: str | None
    title: str
    artists: tuple[str, ...]
    album: str | None
    position_ms: int | None
    is_playing: bool
    observed_at: datetime
    provenance: str
    confidence: float = 1.0
