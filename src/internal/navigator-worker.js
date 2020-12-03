export const canUseServiceWorker = Boolean(window.navigator.serviceWorker)

export const pageIsControlledByServiceWorker = () => {
  return Boolean(getServiceWorkerControllingPage())
}

export const getServiceWorkerControllingPage = () => {
  return canUseServiceWorker ? window.navigator.serviceWorker.controller : null
}
