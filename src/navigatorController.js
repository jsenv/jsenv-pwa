// do not forget error handling: https://developer.mozilla.org/en-US/docs/Web/API/ServiceWorkerContainer/onerror

import { createSignal } from "./internal/createSignal.js"
import { listenEvent } from "./internal/listenEvent.js"
import { sendMessageUsingChannel } from "./internal/sendMessageUsingChannel.js"

const serviceWorkerAPI = window.navigator.serviceWorker

export const canUseServiceWorker = Boolean(serviceWorkerAPI)

// https://developer.mozilla.org/en-US/docs/Web/API/ServiceWorkerRegistration
let registrationPromise = null
let serviceWorker = null
const serviceWorkerSetter = (worker) => {
  serviceWorker = worker
}

let serviceWorkerUpdating = null
const serviceWorkerUpdatingChangeSignal = createSignal()
const serviceWorkerUpdatingSetter = (worker) => {
  if (serviceWorker && serviceWorker === worker) {
    console.log(`it's not an worker update, it's first time worker registers`)
    // mais dans ce cas on pourrait vouloir skipWaiting sur ce worker aussi
    return
  }
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
      console.log("browser notifies use an worker is installing")
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

export const sendMessageToServiceWorker = (message) => {
  if (!serviceWorker) {
    console.warn(`no service worker to send message to`)
    return undefined
  }
  return sendMessageUsingChannel(serviceWorker, message)
}

export const serviceWorkerUpdateIsAvailable = () => {
  return Boolean(serviceWorkerUpdating)
}

export const listenServiceWorkerUpdateAvailable = (callback) => {
  return serviceWorkerUpdatingChangeSignal.listen(callback)
}

export const checkServiceWorkerUpdate = async () => {
  if (!registrationPromise) {
    console.warn(`registerServiceWorker must be called before checkServiceWorkerUpdate can be used`)
    return false
  }

  const registration = await registrationPromise
  const updateRegistration = await registration.update()

  const { installing } = updateRegistration
  if (installing) {
    console.log("installing worker found after calling update()")
    serviceWorkerUpdatingSetter(installing)
    return true
  }

  const { waiting } = updateRegistration
  if (waiting) {
    console.log("waiting worker found after calling update()")
    serviceWorkerUpdatingSetter(waiting)
    return true
  }

  console.log("no worker found after calling update()")
  return false
}

export const sendMessageToServiceWorkerUpdating = (message) => {
  if (!serviceWorkerUpdating) {
    console.warn(`no service worker updating to send message to`)
    return undefined
  }
  return sendMessageUsingChannel(serviceWorkerUpdating, message)
}

export const activateServiceWorkerUpdating = async (params) => {
  if (!serviceWorkerUpdating) {
    throw new Error("no service worker update to activate")
  }
  return sendSkipWaitingToWorker(serviceWorkerUpdating, params)
}

const sendSkipWaitingToWorker = async (worker, { onActivating = () => {} } = {}) => {
  const { state } = worker
  const waitUntilActivated = () => {
    return new Promise((resolve) => {
      const removeStateChangeListener = listenEvent(worker, "statechange", () => {
        if (worker.state === "activating") {
          onActivating()
        }
        if (worker.state === "activated") {
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
    sendMessageToServiceWorkerUpdating({ action: "skipWaiting" })
    await waitUntilActivated()
  } else if (state === "activating") {
    onActivating()
    await waitUntilActivated()
  }

  // activated or redundant, nothing to do
}

let disableAutoReload = () => {}
export const disableAutoReloadAfterServiceWorkerUpdate = () => disableAutoReload()

if (canUseServiceWorker) {
  let refreshing = false
  disableAutoReload = listenEvent(serviceWorkerAPI, "controllerchange", () => {
    if (refreshing) {
      return
    }
    refreshing = true
    window.location.reload()
  })
}

// const navigatorIsControlledByAServiceWorker = () => {
//   return canUseServiceWorker ? Boolean(serviceWorkerAPI.controller) : false
// }

// const getServiceWorkerControllingNavigator = () => {
//   return navigatorIsControlledByAServiceWorker() ? serviceWorkerAPI.controller : null
// }
