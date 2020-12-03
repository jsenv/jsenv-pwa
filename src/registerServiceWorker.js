import {
  canUseServiceWorker,
  getServiceWorkerControllingPage,
} from "./internal/navigator-worker.js"

export const registerServiceWorker = (url, { scope, onstatechange = () => {} }) => {
  if (!canUseServiceWorker) {
    return () => {}
  }

  const navigatorServiceWorker = window.navigator.serviceWorker

  let unregistered = false
  let unregister = () => {}
  let removeStateChangeListener = () => {}

  ;(async () => {
    try {
      const registration = await navigatorServiceWorker.register(url, { scope })
      if (unregistered) return

      const installStateChangeCallback = (serviceWorker) => {
        onstatechange(serviceWorker.state, serviceWorker)
        const statechangeCallback = () => {
          onstatechange(serviceWorker.state, serviceWorker)
        }
        serviceWorker.addEventListener("statechange", statechangeCallback)
        removeStateChangeListener = () => {
          serviceWorker.removeEventListener("statechange", statechangeCallback)
        }
      }

      const serviceWorkerControllingPage = getServiceWorkerControllingPage()
      const { installing, waiting, active } = registration

      if (serviceWorkerControllingPage) {
        installStateChangeCallback(serviceWorkerControllingPage)
      } else if (installing) {
        installStateChangeCallback(installing)
      } else if (waiting) {
        installStateChangeCallback(waiting)
      } else if (active) {
        installStateChangeCallback(active)
      }

      unregister = () => {
        registration.unregister()
      }
    } catch (e) {
      console.warn("ServiceWorker registration failed: ", e)
    }
  })()

  return () => {
    unregistered = true
    unregister()
    removeStateChangeListener()
  }
}
