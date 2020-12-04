// service worker
export {
  canUseServiceWorker,
  registerServiceWorker,
  navigatorIsControlledByAServiceWorker,
  getServiceWorkerControllingNavigator,
  listenServiceWorkerControllingNavigatorChange,
  sendMessageToServiceWorkerControllingNavigator,
  serviceWorkerUpdateIsAvailable,
  listenServiceWorkerUpdateAvailable,
  checkServiceWorkerUpdate,
  activateServiceWorkerUpdate,
} from "./src/navigatorController.js"

// add to home screen
export { listenAddToHomescreenAvailable, promptAddToHomescreen } from "./src/add-to-home-screen.js"

// others
export { listenAppInstalled } from "./src/listenAppInstalled.js"
