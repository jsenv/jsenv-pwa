// add to home screen
export { listenAddToHomescreenAvailable, promptAddToHomescreen } from "./src/add-to-home-screen.js"
export { displayModeStandalone } from "./src/displayModeStandalone.js"
export { listenAppInstalled } from "./src/listenAppInstalled.js"

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
