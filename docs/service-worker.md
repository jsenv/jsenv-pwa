<!-- https://web.dev/manifest-updates/ -->

# Jsenv service worker

Jsenv service worker goal is to make the website capable to work offline.

# How to use

- Install `@jsenv/pwa` in your dependencies

```console
npm install @jsenv/pwa
```

- Create a `service-worker.js` file

```js
/* globals self, config */

self.importScripts("./node_modules/@jsenv/pwa/src/service-worker.setup.js")

config.cacheName = "product-name"
config.urlMap = { "/": "index.html" }
// config.shouldReloadOnInstall = () => {}

self.importScripts("./node_modules/@jsenv/pwa/src/service-worker.main.js")
```

- Register this service worker somewhere

```js
import { registerServiceWorker } from "@jsenv/pwa"

registerServiceWorker("./service-worker.js")
```

> You can use `window.navigator.serviceWorker.register` if you don't want to use `registerServiceWorker`.

With this code jsenv service worker will be registered in your website. But it won't cache any url or intercept requests because it was not configured to do anything. Yet.

# Configuration

Jsenv service worker must be configured between the two `importScripts` calls we saw on the previous part.

Remember `config.cacheName = "product-name"` ?
Here you can configure more things to tell the service worker what to do.

For now this documentation is living in the code itself. Check directly [src/service-worker.setup.js](../src/service-worker.setup.js) to see the available configuration and what it does.

<!-- https://github.com/jsenv/jsenv-core/blob/master/docs/building/readme.md
It can be used independently from jsenv. If you are using jsenv to build your project, jsenv will also build your service workers files if you ask him to. In that case jsenv injects all urls into `self.jsenvBuildUrls` meaning your service worker knows url to cache automatically. -->

<!-- but if you build your project using [@jsenv/core]
If you use `@jsenv/core` to build your project
it is meant to be used in a project using `@jsenv/core` to build -->

# Symbiosis with `@jsenv/core`

`@jsenv/core` can build service worker files. During that process, `self.jsenvBuildUrls` is injected into the service worker final script. It contains all urls builded by jsenv. This service worker checks the presence of `self.jsenvBuildUrls` and cache all these urls when it is installed.

It means if your are using this service worked and building it with `@jsenv/core`, your service worker knows urls to cache automatically.

## Implementation details when used with `@jsenv/core`

Here is an high level overview of what happens from the very first visit of a user to the moment you update your website and user gets the updated version of it.

Assuming your service worker script is as follow:

`sw.js`

```js
self.importScripts("./node_modules/@jsenv/pwa/src/service-worker.setup.js")

config.cacheName = "product-name"
config.urlMap = { "/": "index.html" }
config.shouldReloadOnInstall = (response, request) =>
  new URL(request.url).pathname === "/index.html"

self.importScripts("./node_modules/@jsenv/pwa/src/service-worker.main.js")
```

## 1) User first visit

- Some of your code does `navigator.serviceWorker.register("./sw.js")`.
- Browser fetch/parse/execute `sw.js` and its imported scripts: [src/service-worker.setup.js](../src/service-worker.setup.js) and [src/service-worker.main.js](../src/service-worker.main.js).
- Browser trigger `install` event on `service-worker.main.js`.
- `service-worker.main.js` fetch all urls to cache on install and puts them into browser cache name after `config.cacheName`.

> urls to cache on install is the concatenation of urls in `self.jsenvBuildUrls` and `config.extraUrlsToCacheOnInstall`.

> These url will be cached as long as this service worker lives.

- Browser trigger `activate` on `service-worker.main.js`

At this point service worker does not control the page. And **it's expected**. The intent of this service worker is that service worker will handle networks for the next visit. For that next visit, page loads instantly and could work offline.

> We could use `skipWaiting` or `clients.claim()` to allow service worker to take control of the network requests as soon as it is activated, but it not the point of this service worker as explained in the text below.

> Controlling page as soon as possible allow service worker to be aware of eventual request matching `config.shouldHandleRequest` and not in urls to cache on install. But service worker would have missed most of them already as it happens in parallel to the user visiting the page. I prefer to see it like this: a service worker control a page from the very beginning or not at all. It's way simpler to reason about, predict and test.

## 2) User second visit

- Browser is now "controlled" by the service worker. Most network requests will be intercepted and served from cache.
- All request matching `config.shouldHandleRequest` will be served from cache if possible. If the url is not in cache, it is fetched from network and put into cache. As a result page loads instantly without requests to the network (assuming `config.extraUrlsToCacheOnInstall` + `self.jsenvBuildUrls` lists all of them)

> It is theorically possible to generate the list of urls to cache on install automatically. We could start a headless browser and communicate to the service worker to start collecting urls, then start loading the site in an iframe and tell him when to stop when something happens in that iframe (like load event, or user reach a given point in the ui). In practice, with code splitting and the asynchronicity of things, it's better to have it generated by jsenv during build and eventually adjusted, then reviewed by human.

## 3) You update the service worker

Likely `self.jsenvBuildUrls` got updated by jsenv. Or you updated `sw.js` file.

## 4) Browser sees service worker has changed

Browser periodically fetches (every 24h) the url that was passed to `navigator.serviceWorker.register` and any scripts imported inside using `config.importScript`. It compare files and if any file has changed, the service worker is considered as updated. This process also happens every time `navigator.serviceWorker.register` is called. And it is called every time user loads or refresh the page.

- Browser spaws the new service worker code and trigger `install` on it.
- New service worker re fetch urls to cache on install.
- Browser waits for user to reload the page (or `skipWaiting` to be called)

> At this point browser tells us a new worker is installed and ready to be activated. Something in the user interface can say: There is a new version, reload page ?

- User reloads page
- Browser kills previous worker and trigger `activate` on the new worker.
- New worker delete cache of every url not listed as url to cache on install.

> This is to ensure cache is cleaned to save disk space that is limited. This means any url not in `config.extraUrlsToCacheOnInstall` or `self.jsenvBuildUrls` must be fetched again. If that is not fine for you ensure `config.extraUrlsToCacheOnInstall` contains all the urls you need.

## Usage

During build all urls used by your html file are known. When you pass `serviceWorkers` parameters to build project, jsenv injects `self.jsenvBuildUrls` into the generated service worker file.

If your didn't change meaningful files, building your project outputs exactly the same `self.jsenvBuildUrls.js`. In that case your service worker is not updated -> users keep their current service worker. Otherwise, browser will see that something has changed and start the process to update the service worker.

All that means:

- if any of your file changes, `self.jsenvBuildUrls` changes, browser engages a service worker update.
- The way service worker updates favor cache reuse. As long as `config.cacheName` is the same between workers, cache will be reused and user will redownload only and exactly the files you modified.
- If you want to cache urls that does not appear in `self.jsenvBuildUrls`, add them manually in `sw.js` inside `config.extraUrlsToCacheOnInstall`.

## Notes about common scenarios

### Url missing in self.jsenvBuildUrls

If you load urls that are not explicitely referenced in your html/css/js/svg files they won't appear in `self.jsenvBuildUrls`. To fix that, add a reference in your file.

- Example of a reference to a file in js:

  ```js
  import url from "src/img.png"
  ```

- Example of a reference to a file in html:

  ```html
  <link rel="preload" href="./src/img.png" as="image" />
  ```

- Example of a reference to a file in css:

  ```css
  body {
    background-image: url("./src/img.png");
  }
  ```

You can also manually add urls into `config.extraUrlsToCacheOnInstall` inside `sw.config.js`.

> Jsenv does not put external urls into `self.jsenvBuildUrls`. An external url contains an origin different from your website. This happens if you load a font from Google CDN for instance. An external url (that you want to cache) must be added manually to `sw.js`.

## Cache not updated when service worker updates

Jsenv ensure every url referenced in your html/css/js is replaced by a unique url during the build.

> A unique url is an url like `./file-es34578.css` where `es34578` is an hash computed depending on the content of the file.

If you manually add an url to `config.extraUrlsToCacheOnInstall` that is not unique as below:

```diff
- config.extraUrlsToCacheOnInstall = []
+ config.extraUrlsToCacheOnInstall = ["https://fonts.googleapis.com/css2?family=Roboto"]
```

Then, cache for that url is reused even after service worker updates. When you do that, be sure to update `config.shouldReloadOnInstall` so that is returns true for these urls

```diff
- config.shouldReloadOnInstall = () => false
+ config.shouldReloadOnInstall = (response, request) => request.url === "https://fonts.googleapis.com/css2?family=Roboto"
```

It's simpler to keep that responsability to the service worker but you might need/want to control that from your code. It's possible to control service worker cache as shown below:

```js
import { sendMessageToServiceWorkerControllingPage } from "@jsenv/pwa"

const result = await sendMessageToServiceWorkerControllingPage({
  action: "removeCacheKey",
  args: ["https://fonts.googleapis.com/css2?family=Roboto"],
})

// result can be:
//   - undefined: no service worker controlling the page
//   - false: there is no cache to remove for that url
//   - true: cache was removed
```

## See also

- https://developer.mozilla.org/en-US/docs/Web/API/CacheStorage/open
