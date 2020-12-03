import { pageIsControlledByServiceWorker } from "./internal/navigator-worker.js"

/**
 * This function is meant to trigger a manual update of the service worker
 * controlling the navigator is there is any.
 * It's meant mostly to check if return value is undefined or false
 * to deduce there is no update available.
 * However the true return value should not be handled there
 * but rather in the listenNavigatorControllerUpdateAvailable()
 */
export const checkNavigatorControllerUpdate = async () => {
  if (!pageIsControlledByServiceWorker()) {
    return undefined
  }
  const registration = await window.navigator.serviceWorker.ready
  const updateRegistration = await registration.update()

  const { installing, waiting } = updateRegistration
  if (!installing && !waiting) {
    return false
  }

  return true
}
