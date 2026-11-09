package app.jamaa.tv.games.trivia

import app.jamaa.tv.games.GameIds
import app.jamaa.tv.games.GameView
import app.jamaa.tv.protocol.GameEnvelope
import app.jamaa.tv.protocol.LocalizedTitle
import kotlinx.serialization.SerialName
import kotlinx.serialization.Serializable

// Quiz Night (GAME-TRIVIA §13.2, shared/src/games/trivia/protocol.ts) as the TV receives it. Field names and order are
// the zod schemas'; TriviaDecodeTest decodes every TV fixture of shared/fixtures/v2/games/trivia with the strict
// decoder, so a renamed or added key fails the build instead of silently dropping data.
// Secrecy (GAME-TRIVIA §8.1, §13.3): the TV projection never carries the correct position or anyone's choice before
// REVEAL; the composed [TriviaView] additionally ignores `reveal` outside REVEAL so no screen can draw it early.

@Serializable enum class TriviaPhase { QUIZ_INTRO, READ, ANSWER, REVEAL, LEADERBOARD, FINAL_INTRO, RESULTS, HOLD }

@Serializable enum class QuestionType {
    @SerialName("mc4") MC4,
    @SerialName("tf") TF,
}

/** `public.quiz`: the quiz card of the running game (family id, never a per-locale pack id). */
@Serializable data class TriviaQuiz(
    val id: String,
    val title: LocalizedTitle,
    val stars: Int,
    val domain: String,
    val featuredTopics: List<String>,
    val topicCount: Int,
    val questionCount: Int,
)

@Serializable data class TriviaQuestion(
    val id: String,
    val text: String,
    val type: QuestionType,
    val topic: String,
    val difficulty: Int,
)

/** One player's line of `reveal.choices` (REVEAL only). `choice` is the displayed position, null = no answer. */
@Serializable data class TriviaChoice(
    val id: String,
    val choice: Int?,
    val correct: Boolean,
    val timeMs: Long?,
    val points: Int,
    val streakBonus: Int,
)

@Serializable data class TriviaReveal(
    val correct: Int,
    val choices: List<TriviaChoice>,
    val fastestIds: List<String>,
    val onFireIds: List<String>,
    val stumped: Boolean,
    val genius: Boolean,
    val tooSlow: Boolean,
    val explain: String?,
    val voided: Boolean,
)

@Serializable data class TriviaScore(
    val playerId: String,
    val score: Int,
    val scoreBefore: Int,
    val rankBefore: Int?,
    val streak: Int,
    val bestStreak: Int,
    val correct: Int,
    val fastest: Int,
    val rank: Int?,
    val left: Boolean,
)

/** `game.public` for `trivia` (TriviaPublicSchema). `deadline` is the server epoch ms, `durationMs` the phase length. */
@Serializable data class TriviaPub(
    val schema: Int,
    val phase: TriviaPhase,
    val quiz: TriviaQuiz,
    val rerun: Boolean,
    val index: Int,
    val total: Int,
    val isFinal: Boolean,
    val deadline: Long?,
    val durationMs: Long?,
    val question: TriviaQuestion?,
    val options: List<String>,
    val answeredIds: List<String>,
    val reveal: TriviaReveal?,
    val scores: List<TriviaScore>,
    val newIds: List<String>,
    val waitingIds: List<String>,
    val endedEarly: Boolean,
)

/** `game.me` (phones only; the TV always receives null). Decoded for completeness and the phone-shaped fixtures. */
@Serializable data class TriviaMe(val myChoice: Int?, val myTimeMs: Long?, val waitingForNext: Boolean)

// ---------------------------------------------------------------- setup (`room.setup` while SETUP is Trivia's)

/** GAME-TRIVIA §9.1 quiz card (setup summary card, shelf). `moreTopics` = the "+n" after the featured chips. */
@Serializable data class QuizCardInfo(
    val id: String,
    val title: LocalizedTitle,
    val stars: Int,
    val domain: String,
    val featuredTopics: List<String>,
    val moreTopics: Int,
    val questionCount: Int,
    val tier: String,
)

/** `room.setup.extras` for `trivia`: `available` = questions playable now ("7 questions available"). */
@Serializable data class TriviaExtras(
    val gameId: String,
    val available: Int,
    val playCount: Int,
    val rerun: Boolean,
    val quiz: QuizCardInfo?,
    val quizzes: List<QuizCardInfo>,
)

/** `room.setup.settings` for `trivia` (GAME-TRIVIA §9). `quizId` is a family id; null = the server's default quiz. */
@Serializable data class TriviaSetupSettings(val quizId: String?, val length: String, val pace: String)

// ---------------------------------------------------------------- the composed view the screens draw

/** One player of the instance: the game's score line joined to its room member (names and colours are the room's). */
data class TriviaPlayer(
    val id: String,
    val name: String,
    val color: String,
    val seat: Int,
    val connected: Boolean,
    val left: Boolean,
    val isHost: Boolean,
    val score: Int,
    val scoreBefore: Int,
    val rankBefore: Int?,
    val rank: Int?,
    val streak: Int,
    val bestStreak: Int,
    val correct: Int,
    val fastest: Int,
    /** Answered the current question (ANSWER: `answeredIds`; never which answer). */
    val answered: Boolean,
    /** Joined mid-question: plays from the next READ (`waitingIds`). */
    val waiting: Boolean,
    /** The "New" ribbon for one question (`newIds`). */
    val isNew: Boolean,
)

/** The in-game Quiz Night view: [TriviaPub] with every score line joined to `room.members`, players in seat order. */
data class TriviaView(
    val n: Int,
    val phase: TriviaPhase,
    val quiz: TriviaQuiz,
    val rerun: Boolean,
    /** 0-based question index; [number] is what the counter shows. */
    val index: Int,
    val total: Int,
    val isFinal: Boolean,
    val deadline: Long?,
    val durationMs: Long?,
    val question: TriviaQuestion?,
    val options: List<String>,
    val answeredIds: List<String>,
    /** Non-null in REVEAL only (secrecy guard, GAME-TRIVIA §8.1). */
    val reveal: TriviaReveal?,
    val players: List<TriviaPlayer>,
    val endedEarly: Boolean,
    val over: Boolean,
    val contentLocale: String,
) {
    val number: Int get() = index + 1
    fun player(id: String?): TriviaPlayer? = if (id == null) null else players.firstOrNull { it.id == id }

    /** Players still in the game (left players keep a frozen, greyed score). */
    val active: List<TriviaPlayer> get() = players.filter { !it.left }
}

/** The decoded active Trivia instance. */
data class TriviaGameView(override val envelope: GameEnvelope, val view: TriviaView) : GameView {
    override val gameId: String get() = GameIds.TRIVIA
}

/** Trivia during SETUP: what the summary card and the quiz shelf draw (GAME-TRIVIA §9, DESIGN-JAMAA §2.3.1). */
data class TriviaSetupView(
    val settings: TriviaSetupSettings,
    val extras: TriviaExtras,
    val premium: Boolean,
    val contentLocale: String,
)
