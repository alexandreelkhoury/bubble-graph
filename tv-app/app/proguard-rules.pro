# Release builds are not minified in v1 (isMinifyEnabled = false). If minification is turned on,
# kotlinx.serialization ships its own consumer rules; keep the protocol models anyway:
-keep class app.mishana.tv.protocol.** { *; }
