//! Adapter-neutral normalization of a listener's already-visible shared activity.
//!
//! This module intentionally knows nothing about Spotify authentication, SDKs,
//! private endpoints, Spicetify, Tauri, or platform-specific playback.

use serde::{Deserialize, Serialize};

use crate::{MirrorEvent, MirrorEventError, PROTOCOL_VERSION};

/// One observation made by a source adapter that is already permitted to see
/// this listener's activity. The observer supplies its *own observation time*.
#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
pub struct VisibleActivity {
    pub listener_id: String,
    pub entity_uri: String,
    /// True when the source adapter observed a displayed listening item.
    /// This is not a guarantee that a remote Spotify player is still active.
    pub displayed_as_listening: bool,
    pub observed_at: String,
    pub sequence: Option<u64>,
    pub provenance: String,
}

/// Normalize visible listening activity without querying any Spotify service.
///
/// Other kinds of entities (episodes, albums, missing URIs) cannot be played
/// through the Track Mirror version 1 track-only protocol and are skipped.
/// No pause transition is inferred from a row merely disappearing.
pub fn normalize_visible_activity(
    source: VisibleActivity,
) -> Result<Option<MirrorEvent>, MirrorEventError> {
    if source.listener_id.trim().is_empty() {
        return Err(MirrorEventError::EmptySourceListener);
    }
    if source.observed_at.trim().is_empty() {
        return Err(MirrorEventError::MissingObservationTime);
    }
    // A missing or non-track URI is not a playable track observation.
    if !source.entity_uri.starts_with("spotify:track:") {
        return Ok(None);
    }
    let id = source.entity_uri.trim_start_matches("spotify:track:");
    if id.len() != 22 || !id.bytes().all(|b| b.is_ascii_alphanumeric()) {
        return Err(MirrorEventError::InvalidTrackUri(source.entity_uri));
    }
    if !source.displayed_as_listening {
        // The UI no longer presenting a row is not proof the source pressed pause.
        return Ok(None);
    }

    let event = MirrorEvent {
        version: PROTOCOL_VERSION,
        source_listener_id: source.listener_id.trim().to_owned(),
        track_uri: source.entity_uri,
        track_title: None,
        artists: Vec::new(),
        album: None,
        is_playing: true,
        position_ms: None,
        observed_at: source.observed_at,
        sequence: source.sequence,
        provenance: Some(source.provenance),
        confidence: Some("exact-track-uri-visible-activity".to_owned()),
    };
    event.validate()?;
    Ok(Some(event))
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::{MirrorAction, MirrorEngine};

    const FIRST: &str = "spotify:track:0123456789ABCDEFGHIJKL";
    const SECOND: &str = "spotify:track:123456789ABCDEFGHIJKLM";

    fn visible(uri: &str, sequence: u64) -> VisibleActivity {
        VisibleActivity {
            listener_id: "amanda".to_owned(),
            entity_uri: uri.to_owned(),
            displayed_as_listening: true,
            observed_at: "2026-11-19T20:00:00Z".to_owned(),
            sequence: Some(sequence),
            provenance: "spotify-client-visible-following".to_owned(),
        }
    }

    #[test]
    fn recognized_track_populates_existing_portable_event() {
        let event = normalize_visible_activity(visible(FIRST, 1)).unwrap().unwrap();
        assert_eq!(event.version, PROTOCOL_VERSION);
        assert_eq!(event.track_uri, FIRST);
        assert_eq!(event.source_listener_id, "amanda");
        assert_eq!(event.position_ms, None);
        assert_eq!(event.confidence.as_deref(), Some("exact-track-uri-visible-activity"));
        assert_eq!(event.provenance.as_deref(), Some("spotify-client-visible-following"));
    }

    #[test]
    fn do_not_fabricate_track_or_pause_from_missing_activity() {
        assert!(normalize_visible_activity(visible("", 1)).unwrap().is_none());
        assert!(normalize_visible_activity(visible("spotify:episode:some-episode", 2)).unwrap().is_none());
        let mut absent = visible(FIRST, 3);
        absent.displayed_as_listening = false;
        assert!(normalize_visible_activity(absent).unwrap().is_none());
    }

    #[test]
    fn reject_invalid_track_identifiers() {
        assert!(matches!(
            normalize_visible_activity(visible("spotify:track:!", 1)),
            Err(MirrorEventError::InvalidTrackUri(_))
        ));
    }

    #[test]
    fn normalized_events_preserve_baseline_and_next_track_semantics() {
        let mut engine = MirrorEngine::default();
        engine.select_listener("amanda");
        engine.arm();
        let first = normalize_visible_activity(visible(FIRST, 1)).unwrap().unwrap();
        assert!(matches!(engine.process_event(&first).unwrap(), MirrorAction::Baseline { .. }));
        let second = normalize_visible_activity(visible(SECOND, 2)).unwrap().unwrap();
        assert_eq!(
            engine.process_event(&second).unwrap(),
            MirrorAction::PlayTrack { track_uri: SECOND.to_owned() }
        );
        assert!(matches!(engine.process_event(&second).unwrap(), MirrorAction::Ignored { .. }));
    }
}
