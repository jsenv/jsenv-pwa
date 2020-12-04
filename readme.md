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
  - [Service worker capability detection](#Service-worker-capability-detection)
  - [Service worker registration](#Service-worker-registration)
  - [Service worker update](#Service-worker-update)
    - [serviceWorkerIsAvailable](#serviceWorkerIsAvailable)
    - [checkServiceWorkerUpdate](#checkServiceWorkerUpdate)
    - [listenServiceWorkerUpdate](#listenServiceWorkerUpdate)
    - [getServiceWorkerUpdate](#getServiceWorkerUpdate)
    - [activateServiceWorkerUpdating](#activateServiceWorkerUpdating)
    - [disableAutoReloadAfterServiceWorkerUpdate](#disableAutoReloadAfterServiceWorkerUpdate)
    - [autoReloadAfterServiceWorkerUpdateIsEnabled](#autoReloadAfterServiceWorkerUpdateIsEnabled)
  - [Service works utils](#Service-worker-utils)
    - [sendMessageToServiceWorker](#sendMessageToServiceWorker)
    - [sendMessageToServiceWorkerUpdating](#sendMessageToServiceWorkerUpdating)

# Presentation

TODO

# Add to home screen

TODO: short explanation about add to home screen.

# Service worker

TODO: short explanation about service worker.

## Service worker capability detection

You likely want to register a service worker only if it's supported by the navigator. You can use `canUseServiceWorker` export to get that information.

```js
import { canUseServiceWorker } from "@jsenv/pwa"

console.log(canUseServiceWorker) // true or false
```

In practice, you should not need to rely on `canUseServiceWorker` because functions will behave as you would expect if navigator does not support service workers:

- `registerServiceWorker` does nothing
- `serviceWorkerUpdateIsAvailable` always return `false`
- `listenServiceWorkerUpdateAvailable` never call the callback
- `sendMessageToServiceWorker` does nothing and return `undefined`

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

To implement a user interface around service worker update, you need the following:

- Is there a service worker registerd on the page ?

- A callback to know when there is an available update.

- A function to manually check if an update is available.

- A function to "force" update the service worker

To achieve that you can use the following exports

### serviceWorkerIsAvailable

`serviceWorkerIsAvailable` is a function returning a boolean that is true if navigator supports service worker and you called `registerServiceWorker` before.

```js
import { serviceWorkerIsAvailable } from "@jsenv/pwa"

serviceWorkerIsAvailable() // true, false
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
  // an update becomes available or unavailable, use getServiceWorkerUpdate() to know what is going on
})
```

### getServiceWorkerUpdate

`getServiceWorkerUpdate` is a function returning a boolean indicating if there is an update available. It returns `null` if there is no update available and `{willBecomeNavigatorController, navigatorWillReload }` object otherwise.

```js
import { getServiceWorkerUpdate } from "@jsenv/pwa"

getServiceWorkerUpdate() // { willBecomeNavigatorController, navigatorWillReload } or null
```

`willBecomeNavigatorController` tells you if the service worker will become `window.navigator.serviceWorker.controller`. When previous service worker was not controlling the navigator the next service worker won't neither. You can reproduce this by visiting a page for the very first time, update the service worker file and check for update.

> In that scenario, `navigatorWillReload` is `false` because you was already seeing a page not controlled by a service worker.

`navigatorWillReload` is true if auto reload feature is enabled and navigator was controlled by a service worker before the update. Auto reload is documented in [disableAutoReloadAfterServiceWorkerUpdate](#disableAutoReloadAfterServiceWorkerUpdate).

### activateServiceWorkerUpdating

`activateServiceWorkerUpdating` is an async function that will tell the service worker it can `skipWaiting`. The navigator discards the old service worker and uses the new one. Once `activateServiceWorkerUpdating` resolves, the navigator is about to become controlled by the new service worker.

Once update is done, all listeners registered by [listenServiceWorkerUpdate](#listenServiceWorkerUpdate) will be called again and [getServiceWorkerUpdate](#getServiceWorkerUpdate) returns `null` until an other update becomes available.

When service worker becomes navigator controller all active tabs will reloaded. See more in [disableAutoReloadAfterServiceWorkerUpdate](#disableAutoReloadAfterServiceWorkerUpdate).

```js
import { activateServiceWorkerUpdating } from "@jsenv/pwa"

await activateServiceWorkerUpdating({
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

### disableAutoReloadAfterServiceWorkerUpdate

`disableAutoReloadAfterServiceWorkerUpdate` is a function that prevents navigator to refresh when the service worker updates. This is detected thanks to `controllerchange` event.

By default tabs are reloaded to ensure all urls (js, imgs, ...) are reloaded when service worker updates as they might be outdated.

> Reloading navigator by default works in any case and easy to implement.

> The browser won't wildly reload by itself by default. It reloads by itself only after a call to [activateServiceWorkerUpdating](#activateServiceWorkerUpdating)

If you want to control even further when navigator is reloaded, call `disableAutoReloadAfterServiceWorkerUpdate()`. You might want to disable auto reload because:

- You want to specify the internals of service worker update and show a message like:
  "Service worker update is done. You can reload your browser to refresh urls"
- You want a fine grained approach where you selectively decide if you need to reload browsr or not.

```js
import { disableAutoReloadAfterServiceWorkerUpdate } from "@jsenv/pwa"

disableAutoReloadAfterServiceWorkerUpdate()
```

This autoreload is described as `Approach #3: Allow the user to control when to skip waiting with the Registration API` in https://redfin.engineering/how-to-fix-the-refresh-button-when-using-service-workers-a8e27af6df68.

See also this question on stack overflow: https://stackoverflow.com/questions/40100922/activate-updated-service-worker-on-refresh

### autoReloadAfterServiceWorkerUpdateIsEnabled

```js
import { autoReloadAfterServiceWorkerUpdateIsEnabled } from "@jsenv/pwa"

autoReloadAfterServiceWorkerUpdateIsEnabled() // true/false
```

## Service worker utils

Some function that can be useful to interact with service workers.

### sendMessageToServiceWorker

`sendMessageToServiceWorker` can be used to send a message to your service worker and get the response back.

In the service worker:

```js
self.addEventListener("message", async ({ data, ports }) => {
  if (data === "ping") {
    messageEvent.ports[0].postMessage({ status: "resolved", value: "pong" })
  }
})
```

```js
import { sendMessageToServiceWorker } from "@jsenv/pwa"

const value = await sendMessageToServiceWorker("ping")
console.log(value) // "pong"
```

This is used to tell the service worker to skip waiting and can be used to talk directly with the service worker.

### sendMessageToServiceWorkerUpdating

`sendMessageToServiceWorkerUpdating` is like [sendMessageToServiceWorker](#sendMessageToServiceWorker) but for the service worker currently updating. If there is no service worker updating it logs a warning and returns `undefined`.

It can be used to communicate with a service worker before it becomes the service worker controlling the navigator.
