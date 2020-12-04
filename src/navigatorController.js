import { listenEvent } from "./internal/listenEvent.js"
import { sendMessageUsingChannel } from "./internal/sendMessageUsingChannel.js"

const serviceWorkerAPI = window.navigator.serviceWorker

export const canUseServiceWorker = Boolean(serviceWorkerAPI)

export const registerServiceWorkerControllingNavigator = (
  url,
  { scope, onstatechange = () => {} } = {},
) => {
  let unregistered = false
  let unregister = () => {}
  let removeStateChangeListener = () => {}

  ;(async () => {
    try {
      const registration = await serviceWorkerAPI.register(url, { scope })
      if (unregistered) return
      unregister = () => {
        registration.unregister()
      }

      const serviceWorker = registrationToServiceWorker(registration)
      if (serviceWorker) {
        onstatechange(serviceWorker.state, serviceWorker)
        const statechangeCallback = () => {
          onstatechange(serviceWorker.state, serviceWorker)
        }
        removeStateChangeListener = listenEvent(serviceWorker, "statechange", statechangeCallback)
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

const getServiceWorkerControllingNavigator = () => {
  return navigatorIsControlledByAServiceWorker() ? serviceWorkerAPI.controller : null
}

const registrationToServiceWorker = (registration) => {
  const serviceWorkerControllingNavigator = getServiceWorkerControllingNavigator()
  if (serviceWorkerControllingNavigator) {
    return serviceWorkerControllingNavigator
  }

  const { installing } = registration
  if (installing) {
    return installing
  }

  const { waiting } = registration
  if (waiting) {
    return waiting
  }

  const { active } = registration
  if (active) {
    return active
  }

  return null // is it possible at all?
}

export const navigatorIsControlledByAServiceWorker = () => {
  return canUseServiceWorker ? Boolean(serviceWorkerAPI.controller) : false
}

export const listenServiceWorkerControllingNavigatorChange = (callback) => {
  if (!canUseServiceWorker) return () => {}
  return listenEvent(serviceWorkerAPI, "controllerchange", callback)
}

export const sendMessageToServiceWorkerControllingNavigator = (message) => {
  const controller = getServiceWorkerControllingNavigator()
  if (controller) {
    return sendMessageUsingChannel(controller, message)
  }
  return undefined
}

// update
let serviceWorkerUpdating = null
const updateAvailableCallbackSet = new Set()

export const serviceWorkerControllingNavigatorUpdateIsAvailable = () => {
  return Boolean(serviceWorkerUpdating)
}

export const listenServiceWorkerControllingNavigatorUpdateAvailable = (callback) => {
  updateAvailableCallbackSet.add(callback)
  return () => {
    updateAvailableCallbackSet.delete(callback)
  }
}

export const attemptServiceWorkerControllingNavigatorUpdate = async () => {
  const registration = await serviceWorkerAPI.ready
  const updateRegistration = await registration.update()

  const { installing } = updateRegistration
  if (installing) {
    console.log("installing worker found after calling update()")
    onWorkerUpdating(installing)
    return true
  }

  const { waiting } = updateRegistration
  if (waiting) {
    console.log("waiting worker found after calling update()")
    onWorkerUpdating(waiting)
    return true
  }

  console.log("no worker found after calling update()")
  return false
}

export const activateServiceWorkerControllingNavigatorUpdate = async ({
  onActivating = () => {},
} = {}) => {
  if (!serviceWorkerUpdating) {
    throw new Error("no service worker update to activate")
  }

  const { state } = serviceWorkerUpdating
  const waitUntilActivated = () => {
    return new Promise((resolve) => {
      const removeStateChangeListener = listenEvent(serviceWorkerUpdating, "statechange", () => {
        if (serviceWorkerUpdating.state === "activating") {
          onActivating()
        }
        if (serviceWorkerUpdating.state === "activated") {
          removeStateChangeListener()
          resolve()
        }
      })
    })
  }

  // worker must be waiting (meaning state must be "installed")
  // to be able to call skipWaiting on it.
  // If it's installing it's an error.
  // If it's activating, we'll just skip the skipWaiting call
  // If it's activated, we'll just return early
  if (state === "installed") {
    sendMessageUsingChannel(serviceWorkerUpdating, { action: "skipWaiting" })
    await waitUntilActivated()
  } else if (state === "activating") {
    onActivating()
    await waitUntilActivated()
  }

  // activated or redundant, nothing to do
}

/*
 * A service worker update is done when service worker is activated
 * and navigator.controller becomes the new service worker.
 * Code listens to controller change to make navigator reload itself when it happens.
 * This pattern is described in
 * https://redfin.engineering/how-to-fix-the-refresh-button-when-using-service-workers-a8e27af6df68
 * It allows to ensure all urls (js, imgs, ...)
 * are reloaded in the application (because they may be outdated)
 *
 * Reloading navigator by default works in any case and easy to implement.
 *
 * Remember that code must call activateServiceWorkerUpdate() before browser is reloaded.
 * It means browser will not widly reload by itself. It will reload shortly after you call
 * activateServiceWorkerUpdate().
 *
 * If you want to control when browser is reloaded even if you explicitely called
 * activateServiceWorkerUpdate(), call disableAutoReloadAfterServiceWorkerUpdate().
 * You might want to do this because:
 *  - You want to exlain every bit of details in your interface and display a message like
 *  "service worker update is done. You can reload your browser"
 *  - You implement a fine grained approach where you selectively decides to reload browser or not.
 *
 * see also https://stackoverflow.com/questions/40100922/activate-updated-service-worker-on-refresh
 */
let disableAutoReload = () => {}
export const disableAutoReloadAfterServiceWorkerUpdate = () => disableAutoReload()

const onWorkerUpdating = (worker) => {
  if (serviceWorkerUpdating && serviceWorkerUpdating === worker) {
    // we already know about this worker, no need to listen state changes.
    // it happens for manual updates where we bot detect it
    // from registration.update() return value
    // and "updatefound" event
    console.log("we already know this worker is updating")
    return
  }
  console.log(`found a worker updating (worker state is: ${worker.state})`)
  serviceWorkerUpdating = worker
  updateAvailableCallbackSet.forEach((callback) => {
    callback()
  })
}

let removeUpdateFoundListener = () => {}
const onNavigatorControlled = async () => {
  const registration = await serviceWorkerAPI.ready
  removeUpdateFoundListener()
  removeUpdateFoundListener = listenEvent(registration, "updatefound", () => {
    console.log("browser notifies use an worker is installing")
    onWorkerUpdating(registration.installing)
  })
}

if (canUseServiceWorker) {
  if (navigatorIsControlledByAServiceWorker()) {
    onNavigatorControlled()
  }
  listenServiceWorkerControllingNavigatorChange(onNavigatorControlled)

  let refreshing = false
  disableAutoReload = listenServiceWorkerControllingNavigatorChange(() => {
    if (refreshing) {
      return
    }
    refreshing = true
    window.location.reload()
  })
}
