package com.wakhreek.app

import android.app.NotificationChannel
import android.app.NotificationManager
import android.app.PendingIntent
import android.content.Context
import android.content.Intent
import android.media.AudioAttributes
import android.media.RingtoneManager
import androidx.core.app.NotificationCompat
import com.google.firebase.messaging.FirebaseMessagingService
import com.google.firebase.messaging.RemoteMessage

class WakhreekMessagingService : FirebaseMessagingService() {
    override fun onMessageReceived(message: RemoteMessage) {
        val data = message.data
        if (data["kind"] != "call") return

        val callId = data["callId"] ?: System.currentTimeMillis().toString()
        val caller = data["caller"] ?: "Wakhreek"
        val callType = data["callType"] ?: "audio"
        val url = data["url"] ?: "https://www.wakhreek.com"

        val manager = getSystemService(Context.NOTIFICATION_SERVICE) as NotificationManager
        val sound = RingtoneManager.getDefaultUri(RingtoneManager.TYPE_RINGTONE)
        val channel = NotificationChannel("incoming_calls", "Appels entrants", NotificationManager.IMPORTANCE_HIGH).apply {
            description = "Appels audio et vidéo Wakhreek"
            enableVibration(true)
            vibrationPattern = longArrayOf(0, 700, 250, 700, 250, 900)
            setSound(sound, AudioAttributes.Builder().setUsage(AudioAttributes.USAGE_NOTIFICATION_RINGTONE).build())
            lockscreenVisibility = android.app.Notification.VISIBILITY_PUBLIC
        }
        manager.createNotificationChannel(channel)

        val fullIntent = Intent(this, IncomingCallActivity::class.java).apply {
            putExtra("caller", caller)
            putExtra("callType", callType)
            putExtra("url", url)
            flags = Intent.FLAG_ACTIVITY_NEW_TASK or Intent.FLAG_ACTIVITY_CLEAR_TOP
        }
        val pending = PendingIntent.getActivity(this, callId.hashCode(), fullIntent, PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE)

        val notification = NotificationCompat.Builder(this, "incoming_calls")
            .setSmallIcon(android.R.drawable.sym_call_incoming)
            .setContentTitle(if (callType == "video") "Appel vidéo Wakhreek" else "Appel audio Wakhreek")
            .setContentText("$caller vous appelle")
            .setCategory(NotificationCompat.CATEGORY_CALL)
            .setPriority(NotificationCompat.PRIORITY_MAX)
            .setVisibility(NotificationCompat.VISIBILITY_PUBLIC)
            .setOngoing(true)
            .setAutoCancel(false)
            .setContentIntent(pending)
            .setFullScreenIntent(pending, true)
            .setTimeoutAfter(30_000)
            .build()

        manager.notify(callId.hashCode(), notification)
    }
}
