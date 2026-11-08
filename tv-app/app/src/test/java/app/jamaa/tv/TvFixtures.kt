package app.jamaa.tv

import app.jamaa.tv.games.mishana.MishanaSetupView
import app.jamaa.tv.games.mishana.MishanaTv
import app.jamaa.tv.games.mishana.MishanaView
import app.jamaa.tv.protocol.GuessStatus
import app.jamaa.tv.protocol.GuessView
import app.jamaa.tv.protocol.Phase
import app.jamaa.tv.protocol.ProtocolJson
import app.jamaa.tv.protocol.RoomView
import app.jamaa.tv.protocol.ServerMessage
import app.jamaa.tv.protocol.StateMsg

/** The TV views of shared/fixtures/v2 (JAMAA-PLATFORM §2.5), decoded with the strict decoder. */
object TvFixtures {
    fun state(name: String): StateMsg =
        ProtocolJson.strict.decodeFromString(ServerMessage.serializer(), Fixtures.v2("s2c.state.tv.$name.json")) as StateMsg

    /** e.g. "hub", "setup.mishana", "playing.mishana.voting". */
    fun room(name: String): RoomView = state(name).view

    /** The composed Mish Ana! view of a `playing.mishana.<phase>` fixture. */
    fun mishana(phase: String): MishanaView {
        val v = room("playing.mishana.$phase")
        return MishanaTv.decode(v.game!!, v.room).view
    }

    /** Phases without a v2 TV fixture, derived from the nearest fixture (same players, public fields only). */
    fun tieBreak(): MishanaView = mishana("voting").let { v ->
        val tied = v.players.take(2).map { it.id }
        v.copy(phase = Phase.TIE_BREAK, revote = true, tieCandidates = tied, speakingOrder = tied, currentSpeakerId = tied[0])
    }

    fun guess(status: GuessStatus = GuessStatus.PENDING): MishanaView = mishana("elimination").let { v ->
        v.copy(phase = Phase.MR_WHITE_GUESS, guess = GuessView(v.eliminated!!.playerId, status, if (status == GuessStatus.PENDING) null else "Bicycle", false))
    }

    fun setup(): MishanaSetupView = MishanaTv.setupView(room("setup.mishana").room)!!
}
