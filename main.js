export { addToHomescreen } from "./src/add-to-home-screen.js"

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
  activateServiceWorkerUpdate,
  autoReloadAfterUpdateIsEnabled,
  disableAutoReloadAfterUpdate,
  // utils
  sendMessageToServiceWorker,
  sendMessageToServiceWorkerUpdate,
  // private
  enableServiceWorkerLogs,
} from "./src/navigatorController.js"
