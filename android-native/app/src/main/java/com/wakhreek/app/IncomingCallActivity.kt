package com.wakhreek.app

import android.app.Activity
import android.os.Bundle
import android.view.WindowManager
import android.widget.Button
import android.widget.LinearLayout
import android.widget.TextView

class IncomingCallActivity : Activity() {
    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        setShowWhenLocked(true)
        setTurnScreenOn(true)
        window.addFlags(
            WindowManager.LayoutParams.FLAG_KEEP_SCREEN_ON or
            WindowManager.LayoutParams.FLAG_ALLOW_LOCK_WHILE_SCREEN_ON
        )

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
                val url = intent.getStringExtra("url") ?: "https://www.wakhreek.com"
                startActivity(MainActivity.webIntent(this@IncomingCallActivity, url))
                finish()
            }
        }
        val reject = Button(this).apply { text = "Refuser"; setOnClickListener { finish() } }
        layout.addView(title); layout.addView(name); layout.addView(answer); layout.addView(reject)
        setContentView(layout)
    }
}
