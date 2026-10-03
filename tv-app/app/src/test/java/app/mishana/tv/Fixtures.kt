package app.mishana.tv

import java.io.File

/** Locates /shared/fixtures (SPEC §14.4): `MISHANA_FIXTURES` overrides; the unit-test working dir is tv-app/app. */
object Fixtures {
    val dir: File by lazy {
        System.getenv("MISHANA_FIXTURES")?.takeIf { it.isNotBlank() }?.let(::File)
            ?: File(System.getProperty("user.dir"), "../../shared/fixtures")
    }

    fun read(name: String): String {
        val f = File(dir, name)
        check(f.isFile) { "Missing fixture ${f.absolutePath} (set MISHANA_FIXTURES to override the location)" }
        return f.readText(Charsets.UTF_8)
    }
}
