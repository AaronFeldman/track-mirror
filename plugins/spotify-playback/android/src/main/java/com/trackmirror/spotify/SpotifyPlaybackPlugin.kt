package com.trackmirror.spotify

import android.app.Activity
import android.content.ActivityNotFoundException
import android.content.ComponentName
import android.content.Intent
import android.media.MediaMetadata
import android.media.session.MediaController
import android.media.session.MediaSessionManager
import android.media.session.PlaybackState
import android.net.Uri
import android.os.Build
import android.provider.Settings
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

    private val notificationListenerComponent: ComponentName
        get() = ComponentName(activity, TrackMirrorNotificationListenerService::class.java)

    private fun response(ok: Boolean, message: String? = null): JSObject {
        val result = JSObject()
        result.put("ok", ok)
        result.put("connected", appRemote?.isConnected == true)
        if (message != null) result.put("message", message)
        return result
    }

    private fun mediaSessionResponse(
        ok: Boolean,
        accessGranted: Boolean,
        spotify: MediaController? = null,
        message: String? = null,
    ): JSObject {
        val result = JSObject()
        result.put("ok", ok)
        result.put("accessGranted", accessGranted)
        result.put("spotifySessionFound", spotify != null)
        if (spotify != null) {
            result.put("spotifyPackage", spotify.packageName)
            result.put("playbackState", playbackStateName(spotify.playbackState?.state))
            spotify.metadata?.getString(MediaMetadata.METADATA_KEY_TITLE)?.let {
                result.put("trackTitle", it)
            }
            spotify.metadata?.getString(MediaMetadata.METADATA_KEY_ARTIST)?.let {
                result.put("artist", it)
            }
        }
        if (message != null) result.put("message", message)
        return result
    }

    private fun playbackStateName(state: Int?): String? = when (state) {
        PlaybackState.STATE_NONE -> "NONE"
        PlaybackState.STATE_STOPPED -> "STOPPED"
        PlaybackState.STATE_PAUSED -> "PAUSED"
        PlaybackState.STATE_PLAYING -> "PLAYING"
        PlaybackState.STATE_FAST_FORWARDING -> "FAST_FORWARDING"
        PlaybackState.STATE_REWINDING -> "REWINDING"
        PlaybackState.STATE_BUFFERING -> "BUFFERING"
        PlaybackState.STATE_ERROR -> "ERROR"
        PlaybackState.STATE_CONNECTING -> "CONNECTING"
        PlaybackState.STATE_SKIPPING_TO_PREVIOUS -> "SKIPPING_TO_PREVIOUS"
        PlaybackState.STATE_SKIPPING_TO_NEXT -> "SKIPPING_TO_NEXT"
        PlaybackState.STATE_SKIPPING_TO_QUEUE_ITEM -> "SKIPPING_TO_QUEUE_ITEM"
        null -> null
        else -> "UNKNOWN_$state"
    }

    private fun activeMediaControllers(): List<MediaController> {
        val manager = activity.getSystemService(MediaSessionManager::class.java)
        return manager.getActiveSessions(notificationListenerComponent)
    }

    private fun spotifyController(controllers: List<MediaController>): MediaController? =
        controllers.firstOrNull { controller ->
            controller.packageName == "com.spotify.music" ||
                controller.packageName == "com.spotify.lite" ||
                controller.packageName.startsWith("com.spotify.")
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

    @Command
    fun openMediaControlAccessSettings(invoke: Invoke) {
        val detailIntent = if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.R) {
            Intent(Settings.ACTION_NOTIFICATION_LISTENER_DETAIL_SETTINGS).apply {
                putExtra(
                    Settings.EXTRA_NOTIFICATION_LISTENER_COMPONENT_NAME,
                    notificationListenerComponent,
                )
            }
        } else {
            Intent(Settings.ACTION_NOTIFICATION_LISTENER_SETTINGS)
        }

        try {
            activity.startActivity(detailIntent)
        } catch (_: ActivityNotFoundException) {
            activity.startActivity(Intent(Settings.ACTION_NOTIFICATION_LISTENER_SETTINGS))
        }

        invoke.resolve(
            mediaSessionResponse(
                ok = true,
                accessGranted = false,
                message = "Opened Android media-control access settings. Enable Track Mirror, then return and check status.",
            ),
        )
    }

    @Command
    fun mediaSessionStatus(invoke: Invoke) {
        try {
            val controllers = activeMediaControllers()
            val spotify = spotifyController(controllers)
            val packages = controllers.map { it.packageName }.distinct().joinToString(", ")
            val message = if (spotify != null) {
                "Spotify media session found. Active sessions: ${packages.ifBlank { "none" }}"
            } else {
                "Media-control access is working, but no Spotify media session is active. Start playback in Spotify and try again. Active sessions: ${packages.ifBlank { "none" }}"
            }
            invoke.resolve(
                mediaSessionResponse(
                    ok = true,
                    accessGranted = true,
                    spotify = spotify,
                    message = message,
                ),
            )
        } catch (error: SecurityException) {
            invoke.resolve(
                mediaSessionResponse(
                    ok = false,
                    accessGranted = false,
                    message = "Track Mirror does not yet have Android media-control access. Enable its notification-listener access first.",
                ),
            )
        }
    }

    @Command
    fun playTrackViaMediaSession(invoke: Invoke) {
        val args = invoke.parseArgs(PlayTrackArgs::class.java)
        val trackUri = args.trackUri
        if (!trackUri.startsWith("spotify:track:") || trackUri.removePrefix("spotify:track:").isBlank()) {
            invoke.reject("MediaSession spike only accepts exact spotify:track: URIs")
            return
        }

        try {
            val controllers = activeMediaControllers()
            val spotify = spotifyController(controllers)
            if (spotify == null) {
                invoke.resolve(
                    mediaSessionResponse(
                        ok = false,
                        accessGranted = true,
                        message = "No active Spotify media session. Start a track in Spotify first, then retry.",
                    ),
                )
                return
            }

            spotify.transportControls.playFromUri(Uri.parse(trackUri), null)
            invoke.resolve(
                mediaSessionResponse(
                    ok = true,
                    accessGranted = true,
                    spotify = spotify,
                    message = "Android MediaSession playFromUri command sent to Spotify. Confirm on-device whether Spotify switched to the requested track.",
                ),
            )
        } catch (error: SecurityException) {
            invoke.resolve(
                mediaSessionResponse(
                    ok = false,
                    accessGranted = false,
                    message = "Android denied active-media-session access. Enable Track Mirror in notification-listener settings.",
                ),
            )
        } catch (error: Throwable) {
            invoke.reject("Android MediaSession playFromUri failed: ${error.message ?: error.javaClass.simpleName}")
        }
    }

    @Command
    fun pauseViaMediaSession(invoke: Invoke) {
        try {
            val controllers = activeMediaControllers()
            val spotify = spotifyController(controllers)
            if (spotify == null) {
                invoke.resolve(
                    mediaSessionResponse(
                        ok = false,
                        accessGranted = true,
                        message = "No active Spotify media session. Start Spotify first, then retry.",
                    ),
                )
                return
            }

            spotify.transportControls.pause()
            invoke.resolve(
                mediaSessionResponse(
                    ok = true,
                    accessGranted = true,
                    spotify = spotify,
                    message = "Android MediaSession pause command sent to Spotify.",
                ),
            )
        } catch (error: SecurityException) {
            invoke.resolve(
                mediaSessionResponse(
                    ok = false,
                    accessGranted = false,
                    message = "Android denied active-media-session access. Enable Track Mirror in notification-listener settings.",
                ),
            )
        } catch (error: Throwable) {
            invoke.reject("Android MediaSession pause failed: ${error.message ?: error.javaClass.simpleName}")
        }
    }
}
