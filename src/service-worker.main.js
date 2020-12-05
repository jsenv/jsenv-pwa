/**
 * https://web.dev/service-worker-caching-and-http-caching/
 * https://stackoverflow.com/questions/33262385/service-worker-force-update-of-new-assets/64880568#64880568
 * https://gomakethings.com/how-to-set-an-expiration-date-for-items-in-a-service-worker-cache/
 * https://phyks.me/2019/01/manage-expiration-of-cached-assets-with-service-worker-caching.html

 * https://developers.google.com/web/fundamentals/primers/service-workers/lifecycle
 * https://github.com/deanhume/pwa-update-available
 * https://deanhume.com/displaying-a-new-version-available-progressive-web-app/
 * https://raw.githubusercontent.com/GoogleChromeLabs/sw-precache/master/service-worker.tmpl
 *
 * Do not use relative self.importScripts in there because
 * They are resolved against self.location. It means
 * ./file.js would be resoled against the project root
*/

/* globals self, config */

const assertContextLooksGood = () => {
  const { jsenvBuildUrls } = self
  if (jsenvBuildUrls === undefined) {
    self.jsenvBuildUrls = []
  } else if (!Array.isArray(jsenvBuildUrls)) {
    throw new TypeError(`self.jsenvBuildUrls should be an array, got ${jsenvBuildUrls}`)
  }

  if (typeof config === undefined) {
    throw new Error(`config is not in scope, be sure to import sw.preconfig.js before sw.jsenv.js`)
  }

  const { cacheName } = config
  if (typeof cacheName !== "string") {
    throw new TypeError(`config.cacheName should be a string, got ${cacheName}`)
  }

  const { extraUrlsToCacheOnInstall } = config
  if (!Array.isArray(extraUrlsToCacheOnInstall)) {
    throw new TypeError(
      `config.extraUrlsToCacheOnInstall should be an array, got ${extraUrlsToCacheOnInstall}`,
    )
  }

  const { urlMap } = config
  if (typeof urlMap !== "object") {
    throw new TypeError(`config.urlMap should be an object, got ${urlMap}`)
  }

  const { shouldReloadOnInstall } = config
  if (typeof shouldReloadOnInstall !== "function") {
    throw new TypeError(
      `config.shouldReloadOnInstall should be a function, got ${shouldReloadOnInstall}`,
    )
  }

  const { shouldCleanOnActivate } = config
  if (typeof shouldCleanOnActivate !== "function") {
    throw new TypeError(
      `config.shouldCleanOnActivate should be a function, got ${shouldCleanOnActivate}`,
    )
  }

  const { shouldCleanOtherCacheOnActivate } = config
  if (typeof shouldCleanOtherCacheOnActivate !== "function") {
    throw new TypeError(
      `config.shouldCleanOtherCacheOnActivate should be a function, got ${shouldCleanOtherCacheOnActivate}`,
    )
  }

  const { shouldHandleRequest } = config
  if (typeof shouldHandleRequest !== "function") {
    throw new TypeError(
      `config.shouldHandleRequest should be a function, got ${shouldHandleRequest}`,
    )
  }

  const { logsEnabled } = config
  if (typeof logsEnabled !== "boolean") {
    throw new TypeError(`config.logsEnabled should be a boolean, got ${logsEnabled}`)
  }

  const { logsBackgroundColor } = config
  if (typeof logsBackgroundColor !== "string") {
    throw new TypeError(`config.logsBackgroundColor should be a string, got ${logsBackgroundColor}`)
  }

  const { disableNavigationPreload } = config
  if (typeof disableNavigationPreload !== "boolean") {
    throw new TypeError(
      `config.disableNavigationPreload should be a boolean, got ${disableNavigationPreload}`,
    )
  }
}

/*
 * util is an object holding utility functions.
 * The utility concept was added just to structure a bit this file.
 * When a utility need private helpers function, it's wrapped in {}
 * to highlight that thoose are private functions
 * The {} pattern was choosed because it allows to have private helpers
 * such as parseMaxAge. Not possible to do that with a plain object.
 */

const getUtil = () => {
  const util = {}

  util.createLogger = ({ logsEnabled, logsBackgroundColor }) => {
    const prefixArgs = (...args) => {
      return [
        `%csw`,
        `background: ${logsBackgroundColor}; color: black; padding: 1px 3px; margin: 0 1px`,
        ...args,
      ]
    }

    const createLogMethod = (method) =>
      logsEnabled ? (...args) => console[method](...prefixArgs(...args)) : () => {}

    return {
      // debug: createLogMethod("debug"),
      info: createLogMethod("info"),
      warn: createLogMethod("warn"),
      error: createLogMethod("error"),
    }
  }

  util.resolveUrl = (string) => String(new URL(string, self.location))

  util.fetchUsingNetwork = async (request) => {
    const controller = new AbortController()
    const { signal } = controller

    try {
      const response = await fetch(request, { signal })
      return response
    } catch (e) {
      // abort request in any case
      // I don't know how useful this is ?
      controller.abort()
      throw e
    }
  }

  {
    util.responseCacheIsValid = (responseInCache) => {
      const cacheControlResponseHeader = responseInCache.headers.get("cache-control")
      const maxAge = parseMaxAge(cacheControlResponseHeader)
      return maxAge && maxAge > 0
    }

    // https://github.com/tusbar/cache-control
    const parseMaxAge = (cacheControlHeader) => {
      if (!cacheControlHeader || cacheControlHeader.length === 0) return null

      const HEADER_REGEXP = /([a-zA-Z][a-zA-Z_-]*)\s*(?:=(?:"([^"]*)"|([^ \t",;]*)))?/g
      const matches = cacheControlHeader.match(HEADER_REGEXP) || []

      const values = {}
      Array.from(matches).forEach((match) => {
        const tokens = match.split("=", 2)

        const [key] = tokens
        let value = null

        if (tokens.length > 1) {
          value = tokens[1].trim()
        }

        values[key.toLowerCase()] = value
      })

      return parseDuration(values["max-age"])
    }

    const parseDuration = (value) => {
      if (!value) {
        return null
      }

      const duration = Number.parseInt(value, 10)

      if (!Number.isFinite(duration) || duration < 0) {
        return null
      }

      return duration
    }
  }

  return util
}

assertContextLooksGood()
const util = getUtil()

const logger = util.createLogger(config)

const urlsToCacheOnInstall = [...self.jsenvBuildUrls, ...config.extraUrlsToCacheOnInstall].map(
  util.resolveUrl,
)
const urlMapping = {}
Object.keys(config.urlMap).forEach((key) => {
  urlMapping[util.resolveUrl(key)] = util.resolveUrl(config.urlMap[key])
})

// --- installation phase ---
const install = async () => {
  logger.info("install start")
  try {
    const total = urlsToCacheOnInstall.length
    let installed = 0

    await Promise.all(
      urlsToCacheOnInstall.map(async (url) => {
        try {
          const request = new Request(url)
          const responseInCache = await caches.match(request)

          if (responseInCache) {
            const shouldReload = util.responseCacheIsValid(responseInCache)
              ? false
              : config.shouldReloadOnInstall(responseInCache, request, {
                  requestWasCachedOnInstall: urlsToCacheOnInstall.includes(request.url),
                })
            if (shouldReload) {
              logger.info(`${request.url} in cache but should be reloaded`)
              const requestByPassingCache = new Request(url, { cache: "reload" })
              await fetchAndCache(requestByPassingCache, {
                oncache: () => {
                  installed += 1
                },
              })
            } else {
              logger.info(`${request.url} already in cache`)
              installed += 1
            }
          } else {
            await fetchAndCache(request, {
              oncache: () => {
                installed += 1
              },
            })
          }
        } catch (e) {
          logger.warn(`cannot put ${url} in cache due to error while fetching: ${e.stack}`)
        }
      }),
    )
    if (installed === total) {
      logger.info(`install done (${total} urls added in cache)`)
    } else {
      logger.info(`install done (${installed}/${total} urls added in cache)`)
    }
  } catch (error) {
    logger.error(`install error: ${error.stack}`)
  }
}

self.addEventListener("install", (installEvent) => {
  installEvent.waitUntil(install(installEvent))
})

// --- fetch implementation ---
const handleRequest = async (request, fetchEvent) => {
  logger.info(`received fetch event for ${request.url}`)
  try {
    const responseFromCache = await caches.match(request)
    if (responseFromCache) {
      logger.info(`respond with response from cache for ${request.url}`)
      return responseFromCache
    }

    const responsePreloaded = await fetchEvent.preloadResponse
    if (responsePreloaded) {
      logger.info(`respond with preloaded response for ${request.url}`)
      return responsePreloaded
    }
  } catch (error) {
    logger.warn(`error while trying to use cache for ${request.url}`, error.stack)
    return fetch(request)
  }

  logger.info(`no cache for ${request.url}, fetching it`)
  return fetchAndCache(request)
}

const remapRequest = (request) => {
  if (Object.prototype.hasOwnProperty.call(urlMapping, request.url)) {
    const requestRemapped = new Request(urlMapping[request.url], request)
    return requestRemapped
  }
  return request
}

self.addEventListener("fetch", (fetchEvent) => {
  const request = remapRequest(fetchEvent.request)

  if (
    config.shouldHandleRequest(request, {
      requestWasCachedOnInstall: urlsToCacheOnInstall.includes(request.url),
    })
  ) {
    const responsePromise = handleRequest(request, fetchEvent)
    if (responsePromise) {
      fetchEvent.respondWith(responsePromise)
    }
  }
})

// --- activation phase ---
const activate = async () => {
  logger.info("activate start")

  await Promise.all([enableNavigationPreloadIfPossible(), deleteOtherUrls(), deleteOtherCaches()])
  logger.info("activate done")
}

const enableNavigationPreloadIfPossible = async () => {
  if (config.navigationPreloadEnabled && self.registration.navigationPreload) {
    await self.registration.navigationPreload.enable()
  }
}

const deleteOtherUrls = async () => {
  const cache = await caches.open(config.cacheName)
  const requestsInCache = await cache.keys()
  await Promise.all(
    requestsInCache.map(async (requestInCache) => {
      const responseInCache = await cache.match(requestInCache)
      if (
        config.shouldCleanOnActivate(responseInCache, requestInCache, {
          requestWasCachedOnInstall: urlsToCacheOnInstall.includes(requestInCache.url),
        })
      ) {
        logger.info(`delete ${requestInCache.url}`)
        await cache.delete(requestInCache)
      }
    }),
  )
}

const deleteOtherCaches = async () => {
  const cacheKeys = await caches.keys()
  await Promise.all(
    cacheKeys.map(async (cacheKey) => {
      if (cacheKey !== config.cacheName && config.shouldCleanOtherCacheOnActivate(cacheKey)) {
        logger.info(`delete cache ${cacheKey}`)
        await caches.delete(cacheKey)
      }
    }),
  )
}

self.addEventListener("activate", (activateEvent) => {
  const activatePromise = activate(activateEvent)
  if (activatePromise) {
    activateEvent.waitUntil(activatePromise)
  }
})

// --- postMessage communication ---
const actions = {
  skipWaiting: () => {
    self.skipWaiting()
  },
  ping: () => "pong",
  refreshCacheKey: async (url) => {
    url = String(new URL(url, self.location))
    const response = await fetchAndCache(new Request(url, { cache: "reload" }))
    return response.status
  },
  addCacheKey: async (url) => {
    url = String(new URL(url, self.location))
    const response = await fetchAndCache(url)
    return response.status
  },
  removeCacheKey: async (url) => {
    url = String(new URL(url, self.location))
    const cache = await caches.open(config.cacheName)
    const deleted = await cache.delete(url)
    return deleted
  },
}

self.addEventListener("message", async (messageEvent) => {
  const { data } = messageEvent
  if (typeof data !== "object") return
  const { action } = data
  const actionFn = actions[action]
  if (!actionFn) return

  const { args = [] } = data

  let status
  let value
  try {
    const actionFnReturnValue = await actionFn(...args)
    status = "resolved"
    value = actionFnReturnValue
  } catch (e) {
    status = "rejected"
    value = e
  }

  messageEvent.ports[0].postMessage({ status, value })
})

// ---- utils ----

const caches = self.caches

let cache
const getCache = async () => {
  if (cache) return cache
  cache = await caches.open(config.cacheName)
  return cache
}

const fetchAndCache = async (request, { oncache } = {}) => {
  const [response, cache] = await Promise.all([util.fetchUsingNetwork(request), getCache()])

  if (response.status === 200) {
    logger.info(`fresh response found for ${request.url}, put it in cache and respond with it`)

    const cacheWrittenPromise = cache.put(request, response.clone())
    if (oncache) {
      await cacheWrittenPromise
      oncache()
    }

    return response
  }
  logger.info(`cannot put ${request.url} in cache due to response status (${response.status})`)
  return response
}
