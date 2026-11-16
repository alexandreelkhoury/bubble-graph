// SPEC §9.1. AGP 9.4.0 with built-in Kotlin (no org.jetbrains.kotlin.android plugin).
import java.io.File
import java.util.Properties

plugins {
    alias(libs.plugins.android.application)
    alias(libs.plugins.kotlin.compose)
    alias(libs.plugins.kotlin.serialization)
}

fun prop(name: String): String? = (project.findProperty(name) as String?)?.trim()?.takeIf { it.isNotEmpty() }
fun env(name: String): String? = System.getenv(name)?.trim()?.takeIf { it.isNotEmpty() }
fun origin(url: String): String = url.trim().trimEnd('/')

// Server URL baked into BuildConfig.SERVER_URL (SPEC §9.1, §9.4; docs/TV.md "Production server URL"), first set wins:
//   release: -PserverUrl=… (or env ORG_GRADLE_PROJECT_serverUrl, e.g. CI) > jamaa.prodServerUrl > placeholder
//   debug:   -PserverUrl=… > jamaa.previewServerUrl > jamaa.prodServerUrl > placeholder
// (jamaa.* live in tv-app/gradle.properties.) The placeholder is deliberately not a real host: release builds refuse it,
// and the preview URL, and anything not https (see preReleaseBuild below).
val PLACEHOLDER_SERVER_URL = "https://play.example.workers.dev"
val cliServerUrl: String? = prop("serverUrl")
val previewServerUrlProp: String? = prop("jamaa.previewServerUrl")?.let(::origin)
val releaseServerUrl: String = origin(cliServerUrl ?: prop("jamaa.prodServerUrl") ?: PLACEHOLDER_SERVER_URL)
val debugServerUrl: String = origin(cliServerUrl ?: previewServerUrlProp ?: prop("jamaa.prodServerUrl") ?: PLACEHOLDER_SERVER_URL)

// Play version (docs/TV.md "Versions"): jamaa.versionCode / jamaa.versionName in gradle.properties (-P overrides them).
val appVersionCode: Int = prop("jamaa.versionCode")?.toIntOrNull()?.takeIf { it > 0 }
    ?: error("jamaa.versionCode must be a positive integer (tv-app/gradle.properties)")
val appVersionName: String = prop("jamaa.versionName") ?: error("jamaa.versionName is missing (tv-app/gradle.properties)")

// Upload key for Play App Signing (docs/TV.md "Release signing"). NEVER in the repo; first complete source wins:
//   1. env JAMAA_UPLOAD_STORE_FILE / JAMAA_UPLOAD_STORE_PASSWORD / JAMAA_UPLOAD_KEY_ALIAS / JAMAA_UPLOAD_KEY_PASSWORD, or
//      the Gradle properties jamaa.signing.storeFile / .storePassword / .keyAlias / .keyPassword (put those in
//      ~/.gradle/gradle.properties, never in tv-app/gradle.properties). keyAlias defaults to "upload", keyPassword to
//      the store password.
//   2. a properties file (storeFile, storePassword, keyAlias, keyPassword): -PsigningProps=…, else
//      ~/.jamaa-keys/keystore.properties, else ~/.mishana-keys/keystore.properties (the pre-rename folder).
// Without one, assembleRelease is unsigned (a warning) and bundleRelease fails (Play only takes signed bundles).
class UploadKey(val storeFile: File, val storePassword: String, val keyAlias: String, val keyPassword: String)
val home: String = System.getProperty("user.home")
val signingSource: Pair<String, (String) -> String?>? = run {
    val direct: (String) -> String? = { k ->
        when (k) {
            "storeFile" -> env("JAMAA_UPLOAD_STORE_FILE") ?: prop("jamaa.signing.storeFile")
            "storePassword" -> env("JAMAA_UPLOAD_STORE_PASSWORD") ?: prop("jamaa.signing.storePassword")
            "keyAlias" -> env("JAMAA_UPLOAD_KEY_ALIAS") ?: prop("jamaa.signing.keyAlias")
            "keyPassword" -> env("JAMAA_UPLOAD_KEY_PASSWORD") ?: prop("jamaa.signing.keyPassword")
            else -> null
        }
    }
    if (direct("storeFile") != null) return@run "env/Gradle properties" to direct
    val explicit = prop("signingProps")
    val file = if (explicit != null) File(explicit) else listOf("$home/.jamaa-keys", "$home/.mishana-keys")
        .map { File(it, "keystore.properties") }.firstOrNull { it.isFile }
    file?.let { f ->
        val p = Properties().apply { if (f.isFile) f.inputStream().use { load(it) } }
        f.path to { k: String -> p.getProperty(k)?.trim()?.takeIf { it.isNotEmpty() } }
    }
}
var signingProblem: String? = null
val uploadKey: UploadKey? = signingSource?.let { (source, get) ->
    val store = get("storeFile")?.let { File(it.replaceFirst(Regex("^~(?=/|$)"), home)) }
    val storePassword = get("storePassword")
    signingProblem = when {
        store == null && source != "env/Gradle properties" && !File(source).isFile -> "properties file not found: $source"
        store == null -> "no storeFile in $source"
        !store.isFile -> "keystore not found: $store (from $source)"
        store.canonicalPath.startsWith(rootDir.parentFile.canonicalPath + File.separator) ->
            "keystore $store is inside the repository: move it out (e.g. ~/.jamaa-keys/upload.jks)"
        storePassword == null -> "no store password in $source"
        else -> null
    }
    if (signingProblem != null || store == null || storePassword == null) null
    else UploadKey(store, storePassword, get("keyAlias") ?: "upload", get("keyPassword") ?: storePassword)
}
val wantsBundle: Boolean = gradle.startParameter.taskNames.any { it.substringAfterLast(':').startsWith("bundle") && it.contains("Release") }

android {
    namespace = "app.jamaa.tv"
    // [VERIFY] AGP 9 DSL: if `compileSdk = 37` is deprecated, use `compileSdk { version = release(37) }`.
    compileSdk = 37

    defaultConfig {
        applicationId = "app.jamaa.tv"
        minSdk = 26
        targetSdk = 36
        versionCode = appVersionCode
        versionName = appVersionName
    }

    uploadKey?.let { k ->
        signingConfigs {
            create("upload") {
                storeFile = k.storeFile
                storePassword = k.storePassword
                keyAlias = k.keyAlias
                keyPassword = k.keyPassword
            }
        }
    }

    buildTypes {
        debug {
            buildConfigField("String", "SERVER_URL", "\"$debugServerUrl\"")
        }
        release {
            buildConfigField("String", "SERVER_URL", "\"$releaseServerUrl\"")
            if (uploadKey != null) signingConfig = signingConfigs.getByName("upload")
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

// A release must never ship the placeholder server (SPEC §9.4), nor the preview Worker, nor a cleartext one (release
// has no cleartext network config, so http:// would fail at runtime): set jamaa.prodServerUrl or pass
// -PserverUrl=https://…. It must be signed when it is a bundle (Play Console only accepts signed uploads).
tasks.matching { it.name == "preReleaseBuild" }.configureEach {
    val url = releaseServerUrl // local copies: the task action captures no script object
    val placeholder = PLACEHOLDER_SERVER_URL
    val preview = previewServerUrlProp
    val signedBy = uploadKey?.let { "${it.storeFile} (alias ${it.keyAlias})" }
    val problem = signingProblem
    val bundle = wantsBundle
    val version = "$appVersionName ($appVersionCode)"
    doFirst {
        check(url != placeholder && !url.contains(".example.") && !url.contains("<")) {
            "Release build with the placeholder server URL ($url): set jamaa.prodServerUrl in tv-app/gradle.properties " +
                "to the production Worker (https://jamaa.<subdomain>.workers.dev or the custom domain) or pass -PserverUrl=https://…"
        }
        check(url.startsWith("https://")) {
            "Release server URL must be https:// (release builds allow no cleartext traffic): $url"
        }
        check(url != preview) {
            "Release server URL is the PREVIEW Worker ($url): releases talk to production (jamaa.prodServerUrl)"
        }
        check(problem == null) { "Release signing: $problem (docs/TV.md \"Release signing\")" }
        check(signedBy != null || !bundle) {
            "bundleRelease needs the upload key: set JAMAA_UPLOAD_STORE_FILE + JAMAA_UPLOAD_STORE_PASSWORD, or " +
                "jamaa.signing.* in ~/.gradle/gradle.properties, or ~/.jamaa-keys/keystore.properties (docs/TV.md \"Release signing\")"
        }
        logger.lifecycle("JAMAA release $version, server URL: $url")
        if (signedBy != null) logger.lifecycle("JAMAA release signed with upload key $signedBy")
        else logger.warn("JAMAA release is UNSIGNED (no upload key found): fine for a local R8 check, not for Play")
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
