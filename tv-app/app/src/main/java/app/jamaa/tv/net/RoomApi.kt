package app.jamaa.tv.net

import app.jamaa.tv.protocol.CreateRoomRequest
import app.jamaa.tv.protocol.CreateRoomResponse
import app.jamaa.tv.protocol.ProtocolJson
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.withContext
import kotlinx.serialization.json.JsonArray
import kotlinx.serialization.json.JsonPrimitive
import kotlinx.serialization.json.booleanOrNull
import kotlinx.serialization.json.jsonObject
import kotlinx.serialization.json.jsonPrimitive
import okhttp3.MediaType.Companion.toMediaType
import okhttp3.OkHttpClient
import okhttp3.Request
import okhttp3.RequestBody.Companion.toRequestBody
import java.util.concurrent.TimeUnit

/** `POST /api/rooms` failed. [errorCode] is the server's `{"error": CODE}` when present (SPEC §6.6). */
class CreateRoomException(val httpStatus: Int?, val errorCode: String?, cause: Throwable? = null) :
    Exception("createRoom failed: status=$httpStatus error=$errorCode", cause)

/** `GET /api/config` (JAMAA-PLATFORM §2.5): billing on/off and the games the server offers (null = unknown). */
data class ClientConfig(val billing: Boolean, val games: List<String>?) {
    companion object {
        val OFF = ClientConfig(billing = false, games = null)
    }
}

object RoomApi {
    private val JSON = "application/json".toMediaType()

    val defaultClient: OkHttpClient by lazy {
        Http.base.newBuilder()
            .readTimeout(10, TimeUnit.SECONDS)
            .callTimeout(15, TimeUnit.SECONDS)
            .build()
    }

    /**
     * SPEC §9.3. OkHttp POST on the IO dispatcher. Throws [CreateRoomException]. [entitlement] is the stored token
     * (PAYMENTS-SPEC §4.3) or null; [memory] is the stored no-repeat memory (JAMAA-PLATFORM §2.6a). Null or empty values
     * are omitted from the body.
     */
    suspend fun createRoom(baseUrl: String, locale: String, entitlement: String? = null, memory: Map<String, List<String>>? = null): CreateRoomResponse =
        createRoom(baseUrl, locale, entitlement, memory, defaultClient)

    suspend fun createRoom(
        baseUrl: String,
        locale: String,
        entitlement: String?,
        memory: Map<String, List<String>>?,
        client: OkHttpClient,
    ): CreateRoomResponse =
        withContext(Dispatchers.IO) {
            val req = CreateRoomRequest(locale, entitlement, memory?.takeIf { it.isNotEmpty() })
            val body = ProtocolJson.encoder.encodeToString(CreateRoomRequest.serializer(), req)
            val request = Request.Builder()
                .url(ServerUrls.apiRoomsUrl(baseUrl))
                .post(body.toRequestBody(JSON))
                .build()
            try {
                client.newCall(request).execute().use { response ->
                    val text = response.body.string()
                    if (response.code != 201 && response.code != 200) {
                        throw CreateRoomException(response.code, parseErrorCode(text))
                    }
                    ProtocolJson.decoder.decodeFromString(CreateRoomResponse.serializer(), text)
                }
            } catch (e: CreateRoomException) {
                throw e
            } catch (e: Exception) {
                throw CreateRoomException(null, null, e)
            }
        }

    /**
     * `GET /api/config` → `{"billing": Boolean}` (server BILLING_ENABLED). Only an explicit `true` turns premium/billing
     * on; any failure (network, an older server without the route, a bad body) keeps it off. Never throws.
     */
    suspend fun billingEnabled(baseUrl: String, client: OkHttpClient = defaultClient): Boolean = clientConfig(baseUrl, client).billing

    /**
     * JAMAA-PLATFORM §2.5 `GET /api/config` → `{billing, games}`. [ClientConfig.billing] as [billingEnabled];
     * [ClientConfig.games] is the server's offered game ids, or null when absent or unreadable (the TV then relies on
     * its own list: it fails closed). Never throws.
     */
    suspend fun clientConfig(baseUrl: String, client: OkHttpClient = defaultClient): ClientConfig = withContext(Dispatchers.IO) {
        try {
            val request = Request.Builder().url(ServerUrls.apiConfigUrl(baseUrl)).get().build()
            client.newCall(request).execute().use { response ->
                if (response.code != 200) return@use ClientConfig.OFF
                val o = ProtocolJson.decoder.parseToJsonElement(response.body.string()).jsonObject
                val v = o["billing"]?.jsonPrimitive
                val games = (o["games"] as? JsonArray)?.mapNotNull { (it as? JsonPrimitive)?.takeIf { p -> p.isString }?.content }
                ClientConfig(billing = v != null && !v.isString && v.booleanOrNull == true, games = games)
            }
        } catch (e: Exception) {
            ClientConfig.OFF
        }
    }

    private fun parseErrorCode(text: String): String? = try {
        ProtocolJson.decoder.parseToJsonElement(text).jsonObject["error"]?.jsonPrimitive?.content
    } catch (e: Exception) {
        null
    }
}
