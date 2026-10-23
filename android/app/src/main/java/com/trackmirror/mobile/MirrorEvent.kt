package com.trackmirror.mobile

/**
 * Android representation of mobile/PROTOCOL.md version 1.
 * Unknown JSON fields should be ignored by the eventual decoder.
 */
data class MirrorEvent(
    val version: Int = 1,
    val sourceListenerId: String,
    val trackUri: String,
    val trackTitle: String? = null,
    val artists: List<String> = emptyList(),
    val album: String? = null,
    val isPlaying: Boolean,
    val positionMs: Long? = null,
    val observedAt: String,
    val sequence: Long? = null,
    val provenance: String? = null,
    val confidence: String? = null,
) {
    fun hasPlayableTrackUri(): Boolean = trackUri.startsWith("spotify:track:")
}
