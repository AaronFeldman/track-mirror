import Foundation

/// iOS/iPadOS representation of mobile/PROTOCOL.md version 1.
struct MirrorEvent: Codable, Equatable {
    let version: Int
    let sourceListenerID: String
    let trackURI: String
    let trackTitle: String?
    let artists: [String]
    let album: String?
    let isPlaying: Bool
    let positionMS: Int64?
    let observedAt: String
    let sequence: Int64?
    let provenance: String?
    let confidence: String?

    enum CodingKeys: String, CodingKey {
        case version
        case sourceListenerID = "source_listener_id"
        case trackURI = "track_uri"
        case trackTitle = "track_title"
        case artists
        case album
        case isPlaying = "is_playing"
        case positionMS = "position_ms"
        case observedAt = "observed_at"
        case sequence
        case provenance
        case confidence
    }

    var hasPlayableTrackURI: Bool {
        trackURI.hasPrefix("spotify:track:")
    }
}
