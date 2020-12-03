import { pageIsControlledByServiceWorker } from "./internal/navigator-worker.js"
import { sendMessageUsingChannel } from "./internal/sendMessageUsingChannel.js"

export const listenNavigatorControllerUpdateAvailable = (callback) => {
  if (!pageIsControlledByServiceWorker()) {
    return () => {}
  }

  let removed = false
  let removeUpdateFoundListener = () => {}
  let removeStateChangeListener = () => {}

  window.navigator.serviceWorker.ready.then((registration) => {
    if (removed) return

    const onupdatefound = () => {
      const nextWorker = registration.installing

      // https://developer.mozilla.org/en-US/docs/Web/API/ServiceWorker/onstatechange
      const onstatechange = () => {
        if (nextWorker.state === "installed") {
          callback({
            skipWaiting: () => {
              sendMessageUsingChannel({ action: "skipWaiting" }, nextWorker)
            },
          })
        }
      }
      nextWorker.addEventListener("statechange", onstatechange)
      removeStateChangeListener = () => {
        nextWorker.removeEventListener("statechange", onstatechange)
      }
    }
    removeUpdateFoundListener = () => {
      registration.removeEventListener("updatefound", onupdatefound)
    }
  })

  return () => {
    removed = true
    removeUpdateFoundListener()
    removeStateChangeListener()
  }
}
