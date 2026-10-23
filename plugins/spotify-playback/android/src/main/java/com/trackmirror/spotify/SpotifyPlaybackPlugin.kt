package com.trackmirror.spotify

import android.app.Activity
import app.tauri.annotation.Command
import app.tauri.annotation.InvokeArg
import app.tauri.annotation.TauriPlugin
import app.tauri.plugin.Invoke
import app.tauri.plugin.JSObject
import app.tauri.plugin.Plugin
import com.spotify.android.appremote.api.ConnectionParams
import com.spotify.android.appremote.api.Connector
import com.spotify.android.appremote.api.SpotifyAppRemote

@InvokeArg
class ConfigureArgs {
    lateinit var clientId: String
    lateinit var redirectUri: String
}

@InvokeArg
class PlayTrackArgs {
    lateinit var trackUri: String
}

@InvokeArg
class AuthorizationCallbackArgs {
    lateinit var url: String
}

@TauriPlugin
class SpotifyPlaybackPlugin(private val activity: Activity) : Plugin(activity) {
    private var clientId: String? = null
    private var redirectUri: String? = null
    private var appRemote: SpotifyAppRemote? = null

    private fun response(ok: Boolean, message: String? = null): JSObject {
        val result = JSObject()
        result.put("ok", ok)
        result.put("connected", appRemote?.isConnected == true)
        if (message != null) result.put("message", message)
        return result
    }

    private fun connectionParams(): ConnectionParams? {
        val id = clientId?.takeIf { it.isNotBlank() } ?: return null
        val redirect = redirectUri?.takeIf { it.isNotBlank() } ?: return null
        return ConnectionParams.Builder(id)
            .setRedirectUri(redirect)
            .showAuthView(true)
            .build()
    }

    private fun connectThen(invoke: Invoke, onConnected: (SpotifyAppRemote) -> Unit) {
        val existing = appRemote
        if (existing?.isConnected == true) {
            onConnected(existing)
            return
        }

        val params = connectionParams()
        if (params == null) {
            invoke.reject("Spotify playback is not configured with a client ID and redirect URI")
            return
        }

        SpotifyAppRemote.connect(
            activity,
            params,
            object : Connector.ConnectionListener {
                override fun onConnected(spotifyAppRemote: SpotifyAppRemote) {
                    appRemote = spotifyAppRemote
                    onConnected(spotifyAppRemote)
                }

                override fun onFailure(throwable: Throwable) {
                    appRemote = null
                    invoke.reject("Spotify App Remote connection failed: ${throwable.message ?: throwable.javaClass.simpleName}")
                }
            },
        )
    }

    @Command
    fun configure(invoke: Invoke) {
        val args = invoke.parseArgs(ConfigureArgs::class.java)
        if (args.clientId.isBlank() || args.redirectUri.isBlank()) {
            invoke.reject("Spotify client ID and redirect URI are required")
            return
        }

        clientId = args.clientId
        redirectUri = args.redirectUri
        invoke.resolve(response(true, "Spotify playback configured"))
    }

    @Command
    fun connect(invoke: Invoke) {
        connectThen(invoke) {
            invoke.resolve(response(true, "Spotify App Remote connected"))
        }
    }

    @Command
    fun playTrack(invoke: Invoke) {
        val args = invoke.parseArgs(PlayTrackArgs::class.java)
        val trackUri = args.trackUri
        if (!trackUri.startsWith("spotify:track:") || trackUri.removePrefix("spotify:track:").isBlank()) {
            invoke.reject("Track Mirror only accepts exact spotify:track: URIs")
            return
        }

        connectThen(invoke) { remote ->
            remote.playerApi.play(trackUri)
            invoke.resolve(response(true, "Play command sent to Spotify"))
        }
    }

    @Command
    fun pause(invoke: Invoke) {
        val remote = appRemote
        if (remote?.isConnected != true) {
            invoke.reject("Spotify App Remote is not connected")
            return
        }

        remote.playerApi.pause()
        invoke.resolve(response(true, "Pause command sent to Spotify"))
    }

    @Command
    fun disconnect(invoke: Invoke) {
        appRemote?.let { SpotifyAppRemote.disconnect(it) }
        appRemote = null
        invoke.resolve(response(true, "Spotify App Remote disconnected"))
    }

    @Command
    fun handleAuthorizationCallback(invoke: Invoke) {
        // Android App Remote's built-in authorization is completed by connect().
        // Keep this command for a platform-identical Rust interface.
        invoke.parseArgs(AuthorizationCallbackArgs::class.java)
        invoke.resolve(response(true, "No separate Android authorization callback is required"))
    }
}
