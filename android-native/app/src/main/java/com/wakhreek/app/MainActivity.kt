package com.wakhreek.app

import android.app.Activity
import android.content.Context
import android.content.Intent
import android.net.Uri
import android.os.Bundle

class MainActivity : Activity() {
    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        startActivity(webIntent(this, "https://www.wakhreek.com"))
        finish()
    }

    companion object {
        fun webIntent(context: Context, url: String): Intent =
            Intent(Intent.ACTION_VIEW, Uri.parse(url)).apply { setPackage(null) }
    }
}
