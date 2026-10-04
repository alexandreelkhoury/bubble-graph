package app.mishana.tv.billing

import app.mishana.tv.Constants
import app.mishana.tv.net.Http
import app.mishana.tv.protocol.CatalogResponse
import app.mishana.tv.protocol.EntitlementBody
import app.mishana.tv.protocol.EntitlementRequest
import app.mishana.tv.protocol.EntitlementResponse
import app.mishana.tv.protocol.ProtocolJson
import app.mishana.tv.protocol.PurchaseRef
import app.mishana.tv.protocol.VerifyRequest
import app.mishana.tv.protocol.VerifyResponse
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.withContext
import kotlinx.serialization.KSerializer
import kotlinx.serialization.json.jsonObject
import kotlinx.serialization.json.jsonPrimitive
import okhttp3.MediaType.Companion.toMediaType
import okhttp3.OkHttpClient
import okhttp3.Request
import okhttp3.RequestBody.Companion.toRequestBody
import java.util.concurrent.TimeUnit

/** A billing HTTP call failed. [errorCode] is the server's `{"error": BillingErrorCode}` when present. Never carries a token. */
class BillingApiException(val httpStatus: Int?, val errorCode: String?, cause: Throwable? = null) :
    Exception("billing call failed: status=$httpStatus error=$errorCode", cause)

/** PAYMENTS-SPEC §3.4 as the TV uses it. Tests pass a fake. */
interface BillingApi {
    suspend fun catalog(): CatalogResponse

    /** At most [Constants.MAX_PURCHASES_PER_VERIFY] purchases per call (the repository chunks). */
    suspend fun verify(installId: String, purchases: List<PurchaseRef>): VerifyResponse
    suspend fun entitlement(installId: String): EntitlementBody
}

/**
 * OkHttp client for `/api/billing/{catalog,verify,entitlement}` on the IO dispatcher, with RoomApi's timeouts.
 * The TV sends no Origin header (SPEC §7.4). Install ids and purchase tokens travel only in request bodies.
 */
class EntitlementApi(
    private val baseUrl: () -> String,
    private val client: OkHttpClient = defaultClient,
) : BillingApi {

    override suspend fun catalog(): CatalogResponse =
        call(Request.Builder().url(url("catalog")).get().build(), CatalogResponse.serializer())

    override suspend fun verify(installId: String, purchases: List<PurchaseRef>): VerifyResponse {
        require(purchases.size in 1..Constants.MAX_PURCHASES_PER_VERIFY) { "verify takes 1..${Constants.MAX_PURCHASES_PER_VERIFY} purchases" }
        val body = ProtocolJson.encoder.encodeToString(VerifyRequest.serializer(), VerifyRequest(installId, purchases))
        return call(post("verify", body), VerifyResponse.serializer())
    }

    override suspend fun entitlement(installId: String): EntitlementBody {
        val body = ProtocolJson.encoder.encodeToString(EntitlementRequest.serializer(), EntitlementRequest(installId))
        return call(post("entitlement", body), EntitlementResponse.serializer()).entitlement
    }

    private fun url(path: String): String = baseUrl().trim().trimEnd('/') + "/api/billing/" + path

    private fun post(path: String, json: String): Request =
        Request.Builder().url(url(path)).post(json.toRequestBody(JSON_TYPE)).build()

    private suspend fun <T> call(request: Request, serializer: KSerializer<T>): T = withContext(Dispatchers.IO) {
        try {
            client.newCall(request).execute().use { response ->
                val text = response.body.string()
                if (response.code != 200) throw BillingApiException(response.code, parseErrorCode(text))
                ProtocolJson.decoder.decodeFromString(serializer, text)
            }
        } catch (e: BillingApiException) {
            throw e
        } catch (e: Exception) {
            // The cause is kept for debugging; OkHttp exceptions name the host at most, never a body.
            throw BillingApiException(null, null, e)
        }
    }

    companion object {
        private val JSON_TYPE = "application/json".toMediaType()

        /** Same timeouts as RoomApi (SPEC §9.3), on the shared OkHttp base. */
        val defaultClient: OkHttpClient by lazy {
            Http.base.newBuilder()
                .readTimeout(10, TimeUnit.SECONDS)
                .callTimeout(15, TimeUnit.SECONDS)
                .build()
        }

        fun parseErrorCode(text: String): String? = try {
            ProtocolJson.decoder.parseToJsonElement(text).jsonObject["error"]?.jsonPrimitive?.content
        } catch (e: Exception) {
            null
        }
    }
}
