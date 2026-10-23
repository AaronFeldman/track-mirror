import Foundation
import SpotifyiOS
import SwiftRs
import Tauri

private final class ConfigureArgs: Decodable {
    let clientId: String
    let redirectUri: String
}

private final class PlayTrackArgs: Decodable {
    let trackUri: String
}

private final class AuthorizationCallbackArgs: Decodable {
    let url: String
}

final class SpotifyPlaybackPlugin: Plugin {
    private var configuration: SPTConfiguration?
    private var appRemote: SPTAppRemote?
    private var pendingConnectInvoke: Invoke?
    private var pendingPlayInvoke: Invoke?
    private var pendingTrackURI: String?

    private func response(_ ok: Bool, _ message: String? = nil) -> [String: Any] {
        var result: [String: Any] = [
            "ok": ok,
            "connected": appRemote?.isConnected ?? false,
        ]
        if let message {
            result["message"] = message
        }
        return result
    }

    private func rejectPending(_ message: String) {
        pendingConnectInvoke?.reject(message)
        pendingPlayInvoke?.reject(message)
        pendingConnectInvoke = nil
        pendingPlayInvoke = nil
        pendingTrackURI = nil
    }

    @objc public func configure(_ invoke: Invoke) throws {
        let args = try invoke.parseArgs(ConfigureArgs.self)
        guard !args.clientId.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty,
              !args.redirectUri.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty,
              let redirectURL = URL(string: args.redirectUri)
        else {
            invoke.reject("Spotify client ID and a valid redirect URI are required")
            return
        }

        if appRemote?.isConnected == true {
            appRemote?.disconnect()
        }

        let configuration = SPTConfiguration(clientID: args.clientId, redirectURL: redirectURL)
        let remote = SPTAppRemote(configuration: configuration, logLevel: .debug)
        remote.delegate = self

        self.configuration = configuration
        self.appRemote = remote
        self.pendingConnectInvoke = nil
        self.pendingPlayInvoke = nil
        self.pendingTrackURI = nil

        invoke.resolve(response(true, "Spotify playback configured"))
    }

    @objc public func connect(_ invoke: Invoke) throws {
        guard let remote = appRemote else {
            invoke.reject("Spotify playback is not configured with a client ID and redirect URI")
            return
        }

        if remote.isConnected {
            invoke.resolve(response(true, "Spotify App Remote already connected"))
            return
        }

        pendingConnectInvoke = invoke
        remote.connect()
    }

    @objc public func playTrack(_ invoke: Invoke) throws {
        let args = try invoke.parseArgs(PlayTrackArgs.self)
        let trackURI = args.trackUri

        guard trackURI.hasPrefix("spotify:track:"),
              !trackURI.replacingOccurrences(of: "spotify:track:", with: "").isEmpty
        else {
            invoke.reject("Track Mirror only accepts exact spotify:track: URIs")
            return
        }

        guard let remote = appRemote else {
            invoke.reject("Spotify playback is not configured with a client ID and redirect URI")
            return
        }

        if remote.isConnected {
            guard let playerAPI = remote.playerAPI else {
                invoke.reject("Spotify player API is unavailable")
                return
            }
            playerAPI.play(trackURI) { [weak self] _, error in
                guard let self else { return }
                if let error {
                    invoke.reject("Spotify play failed: \(error.localizedDescription)")
                } else {
                    invoke.resolve(self.response(true, "Play command sent to Spotify"))
                }
            }
            return
        }

        // iOS may suspend Spotify when it is not active. authorizeAndPlayURI
        // wakes Spotify, requests App Remote authorization when needed, and
        // asks Spotify itself to start the exact mirrored URI.
        pendingPlayInvoke = invoke
        pendingTrackURI = trackURI
        remote.authorizeAndPlayURI(trackURI) { [weak self] spotifyInstalled in
            guard let self else { return }
            if !spotifyInstalled {
                self.rejectPending("Spotify is not installed on this device")
            }
        }
    }

    @objc public func pause(_ invoke: Invoke) throws {
        guard let remote = appRemote, remote.isConnected else {
            invoke.reject("Spotify App Remote is not connected")
            return
        }
        guard let playerAPI = remote.playerAPI else {
            invoke.reject("Spotify player API is unavailable")
            return
        }

        playerAPI.pause { [weak self] _, error in
            guard let self else { return }
            if let error {
                invoke.reject("Spotify pause failed: \(error.localizedDescription)")
            } else {
                invoke.resolve(self.response(true, "Pause command sent to Spotify"))
            }
        }
    }

    @objc public func disconnect(_ invoke: Invoke) throws {
        if appRemote?.isConnected == true {
            appRemote?.disconnect()
        }
        pendingConnectInvoke = nil
        pendingPlayInvoke = nil
        pendingTrackURI = nil
        invoke.resolve(response(true, "Spotify App Remote disconnected"))
    }

    @objc public func handleAuthorizationCallback(_ invoke: Invoke) throws {
        let args = try invoke.parseArgs(AuthorizationCallbackArgs.self)
        guard let url = URL(string: args.url), let remote = appRemote else {
            invoke.reject("Invalid Spotify authorization callback")
            return
        }

        guard let parameters = remote.authorizationParameters(from: url) else {
            invoke.reject("Spotify authorization callback did not contain authorization parameters")
            return
        }

        if let errorDescription = parameters[SPTAppRemoteErrorDescriptionKey] as? String {
            rejectPending("Spotify authorization failed: \(errorDescription)")
            invoke.reject("Spotify authorization failed: \(errorDescription)")
            return
        }

        guard let accessToken = parameters[SPTAppRemoteAccessTokenKey] as? String else {
            invoke.reject("Spotify authorization callback did not contain an access token")
            return
        }

        remote.connectionParameters.accessToken = accessToken
        remote.connect()
        invoke.resolve(response(true, "Spotify authorization accepted; connecting App Remote"))
    }
}

extension SpotifyPlaybackPlugin: SPTAppRemoteDelegate {
    func appRemoteDidEstablishConnection(_ appRemote: SPTAppRemote) {
        pendingConnectInvoke?.resolve(response(true, "Spotify App Remote connected"))
        pendingConnectInvoke = nil

        if let playInvoke = pendingPlayInvoke {
            // authorizeAndPlayURI already requested this exact URI, so do not
            // issue a second play command after the connection is established.
            playInvoke.resolve(response(true, "Spotify authorized and mirrored track requested"))
            pendingPlayInvoke = nil
            pendingTrackURI = nil
        }
    }

    func appRemote(_ appRemote: SPTAppRemote, didDisconnectWithError error: Error?) {
        if let error {
            rejectPending("Spotify App Remote disconnected: \(error.localizedDescription)")
        }
    }

    func appRemote(_ appRemote: SPTAppRemote, didFailConnectionAttemptWithError error: Error?) {
        let message = error?.localizedDescription ?? "unknown connection error"
        rejectPending("Spotify App Remote connection failed: \(message)")
    }
}

@_cdecl("init_plugin_spotify_playback")
func initPlugin() -> Plugin {
    SpotifyPlaybackPlugin()
}
