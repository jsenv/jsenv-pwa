import { getServiceWorkerControllingPage } from "./internal/navigator-worker.js"
import { sendMessageUsingChannel } from "./internal/sendMessageUsingChannel.js"

export const sendMessageToNavigatorController = (message) => {
  const serviceWorkerControllingPage = getServiceWorkerControllingPage()
  if (!serviceWorkerControllingPage) {
    return undefined
  }
  return sendMessageUsingChannel(message, serviceWorkerControllingPage)
}
