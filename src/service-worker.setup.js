/* globals self */

self.config = {}
const { config } = self

config.cachePrefix = `jsenv`

/**
 * Service worker will try to put all config.manualUrlsConfig into browser cache
 * when it is installed (installation happens once).
 * Putting an url in that list means it is mandatory for the website to work offline
 * and that it will be cached as long as service worker is alive.
 *
 * You can tell worker the url is versioned doing
 * "style-v2.css": { versioned: true }
 *
 */
config.manualUrlsConfig = {
  "/": {},
}

/*
  Decides if the request must be cached or not.
  When returning true, the response for that request will be stored into cache
*/
config.shouldHandleRequest = (request, { requestWasCachedOnInstall }) => {
  if (request.method !== "GET" && request.method !== "HEAD") return false
  return requestWasCachedOnInstall
}

/*
  shouldReloadOnInstall(response, request)

  It is a function that will be used to decide if cache must be ignored
  when service worker installs. When returning true service worker
  re-fetch even if there is cache for that request, otherwise cache is reused.
  It is called on every config.urlsToCacheOnInstall.
  shouldReloadOnInstall is not called at all if server is sending cache-control
  with a max-age > 0 for that request. Meaning the cache is reused in that case.

  The implementation below tells to reuse cache for every url listed in
  config.urlsToCacheOnInstall.
*/
config.shouldReloadOnInstall = () => false

/*
  Whenever you change something in this file, such as config.cacheName
  or config.urlsToCacheOnInstall, browser reinstalls the service worker.
  When service worker activates, it is responsible to clean the cache
  used by the previous service worker version.

  This logic must be implemented using config.shouldCleanOnActivate and
  config.shouldCleanOtherCacheOnActivate functions below.
*/

/*
  shouldCleanOnActivate(response, request)

  It is a function that will be used to decide if a cached response must be deleted
  when service worker activates.

  The implementation below tells to delete cache for any request not listed
  in config.urlsToCacheOnInstall. It means that if an url was listed in the previous worker
  but is not anymore it will be deleted. It also means that if a request returns true for
  config.shouldHandleRequest and is not listed in config.urlsToCacheOnInstall, that request
  cache will be deleted every time service worker is activated after an update.
*/
config.shouldCleanOnActivate = (response, request, { requestWasCachedOnInstall }) =>
  !requestWasCachedOnInstall

config.logLevel = "warn"
config.logsBackgroundColor = "#ffdc00" // nice yellow

config.navigationPreloadEnabled = false

config.actions = {
  ping: () => "pong",
}
