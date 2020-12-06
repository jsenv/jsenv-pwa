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
  const { generatedUrlsConfig } = self
  if (generatedUrlsConfig === undefined) {
    self.generatedUrlsConfig = {}
  } else if (typeof generatedUrlsConfig !== "object") {
    throw new TypeError(`self.generatedUrlsConfig should be an object, got ${generatedUrlsConfig}`)
  }

  if (typeof config === undefined) {
    throw new Error(`config is not in scope, be sure to import sw.preconfig.js before sw.jsenv.js`)
  }

  const { manualUrlsConfig } = config
  if (typeof manualUrlsConfig !== "object") {
    throw new TypeError(`config.manualUrlsConfig should be an array, got ${manualUrlsConfig}`)
  }

  const { cachePrefix } = config
  if (typeof cachePrefix !== "string") {
    throw new TypeError(`config.cachePrefix should be a string, got ${cachePrefix}`)
  }
  if (cachePrefix.length === 0) {
    throw new TypeError(`config.cachePrefix must not be empty`)
  }

  const { shouldCleanOnActivate } = config
  if (typeof shouldCleanOnActivate !== "function") {
    throw new TypeError(
      `config.shouldCleanOnActivate should be a function, got ${shouldCleanOnActivate}`,
    )
  }

  const { shouldHandleRequest } = config
  if (typeof shouldHandleRequest !== "function") {
    throw new TypeError(
      `config.shouldHandleRequest should be a function, got ${shouldHandleRequest}`,
    )
  }

  const { logLevel } = config
  if (typeof logLevel !== "string") {
    throw new TypeError(`config.logLevel should be a boolean, got ${logLevel}`)
  }

  const { logsBackgroundColor } = config
  if (typeof logsBackgroundColor !== "string") {
    throw new TypeError(`config.logsBackgroundColor should be a string, got ${logsBackgroundColor}`)
  }

  const { navigationPreloadEnabled } = config
  if (typeof navigationPreloadEnabled !== "boolean") {
    throw new TypeError(
      `config.navigationPreloadEnabled should be a boolean, got ${navigationPreloadEnabled}`,
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

  util.createLogger = ({ logLevel, logsBackgroundColor }) => {
    const prefixArgs = (...args) => {
      return [
        `%csw`,
        `background: ${logsBackgroundColor}; color: black; padding: 1px 3px; margin: 0 1px`,
        ...args,
      ]
    }

    const createLogMethod = (method) => (...args) => console[method](...prefixArgs(...args))

    const debug = createLogMethod("debug")
    const info = createLogMethod("info")
    const warn = createLogMethod("warn")
    const error = createLogMethod("error")
    const noop = () => {}

    if (logLevel === "debug") {
      return {
        debug,
        info,
        warn,
        error,
      }
    }

    if (logLevel === "info") {
      return {
        debug: noop,
        info,
        warn,
        error,
      }
    }

    if (logLevel === "warn") {
      return {
        debug: noop,
        info: noop,
        warn,
        error,
      }
    }

    if (logLevel === "error") {
      return {
        debug: noop,
        info: noop,
        warn: noop,
        error,
      }
    }

    if (logLevel === "off") {
      return {
        debug: noop,
        info: noop,
        warn: noop,
        error: noop,
      }
    }

    throw new Error(`unknown logLevel, got ${logLevel}`)
  }

  util.resolveUrl = (string) => String(new URL(string, self.location))

  {
    util.responseUsesLongTermCaching = (responseInCache) => {
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

  {
    util.getCacheName = ({ cachePrefix }) => {
      return `${cachePrefix}${generateCacheId()}`
    }

    const base = 36
    const blockSize = 4
    const discreteValues = Math.pow(base, blockSize)

    const pad = (number, size) => {
      var s = `000000000${number}`
      return s.substr(s.length - size)
    }

    const getRandomValue = (() => {
      const { crypto } = self
      if (crypto) {
        const lim = Math.pow(2, 32) - 1
        return () => {
          return Math.abs(crypto.getRandomValues(new Uint32Array(1))[0] / lim)
        }
      }
      return Math.random
    })()

    const randomBlock = () => {
      return pad(((getRandomValue() * discreteValues) << 0).toString(base), blockSize)
    }

    const generateCacheId = () => {
      const timestamp = new Date().getTime().toString(base)
      const random = `${randomBlock()}${randomBlock()}`

      return `${timestamp}${random}`
    }
  }

  {
    util.readUrlConfig = () => {
      const urlsConfig = {
        ...self.generatedUrlsConfig,
        ...config.manualUrlsConfig,
      }
      const urlsToCacheOnInstall = []
      const urlsToReloadOnInstall = []
      const urlMapping = {}
      forEachUniqueUrlIn(urlsConfig, (url, urlConfig) => {
        if (!urlConfig) urlConfig = { cache: false }
        if (urlConfig === true) urlConfig = { cache: true }
        const { cache = true, versioned = false, alias } = urlConfig

        if (cache) {
          urlsToCacheOnInstall.push(url)
          if (!versioned) {
            urlsToReloadOnInstall.push(url)
          }
        }
        if (alias) {
          urlMapping[url] = util.resolveUrl(alias)
        }
      })
      return {
        urlsToCacheOnInstall,
        urlsToReloadOnInstall,
        urlMapping,
      }
    }

    const forEachUniqueUrlIn = (object, callback) => {
      const urls = []
      Object.keys(object).forEach((key) => {
        const url = util.resolveUrl(key)
        if (!urls.includes(url)) {
          urls.push(url)
          callback(url, object[key])
        }
      })
    }
  }

  util.redirectRequest = async (request, url) => {
    const { mode } = request
    // see https://github.com/GoogleChrome/workbox/issues/1796
    if (mode !== "navigate") {
      return new Request(url, request)
    }

    const requestClone = request.clone()
    const { body, credentials, headers, integrity, referrer, referrerPolicy } = requestClone
    const bodyPromise = body ? Promise.resolve(body) : requestClone.blob()
    const bodyValue = await bodyPromise

    const requestMutated = new Request(url, {
      body: bodyValue,
      credentials,
      headers,
      integrity,
      referrer,
      referrerPolicy,
      mode: "same-origin",
      redirect: "manual",
    })
    return requestMutated
  }

  return util
}

assertContextLooksGood()

const util = getUtil()
const cacheName = util.getCacheName(config)
const logger = util.createLogger(config)
const { urlsToCacheOnInstall, urlsToReloadOnInstall, urlMapping } = util.readUrlConfig(config)

logger.info(`cache key: ${cacheName}`)

// --- installation phase ---
const install = async () => {
  logger.info("install start")
  try {
    const total = urlsToCacheOnInstall.length
    let installed = 0

    await Promise.all(
      urlsToCacheOnInstall.map(async (url) => {
        try {
          const requestUrlsInUrlsToReloadOnInstall = urlsToReloadOnInstall.includes(url)
          const request = new Request(url, {
            ...(requestUrlsInUrlsToReloadOnInstall
              ? {
                  // A non versioned url must ignore navigator cache
                  // otherwise we might (99% chances) hit previous worker cache
                  // and miss the new version
                  cache: "reload",
                }
              : {
                  // If versioned url is the same as before, it's ok to reuse
                  // cache from previous worker or navigator itself.
                }),
          })
          await fetchAndCache(request, {
            oncache: () => {
              installed += 1
            },
          })
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
  logger.debug(`received fetch event for ${request.url}`)
  try {
    const responseFromCache = await self.caches.match(request)
    if (responseFromCache) {
      logger.debug(`respond with response from cache for ${request.url}`)
      return responseFromCache
    }

    const responsePreloaded = await fetchEvent.preloadResponse
    if (responsePreloaded) {
      logger.debug(`respond with preloaded response for ${request.url}`)
      return responsePreloaded
    }
  } catch (error) {
    logger.warn(`error while trying to use cache for ${request.url}`, error.stack)
    return fetch(request)
  }

  logger.debug(`no cache for ${request.url}, fetching it`)
  return fetchAndCache(request)
}

const remapRequest = (request) => {
  if (Object.prototype.hasOwnProperty.call(urlMapping, request.url)) {
    const newUrl = urlMapping[request.url]
    logger.debug(`redirect request from ${request.url} to ${newUrl}`)
    return util.redirectRequest(request, newUrl)
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
  const cache = await self.caches.open(cacheName)
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
  const cacheKeys = await self.caches.keys()
  await Promise.all(
    cacheKeys.map(async (cacheKey) => {
      if (cacheKey !== cacheName && cacheKey.startsWith(config.cachePrefix)) {
        logger.info(`delete cache ${cacheKey}`)
        await self.caches.delete(cacheKey)
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
  refreshCacheKey: async (url) => {
    url = util.resolveUrl(url)
    const response = await fetchAndCache(new Request(url, { cache: "reload" }))
    return response.status
  },
  addCacheKey: async (url) => {
    url = util.resolveUrl(url)
    const response = await fetchAndCache(url)
    return response.status
  },
  removeCacheKey: async (url) => {
    url = util.resolveUrl(url)
    const cache = await self.caches.open(cacheName)
    const deleted = await cache.delete(url)
    return deleted
  },
  ...config.actions,
}

self.addEventListener("message", async (messageEvent) => {
  const { data } = messageEvent
  if (typeof data !== "object") return
  const { action } = data
  const actionFn = actions[action]
  if (!actionFn) return

  const { payload } = data

  let status
  let value
  try {
    const actionFnReturnValue = await actionFn(payload, { cacheName })
    status = "resolved"
    value = actionFnReturnValue
  } catch (e) {
    status = "rejected"
    value = e
  }

  messageEvent.ports[0].postMessage({ status, value })
})

const fetchAndCache = async (request, { oncache } = {}) => {
  const [response, cache] = await Promise.all([fetchUsingNetwork(request), getCache()])

  if (response.status === 200) {
    logger.debug(`fresh response found for ${request.url}, put it in cache and respond with it`)

    const cacheWrittenPromise = cache.put(request, response.clone())
    if (oncache) {
      await cacheWrittenPromise
      oncache()
    }

    return response
  }
  logger.warn(`cannot put ${request.url} in cache due to response status (${response.status})`)
  return response
}

const fetchUsingNetwork = async (request) => {
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

const getCache = async () => {
  const cache = await self.caches.open(cacheName)
  return cache
}
