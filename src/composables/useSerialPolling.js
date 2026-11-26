import { onBeforeUnmount, onMounted, watch } from 'vue'

const MAX_RETRY_DELAY = 60_000

// Return false from run to stop polling after a successful cycle.
export function useSerialPolling(run, { interval, enabled = () => true }) {
  let mounted = false
  let pending = false
  let inFlight = null
  let timer
  let delay = interval

  const canRun = () => mounted && enabled() && !document.hidden

  async function runPending() {
    if (!pending || inFlight || !canRun()) return
    pending = false

    const controller = new AbortController()
    inFlight = controller
    const isCurrent = () => !controller.signal.aborted && canRun()
    let repeat = true
    try {
      repeat = await run(controller.signal, isCurrent) !== false
      if (isCurrent()) delay = interval
    } catch {
      if (isCurrent()) delay = Math.min(delay * 2, MAX_RETRY_DELAY)
    } finally {
      // An aborted request still occupies the slot until its promise settles.
      inFlight = null
    }

    if (pending) queueMicrotask(runPending)
    else if (repeat && isCurrent()) timer = setTimeout(refresh, delay)
  }

  function refresh() {
    if (!canRun()) return
    clearTimeout(timer)
    pending = true
    inFlight?.abort()
    queueMicrotask(runPending)
  }

  function pause() {
    clearTimeout(timer)
    pending = false
    inFlight?.abort()
  }

  function syncActivity() {
    if (canRun()) refresh()
    else pause()
  }

  onMounted(() => {
    mounted = true
    document.addEventListener('visibilitychange', syncActivity)
    syncActivity()
  })
  onBeforeUnmount(() => {
    mounted = false
    document.removeEventListener('visibilitychange', syncActivity)
    pause()
  })
  watch(enabled, syncActivity)

  return refresh
}
