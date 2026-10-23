use serde::{Deserialize, Serialize};
use std::error::Error;
use std::fmt::{Display, Formatter};

pub const PROTOCOL_VERSION: u16 = 1;

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
pub struct MirrorEvent {
    pub version: u16,
    pub source_listener_id: String,
    pub track_uri: String,
    pub track_title: Option<String>,
    #[serde(default)]
    pub artists: Vec<String>,
    pub album: Option<String>,
    pub is_playing: bool,
    pub position_ms: Option<u64>,
    pub observed_at: String,
    pub sequence: Option<u64>,
    pub provenance: Option<String>,
    pub confidence: Option<String>,
}

impl MirrorEvent {
    pub fn validate(&self) -> Result<(), MirrorEventError> {
        if self.version != PROTOCOL_VERSION {
            return Err(MirrorEventError::UnsupportedVersion(self.version));
        }
        if self.source_listener_id.trim().is_empty() {
            return Err(MirrorEventError::EmptySourceListener);
        }
        if self.observed_at.trim().is_empty() {
            return Err(MirrorEventError::MissingObservationTime);
        }
        if !self.track_uri.starts_with("spotify:track:")
            || self.track_uri.trim_start_matches("spotify:track:").is_empty()
        {
            return Err(MirrorEventError::InvalidTrackUri(self.track_uri.clone()));
        }
        Ok(())
    }
}

#[derive(Debug, Clone, PartialEq, Eq)]
pub enum MirrorEventError {
    UnsupportedVersion(u16),
    EmptySourceListener,
    MissingObservationTime,
    InvalidTrackUri(String),
}

impl Display for MirrorEventError {
    fn fmt(&self, f: &mut Formatter<'_>) -> std::fmt::Result {
        match self {
            Self::UnsupportedVersion(version) => {
                write!(f, "unsupported Track Mirror protocol version: {version}")
            }
            Self::EmptySourceListener => write!(f, "source listener id is empty"),
            Self::MissingObservationTime => write!(f, "observation time is missing"),
            Self::InvalidTrackUri(uri) => write!(f, "invalid Spotify track URI: {uri}"),
        }
    }
}

impl Error for MirrorEventError {}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]\#[serde(tag = "type", rename_all = "snake_case")]
pub enum MirrorAction {
    Ignored { reason: String },
    Baseline { track_uri: String },
    PlayTrack { track_uri: String },
    Pause { track_uri: String },
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
pub struct EngineStatus {
    pub selected_listener_id: Option<String>,
    pub armed: bool,
    pub last_track_uri: Option<String>,
    pub last_is_playing: Option<bool>,
    pub last_sequence: Option<u64>,
}

#[derive(Debug, Clone, Default)]
pub struct MirrorEngine {
    selected_listener_id: Option<String>,
    armed: bool,
    last_track_uri: Option<String>,
    last_is_playing: Option<bool>,
    last_sequence: Option<u64>,
}

impl MirrorEngine {
    pub fn select_listener(&mut self, listener_id: impl Into<String>) {
        self.selected_listener_id = Some(listener_id.into());
        self.reset_observation();
    }

    pub fn arm(&mut self) {
        self.armed = true;
        self.reset_observation();
    }

    pub fn disarm(&mut self) {
        self.armed = false;
        self.reset_observation();
    }

    pub fn status(&self) -> EngineStatus {
        EngineStatus {
            selected_listener_id: self.selected_listener_id.clone(),
            armed: self.armed,
            last_track_uri: self.last_track_uri.clone(),
            last_is_playing: self.last_is_playing,
            last_sequence: self.last_sequence,
        }
    }

    pub fn process_event(&mut self, event: &MirrorEvent) -> Result<MirrorAction, MirrorEventError> {
        event.validate()?;

        if !self.armed {
            return Ok(MirrorAction::Ignored {
                reason: "mirroring is disarmed".into(),
            });
        }

        let Some(selected_listener) = self.selected_listener_id.as_deref() else {
            return Ok(MirrorAction::Ignored {
                reason: "no source listener selected".into(),
            });
        };

        if event.source_listener_id != selected_listener {
            return Ok(MirrorAction::Ignored {
                reason: "event belongs to a different source listener".into(),
            });
        }

        if let (Some(incoming), Some(previous)) = (event.sequence, self.last_sequence) {
            if incoming <= previous {
                return Ok(MirrorAction::Ignored {
                    reason: "duplicate or out-of-order sequence".into(),
                });
            }
        }

        let Some(previous_uri) = self.last_track_uri.as_deref() else {
            self.record(event);
            return Ok(MirrorAction::Baseline {
                track_uri: event.track_uri.clone(),
            });
        };

        let track_changed = previous_uri != event.track_uri;
        let playback_changed = self.last_is_playing != Some(event.is_playing);

        let action = if track_changed && event.is_playing {
            MirrorAction::PlayTrack {
                track_uri: event.track_uri.clone(),
            }
        } else if !track_changed && playback_changed && !event.is_playing {
            MirrorAction::Pause {
                track_uri: event.track_uri.clone(),
            }
        } else if !track_changed && playback_changed && event.is_playing {
            // Play the exact URI rather than issuing a blind resume. The follower may not
            // currently have the source track loaded, especially after a paused track change.
            MirrorAction::PlayTrack {
                track_uri: event.track_uri.clone(),
            }
        } else {
            MirrorAction::Ignored {
                reason: if track_changed {
                    "source changed tracks while paused"
                } else {
                    "no actionable playback change"
                }
                .into(),
            }
        };

        self.record(event);
        Ok(action)
    }

    fn record(&mut self, event: &MirrorEvent) {
        self.last_track_uri = Some(event.track_uri.clone());
        self.last_is_playing = Some(event.is_playing);
        self.last_sequence = event.sequence;
    }

    fn reset_observation(&mut self) {
        self.last_track_uri = None;
        self.last_is_playing = None;
        self.last_sequence = None;
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    fn event(listener: &str, uri: &str, playing: bool, sequence: u64) -> MirrorEvent {
        MirrorEvent {
            version: PROTOCOL_VERSION,
            source_listener_id: listener.into(),
            track_uri: uri.into(),
            track_title: None,
            artists: Vec::new(),
            album: None,
            is_playing: playing,
            position_ms: None,
            observed_at: "2026-10-23T10:00:00Z".into(),
            sequence: Some(sequence),
            provenance: Some("manual-test".into()),
            confidence: Some("exact-uri".into()),
        }
    }

    #[test]
    fn first_event_after_arming_is_only_a_baseline() {
        let mut engine = MirrorEngine::default();
        engine.select_listener("amanda");
        engine.arm();

        let action = engine
            .process_event(&event("amanda", "spotify:track:first", true, 1))
            .unwrap();

        assert_eq!(
            action,
            MirrorAction::Baseline {
                track_uri: "spotify:track:first".into()
            }
        );
    }

    #[test]
    fn next_track_change_plays_the_exact_uri() {
        let mut engine = MirrorEngine::default();
        engine.select_listener("amanda");
        engine.arm();
        engine
            .process_event(&event("amanda", "spotify:track:first", true, 1))
            .unwrap();

        let action = engine
            .process_event(&event("amanda", "spotify:track:second", true, 2))
            .unwrap();

        assert_eq!(
            action,
            MirrorAction::PlayTrack {
                track_uri: "spotify:track:second".into()
            }
        );
    }

    #[test]
    fn duplicate_or_out_of_order_events_do_not_restart_playback() {
        let mut engine = MirrorEngine::default();
        engine.select_listener("amanda");
        engine.arm();
        engine
            .process_event(&event("amanda", "spotify:track:first", true, 10))
            .unwrap();

        let action = engine
            .process_event(&event("amanda", "spotify:track:second", true, 9))
            .unwrap();

        assert!(matches!(action, MirrorAction::Ignored { .. }));
        assert_eq!(engine.status().last_track_uri.as_deref(), Some("spotify:track:first"));
    }

    #[test]
    fn events_for_other_listeners_are_ignored() {
        let mut engine = MirrorEngine::default();
        engine.select_listener("amanda");
        engine.arm();

        let action = engine
            .process_event(&event("solomon20000000", "spotify:track:other", true, 1))
            .unwrap();

        assert!(matches!(action, MirrorAction::Ignored { .. }));
        assert!(engine.status().last_track_uri.is_none());
    }

    #[test]
    fn pause_transition_produces_pause_action() {
        let mut engine = MirrorEngine::default();
        engine.select_listener("amanda");
        engine.arm();
        engine
            .process_event(&event("amanda", "spotify:track:first", true, 1))
            .unwrap();

        let action = engine
            .process_event(&event("amanda", "spotify:track:first", false, 2))
            .unwrap();

        assert_eq!(
            action,
            MirrorAction::Pause {
                track_uri: "spotify:track:first".into()
            }
        );
    }

    #[test]
    fn rearming_requires_a_fresh_baseline() {
        let mut engine = MirrorEngine::default();
        engine.select_listener("amanda");
        engine.arm();
        engine
            .process_event(&event("amanda", "spotify:track:first", true, 1))
            .unwrap();
        engine.disarm();
        engine.arm();

        let action = engine
            .process_event(&event("amanda", "spotify:track:second", true, 2))
            .unwrap();

        assert!(matches!(action, MirrorAction::Baseline { .. }));
    }
}
