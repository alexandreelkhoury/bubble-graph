package app.mishana.tv.net

import app.mishana.tv.Constants
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Job
import kotlinx.coroutines.delay
import kotlinx.coroutines.isActive
import kotlinx.coroutines.launch

/**
 * App-level heartbeat (SPEC §6.5, §9.7): every [intervalMs] send PING_FRAME; if no PONG_FRAME arrives within
 * [timeoutMs] of a ping, call [onTimeout] once (the socket then cancels and reconnects).
 * Pure timing logic: the scope, clock and send function are injected (tests use virtual time).
 */
class Heartbeat(
    private val scope: CoroutineScope,
    private val clock: () -> Long,
    private val send: (String) -> Boolean,
    private val onTimeout: () -> Unit,
    private val intervalMs: Long = Constants.HEARTBEAT_INTERVAL_MS,
    private val timeoutMs: Long = Constants.PONG_TIMEOUT_MS,
) {
    private val lock = Any()
    private var loop: Job? = null
    private var watchdog: Job? = null

    /** Clock time of the last ping sent (null when none is outstanding). */
    @Volatile var pendingSince: Long? = null
        private set

    /** Clock time of the last pong received, or null. */
    @Volatile var lastPongAt: Long? = null
        private set

    fun start() {
        synchronized(lock) {
            cancelJobs()
            pendingSince = null
            loop = scope.launch {
                while (isActive) {
                    delay(intervalMs)
                    ping()
                }
            }
        }
    }

    private fun ping() {
        synchronized(lock) {
            if (pendingSince == null) pendingSince = clock()
            watchdog?.cancel()
            watchdog = scope.launch {
                delay(timeoutMs)
                val timedOut = synchronized(lock) {
                    if (pendingSince != null) {
                        cancelJobs()
                        true
                    } else {
                        false
                    }
                }
                if (timedOut) onTimeout()
            }
        }
        send(Constants.PING_FRAME)
    }

    fun onPong() {
        synchronized(lock) {
            pendingSince = null
            lastPongAt = clock()
            watchdog?.cancel()
            watchdog = null
        }
    }

    fun stop() {
        synchronized(lock) {
            cancelJobs()
            pendingSince = null
        }
    }

    private fun cancelJobs() {
        loop?.cancel()
        loop = null
        watchdog?.cancel()
        watchdog = null
    }
}
