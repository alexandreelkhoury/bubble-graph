package app.mishana.tv.net

import okhttp3.OkHttpClient
import java.util.concurrent.TimeUnit

/**
 * One OkHttp base for the whole app: the API client and the socket client are `newBuilder()` variants of it, so they
 * share one connection pool, dispatcher and thread pools (OkHttp's documented way to customise per use).
 */
object Http {
    val base: OkHttpClient by lazy {
        OkHttpClient.Builder()
            .connectTimeout(5, TimeUnit.SECONDS)
            .build()
    }
}
