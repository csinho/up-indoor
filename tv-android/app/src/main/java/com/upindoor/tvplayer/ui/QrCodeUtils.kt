package com.upindoor.tvplayer.ui

import android.graphics.Bitmap
import android.graphics.Color
import com.google.zxing.BarcodeFormat
import com.google.zxing.EncodeHintType
import com.google.zxing.qrcode.QRCodeWriter
import com.google.zxing.qrcode.decoder.ErrorCorrectionLevel

object QrCodeUtils {
  fun generateBitmap(
    content: String,
    size: Int,
  ): Bitmap {
    val hints =
      mapOf(
        EncodeHintType.CHARACTER_SET to "UTF-8",
        EncodeHintType.MARGIN to 1,
        EncodeHintType.ERROR_CORRECTION to ErrorCorrectionLevel.M,
      )

    val matrix =
      QRCodeWriter().encode(
        content,
        BarcodeFormat.QR_CODE,
        size,
        size,
        hints,
      )

    val bitmap = Bitmap.createBitmap(size, size, Bitmap.Config.ARGB_8888)
    for (x in 0 until size) {
      for (y in 0 until size) {
        bitmap.setPixel(
          x,
          y,
          if (matrix[x, y]) Color.BLACK else Color.WHITE,
        )
      }
    }

    return bitmap
  }
}
