package com.trackmirror.spotify

import android.service.notification.NotificationListenerService

/**
 * Minimal notification-listener service used only to qualify Track Mirror for
 * Android's active MediaSession controller access.
 *
 * The MediaSession spike does not inspect, store, or process notification
 * contents. The user must explicitly enable this listener in Android settings.
 */
class TrackMirrorNotificationListenerService : NotificationListenerService()
