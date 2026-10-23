package com.trackmirror.mobile

import android.content.Context
import com.spotify.android.appremote.api.ConnectionParams
import com.spotify.android.appremote.api.Connector
import com.spotify.android.appremote.api.SpotifyAppRemote

/**
 * Thin Track Mirror playback adapter around Spotify App Remote.
 *
 * Track Mirror supplies track identity/state only. Spotify's own Android app
 * performs playback.
 */
class SpotifyPlaybackAdapter(
    private val context: Context,
    private val clientId: String,
    private val redirectUri: String,
) {
    private var appRemote: SpotifyAppRemote? = null
    private var lastPlayedTrackUri: String? = null

    val isConnected: Boolean
        get() = appRemote?.isConnected == true

    fun connect(
        onConnected: () -> Unit = {},
        onFailure: (Throwable) -> Unit = {},
    ) {
        if (isConnected) {
            onConnected()
            return
        }

        val params = ConnectionParams.Builder(clientId)
            .setRedirectUri(redirectUri)
            .showAuthView(true)
            .build()

        SpotifyAppRemote.connect(
            context,
            params,
            object : Connector.ConnectionListener {
                override fun onConnected(spotifyAppRemote: SpotifyAppRemote) {
                    appRemote = spotifyAppRemote
                    onConnected()
                }

                override fun onFailure(throwable: Throwable) {
                    appRemote = null
                    onFailure(throwable)
                }
            },
        )
    }

    fun disconnect() {
        appRemote?.let(SpotifyAppRemote::disconnect)
        appRemote = null
    }

    /**
     * Plays a newly observed exact track URI.
     *
     * Version 1 deliberately ignores pause/seek/drift fields until the mobile
     * playback path is validated end to end. Duplicate delivery of the same
     * URI does not restart the track.
     */
    fun apply(event: MirrorEvent): Boolean {
        if (!event.isPlaying) return false
        if (!event.hasPlayableTrackUri()) return false
        if (event.trackUri == lastPlayedTrackUri) return false

        val remote = appRemote ?: return false
        remote.playerApi.play(event.trackUri)
        lastPlayedTrackUri = event.trackUri
        return true
    }

    fun clearDuplicateGuard() {
        lastPlayedTrackUri = null
    }
}
