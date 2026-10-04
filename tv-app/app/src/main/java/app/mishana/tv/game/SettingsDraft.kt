package app.mishana.tv.game

import app.mishana.tv.protocol.Settings
import app.mishana.tv.protocol.SettingsPatch

/**
 * The TV's optimistic settings overlay (TV-03): local changes show at once, are merged into one patch, sent after a
 * debounce, and dropped when the server echoes them (or after a fallback, if it never does). Pure: the caller
 * (GameViewModel) owns the timers and calls [change] → [flush] (debounce elapsed) → [expire] (fallback elapsed).
 */
class SettingsDraft {
    /** The local overlay over the server settings, or null when the screen shows the server's values. */
    var patch: SettingsPatch? = null
        private set

    /** Changed locally and not sent yet. */
    private var pending = false

    /** The last patch sent, kept until its echo arrives (a late echo must not read as someone else's change). */
    private var lastSent: SettingsPatch? = null

    fun change(p: SettingsPatch) {
        patch = merge(patch, p)
        pending = true
    }

    /** The debounce elapsed: returns the whole overlay to send (null when there is nothing to send). */
    fun flush(): SettingsPatch? {
        val p = patch ?: return null
        pending = false
        lastSent = p
        return p
    }

    /** The fallback elapsed without an echo (the server rejected it): show the server's values again. */
    fun expire() {
        if (!pending) patch = null
    }

    /**
     * The server settings changed from [before] to [after]. Returns the keys someone else changed (the VIP; they get
     * the `settings.changedBy` toast and the row flash), or an empty set when this is the echo of our own change.
     */
    fun onServerSettings(before: Settings, after: Settings): Set<String> {
        if (pending || before == after) return emptySet()
        val own = patch != null || lastSent?.let { after.withDraft(it) == after } == true
        patch = null
        lastSent = null
        return if (own) emptySet() else changedSettingKeys(before, after)
    }

    fun clear() {
        patch = null
        pending = false
        lastSent = null
    }
}

/** Merges [b] over [a] (non-null fields of b win). */
fun merge(a: SettingsPatch?, b: SettingsPatch): SettingsPatch {
    if (a == null) return b
    return SettingsPatch(
        winRule = b.winRule ?: a.winRule,
        revealRoles = b.revealRoles ?: a.revealRoles,
        roleMode = b.roleMode ?: a.roleMode,
        undercoverCount = b.undercoverCount ?: a.undercoverCount,
        blankCount = b.blankCount ?: a.blankCount,
        clueSeconds = b.clueSeconds ?: a.clueSeconds,
        voteSeconds = b.voteSeconds ?: a.voteSeconds,
        revealSeconds = b.revealSeconds ?: a.revealSeconds,
        guessSeconds = b.guessSeconds ?: a.guessSeconds,
        tieBreak = b.tieBreak ?: a.tieBreak,
        blankGuess = b.blankGuess ?: a.blankGuess,
        wordLocale = b.wordLocale ?: a.wordLocale,
        // A word-language change resets packIds on the server unless the patch carries them (SPEC §4.4).
        packIds = b.packIds ?: if (b.wordLocale != null) null else a.packIds,
        difficulties = b.difficulties ?: a.difficulties,
        familyFilter = b.familyFilter ?: a.familyFilter,
        swapSides = b.swapSides ?: a.swapSides,
        points = b.points ?: a.points,
    )
}

/** The settings as shown: the server's, with the local overlay [p] applied. */
fun Settings.withDraft(p: SettingsPatch?): Settings {
    if (p == null) return this
    return copy(
        winRule = p.winRule ?: winRule,
        revealRoles = p.revealRoles ?: revealRoles,
        roleMode = p.roleMode ?: roleMode,
        undercoverCount = p.undercoverCount ?: undercoverCount,
        blankCount = p.blankCount ?: blankCount,
        clueSeconds = p.clueSeconds ?: clueSeconds,
        voteSeconds = p.voteSeconds ?: voteSeconds,
        revealSeconds = p.revealSeconds ?: revealSeconds,
        guessSeconds = p.guessSeconds ?: guessSeconds,
        tieBreak = p.tieBreak ?: tieBreak,
        blankGuess = p.blankGuess ?: blankGuess,
        wordLocale = p.wordLocale ?: wordLocale,
        packIds = p.packIds ?: if (p.wordLocale != null && p.wordLocale != wordLocale) emptyList() else packIds,
        difficulties = p.difficulties ?: difficulties,
        familyFilter = p.familyFilter ?: familyFilter,
        swapSides = p.swapSides ?: swapSides,
        points = p.points ?: points,
    )
}
