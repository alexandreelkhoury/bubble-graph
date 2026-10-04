package app.mishana.tv.game

/** Where cues go: SoundPool on the device ([app.mishana.tv.audio.SoundPoolPlayer]), nothing in JVM tests. */
interface SoundSink {
    fun play(p: CuePlay)

    /** Cuts what is ringing and anything scheduled (mute, a skipped reveal). */
    fun stopAll()

    fun release()

    object None : SoundSink {
        override fun play(p: CuePlay) = Unit
        override fun stopAll() = Unit
        override fun release() = Unit
    }
}
