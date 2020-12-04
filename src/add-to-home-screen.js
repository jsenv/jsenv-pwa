/**
  The following scenario is working:

  - user click install button -> browser shows add to home screen prompt
  - user click cancel on browser prompt
  - user click again install button -> browser shows again add to home screen prompt

  It's very easy to break this so that subsequent click does nothing.
  Nothing means browser always returns a "dimissed" user choice without asking user.
  I suspect chrome is trying to prevent malicious script to annoy user
  by calling prompt() many times.

  It's currently working because we don't hide beforeinstallpromptEvent behind a function.
  It would be hidden behind a function if we put it into react state or
  just by using a curried funciton like:

  beforeinstallpromptEvent
  const curriedFunction = () => {
    beforeinstallpromptEvent.prompt()
  }

  If we do so, chrome will always dismiss subsequent click on install button. (until page is reloaded).
  To avoid that we store the event on window.beforeinstallpromptEvent.
*/

import { listenAppInstalled } from "./listenAppInstalled.js"
import { displayModeStandalone } from "./displayModeStandalone.js"

export const listenAddToHomescreenAvailable = (callback) => {
  let availablePrevious
  let appInstalledEvent = false
  const checkAvailable = ({
    beforeinstallpromptEventAvailableOnWindow,
    displayModeIsStandalone,
  }) => {
    const available = addToHomescreenAvailableGetter({
      beforeinstallpromptEventAvailableOnWindow,
      displayModeIsStandalone,
      appInstalledEvent,
    })
    if (available !== availablePrevious) {
      availablePrevious = available
      callback(available)
    }
  }

  checkAvailable({
    beforeinstallpromptEventAvailableOnWindow: beforeinstallpromptEventAvailableOnWindowGetter(),
    displayModeIsStandalone: displayModeStandalone.get(),
  })

  const removeBeforeInstallPromptListener = listenBeforeInstallPrompt(
    (beforeinstallpromptEvent) => {
      window.beforeinstallpromptEvent = beforeinstallpromptEvent
      checkAvailable({
        beforeinstallpromptEventAvailableOnWindow: true,
        displayModeIsStandalone: displayModeStandalone.get(),
      })
    },
  )

  const removeDisplayModeListener = displayModeStandalone.listen(() => {
    checkAvailable({
      beforeinstallpromptEventAvailableOnWindow: beforeinstallpromptEventAvailableOnWindowGetter(),
      displayModeIsStandalone: displayModeStandalone.get(),
    })
  })

  const removeAppInstalledListener = listenAppInstalled(() => {
    // prompt "becomes" unavailable if user installs app
    // it can happen if user installs app manually from browser toolbar
    // in that case there is no point showing the install
    // button in the ui
    appInstalledEvent = true
    checkAvailable({
      beforeinstallpromptEventAvailableOnWindow: beforeinstallpromptEventAvailableOnWindowGetter(),
      displayModeIsStandalone: displayModeStandalone.get(),
    })
  })

  return () => {
    removeBeforeInstallPromptListener()
    removeDisplayModeListener()
    removeAppInstalledListener()
  }
}

export const promptAddToHomescreen = async () => {
  window.beforeinstallpromptEvent.prompt()
  const choiceResult = await window.beforeinstallpromptEvent.userChoice
  if (choiceResult.outcome === "accepted") {
    return true
  }
  return false
}

const beforeinstallpromptEventAvailableOnWindowGetter = () => {
  return Boolean(window.beforeinstallpromptEvent)
}

const addToHomescreenAvailableGetter = ({
  beforeinstallpromptEventAvailableOnWindow,
  displayModeIsStandalone,
  appInstalledEvent,
}) => {
  if (!beforeinstallpromptEventAvailableOnWindow) {
    return false
  }
  if (displayModeIsStandalone) {
    return false
  }
  if (appInstalledEvent) {
    return false
  }
  return true
}

const listenBeforeInstallPrompt = (callback) => {
  window.addEventListener("beforeinstallprompt", callback)
  return () => {
    window.removeEventListener("beforeinstallprompt", callback)
  }
}
