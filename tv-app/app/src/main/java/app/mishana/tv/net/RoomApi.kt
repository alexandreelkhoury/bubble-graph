package app.mishana.tv.net

import app.mishana.tv.protocol.CreateRoomRequest
import app.mishana.tv.protocol.CreateRoomResponse
import app.mishana.tv.protocol.ProtocolJson
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.withContext
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

object RoomApi {
    private val JSON = "application/json".toMediaType()

    val defaultClient: OkHttpClient by lazy {
        Http.base.newBuilder()
            .readTimeout(10, TimeUnit.SECONDS)
            .callTimeout(15, TimeUnit.SECONDS)
            .build()
    }

    /** SPEC §9.3. OkHttp POST on the IO dispatcher. Throws [CreateRoomException]. */
    suspend fun createRoom(baseUrl: String, locale: String): CreateRoomResponse = createRoom(baseUrl, locale, defaultClient)

    suspend fun createRoom(baseUrl: String, locale: String, client: OkHttpClient): CreateRoomResponse =
        withContext(Dispatchers.IO) {
            val body = ProtocolJson.encoder.encodeToString(CreateRoomRequest.serializer(), CreateRoomRequest(locale))
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

    private fun parseErrorCode(text: String): String? = try {
        ProtocolJson.decoder.parseToJsonElement(text).jsonObject["error"]?.jsonPrimitive?.content
    } catch (e: Exception) {
        null
    }
}
