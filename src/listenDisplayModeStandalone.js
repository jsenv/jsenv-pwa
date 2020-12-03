/**
 * listenDisplayModeStandalone can be used to know the current displayMode of
 * our web page is standalone (PWA)
 */

export const listenDisplayModeStandalone = (callback) => {
  const checkDisplayMode = () => {
    callback(displayModeIsStandaloneGetter())
  }
  checkDisplayMode()
  const media = window.matchMedia("(display-mode: standalone)")
  media.addListener(checkDisplayMode)
  return () => {
    media.removeListener(checkDisplayMode)
  }
}

export const displayModeIsStandaloneGetter = () => {
  return window.navigator.standalone || window.matchMedia("(display-mode: standalone)").matches
}

// listenDisplayModeStandalone((standalone) => {
//   document.querySelector("#display-mode").innerHTML = standalone
// })
