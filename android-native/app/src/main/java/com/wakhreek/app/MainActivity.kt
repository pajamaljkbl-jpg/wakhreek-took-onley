package com.wakhreek.app

import android.Manifest
import android.app.Activity
import android.app.NotificationChannel
import android.app.NotificationManager
import android.content.Intent
import android.content.pm.PackageManager
import android.media.AudioAttributes
import android.media.RingtoneManager
import android.net.Uri
import android.os.Build
import android.os.Bundle
import android.provider.Settings
import android.webkit.CookieManager
import android.webkit.PermissionRequest
import android.webkit.WebChromeClient
import android.webkit.WebResourceRequest
import android.webkit.WebSettings
import android.webkit.WebView
import android.webkit.WebViewClient
import androidx.core.app.ActivityCompat
import androidx.core.content.ContextCompat
import com.google.firebase.messaging.FirebaseMessaging
import org.json.JSONObject

class MainActivity : Activity() {
    companion object {
        @JvmStatic
        var isForeground = false
    }

    private lateinit var webView: WebView
    private val mediaRequestCode = 1001

    override fun onResume() {
        super.onResume()
        isForeground = true
    }

    override fun onPause() {
        super.onPause()
        isForeground = false
    }

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)

        createNotificationChannels()

        webView = WebView(this)
        setContentView(webView)

        CookieManager.getInstance().setAcceptCookie(true)
        CookieManager.getInstance().setAcceptThirdPartyCookies(webView, true)

        webView.settings.apply {
            javaScriptEnabled = true
            domStorageEnabled = true
            databaseEnabled = true
            mediaPlaybackRequiresUserGesture = false
            cacheMode = WebSettings.LOAD_DEFAULT
            userAgentString = "$userAgentString WakhreekAndroid/1.1"
        }

        webView.webChromeClient = object : WebChromeClient() {
            override fun onPermissionRequest(request: PermissionRequest) {
                runOnUiThread {
                    val wantsAudio = request.resources.contains(PermissionRequest.RESOURCE_AUDIO_CAPTURE)
                    val wantsVideo = request.resources.contains(PermissionRequest.RESOURCE_VIDEO_CAPTURE)
                    if (wantsAudio || wantsVideo) {
                        ensureNativeMediaPermissions()
                        val grants = request.resources.filter {
                            it == PermissionRequest.RESOURCE_AUDIO_CAPTURE || it == PermissionRequest.RESOURCE_VIDEO_CAPTURE
                        }.toTypedArray()
                        request.grant(grants)
                    } else request.deny()
                }
            }
        }

        webView.webViewClient = object : WebViewClient() {
            override fun shouldOverrideUrlLoading(view: WebView?, request: WebResourceRequest?): Boolean {
                val uri = request?.url ?: return false
                val host = uri.host.orEmpty()
                return if (host == "www.wakhreek.com" || host == "wakhreek.com") {
                    false
                } else {
                    startActivity(Intent(Intent.ACTION_VIEW, uri))
                    true
                }
            }

            override fun onPageFinished(view: WebView?, url: String?) {
                super.onPageFinished(view, url)
                publishFirebaseTokenToWeb()
            }
        }

        ensureNativeMediaPermissions()
        ensureFullScreenIntentPermission()
        val startUrl = intent.getStringExtra("url") ?: "https://www.wakhreek.com"
        webView.loadUrl(startUrl)
    }

    override fun onNewIntent(intent: Intent?) {
        super.onNewIntent(intent)
        setIntent(intent)
        val url = intent?.getStringExtra("url")
        if (!url.isNullOrBlank() && ::webView.isInitialized) webView.loadUrl(url)
    }

    override fun onBackPressed() {
        if (::webView.isInitialized && webView.canGoBack()) webView.goBack() else super.onBackPressed()
    }

    private fun createNotificationChannels() {
        val manager = getSystemService(NotificationManager::class.java)
        val ringtone = RingtoneManager.getDefaultUri(RingtoneManager.TYPE_RINGTONE)
        val ringtoneAttributes = AudioAttributes.Builder()
            .setUsage(AudioAttributes.USAGE_NOTIFICATION_RINGTONE)
            .build()

        val incoming = NotificationChannel(
            "incoming_calls",
            "Appels entrants",
            NotificationManager.IMPORTANCE_HIGH
        ).apply {
            description = "Appels audio et vidéo Wakhreek"
            enableVibration(true)
            vibrationPattern = longArrayOf(0, 700, 250, 700, 250, 900)
            setSound(ringtone, ringtoneAttributes)
            lockscreenVisibility = android.app.Notification.VISIBILITY_PUBLIC
        }
        val missed = NotificationChannel(
            "missed_calls",
            "Appels manqués",
            NotificationManager.IMPORTANCE_DEFAULT
        ).apply {
            description = "Appels manqués Wakhreek"
            lockscreenVisibility = android.app.Notification.VISIBILITY_PUBLIC
        }
        manager.createNotificationChannel(incoming)
        manager.createNotificationChannel(missed)
    }

    private fun ensureNativeMediaPermissions() {
        val needed = mutableListOf<String>()
        if (ContextCompat.checkSelfPermission(this, Manifest.permission.RECORD_AUDIO) != PackageManager.PERMISSION_GRANTED) needed += Manifest.permission.RECORD_AUDIO
        if (ContextCompat.checkSelfPermission(this, Manifest.permission.CAMERA) != PackageManager.PERMISSION_GRANTED) needed += Manifest.permission.CAMERA
        if (Build.VERSION.SDK_INT >= 33 && ContextCompat.checkSelfPermission(this, Manifest.permission.POST_NOTIFICATIONS) != PackageManager.PERMISSION_GRANTED) needed += Manifest.permission.POST_NOTIFICATIONS
        if (needed.isNotEmpty()) ActivityCompat.requestPermissions(this, needed.toTypedArray(), mediaRequestCode)
    }

    private fun ensureFullScreenIntentPermission() {
        if (Build.VERSION.SDK_INT < 34) return
        val manager = getSystemService(NotificationManager::class.java)
        if (manager.canUseFullScreenIntent()) return
        try {
            val intent = Intent(Settings.ACTION_MANAGE_APP_USE_FULL_SCREEN_INTENT).apply {
                data = Uri.parse("package:$packageName")
            }
            startActivity(intent)
        } catch (_: Exception) {
        }
    }

    private fun publishFirebaseTokenToWeb() {
        FirebaseMessaging.getInstance().token.addOnSuccessListener { token ->
            val encoded = JSONObject.quote(token)
            val js = """
                (function(){
                  window.__WAKHREEK_NATIVE__ = true;
                  window.__WAKHREEK_FCM_TOKEN = $encoded;
                  window.dispatchEvent(new CustomEvent('wakhreek-native-token',{detail:{token:$encoded}}));
                })();
            """.trimIndent()
            webView.evaluateJavascript(js, null)
        }
    }
}
