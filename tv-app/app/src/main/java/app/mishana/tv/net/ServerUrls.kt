package app.mishana.tv.net

import app.mishana.tv.Constants
import java.util.UUID

/** Pure URL helpers (SPEC §9.4). */
object ServerUrls {
    /** `serverUrl` with http→ws / https→wss, plus `/parties/room/$code?_pk=<uuid>&cid=<uuid>` (fresh per attempt). */
    fun wsUrl(
        serverUrl: String,
        code: String,
        pk: String = UUID.randomUUID().toString(),
        cid: String = UUID.randomUUID().toString(),
    ): String {
        val base = serverUrl.trim().trimEnd('/')
        val ws = when {
            base.startsWith("https://", ignoreCase = true) -> "wss://" + base.substring(8)
            base.startsWith("http://", ignoreCase = true) -> "ws://" + base.substring(7)
            else -> base
        }
        return "$ws${Constants.WS_PATH_PREFIX}$code?_pk=$pk&cid=$cid"
    }

    fun apiRoomsUrl(serverUrl: String): String = serverUrl.trim().trimEnd('/') + "/api/rooms"

    /** `joinUrl` without scheme and path, for the lobby host line (`lobby.orVisit`). */
    fun displayHost(joinUrl: String): String {
        val noScheme = joinUrl.substringAfter("://", joinUrl)
        return noScheme.substringBefore('/').substringBefore('?')
    }
}
