import Foundation
import SpotifyiOS

/// Thin Track Mirror adapter around Spotify App Remote.
/// Track Mirror supplies track identity/state only; Spotify's own iOS app
/// performs playback.
final class SpotifyPlaybackAdapter: NSObject {
    private let configuration: SPTConfiguration
    private(set) var appRemote: SPTAppRemote
    private var lastPlayedTrackURI: String?
    private var pendingInitialEvent: MirrorEvent?

    var onConnected: (() -> Void)?
    var onDisconnected: ((Error?) -> Void)?
    var onError: ((Error) -> Void)?

    init(clientID: String, redirectURL: URL) {
        configuration = SPTConfiguration(clientID: clientID, redirectURL: redirectURL)
        appRemote = SPTAppRemote(configuration: configuration, logLevel: .debug)
        super.init()
        appRemote.delegate = self
    }

    /// Call this from the app/scene URL callback after Spotify returns to
    /// Track Mirror from authorization.
    @discardableResult
    func handleAuthorizationCallback(_ url: URL) -> Bool {
        guard let parameters = appRemote.authorizationParameters(from: url) else {
            return false
        }

        if let accessToken = parameters[SPTAppRemoteAccessTokenKey] {
            appRemote.connectionParameters.accessToken = accessToken
            appRemote.connect()
            return true
        }

        return false
    }

    /// Start or wake the Spotify authorization/App Remote flow using the
    /// first actual mirrored track. This avoids waking Spotify with an
    /// unrelated placeholder track.
    func authorizeAndApply(_ event: MirrorEvent) {
        guard event.isPlaying, event.hasPlayableTrackURI else { return }

        if appRemote.isConnected {
            _ = apply(event)
            return
        }

        pendingInitialEvent = event
        appRemote.authorizeAndPlayURI(event.trackURI) { [weak self] spotifyInstalled in
            guard let self else { return }
            if !spotifyInstalled {
                let error = NSError(
                    domain: "TrackMirror.SpotifyPlaybackAdapter",
                    code: 1,
                    userInfo: [NSLocalizedDescriptionKey: "Spotify is not installed on this device."]
                )
                self.onError?(error)
            }
        }
    }

    /// Apply a newly observed exact track URI to an already connected
    /// Spotify App Remote session. Version 1 deliberately ignores pause,
    /// seek and drift fields until the mobile playback path is validated.
    @discardableResult
    func apply(_ event: MirrorEvent) -> Bool {
        guard event.isPlaying else { return false }
        guard event.hasPlayableTrackURI else { return false }
        guard event.trackURI != lastPlayedTrackURI else { return false }
        guard appRemote.isConnected else { return false }

        appRemote.playerAPI?.play(event.trackURI, callback: { [weak self] _, error in
            if let error {
                self?.onError?(error)
                return
            }
            self?.lastPlayedTrackURI = event.trackURI
        })
        return true
    }

    func disconnect() {
        if appRemote.isConnected {
            appRemote.disconnect()
        }
    }

    func clearDuplicateGuard() {
        lastPlayedTrackURI = nil
    }
}

extension SpotifyPlaybackAdapter: SPTAppRemoteDelegate {
    func appRemoteDidEstablishConnection(_ appRemote: SPTAppRemote) {
        if let pending = pendingInitialEvent {
            // authorizeAndPlayURI already requested this exact track, so mark
            // it as seen rather than immediately issuing a duplicate play.
            lastPlayedTrackURI = pending.trackURI
            pendingInitialEvent = nil
        }
        onConnected?()
    }

    func appRemote(_ appRemote: SPTAppRemote, didDisconnectWithError error: Error?) {
        onDisconnected?(error)
    }

    func appRemote(_ appRemote: SPTAppRemote, didFailConnectionAttemptWithError error: Error?) {
        if let error {
            onError?(error)
        }
    }
}
