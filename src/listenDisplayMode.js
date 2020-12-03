/**
 * listenDisplayMode can be used to know the current displayMode of
 * our web page. It can be "standalone" or "browser-tab".
 *
 */

export const listenDisplayMode = (callback) => {
  const checkDisplayMode = () => {
    const displayModeIsStandalone =
      window.navigator.standalone || window.matchMedia("(display-mode: standalone)").matches
    callback(displayModeIsStandalone ? "standalone" : "browser tab")
  }
  checkDisplayMode()

  window.matchMedia("(display-mode: standalone)").addListener(() => {
    checkDisplayMode()
  })
}

// listenDisplayMode((displayMode) => {
//   document.querySelector("#display-mode").innerHTML = displayMode
// })
