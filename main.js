// service worker
export {
  canUseServiceWorker,
  // registration
  registerServiceWorker,
  serviceWorkerIsAvailable,
  // update
  listenServiceWorkerUpdate,
  getServiceWorkerUpdate,
  checkServiceWorkerUpdate,
  activateServiceWorkerUpdating,
  autoReloadAfterUpdateIsEnabled,
  disableAutoReloadAfterUpdate,
  // utils
  sendMessageToServiceWorker,
  sendMessageToServiceWorkerUpdating,
} from "./src/navigatorController.js"

// add to home screen
export { listenAddToHomescreenAvailable, promptAddToHomescreen } from "./src/add-to-home-screen.js"
export { listenAppInstalled } from "./src/listenAppInstalled.js"
