<!-- https://web.dev/manifest-updates/ -->

# Jsenv service worker

Using a service worker will make website capable to work offline. Once a website works offline, next visit trigger zero networks requests making it super fast to load.

This service worker:

- Can be configured to control the list of urls to cache
- Ensure cache is reused only when url are versioned
- Can be connected to a build tool to configure the list of urls to cache

# How to use

<details>
  <summary>1. Install <code>@jsenv/pwa</code></summary>

```console
npm install @jsenv/pwa
```

</details>

<details>
  <summary>2. Create <code>service-worker.js</code></summary>

```js
/* globals self */

self.importScripts("./node_modules/@jsenv/pwa/src/service-worker.setup.js")

self.config.cachePrefix = "product-name"

self.importScripts("./node_modules/@jsenv/pwa/src/service-worker.main.js")
```

</details>

<details>
  <summary>3. Register service worker</summary>

```js
import { registerServiceWorker } from "@jsenv/pwa"

registerServiceWorker("./service-worker.js")
```

You can also use `window.navigator.serviceWorker.register` instead of `registerServiceWorker`.

</details>

At this point your website will use jsenv service worker. By default jsenv service worker cache only the root url (`/`). It must be configured to cache more urls.

# Configuration

Jsenv service worker must be configured between the two `importScripts` calls visible in `service-worker.js` from the previous part.

Just after the line `self.config.cachePrefix = "product-name"` you can add more lines to tell the service worker how to behave.

Check directly [src/service-worker.setup.js](../src/service-worker.setup.js) to see the available configuration and what it does.

<!-- - If any of your file changes, service worker file changes, browser engages a service worker update. -->

# Cache invalidation

By default, the cache for urls is deleted when service worker updates. In other words, when service worker updates it will refetch urls from network and put them into cache again.

The service worker consider all urls as not versioned by default. If you know the url is versioned, tell it to the service worker and that url won't be re-fetched from network between updates.

```diff
config.manualUrlsConfig = {
  "/": true,
+ "https://fonts.googleapis.com/css2?family=Roboto": { versioned: true }
}
```

# High level overview

An high level overview of what happens when user visit your pwa for the first time, second time and when there is an update.

Assuming your service worker script is at `./service-worker.js` and contains:

```js
self.importScripts("./node_modules/@jsenv/pwa/src/service-worker.setup.js")

self.config.cachePrefix = "product-name"

self.importScripts("./node_modules/@jsenv/pwa/src/service-worker.main.js")
```

## User first visit

- At some point, your website is executing the following js

  ```js
  navigator.serviceWorker.register("/service-worker.js")
  ```

- Browser fetch/parse/execute `service-worker.js`

- Browser trigger `"install"` event on [src/service-worker.main.js](../src/service-worker.main.js#L361)

- _service-worker.main.js_ fetch all urls to cache on install and puts them into navigator cache using `config.cachePrefix` to generate a unique cache key.

- Browser trigger `"activate"` event on [src/service-worker.main.js](../src/service-worker.main.js#L456)

At this point service worker does not control the page. And **it's expected**. Service worker are meant to be a progressive enhancement, they are able to handle network for the next visit. On that next visit, page loads instantly and could work offline.

<details>
  <summary>See more about controlling the first visit</summary>

The whole website could wait for service worker to be installed before doing anything with the following code

```js
await navigator.serviceWorker.ready
```

But that would have a huge performance impact and this is not how service worker were designed by web browsers.

We could also take control of the navigator as soon as possible with the following code in the service worker

```js
self.addEventListener("install", (event) => {
  event.waitUntil(self.skipWaiting())
})
self.addEventListener("activate", (event) => {
  event.waitUntil(self.clients.claim())
})
```

But in that scenario service worker and user visiting the page happens in parallel. So by the time service worker install and activates it have missed many of the requests done by the navigator. You end up in a non predictable state.

In the end it is way simpler and safe to consider a service worker either control a navigator from the very beginning or not at all.

</details>

## User second visit

- Browser is now _controlled_ by the service worker. All requests configured to be handled by the service worker will be intercepted.
- All request matching `config.shouldHandleRequest` will be served from cache if possible. If the url is not in cache, it is fetched from network and put into cache.

Assuming `self.generatedUrlsConfig` and `config.manualUrlsConfig` contains all urls needed by the website, page loads without any request to the network: **page works offline and loads super fast**.

## Website update

You update one of the files in your website, an image or some js files.

A process, ideally automatic, must update your _service-worker.js_ file. Without this the browser won't see any change in the service worker file and consider there is nothing to update. If you use `@jsenv/core` to build your website, it is done for you as explained in [Symbiosis with jsenv build](#Symbiosis-with-jsenv-build).

## Browser sees service worker file change

Browser periodically fetches (every 24h) the url that was passed to `navigator.serviceWorker.register` and any scripts imported inside using `self.importScript`. If any file has changed, the service worker is considered as updated. This process also happens every time user loads or refresh the page.

When browser see the service worker needs to update, here is what happens:

- Browser spawns the new service worker code and trigger `"install"` event on it.
- New service worker re fetch urls to cache on install.
- Browser waits for user to reload the page

At this point browser tells us a new worker is _installed_ and ready to be _activated_. The website can know this thanks to [listenServiceWorkerUpdate](../readme.md#listenServiceWorkerUpdate) and display a message to the user to encourage him to reload the page.

- User reloads page
- Browser kills previous worker and trigger `"activate"` event on the new worker.
- New worker delete cache of every url not listed as url to cache on install to save disk space.

# Symbiosis with jsenv build

The list of urls to cache can be automatically generated if you build your website using `@jsenv/core`. This is possible because:

1. This service worker cache all urls declared in `self.generatedUrlsConfig`

2. During build, `@jsenv/core` injects urls into the service worker file(s) under `self.generatedUrlsConfig`. This feature is documented in [jsenv service worker](https://github.com/jsenv/jsenv-core/blob/master/docs/building/readme.md#jsenv-service-worker)

Jsenv ensure every url is replaced by a unique url during the build. This allows to tell the service worker urls are versioned and there is no need to invalidate their cache when service worker updates.

## Jsenv url detection

If you use some urls that are not explicitely referenced in your html/css/js/svg files they won't be detected by jsenv. To fix that, add a reference in your file.

<details>
  <summary>Examples of url references</summary>

### js

```js
new URL("./src/img.png", import.meta.url)
```

### html

```html
<link rel="preload" href="./src/img.png" as="image" />
```

### css

```css
body {
  background-image: url("./src/img.png");
}
```

</details>

If you want to cache urls not injected by jsenv during build, add them manually inside `self.config.manualUrlsConfig` in your `service-worker.js` file.

Jsenv ignore external urls: url with an origin different from your website. For example if you load a font from Google CDN. Such url won't be added to `self.generatedUrlsConfig`. In that scenario and if you want to cache an external url, add it to `self.config.manualUrlsConfig`.

```diff
self.config.manualUrlsConfig = {
  "/": true,
+ "https://fonts.googleapis.com/css2?family=Roboto": true
}
```

<details>
  <summary>Read more about url detection</summary>

It is theorically possible to generate the list of urls to cache on install automatically:

1. Start a headless browser
2. Create a service worker that will be responsible to collect url
3. Start loading the site in an iframe
4. At some point, tell to the service worker we are done (iframe load event or ui reach a certain state)
5. Get all urls collected by the service worker

In practice, writing and maintaining such code would be complex. Especially considering code splitting. It is simpler to detect urls using static code analysis. This static code analysis is done by jsenv during build.

</details>

## Programmatic cache invalidation

It's possible to control service worker cache as shown below:

```js
import { sendMessageToServiceWorker } from "@jsenv/pwa"

const result = await sendMessageToServiceWorker({
  action: "removeCacheKey",
  payload: "https://fonts.googleapis.com/css2?family=Roboto",
})

// result can be:
//   - undefined: no service worker controlling the page
//   - false: there is no cache to remove for that url
//   - true: cache was removed
```

## See also

- https://developer.mozilla.org/en-US/docs/Web/API/CacheStorage/open
