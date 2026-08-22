package com.wakhreek.app

import android.app.Activity
import android.app.KeyguardManager
import android.content.Intent
import android.os.Build
import android.os.Bundle
import android.view.WindowManager
import android.widget.Button
import android.widget.LinearLayout
import android.widget.TextView

class IncomingCallActivity : Activity() {
    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)

        // Réveille l'écran et affiche l'appel au-dessus de l'écran verrouillé.
        // (setShowWhenLocked / setTurnScreenOn n'existent qu'à partir d'Android 8.1)
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O_MR1) {
            setShowWhenLocked(true)
            setTurnScreenOn(true)
        }
        window.addFlags(
            WindowManager.LayoutParams.FLAG_KEEP_SCREEN_ON or
            WindowManager.LayoutParams.FLAG_ALLOW_LOCK_WHILE_SCREEN_ON or
            WindowManager.LayoutParams.FLAG_TURN_SCREEN_ON
        )
        // Déverrouille l'écran une fois l'appel affiché (sans demander le code).
        val keyguard = getSystemService(KeyguardManager::class.java)
        keyguard?.requestDismissKeyguard(this, null)

        val caller = intent.getStringExtra("caller") ?: "Wakhreek"
        val type = intent.getStringExtra("callType") ?: "audio"

        val layout = LinearLayout(this).apply {
            orientation = LinearLayout.VERTICAL
            setPadding(48, 120, 48, 48)
        }
        val title = TextView(this).apply {
            text = if (type == "video") "Appel vidéo Wakhreek" else "Appel audio Wakhreek"
            textSize = 28f
        }
        val name = TextView(this).apply { text = caller; textSize = 22f }
        val answer = Button(this).apply {
            text = "Répondre"
            setOnClickListener {
                val base = intent.getStringExtra("url") ?: "https://www.wakhreek.com"
                // answer=1 → la page web décroche automatiquement (pas de double confirmation)
                val url = if (base.contains("?")) "$base&answer=1" else "$base?answer=1"
                val open = Intent(this@IncomingCallActivity, MainActivity::class.java).apply {
                    putExtra("url", url)
                    flags = Intent.FLAG_ACTIVITY_CLEAR_TOP or Intent.FLAG_ACTIVITY_SINGLE_TOP
                }
                startActivity(open)
                finish()
            }
        }
        val reject = Button(this).apply { text = "Refuser"; setOnClickListener { finish() } }
        layout.addView(title); layout.addView(name); layout.addView(answer); layout.addView(reject)
        setContentView(layout)
    }
}
