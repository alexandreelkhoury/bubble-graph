package app.jamaa.tv.platform

import app.jamaa.tv.AvatarShape
import app.jamaa.tv.protocol.GameEnvelope
import app.jamaa.tv.protocol.MemberPublic
import app.jamaa.tv.ui.characters.CharacterPaths

// JAMAA-PLATFORM §3.7 characters, the pure part (JVM-tested): the 13 expressions, the reaction bursts, the per-shape
// face boxes (DESIGN-JAMAA §4.2) and the expression a character shows. Secrecy (§3.7, DESIGN-JAMAA §4.3): the
// expression is a function of public data only — the member (connected, reaction) and the envelope's
// doneIds/awaitedIds — never of a game's secret fields.
// Geometry (body paths, face boxes, feature paths) is lane D's generated ui/characters/CharacterPaths.kt.

enum class Expression { IDLE, THINK, DONE, HAPPY, LAUGH, SMUG, SHOCK, SAD, FACEPALM, SHY, POINT, CHEER, AWAY }

/** §3.7 icon bursts above a reacting character. */
enum class Burst { TEARS, EXCLAIM, SWEAT, HEART, RAINCLOUD, CONFETTI }

/** A face box in body units (24-unit viewBox); features are designed in a 12 × 9 face space scaled by `w / 12`. */
data class FaceBox(val x: Float, val y: Float, val w: Float, val h: Float) {
    val scale: Float get() = w / 12f
}

object CharacterRules {
    /** A reaction shows for this long, keyed by `reaction.n` so repeats replay (§3.7). */
    const val REACTION_MS = 1_500L

    /** Faces are drawn only at ≥ 40 dp; smaller sizes show the plain glyph (§3.7). */
    const val MIN_FACE_DP = 40

    /** Expressions are legible from 72 dp; below 64 dp features scale ×1.5 (DESIGN-JAMAA §4.2 size floor). */
    const val LEGIBLE_DP = 72
    const val FLOOR_DP = 64

    fun expressionOf(reaction: String): Expression? = when (reaction) {
        "laugh" -> Expression.LAUGH
        "shock" -> Expression.SHOCK
        "facepalm" -> Expression.FACEPALM
        "happy" -> Expression.HAPPY
        "sad" -> Expression.SAD
        "cheer" -> Expression.CHEER
        else -> null
    }

    fun burstOf(reaction: String): Burst? = when (reaction) {
        "laugh" -> Burst.TEARS
        "shock" -> Burst.EXCLAIM
        "facepalm" -> Burst.SWEAT
        "happy" -> Burst.HEART
        "sad" -> Burst.RAINCLOUD
        "cheer" -> Burst.CONFETTI
        else -> null
    }

    /** The face box of a shape, from the generated [CharacterPaths] (DESIGN-JAMAA §4.2). */
    fun faceBox(shape: AvatarShape): FaceBox {
        val b = CharacterPaths.faceBoxes.getValue(shape.name.lowercase())
        return FaceBox(b.x, b.y, b.w, b.h)
    }

    /** Feature scale multiplier: ×1.5 below 64 dp, and a further ×1.2 for the bolt and star faces. */
    fun featureBoost(sizeDp: Float, shape: AvatarShape): Float {
        var f = if (sizeDp < FLOOR_DP) 1.5f else 1f
        if (sizeDp < FLOOR_DP && (shape == AvatarShape.Bolt || shape == AvatarShape.Star)) f *= 1.2f
        return f
    }

    /**
     * The expression a member's character shows now. Priority: away (disconnected) → an active reaction → `done`
     * (in `game.doneIds`) → `think` (in `game.awaitedIds`) → [fallback] (idle, or an event expression the screen holds).
     */
    fun expression(member: MemberPublic, game: GameEnvelope?, activeReaction: String?, fallback: Expression = Expression.IDLE): Expression {
        if (!member.connected) return Expression.AWAY
        activeReaction?.let { expressionOf(it) }?.let { return it }
        if (game != null) {
            if (member.id in game.doneIds) return Expression.DONE
            if (member.id in game.awaitedIds) return Expression.THINK
        }
        return fallback
    }
}

/**
 * Which reactions are playing (pure): fed every members snapshot with the local time, it starts a reaction when a
 * member's `reaction.n` changes (so a repeat replays) and ends it after [CharacterRules.REACTION_MS]. The first
 * snapshot only records the counters, so a reconnect never replays old reactions.
 */
class ReactionTracker {
    private var seen: Map<String, Int>? = null
    private val active = HashMap<String, Pair<String, Long>>()

    /** Returns the members whose reaction just started (to play `reaction_pop` and the burst). */
    fun update(members: List<MemberPublic>, nowMs: Long): List<String> {
        val prev = seen
        val next = members.associate { it.id to (it.reaction?.n ?: 0) }
        seen = next
        if (prev == null) return emptyList()
        val started = mutableListOf<String>()
        for (m in members) {
            val r = m.reaction ?: continue
            if (r.n != (prev[m.id] ?: 0)) {
                active[m.id] = r.kind to nowMs
                started += m.id
            }
        }
        active.keys.retainAll(next.keys)
        return started
    }

    /** The reaction kind playing for [memberId] at [nowMs], or null. */
    fun activeFor(memberId: String, nowMs: Long): String? {
        val (kind, at) = active[memberId] ?: return null
        return if (nowMs - at < CharacterRules.REACTION_MS) kind else null
    }

    fun reset() {
        seen = null
        active.clear()
    }
}
