package app.mishana.tv.ui.components

import com.google.zxing.BarcodeFormat
import com.google.zxing.EncodeHintType
import com.google.zxing.common.BitMatrix
import com.google.zxing.qrcode.QRCodeWriter
import com.google.zxing.qrcode.decoder.ErrorCorrectionLevel

/** Pure QR helpers (SPEC §9.9). Kept free of Compose so they run in plain JVM unit tests. */
object QrMatrix {
    /** Upper case keeps the whole URL in QR alphanumeric mode (smaller version, bigger modules). */
    fun content(joinUrl: String): String = joinUrl.uppercase()

    /** zxing 3.5.4: `encode(String, BarcodeFormat, int, int, Map<EncodeHintType,?>)`; width/height 0 = minimal matrix. */
    fun encode(content: String): BitMatrix =
        QRCodeWriter().encode(
            content,
            BarcodeFormat.QR_CODE,
            0,
            0,
            mapOf(EncodeHintType.MARGIN to 0, EncodeHintType.ERROR_CORRECTION to ErrorCorrectionLevel.M),
        )

    /** `module = floor(panelDp / (matrix.width + 8))` dp: the 4-module quiet zone is inside the light panel. */
    fun moduleDp(panelDp: Int, matrixWidth: Int): Int = panelDp / (matrixWidth + 8)
}
