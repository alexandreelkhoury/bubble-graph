// "JAMAA Pixi" (docs/TV.md "JAMAA Pixi (comparison app)"): a second, tiny Android TV app, a fullscreen WebView on
// <server>/tv-pixi (the PixiJS TV client served by the Worker). Independent of :app (no shared code or resources);
// AGP 9 built-in Kotlin, no dependencies. The server URL resolves exactly like :app's (app/build.gradle.kts).
plugins {
    alias(libs.plugins.android.application)
}

val PLACEHOLDER_SERVER_URL = "https://play.example.workers.dev"
val serverUrl: String = ((project.findProperty("serverUrl") as String?)
    ?: (project.findProperty("jamaa.prodServerUrl") as String?)
    ?: PLACEHOLDER_SERVER_URL).trim().trimEnd('/')

android {
    namespace = "app.jamaa.tv.pixi"
    compileSdk = 37

    defaultConfig {
        applicationId = "app.jamaa.tv.pixi"
        minSdk = 26
        targetSdk = 36
        versionCode = 1
        versionName = "1.0.0"
        buildConfigField("String", "SERVER_URL", "\"$serverUrl\"")
    }

    compileOptions {
        sourceCompatibility = JavaVersion.VERSION_17
        targetCompatibility = JavaVersion.VERSION_17
    }

    buildFeatures {
        buildConfig = true
    }
}
