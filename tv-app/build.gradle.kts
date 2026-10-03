// Root build file. AGP 9 uses built-in Kotlin: do NOT apply org.jetbrains.kotlin.android (SPEC §9.1).
plugins {
    alias(libs.plugins.android.application) apply false
    alias(libs.plugins.kotlin.compose) apply false
    alias(libs.plugins.kotlin.serialization) apply false
}
