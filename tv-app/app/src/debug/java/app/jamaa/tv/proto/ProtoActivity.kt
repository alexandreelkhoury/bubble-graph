package app.jamaa.tv.proto

import android.annotation.SuppressLint
import android.app.Activity
import android.graphics.Color
import android.os.Bundle
import android.util.Log
import android.view.KeyEvent
import android.view.WindowManager
import android.webkit.ConsoleMessage
import android.webkit.JavascriptInterface
import android.webkit.WebChromeClient
import android.webkit.WebSettings
import android.webkit.WebView
import android.webkit.WebViewClient
import android.content.Context
import android.content.SharedPreferences
import app.jamaa.tv.settings.DebugPrefs
import java.net.URI

/**
 * DEBUG BUILDS ONLY (src/debug): the "JAMAA Proto" launcher. A fullscreen, hardware-accelerated WebView that opens the
 * PixiJS prototype (prototypes/pixi-bluff) so the real Android TV WebView performance can be measured on the owner's TV:
 * the same rendering path a PixiJS wrapper app would use.
 *
 * - Start screen: a URL field (default `http://<debug server host>:5174/`, the last URL is remembered) and presets.
 *   `adb shell am start -n app.jamaa.tv/.proto.ProtoActivity --es url http://192.168.1.20:5174/` skips it.
 * - D-pad and OK reach the page as ordinary key events (ArrowUp/Down/Left/Right, Enter).
 * - BACK (short press) is forwarded to the page as an Escape key (= restart the scene); hold BACK to return to the
 *   start screen; BACK on the start screen closes the activity.
 * - The page's console goes to logcat: `adb logcat -s JamaaProto` shows the `[pixi-bluff]` FPS report of each run.
 */
class ProtoActivity : Activity() {
    private lateinit var web: WebView
    private lateinit var prefs: DebugPrefs
    private lateinit var store: SharedPreferences
    private var onStartScreen = true
    private var backDownAt = 0L

    @SuppressLint("SetJavaScriptEnabled", "JavascriptInterface")
    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        prefs = DebugPrefs(this)
        store = getSharedPreferences(DebugPrefs.FILE, Context.MODE_PRIVATE)
        window.addFlags(WindowManager.LayoutParams.FLAG_KEEP_SCREEN_ON or WindowManager.LayoutParams.FLAG_HARDWARE_ACCELERATED)
        WebView.setWebContentsDebuggingEnabled(true) // chrome://inspect from the laptop
        web = WebView(this).apply {
            setBackgroundColor(Color.BLACK)
            isFocusable = true
            isFocusableInTouchMode = true
            settings.javaScriptEnabled = true
            settings.domStorageEnabled = true
            settings.mediaPlaybackRequiresUserGesture = false
            settings.cacheMode = WebSettings.LOAD_NO_CACHE // always the laptop's latest build
            settings.useWideViewPort = true
            settings.loadWithOverviewMode = true
            webViewClient = WebViewClient()
            webChromeClient = object : WebChromeClient() {
                override fun onConsoleMessage(m: ConsoleMessage): Boolean {
                    Log.i(TAG, "${m.message()} (${m.sourceId()}:${m.lineNumber()})")
                    return true
                }
            }
        }
        setContentView(web)
        val fromIntent = intent?.getStringExtra(EXTRA_URL)
        if (!fromIntent.isNullOrBlank()) openUrl(fromIntent) else showStartScreen()
    }

    private fun defaultUrl(): String {
        val saved = store.getString(KEY_URL, null).orEmpty()
        if (saved.isNotBlank()) return saved
        val host = runCatching { URI(prefs.effectiveServerUrl()).host }.getOrNull()
        return "http://${host ?: "192.168.1.2"}:$DEV_PORT/"
    }

    private fun showStartScreen() {
        onStartScreen = true
        web.addJavascriptInterface(Bridge(), "JamaaProto")
        web.loadDataWithBaseURL("http://jamaa.proto/", startHtml(defaultUrl()), "text/html", "utf-8", null)
        web.requestFocus()
    }

    private fun openUrl(url: String) {
        onStartScreen = false
        store.edit().putString(KEY_URL, url).apply()
        Log.i(TAG, "open $url")
        web.removeJavascriptInterface("JamaaProto") // the prototype page gets no bridge
        web.loadUrl(url)
        web.requestFocus()
    }

    override fun dispatchKeyEvent(event: KeyEvent): Boolean {
        if (event.keyCode == KeyEvent.KEYCODE_BACK && !onStartScreen) {
            if (event.action == KeyEvent.ACTION_DOWN) {
                if (event.repeatCount == 0) backDownAt = event.eventTime
                else if (backDownAt > 0 && event.eventTime - backDownAt > LONG_PRESS_MS) {
                    backDownAt = 0
                    showStartScreen()
                }
            } else if (event.action == KeyEvent.ACTION_UP && backDownAt > 0) {
                backDownAt = 0
                web.evaluateJavascript(ESCAPE_JS, null)
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

    /** Only on the local start screen (removed before the prototype loads). */
    private inner class Bridge {
        @JavascriptInterface
        fun open(url: String) {
            runOnUiThread { openUrl(url.trim()) }
        }
    }

    companion object {
        const val TAG = "JamaaProto"
        const val EXTRA_URL = "url"
        const val DEV_PORT = 5174
        private const val KEY_URL = "proto_url" // in the existing debug prefs file "jamaa_debug"
        private const val LONG_PRESS_MS = 700L
        private const val ESCAPE_JS =
            "(function(){var o={key:'Escape',code:'Escape',bubbles:true};" +
                "window.dispatchEvent(new KeyboardEvent('keydown',o));window.dispatchEvent(new KeyboardEvent('keyup',o));})()"

        private fun esc(s: String) = s.replace("&", "&amp;").replace("\"", "&quot;").replace("<", "&lt;")

        /** Plain HTML start screen: the URL field + presets; Up/Down move focus, OK opens. */
        fun startHtml(url: String): String = """
<!doctype html><html><head><meta name="viewport" content="width=device-width,initial-scale=1">
<style>
body{margin:0;background:#1D1036;color:#FFF1DC;font:600 22px sans-serif;padding:48px 72px}
h1{margin:0 0 8px;color:#FFC94D;font-size:34px} p{opacity:.8;margin:4px 0 20px;font-size:18px}
input,button{display:block;width:760px;box-sizing:border-box;font:inherit;margin:10px 0;padding:12px 18px;border-radius:12px;
border:3px solid #4A2E7A;background:#2B1650;color:#FFF1DC;text-align:left}
:focus{outline:none;border-color:#FFC94D;background:#4A2E7A}
small{display:block;margin-top:18px;opacity:.65;font-size:16px}
</style></head><body>
<h1>JAMAA Proto (debug build)</h1>
<p>PixiJS prototype of the Bluff! reveal. Run <b>pnpm --filter @jamaa/pixi-bluff-proto dev --host</b> on the laptop.</p>
<form id="f"><input id="u" type="url" enterkeyhint="go" value="${esc(url)}" spellcheck="false" autocapitalize="off"></form>
<button data-q="">Open (WebGL, default)</button>
<button data-q="res=1">Open at half resolution (res=1)</button>
<button data-q="boil=0">Open with boil off (lite motion)</button>
<button data-q="renderer=canvas">Open with the Canvas 2D renderer</button>
<button data-q="renderer=webgpu">Open with WebGPU</button>
<button data-q="auto=1">Benchmark loop (auto-advance, repeats)</button>
<small>OK on the field opens the keyboard. Up/Down move. In the prototype: OK next · Back restart · hold Back = this screen · Up overlay · Down resolution · Left boil.</small>
<script>
var els=[].slice.call(document.querySelectorAll('input,button'));els[1].focus();
function go(q){var u=document.getElementById('u').value.trim();if(q)u+=(u.indexOf('?')<0?'?':'&')+q;JamaaProto.open(u);}
els.forEach(function(b){if(b.tagName==='BUTTON')b.onclick=function(){go(b.getAttribute('data-q'));};});
document.getElementById('f').onsubmit=function(e){e.preventDefault();go('');};
document.addEventListener('keydown',function(e){var i=els.indexOf(document.activeElement);
if(e.key==='ArrowDown'){els[Math.min(els.length-1,i+1)].focus();e.preventDefault();}
if(e.key==='ArrowUp'){els[Math.max(0,i-1)].focus();e.preventDefault();}});
</script></body></html>
"""
    }
}
