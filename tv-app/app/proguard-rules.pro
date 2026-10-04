# Release builds are minified (R8). kotlinx.serialization, OkHttp and AndroidX ship their own consumer rules;
# the protocol models are kept whole anyway (serializers are looked up by type, and fixture names must survive):
-keep class app.mishana.tv.protocol.** { *; }
