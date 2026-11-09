package app.jamaa.tv.games.trivia

import app.jamaa.tv.game.Cue
import app.jamaa.tv.game.CuePlay
import app.jamaa.tv.game.SoundCues

/**
 * Quiz Night sounds on the TV (GAME-TRIVIA §12.6, DESIGN-JAMAA §5.5), pure so the rules are JVM-tested. Delays follow
 * the [TriviaMoments] step lists, so each cue lands with its keyframe. Only platform cues are used: the platform's
 * SoundPool loads [Cue] (res/raw platform files) and has no entry point for the generated per-game cue index
 * (SoundCuesTrivia) yet — JAMAA-GAP in the lane report; the DESIGN-JAMAA §5.5 aliases are used meanwhile
 * (`trivia.buzz` = answer_lock, `trivia.correct` = quiz_correct, `trivia.wrong` = quiz_wrong, the slam = sfx.stamp,
 * the tile flip = sfx.flip, the drum build = sfx.drumroll).
 * The TV never plays a "wrong" sound for one player: quiz_wrong only when nobody was right.
 */
object TriviaCues {
    /** Answer locks are at least this far apart (DESIGN-JAMAA §5.4 "≥ 120 ms apart"). */
    const val LOCK_GAP_MS = 120L

    /** At most 10 landing ticks per award (platform §3.10 C). */
    const val MAX_LAND_TICKS = 10

    /**
     * Cues for one new view. [before] null = the first view of this screen (a reconnect mid-phase plays nothing but
     * the phase's own entry when it just started, [freshPhase]).
     */
    fun transition(before: TriviaView?, after: TriviaView, freshPhase: Boolean = true): List<CuePlay> {
        val samePhase = before != null && before.n == after.n && before.phase == after.phase && before.index == after.index
        if (samePhase) return answerLocks(before!!, after)
        if (!freshPhase) return emptyList()
        return entry(after)
    }

    /** One `answer_lock` per newly answered player during ANSWER (no hint of the answer: same sound for everyone). */
    fun answerLocks(before: TriviaView, after: TriviaView): List<CuePlay> {
        if (after.phase != TriviaPhase.ANSWER) return emptyList()
        val was = before.answeredIds.toSet()
        return after.answeredIds.filter { it !in was }.mapIndexed { i, _ -> CuePlay(Cue.ANSWER_LOCK, delayMs = LOCK_GAP_MS * i) }
    }

    /** The cues of entering a phase, timed to its moment. */
    fun entry(v: TriviaView): List<CuePlay> = when (v.phase) {
        TriviaPhase.QUIZ_INTRO -> {
            // The stars fill one by one, cup_star pitched up per star; the moment starts after the entrance grace.
            val lead = ((v.durationMs ?: TriviaMoments.QUIZ_INTRO_MS) - TriviaMoments.QUIZ_INTRO_MS).coerceAtLeast(0L)
            (0 until v.quiz.stars.coerceIn(1, 3)).map { i ->
                CuePlay(Cue.CUP_STAR, SoundCues.semitones(SoundCues.PENTATONIC[5 + i * 2]), lead + 400L + 150L * i)
            }
        }
        TriviaPhase.READ -> listOf(CuePlay(Cue.STAMP, delayMs = TriviaMoments.SLAM_LAND_MS))
        TriviaPhase.ANSWER -> listOf(CuePlay(Cue.FLIP))
        TriviaPhase.REVEAL -> reveal(v)
        TriviaPhase.LEADERBOARD -> buildList {
            add(CuePlay(Cue.COUNTER_TICK, delayMs = 300L))
            if (TriviaBoard.leaders(v).isNotEmpty()) add(CuePlay(Cue.CROWN_DROP, delayMs = 2_100L))
        }
        TriviaPhase.FINAL_INTRO -> listOf(CuePlay(Cue.DRUMROLL), CuePlay(Cue.STAMP, delayMs = TriviaMoments.FINAL_STAMP_LAND_MS))
        TriviaPhase.RESULTS -> listOf(CuePlay(Cue.DRUMROLL), CuePlay(Cue.CROWN_DROP, delayMs = 1_300L))
        TriviaPhase.HOLD -> emptyList()
    }

    /** The reveal timeline (GAME-TRIVIA §12.3). */
    fun reveal(v: TriviaView): List<CuePlay> {
        val r = v.reveal ?: return emptyList()
        val out = mutableListOf(CuePlay(Cue.TIME_UP))
        if (r.voided) return out
        if (r.stumped) {
            out += CuePlay(Cue.QUIZ_WRONG, delayMs = 300L)
            return out
        }
        out += CuePlay(Cue.QUIZ_CORRECT, delayMs = 300L)
        val jumpers = TriviaBoard.stacks(v).values.sumOf { it.size }
        for (i in 0 until minOf(jumpers, MAX_LAND_TICKS)) {
            out += CuePlay(Cue.COIN_LAND, 0.8f, TriviaMoments.JUMP_AT + TriviaMoments.JUMP_STAGGER * i + 260L)
        }
        if (r.fastestIds.isNotEmpty()) out += CuePlay(Cue.REACTION_POP, 1.5f, 2_400L)
        val coins = TriviaBoard.coins(v)
        if (coins.isNotEmpty()) out += CuePlay(Cue.COIN_FLY, delayMs = TriviaMoments.COIN_AT.toLong())
        coins.take(MAX_LAND_TICKS).forEachIndexed { i, _ ->
            val rate = SoundCues.semitones(SoundCues.PENTATONIC[minOf(SoundCues.PENTATONIC.size - 1, 4 + i)])
            out += CuePlay(Cue.COIN_LAND, rate, (TriviaMoments.COIN_AT + TriviaMoments.COIN_MS + TriviaMoments.COIN_STAGGER * i).toLong())
        }
        if (TriviaBoard.overtakers(v).isNotEmpty()) out += CuePlay(Cue.COUNTER_TICK, delayMs = TriviaMoments.REORDER_AT.toLong())
        if (r.genius) out += CuePlay(Cue.ALL_READY, delayMs = 900L)
        return out
    }

    /**
     * The ANSWER countdown tick: one `sfx.tick` each time the remaining whole seconds drop within the last 5 s
     * ([prevMs] → [nowMs], remaining milliseconds). Null when no second boundary was crossed.
     */
    fun tick(prevMs: Long?, nowMs: Long): Cue? {
        if (prevMs == null || nowMs >= prevMs || nowMs <= 0L) return null
        val p = (prevMs + 999) / 1_000
        val n = (nowMs + 999) / 1_000
        return if (n < p && n in 1..5) Cue.TICK else null
    }
}
