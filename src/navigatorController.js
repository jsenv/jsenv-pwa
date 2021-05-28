// do not forget error handling: https://developer.mozilla.org/en-US/docs/Web/API/ServiceWorkerContainer/onerror

import { createSignal } from "./internal/createSignal.js"
import { listenEvent } from "./internal/listenEvent.js"
import { sendMessageUsingChannel } from "./internal/sendMessageUsingChannel.js"

const serviceWorkerAPI = window.navigator.serviceWorker
let logEnabled = false
const log = (...args) => {
  if (logEnabled) {
    console.log(...args)
  }
}

export const enableServiceWorkerLogs = () => {
  logEnabled = true
}

export const canUseServiceWorker =
  Boolean(serviceWorkerAPI) && document.location.protocol === "https:"

// https://developer.mozilla.org/en-US/docs/Web/API/ServiceWorkerRegistration
let registrationPromise = null
let serviceWorker = null
const serviceWorkerSetter = (worker) => {
  serviceWorker = worker
}

let serviceWorkerUpdating = null
const serviceWorkerUpdatingChangeSignal = createSignal()
const serviceWorkerUpdatingSetter = (worker) => {
  if (serviceWorkerUpdating && serviceWorkerUpdating === worker) {
    // we already know about this worker, no need to listen state changes.
    // it happens for manual updates where we bot detect it
    // from registration.update() return value
    // and "updatefound" event
    log("we already know this worker is updating")
    return
  }
  if (worker) {
    log(`found a worker updating (worker state is: ${worker.state})`)
  } else {
    log(`worker update is done`)
  }
  serviceWorkerUpdating = worker
  serviceWorkerUpdatingChangeSignal.emit()
}

export const serviceWorkerIsAvailable = () => Boolean(registrationPromise)

export const registerServiceWorker = (url, { scope } = {}) => {
  if (!canUseServiceWorker) {
    return () => {}
  }

  let unregistered = false
  let unregister = () => {}
  let removeUpdateFoundListener = () => {}

  registrationPromise = serviceWorkerAPI.register(url, { scope })
  ;(async () => {
    const registration = await registrationPromise
    unregister = () => {
      registration.unregister()
    }

    if (unregistered) {
      unregister()
      return
    }

    const { installing, waiting, active } = registration
    serviceWorkerSetter(installing || waiting || active)
    removeUpdateFoundListener = listenEvent(registration, "updatefound", () => {
      log("browser notifies use an worker is installing")
      if (registration.installing === installing) {
        log(`it's not an worker update, it's first time worker registers`)
        return
      }
      serviceWorkerUpdatingSetter(registration.installing)
    })
  })()

  return () => {
    unregistered = true
    removeUpdateFoundListener()
    unregister()
  }
}

// export const getServiceWorkerState = () => {
//   if (serviceWorker) {
//     return serviceWorker.state
//   }
//   return null
// }

// export const listenServiceWorkerState = (callback) => {
//   let removeStateChangeListener = () => {}
//   const removeWorkerChangeListener = serviceWorkerChangeSignal.listen(() => {
//     callback()
//     removeStateChangeListener = listenEvent(serviceWorker, "statechange", callback)
//   })
//   return () => {
//     removeWorkerChangeListener()
//     removeStateChangeListener()
//   }
// }

/*
 * sendMessageToServiceWorker communicates with the current service worker.
 *
 * As soon as a new worker is activating, the current service worker
 * becomes the new one and sendMessageToServiceWorker communicate with it.
 * This is because browser kills the old service worker as soon as a new worker
 * version starts to activate
 */
export const sendMessageToServiceWorker = (message) => {
  if (!serviceWorker) {
    console.warn(`no service worker to send message to`)
    return undefined
  }
  return sendMessageUsingChannel(serviceWorker, message)
}

export const getServiceWorkerUpdate = () => {
  return serviceWorkerUpdating
    ? {
        shouldBecomeNavigatorController: Boolean(serviceWorkerAPI.controller),
        navigatorWillReload: autoReloadEnabled,
      }
    : null
}

export const listenServiceWorkerUpdate = (callback) => {
  return serviceWorkerUpdatingChangeSignal.listen(callback)
}

export const checkServiceWorkerUpdate = async () => {
  if (!registrationPromise) {
    console.warn(`registerServiceWorker must be called before checkServiceWorkerUpdate can be used`)
    return false
  }

  const registration = await registrationPromise
  // await for the registration promise above can take some time
  // especially when the service worker is installing for the first time
  // because it is fetching a lot of urls to put into cache.
  // In that scenario we might want to display something different ?
  // Without this UI seems to take ages to check for an update
  const updateRegistration = await registration.update()

  const { installing } = updateRegistration
  if (installing) {
    log("installing worker found after calling update()")
    serviceWorkerUpdatingSetter(installing)
    return true
  }

  const { waiting } = updateRegistration
  if (waiting) {
    log("waiting worker found after calling update()")
    serviceWorkerUpdatingSetter(waiting)
    return true
  }

  log("no worker found after calling update()")
  return false
}

export const sendMessageToServiceWorkerUpdate = (message) => {
  if (!serviceWorkerUpdating) {
    console.warn(`no service worker updating to send message to`)
    return undefined
  }
  return sendMessageUsingChannel(serviceWorkerUpdating, message)
}

export const activateServiceWorkerUpdate = async (params) => {
  if (!serviceWorkerUpdating) {
    throw new Error("no service worker update to activate")
  }
  return sendSkipWaitingToWorker(serviceWorkerUpdating, params)
}

const sendSkipWaitingToWorker = async (
  worker,
  { onActivating = () => {}, onActivated = () => {}, onBecomesNavigatorController = () => {} } = {},
) => {
  const { state } = worker
  const waitUntilActivated = () => {
    return new Promise((resolve) => {
      const removeStateChangeListener = listenEvent(worker, "statechange", () => {
        if (worker.state === "activating") {
          serviceWorkerSetter(serviceWorkerUpdating)
          onActivating()
        }
        if (worker.state === "activated") {
          serviceWorkerSetter(serviceWorkerUpdating)
          onActivated()
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
  if (state === "installed" || state === "activating") {
    if (state === "installed") {
      sendMessageToServiceWorkerUpdate({ action: "skipWaiting" })
    }
    if (state === "activating") {
      serviceWorkerSetter(serviceWorkerUpdating)
    }
    await waitUntilActivated()

    if (serviceWorkerAPI.controller) {
      const removeControllerChangeListener = listenEvent(
        serviceWorkerAPI,
        "controllerchange",
        () => {
          removeControllerChangeListener()
          onBecomesNavigatorController()
          serviceWorkerUpdatingSetter(null)
          if (autoReloadEnabled) reload()
        },
      )
    } else {
      serviceWorkerUpdatingSetter(null)
      if (autoReloadEnabled) reload()
    }
    return
  }

  serviceWorkerSetter(serviceWorkerUpdating)
  onBecomesNavigatorController()
  serviceWorkerUpdatingSetter(null)
  if (autoReloadEnabled) reload()
}

let autoReloadEnabled = true
let disableAutoReload = () => {}
export const autoReloadAfterUpdateIsEnabled = () => autoReloadEnabled
export const disableAutoReloadAfterUpdate = () => disableAutoReload()

let refreshing = false
const reload = () => {
  if (refreshing) {
    return
  }
  refreshing = true
  window.location.reload()
}

if (canUseServiceWorker) {
  const removeControllerChangeListener = listenEvent(serviceWorkerAPI, "controllerchange", reload)

  disableAutoReload = () => {
    autoReloadEnabled = false
    removeControllerChangeListener()
  }
}

// const navigatorIsControlledByAServiceWorker = () => {
//   return canUseServiceWorker ? Boolean(serviceWorkerAPI.controller) : false
// }

// const getServiceWorkerControllingNavigator = () => {
//   return navigatorIsControlledByAServiceWorker() ? serviceWorkerAPI.controller : null
// }
