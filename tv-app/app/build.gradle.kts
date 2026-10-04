// SPEC §9.1. AGP 9.4.0 with built-in Kotlin (no org.jetbrains.kotlin.android plugin).
import java.io.File
import java.util.Properties

plugins {
    alias(libs.plugins.android.application)
    alias(libs.plugins.kotlin.compose)
    alias(libs.plugins.kotlin.serialization)
}

// Server URL baked into BuildConfig.SERVER_URL (SPEC §9.1, §9.4; docs/TV.md "Production server URL"), first set wins:
//   1. -PserverUrl=…  (or the env var ORG_GRADLE_PROJECT_serverUrl, e.g. in CI)
//   2. mishana.prodServerUrl in tv-app/gradle.properties
//   3. PLACEHOLDER_SERVER_URL below.
// The placeholder is deliberately not a real host: release builds refuse it (see preReleaseBuild below).
val PLACEHOLDER_SERVER_URL = "https://mish-ana.example.workers.dev"
val serverUrl: String = ((project.findProperty("serverUrl") as String?)
    ?: (project.findProperty("mishana.prodServerUrl") as String?)
    ?: PLACEHOLDER_SERVER_URL).trim().trimEnd('/')

// Upload key for Play App Signing (docs/TV.md "Release signing"). Never committed: the properties file lives outside
// the repo, at -PsigningProps=… or ~/.mishana-keys/keystore.properties (storeFile, storePassword, keyAlias,
// keyPassword). Without it, release builds stay unsigned.
val signingProps: Properties? = File(
    (project.findProperty("signingProps") as String?) ?: "${System.getProperty("user.home")}/.mishana-keys/keystore.properties"
).takeIf { it.isFile }?.let { f -> Properties().apply { f.inputStream().use { load(it) } } }

android {
    namespace = "app.mishana.tv"
    // [VERIFY] AGP 9 DSL: if `compileSdk = 37` is deprecated, use `compileSdk { version = release(37) }`.
    compileSdk = 37

    defaultConfig {
        applicationId = "app.mishana.tv"
        minSdk = 26
        targetSdk = 36
        versionCode = 1
        versionName = "0.1.0"
        buildConfigField("String", "SERVER_URL", "\"$serverUrl\"")
    }

    signingProps?.let { p ->
        signingConfigs {
            create("upload") {
                storeFile = file(p.getProperty("storeFile"))
                storePassword = p.getProperty("storePassword")
                keyAlias = p.getProperty("keyAlias")
                keyPassword = p.getProperty("keyPassword")
            }
        }
    }

    buildTypes {
        release {
            if (signingProps != null) signingConfig = signingConfigs.getByName("upload")
            // R8 matters for Compose on low-end TV SoCs (inlining, dead group removal); resources shrink with it.
            isMinifyEnabled = true
            isShrinkResources = true
            proguardFiles(getDefaultProguardFile("proguard-android-optimize.txt"), "proguard-rules.pro")
        }
    }

    compileOptions {
        sourceCompatibility = JavaVersion.VERSION_17
        targetCompatibility = JavaVersion.VERSION_17
    }

    buildFeatures {
        compose = true
        buildConfig = true
    }

    testOptions {
        // GameViewModelTest constructs an Application (SPEC §9.8: AndroidViewModel); android.jar stubs return defaults.
        unitTests.isReturnDefaultValues = true
    }

    packaging {
        resources {
            excludes += "/META-INF/{AL2.0,LGPL2.1}"
        }
    }
}

// The protocol models are immutable (vals, read-only lists from kotlinx.serialization): declaring them stable lets
// screens skip sub-trees whose part of the broadcast did not change.
composeCompiler {
    stabilityConfigurationFiles.add(project.layout.projectDirectory.file("compose-stability.conf"))
}

// A release must never ship the placeholder server (SPEC §9.4), nor a cleartext one (release has no cleartext
// network config, so http:// would fail at runtime): set mishana.prodServerUrl or pass -PserverUrl=https://….
tasks.matching { it.name == "preReleaseBuild" }.configureEach {
    val url = serverUrl // local copies: the task action captures no script object
    val placeholder = PLACEHOLDER_SERVER_URL
    doFirst {
        check(url != placeholder && !url.contains(".example.") && !url.contains("<")) {
            "Release build with the placeholder server URL ($url): set mishana.prodServerUrl in tv-app/gradle.properties " +
                "to your deployed Worker (e.g. https://play.<your-subdomain>.workers.dev) or pass -PserverUrl=https://…"
        }
        check(url.startsWith("https://")) {
            "Release server URL must be https:// (release builds allow no cleartext traffic): $url"
        }
        logger.lifecycle("Mish Ana! release server URL: $url")
    }
}

dependencies {
    val composeBom = platform(libs.compose.bom)
    implementation(composeBom)
    implementation(libs.compose.ui)
    implementation(libs.compose.foundation)
    implementation(libs.compose.ui.tooling.preview)
    implementation(libs.tv.material)
    implementation(libs.tv.foundation)
    implementation(libs.activity.compose)
    implementation(libs.lifecycle.viewmodel.compose)
    implementation(libs.lifecycle.runtime.compose)
    implementation(libs.core.ktx)
    implementation(libs.appcompat)
    implementation(libs.kotlinx.serialization.json)
    implementation(libs.kotlinx.coroutines.android)
    implementation(libs.okhttp)
    implementation(libs.zxing.core)
    implementation(libs.play.billing)

    debugImplementation(libs.compose.ui.tooling)

    testImplementation(libs.junit)
    testImplementation(libs.kotlinx.coroutines.test)
    testImplementation(libs.turbine)
    testImplementation(libs.okhttp.mockwebserver)
}
