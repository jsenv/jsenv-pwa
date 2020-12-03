import { canUseServiceWorker } from "./internal/navigator-worker.js"

// https://developer.mozilla.org/en-US/docs/Web/API/ServiceWorkerContainer/controller
export const listenNavigatorController = (callback) => {
  if (!canUseServiceWorker) {
    return () => {}
  }

  const navigatorServiceWorker = window.navigator.serviceWorker

  const checkController = () => {
    callback(navigatorServiceWorker.controller)
  }

  checkController()
  // This fires when the service worker controlling this page
  // changes, eg a new worker has skipped waiting and become
  // the new active worker.
  navigatorServiceWorker.addEventListener("controllerchange", checkController)
  return () => {
    navigatorServiceWorker.removeEventListener("controllerchange", checkController)
  }
}
