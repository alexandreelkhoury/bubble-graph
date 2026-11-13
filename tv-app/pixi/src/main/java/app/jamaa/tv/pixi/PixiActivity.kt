package app.jamaa.tv.pixi

import android.annotation.SuppressLint
import android.app.Activity
import android.graphics.Color
import android.os.Bundle
import android.util.Log
import android.view.KeyEvent
import android.view.WindowManager
import android.webkit.ConsoleMessage
import android.webkit.WebChromeClient
import android.webkit.WebResourceError
import android.webkit.WebResourceRequest
import android.webkit.WebSettings
import android.webkit.WebView
import android.webkit.WebViewClient

/**
 * "JAMAA Pixi": a fullscreen, hardware-accelerated WebView on `<server>/tv-pixi`, the PixiJS TV client the Worker serves
 * (web-client/src/tv-pixi). It exists to compare the Pixi rendering path with the native Compose app ("JAMAA") on the
 * same TV. The remote reaches the page as ordinary key events (D-pad = ArrowUp/Down/Left/Right, OK = Enter).
 *
 * - BACK (short press) is forwarded to the page as Escape. If the page does not handle it (the "closed" splash after
 *   "Close JAMAA?"), the activity finishes. Hold BACK (about 0.7 s) to reload the page (a new room).
 * - The page's console goes to logcat: `adb logcat -s JamaaPixi` (the `[pixi-tv] fps ...` line every 5 s).
 * - `adb shell am start -n app.jamaa.tv.pixi/.PixiActivity --es url http://<laptop>:8787/tv-pixi` opens another host.
 */
class PixiActivity : Activity() {
    private lateinit var web: WebView
    private var target = ""
    private var backDownAt = 0L

    @SuppressLint("SetJavaScriptEnabled")
    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        window.addFlags(WindowManager.LayoutParams.FLAG_KEEP_SCREEN_ON or WindowManager.LayoutParams.FLAG_HARDWARE_ACCELERATED)
        WebView.setWebContentsDebuggingEnabled(true) // chrome://inspect from the laptop
        target = intent?.getStringExtra(EXTRA_URL)?.takeIf { it.isNotBlank() } ?: "${BuildConfig.SERVER_URL}/tv-pixi"
        web = WebView(this).apply {
            setBackgroundColor(Color.BLACK)
            isFocusable = true
            isFocusableInTouchMode = true
            settings.javaScriptEnabled = true
            settings.domStorageEnabled = true // the fps toggle and the locale are remembered in localStorage
            settings.mediaPlaybackRequiresUserGesture = false // the TV's sounds
            settings.cacheMode = WebSettings.LOAD_DEFAULT
            settings.useWideViewPort = true
            settings.loadWithOverviewMode = true
            webViewClient = object : WebViewClient() {
                override fun onReceivedError(view: WebView, request: WebResourceRequest, error: WebResourceError) {
                    if (request.isForMainFrame) {
                        Log.w(TAG, "load failed ${request.url}: ${error.description}")
                        view.loadDataWithBaseURL(null, errorHtml(target, error.description.toString()), "text/html", "utf-8", null)
                    }
                }
            }
            webChromeClient = object : WebChromeClient() {
                override fun onConsoleMessage(m: ConsoleMessage): Boolean {
                    Log.i(TAG, "${m.message()} (${m.sourceId()}:${m.lineNumber()})")
                    return true
                }
            }
        }
        setContentView(web)
        Log.i(TAG, "open $target")
        web.loadUrl(target)
        web.requestFocus()
    }

    override fun dispatchKeyEvent(event: KeyEvent): Boolean {
        if (event.keyCode == KeyEvent.KEYCODE_BACK) {
            if (event.action == KeyEvent.ACTION_DOWN) {
                if (event.repeatCount == 0) backDownAt = event.eventTime
                else if (backDownAt > 0 && event.eventTime - backDownAt > LONG_PRESS_MS) {
                    backDownAt = 0
                    Log.i(TAG, "reload $target")
                    web.loadUrl(target)
                }
            } else if (event.action == KeyEvent.ACTION_UP && backDownAt > 0) {
                backDownAt = 0
                web.evaluateJavascript(BACK_JS) { handled -> if (handled == "true") finish() }
            }
            return true
        }
        if (!web.hasFocus()) web.requestFocus() // keep the D-pad on the page
        return super.dispatchKeyEvent(event)
    }

    override fun onResume() {
        super.onResume()
        web.onResume()
    }

    override fun onPause() {
        web.onPause()
        super.onPause()
    }

    override fun onDestroy() {
        web.destroy()
        super.onDestroy()
    }

    companion object {
        const val TAG = "JamaaPixi"
        const val EXTRA_URL = "url"
        private const val LONG_PRESS_MS = 700L

        /** Escape down + up on the page; evaluates to "true" when nothing called preventDefault (the page did not use Back). */
        private const val BACK_JS =
            "(function(){var o={key:'Escape',code:'Escape',bubbles:true,cancelable:true};" +
                "var free=window.dispatchEvent(new KeyboardEvent('keydown',o));" +
                "window.dispatchEvent(new KeyboardEvent('keyup',o));return free;})()"

        private fun esc(s: String) = s.replace("&", "&amp;").replace("\"", "&quot;").replace("<", "&lt;")

        private fun errorHtml(url: String, why: String) = """
<!doctype html><html><head><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;background:#071A24;color:#FFF7EC;font:600 24px sans-serif;padding:72px">
<h1 style="color:#FFC94D;font-size:40px;margin:0 0 16px">JAMAA Pixi</h1>
<p>Can't reach ${esc(url)}</p><p style="opacity:.7;font-size:18px">${esc(why)}</p>
<p style="opacity:.7;font-size:18px">Hold Back to retry. Press Back to exit.</p></body></html>
"""
    }
}
