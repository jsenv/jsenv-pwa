import { listenAppInstalled } from "./listenAppInstalled.js"

export const listenInstallPromptAvailable = (callback) => {
  const installPromptListener = () => {
    const { beforeinstallpromptEvent } = window
    if (beforeinstallpromptEvent) {
      const prompt = beforeInstallPromptEventToPrompt(beforeinstallpromptEvent, () => {
        window.beforeinstallpromptEvent = undefined
      })
      callback(prompt)
      return () => {}
    }

    const onbeforeinstallprompt = (beforeinstallpromptEvent) => {
      beforeinstallpromptEvent.preventDefault()
      const prompt = beforeInstallPromptEventToPrompt(beforeinstallpromptEvent)
      callback({ prompt })
    }

    window.addEventListener("beforeinstallprompt", onbeforeinstallprompt)
    return () => {
      window.removeEventListener("beforeinstallprompt", onbeforeinstallprompt)
    }
  }

  const removePromptListener = installPromptListener()

  const removeAppInstalledListener = listenAppInstalled(() => {
    // prompt "becomes" unavailable if user installs app
    // it can happen if user installs app manually from browser toolbar
    // in that case there is no point showing the install
    // button in the ui
    callback(null)
    removePromptListener()
  })

  return () => {
    removePromptListener()
    removeAppInstalledListener()
  }
}

const beforeInstallPromptEventToPrompt = async (beforeinstallpromptEvent, onaccept = () => {}) => {
  beforeinstallpromptEvent.prompt()
  const choiceResult = await beforeinstallpromptEvent.userChoice
  if (choiceResult.outcome === "accepted") {
    onaccept()
    return true
  }
  return false
}

// listenInstallPromptAvailable((prompt) => {
//   document.querySelector("#install").disabled = false
//   document.querySelector("#install").onclick = async () => {
//     const accepted = await prompt()
//     if (accepted) {
//       document.querySelector("#install").disabled = true
//     }
//   }
// })
