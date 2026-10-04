// SPEC §9.1. AGP 9.4.0 with built-in Kotlin (no org.jetbrains.kotlin.android plugin).
plugins {
    alias(libs.plugins.android.application)
    alias(libs.plugins.kotlin.compose)
    alias(libs.plugins.kotlin.serialization)
}

val serverUrl: String = (project.findProperty("serverUrl") as String?)
    ?: (project.findProperty("mishana.prodServerUrl") as String?)
    ?: "https://mish-ana.example.workers.dev"

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

    buildTypes {
        release {
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

// A release must never ship the placeholder server (SPEC §9.4): set mishana.prodServerUrl or -PserverUrl.
tasks.matching { it.name == "preReleaseBuild" }.configureEach {
    val url = serverUrl // a local copy: the task action captures no script object
    doFirst {
        check(!url.contains("example.")) {
            "Release build with the placeholder server URL ($url): set mishana.prodServerUrl in gradle.properties or pass -PserverUrl=https://…"
        }
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

    debugImplementation(libs.compose.ui.tooling)

    testImplementation(libs.junit)
    testImplementation(libs.kotlinx.coroutines.test)
    testImplementation(libs.turbine)
    testImplementation(libs.okhttp.mockwebserver)
}
