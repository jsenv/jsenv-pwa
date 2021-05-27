# pwa

Service worker and other progressive web application helpers.

[![github package](https://img.shields.io/github/package-json/v/jsenv/jsenv-pwa.svg?label=package&logo=github)](https://github.com/jsenv/jsenv-pwa/packages)
[![npm package](https://img.shields.io/npm/v/@jsenv/pwa.svg?logo=npm&label=package)](https://www.npmjs.com/package/@jsenv/pwa)
[![workflow status](https://github.com/jsenv/jsenv-pwa/workflows/ci/badge.svg)](https://github.com/jsenv/jsenv-pwa/actions?workflow=ci)
[![codecov](https://codecov.io/gh/jsenv/jsenv-pwa/branch/master/graph/badge.svg)](https://codecov.io/gh/jsenv/jsenv-pwa)

# Table of contents

- [Presentation](#Presentation)
- [Add to home screen](#Add-to-home-screen)
- [Service worker](#Service-worker)
- [Jsenv service worker](#jsenv-service-worker)

# Presentation

`@jsenv/pwa` is a tool that can be used to implement the api required to turn a website into a progressive web application:

- Add to home screen
- Service workers

> A progressive web application is a regular web page that is runned by a navigator but without the navigator ui.

# Add to home screen

Add to home screen means a user can choose to add a shortcut to your website in their device. The navigator will then run your website with only your ui in fullscreen.

<details>
  <summary>Add to home screen code example</summary>

The following html displays a button enabled when add to home screen is available. Clicking on the button prompt user to add the website to home screen.

```html
<!DOCTYPE html>
<html>
  <head>
    <title>Title</title>
    <meta charset="utf-8" />
    <link rel="icon" href="data:," />
  </head>

  <body>
    <button id="add-to-home-screen" disabled>Add to home screen</button>
    <script type="module">
      import { addToHomescreen } from "@jsenv/pwa"

      const button = document.querySelector("button#add-to-home-screen")

      button.disabled = !addToHomescreen.isAvailable()
      addToHomescreen.listenAvailabilityChange(() => {
        document.querySelector(
          "button#add-to-home-screen",
        ).disabled = !addToHomescreen.isAvailable()
      })
      button.onclick = () => {
        addToHomescreen.prompt()
      }
    </script>
    <!--
    "beforeinstallprompt" event might be dispatched very quickly by the navigator, before
    <script type="module"> above got a chance to catch it. For this reason, we listen
    early for this event and store it into window.beforeinstallpromptEvent.
    When "@jsenv/pwa" is imported it will check window.beforeinstallpromptEvent existence.
    -->
    <script>
      window.addEventListener("beforeinstallprompt", (beforeinstallpromptEvent) => {
        beforeinstallpromptEvent.preventDefault()
        window.beforeinstallpromptEvent = beforeinstallpromptEvent
      })
    </script>
  </body>
</html>
```

</details>

<details>
  <summary>addToHomescreen.isAvailable</summary>

`addToHomescreen.isAvailable` is a function returning a boolean indicating if addToHomescreen is available. This function must be used to know if you can call `addToHomescreen.prompt`.

Add to home screen is available if navigator fired a `beforeinstallprompt` event

</details>

<details>
  <summary>addToHomescreen.listenAvailabilityChange</summary>

`addToHomescreen.listenAvailabilityChange` is a function that will call a callback when add to home screen becomes available or unavailable.

</details>

<details>
  <summary>addToHomescreen.prompt</summary>

`addToHomescreen.prompt` is an async function that will ask navigator to trigger a prompt to ask user if he wants to add your website to their homescreen. It resolves to a boolean indicating if users accepted or declined the prompt.

It can be called many times but always inside a user interaction event handler, such as a click event.

</details>

## displayModeStandalone

`displayModeStandalone` is an object that can be used to know if display mode is standalone or be notified when this changes. The standalone display mode is true when your web page is runned as an application (navigator ui is mostly/fully hidden).

```js
import { displayModeStandalone } from "@jsenv/pwa"

displayModeStandalone.get() // true or false

displayModeStandalone.listen(() => {
  displayModeStandalone.get() // true or false
})
```

# Service worker

Service worker allows you to register a script in the navigator. That script is granted with the ability to communicate with browser internal cache and intercept any request made by the navigator. They are designed to make a website capable to work offline and load instantly from cache before wondering if there is any update available.

The raw service worker api offered by navigators is complex to understand. Especially when it comes to updating a service worker. This documentation explain what is going on and how to use `@jsenv/pwa` to register and update a service worker.

Read more on service worker at https://developer.mozilla.org/en-US/docs/Web/API/Service_Worker_API/Using_Service_Workers.

## Service worker code examples

Basic code examples illustrating how to use `@jsenv/pwa` for service workers.

<details>
  <summary>Vanilla js</summary>

```html
<!DOCTYPE html>
<html>
  <head>
    <title>Title</title>
    <meta charset="utf-8" />
    <link rel="icon" href="data:," />
  </head>

  <body>
    <button id="check-update" disabled>Check update</button>
    <p id="update-available"></p>
    <button id="activate-update" disabled>Activate update</button>
    <script type="module">
      import {
        canUseServiceWorker,
        registerServiceWorker,
        checkServiceWorkerUpdate,
        listenServiceWorkerUpdate,
        getServiceWorkerUpdate,
        activateServiceWorkerUpdate,
      } from "@jsenv/pwa"

      registerServiceWorker("./sw.js")

      if (canUseServiceWorker) {
        const buttonCheckUpdate = document.querySelector("#check-update")

        buttonCheckUpdate.disabled = false
        buttonCheckUpdate.onclick = async () => {
          const found = await checkServiceWorkerUpdate()
          if (!found) {
            alert("no update found")
          }
        }

        const textUpdateAvailable = document.querySelector("#update-available")
        const buttonActivateUpdate = document.querySelector("#activate-update")

        listenServiceWorkerUpdate(() => {
          const available = Boolean(getServiceWorkerUpdate())
          if (available) {
            textUpdateAvailable.innerHTML = "An update is available !"
            buttonActivateUpdate.disabled = false
          } else {
            textUpdateAvailable.innerHTML = ""
            buttonActivateUpdate.disabled = true
          }
        })

        buttonActivateUpdate.onclick = async () => {
          buttonActivateUpdate.disabled = true
          await activateServiceWorkerUpdate()
        }
      }
    </script>
  </body>
</html>
```

</details>

<details>
    <summary>React</summary>

```jsx
import React from "react"
import {
  canUseServiceWorker,
  registerServiceWorker,
  getServiceWorkerUpdate,
  listenServiceWorkerUpdate,
  checkServiceWorkerUpdate,
  activateServiceWorkerUpdate,
} from "@jsenv/pwa"

registerServiceWorker("./sw.js")

export const App = () => {
  if (!canUseServiceWorker) {
    return null
  }
  return <ServiceWorkerView />
}

const ServiceWorkerView = () => {
  const serviceWorkerUpdate = useServiceWorkerUpdate()

  return (
    <fieldset>
      <legend>Update</legend>
      {serviceWorkerUpdate ? <UpdateAvailable /> : <UpdateNotAvailable />}
    </fieldset>
  )
}

const UpdateAvailable = () => {
  const [updatingStatus, updatingStatusSetter] = React.useState("")

  const update = async () => {
    updatingStatusSetter("updating")
    await activateServiceWorkerUpdate({
      onActivating: () => updatingStatusSetter("activating"),
      onActivated: () => updatingStatusSetter("activated"),
    })
  }

  return (
    <>
      <p>
        {updatingStatus === "" ? "Update available" : null}
        {updatingStatus === "updating" || updatingStatus === "activating" ? "Updating..." : null}
        {updatingStatus === "activated" ? `Update ready, navigator will reload` : null}
      </p>
      <button disabled={Boolean(updatingStatus)} onClick={update}>
        Update (page will be reloaded)
      </button>
    </>
  )
}

const UpdateNotAvailable = () => {
  const [updateAttemptStatus, updateAttemptStatusSetter] = React.useState("")

  const check = async () => {
    updateAttemptStatusSetter("fetching")
    const found = await checkServiceWorkerUpdate()
    if (found) {
      // no need to handle that case because
      // an update is now available
      // meaning <UpdateAvailable /> will take over.
    } else {
      updateAttemptStatusSetter("notfound")
    }
  }

  return (
    <>
      <p>
        {updateAttemptStatus === "fetching" ? "Checking for update..." : null}
        {updateAttemptStatus === "notfound" ? "No update available" : null}
      </p>
      <button disabled={updateAttemptStatus === "fetching"} onClick={check}>
        Check for update
      </button>
    </>
  )
}

const useServiceWorkerUpdate = () => {
  const [update, updateSetter] = React.useState(getServiceWorkerUpdate())
  React.useEffect(() => {
    return listenServiceWorkerUpdate(() => {
      updateSetter(getServiceWorkerUpdate())
    })
  }, [])
  return update
}
```

</details>

## Service worker registration

To register your service worker use `registerServiceWorker`:

```js
import { registerServiceWorker } from "@jsenv/pwa"

registerServiceWorker("./sw.js")
```

This provide service worker on your navigator. And the navigator will take care of checking if your service worker has changed and update it. If you want to get some control on the service worker update, check the next section.

> Navigator check updates every time page is loaded or every 24h. If there is an update, navigator activate the new service worker only once once every tab using the previous version are closed. Refreshing a tab is not enough.

## Service worker update

This repository helps a lot to get something clean out of the messy api navigator offers when it comes to handle service worker update. Check https://redfin.engineering/how-to-fix-the-refresh-button-when-using-service-workers-a8e27af6df68 if you want an idea of how messy it is.

To implement a user interface around service worker update, you need an api to:

- Ask if there a service worker registerd on the page

- Register a callback to know when an update is available

- Trigger update check when you want

- Force the update of the service worker

To achieve that you can use the functions documented below.

### serviceWorkerIsAvailable

`serviceWorkerIsAvailable` is a function returning a boolean that is true if navigator supports service worker and you called `registerServiceWorker` before.

```js
import { serviceWorkerIsAvailable } from "@jsenv/pwa"

serviceWorkerIsAvailable() // true or false
```

### checkServiceWorkerUpdate

`checkServiceWorkerUpdate` is an async function asking to the navigator to check if there is an update available for the service worker. It returns true if there is one and false otherwise.

```js
import { checkServiceWorkerUpdate } from "@jsenv/pwa"

const updatefound = await checkServiceWorkerUpdate()
```

### listenServiceWorkerUpdate

`listenServiceWorkerUpdate` is a function that will call a callback when a service worker update becomes available or unavailable. An update is always detected by the navigator either periodically or because your called [checkServiceWorkerUpdate](#checkServiceWorkerUpdate). Once you know there is an update you can call [getServiceWorkerUpdate](#getServiceWorkerUpdate) to get some details.

```js
import { listenServiceWorkerUpdate } from "@jsenv/pwa"

listenServiceWorkerUpdate(() => {
  // an update becomes available or unavailable
  // use getServiceWorkerUpdate() to deduce this information
})
```

### getServiceWorkerUpdate

`getServiceWorkerUpdate` is a function returning a value indicating if there is an update available. It returns `null` if there is no update available and `{ shouldBecomeNavigatorController, navigatorWillReload }` object otherwise.

```js
import { getServiceWorkerUpdate } from "@jsenv/pwa"

getServiceWorkerUpdate() // { shouldBecomeNavigatorController, navigatorWillReload } or null
```

`navigatorWillReload` is true if auto reload feature is enabled. Auto reload is documented in [disableAutoReloadAfterUpdate](#disableAutoReloadAfterUpdate).

`shouldBecomeNavigatorController` tells you if the service worker will become `window.navigator.serviceWorker.controller`. It can be false when previous service worker was not controlling the navigator. In that case the next service worker won't neither. You can reproduce this by visiting a page for the very first time, update the service worker file and check for update.<br />
In that scenario, you was already seeing a page not controlled by a service worker and after update it's still the case. If user decides to activate that service worker update using [activateServiceWorkerUpdate](#activateServiceWorkerUpdate), jsenv reloads the navigator. This is because if the service worker updates, we assume what user sees is outdated.

### activateServiceWorkerUpdate

`activateServiceWorkerUpdate` is an async function that will tell the service worker it can `skipWaiting`. The navigator discards the old service worker and uses the new one. If the navigator was controlled this new service worker will become the navigator controller.

Once update is done, all listeners registered by [listenServiceWorkerUpdate](#listenServiceWorkerUpdate) are called and [getServiceWorkerUpdate](#getServiceWorkerUpdate) returns `null` until an other update becomes available.

When and if service worker becomes navigator controller, all active tabs will reloaded. See more in [disableAutoReloadAfterServiceWorkerUpdate](#disableAutoReloadAfterServiceWorkerUpdate).

```js
import { activateServiceWorkerUpdate } from "@jsenv/pwa"

await activateServiceWorkerUpdate({
  onActivating: () => {
    // new service worker is activating
  },
  onActivated: () => {
    // new service worker is activated
  },
  onBecomesNavigatorController: () => {
    // service worker becomes the navigator controller
  },
})
```

> `onBecomesNavigatorController` is called only if that service worker is controlling the navigator once activated.

### disableAutoReloadAfterUpdate

`disableAutoReloadAfterUpdate` is a function that prevents navigator to reload after the service worker updates.

By default tabs are reloaded to ensure all urls (js, imgs, ...) are reloaded when service worker updates as they might be outdated.

> Reloading navigator by default works in any case and easy to implement.

> The browser won't wildly reload by itself by default. It reloads by itself only after a call to [activateServiceWorkerUpdate](#activateServiceWorkerUpdate)

If you want to control even further when navigator is reloaded, call `disableAutoReloadAfterUpdate()`. You might want to disable auto reload because:

- You want to specify the internals of service worker update and show a message like:
  "Service worker update is done. You can reload your browser to refresh urls"
- You want a fine grained approach where you selectively decide if you need to reload browser or not.

```js
import { disableAutoReloadAfterUpdate } from "@jsenv/pwa"

disableAutoReloadAfterUpdate()
```

This autoreload is described as `Approach #3: Allow the user to control when to skip waiting with the Registration API` in https://redfin.engineering/how-to-fix-the-refresh-button-when-using-service-workers-a8e27af6df68.

See also this question on stack overflow: https://stackoverflow.com/questions/40100922/activate-updated-service-worker-on-refresh

### autoReloadAfterUpdateIsEnabled

```js
import { autoReloadAfterUpdateIsEnabled } from "@jsenv/pwa"

autoReloadAfterUpdateIsEnabled() // true/false
```

## Service worker utils

Some function that can be useful to interact with service workers.

### sendMessageToServiceWorker

`sendMessageToServiceWorker` can be used to send a message to your service worker and get the response back.

In the service worker:

```js
self.addEventListener("message", async ({ data, ports }) => {
  if (data === "ping") {
    ports[0].postMessage({ status: "resolved", value: "pong" })
  }
})
```

```js
import { sendMessageToServiceWorker } from "@jsenv/pwa"

const value = await sendMessageToServiceWorker("ping")
console.log(value) // "pong"
```

You can use `sendMessageToServiceWorker` as long as [serviceWorkerIsAvailable](#serviceWorkerIsAvailable) returns true. It will always communicate with the current service worker. Service worker can be installing, activating or activated. As soon as a new service worker starts to activate `sendMessageToServiceWorker` will communicate with the service worker that is activating.

### sendMessageToServiceWorkerUpdate

`sendMessageToServiceWorkerUpdate` is like [sendMessageToServiceWorker](#sendMessageToServiceWorker) but for the service worker currently updating. It can be used to communicate with a service worker while it's installing, installed (waiting to activate) or activating. After that the service worker becomes the current service worker and [sendMessageToServiceWorker](sendMessageToServiceWorker) must be used instead.

Use `sendMessageToServiceWorkerUpdate` only while [getServiceWorkerUpdate](#getServiceWorkerUpdate) returns a truthy value, otherwise it will log a warning and return `undefined.`

## Service worker capability detection

You likely want to register a service worker only if it's supported by the navigator. You can use `canUseServiceWorker` export to get that information.

```js
import { canUseServiceWorker } from "@jsenv/pwa"

console.log(canUseServiceWorker) // true or false
```

In practice, you should not need to rely on `canUseServiceWorker` because functions will behave as you would expect if navigator does not support service workers:

- `registerServiceWorker` does nothing
- `getServiceWorkerUpdate` always return `null`
- `listenServiceWorkerUpdate` never call the callback
- `sendMessageToServiceWorker` does nothing and return `undefined`

# Jsenv service worker

This repository also contains a service worker implementation ready to use.
Read more in [Jsenv service worker documentation](./docs/jsenv-service-worker.md).
