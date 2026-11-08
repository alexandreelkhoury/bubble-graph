package app.jamaa.tv

import java.io.File

/** Locates /shared/fixtures (SPEC §14.4): `JAMAA_FIXTURES` overrides; the unit-test working dir is tv-app/app. */
object Fixtures {
    val dir: File by lazy {
        System.getenv("JAMAA_FIXTURES")?.takeIf { it.isNotBlank() }?.let(::File)
            ?: File(System.getProperty("user.dir"), "../../shared/fixtures")
    }

    fun read(name: String): String {
        val f = File(dir, name)
        check(f.isFile) { "Missing fixture ${f.absolutePath} (set JAMAA_FIXTURES to override the location)" }
        return f.readText(Charsets.UTF_8)
    }

    /** A protocol v2 fixture (shared/fixtures/v2, JAMAA-PLATFORM §2.5). */
    fun v2(name: String): String = read("v2/$name")
}
