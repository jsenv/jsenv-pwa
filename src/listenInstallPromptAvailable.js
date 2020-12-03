export const listenInstallPromptAvailable = (callback) => {
  window.addEventListener("beforeinstallprompt", (beforeinstallpromptEvent) => {
    const prompt = async () => {
      beforeinstallpromptEvent.prompt()
      const choiceResult = await beforeinstallpromptEvent.userChoice
      if (choiceResult.outcome === "accepted") {
        beforeinstallpromptEvent = undefined
        return true
      }
      return false
    }
    callback({ prompt })
  })
}

// listenInstallPromptAvailable(({ prompt }) => {
//   document.querySelector("#install").disabled = false
//   document.querySelector("#install").onclick = async () => {
//     const accepted = await prompt()
//     if (accepted) {
//       document.querySelector("#install").disabled = true
//     }
//   }
// })
