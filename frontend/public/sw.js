const CACHE_NAME = "oryn-finance-v1";
const RUNTIME_CACHE = "oryn-runtime-v1";

const STATIC_ASSETS = ["/", "/index.html", "/manifest.json", "/favicon.ico"];

const API_CACHE_DURATION = 5 * 60 * 1000; // 5 minutes

// Install event - cache static assets
self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      return cache.addAll(STATIC_ASSETS).catch((error) => {
        console.error("Failed to cache static assets:", error);
      });
    }),
  );
  self.skipWaiting();
});

// Activate event - clean up old caches
self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames
          .filter((name) => name !== CACHE_NAME && name !== RUNTIME_CACHE)
          .map((name) => caches.delete(name)),
      );
    }),
  );
  self.clients.claim();
});

// Fetch event - network first, fallback to cache
self.addEventListener("fetch", (event) => {
  const { request } = event;
  const url = new URL(request.url);

  // Skip non-GET requests
  if (request.method !== "GET") return;

  // API requests - network first with cache fallback
  if (url.pathname.startsWith("/api/")) {
    event.respondWith(
      fetch(request)
        .then((response) => {
          if (response.ok) {
            const responseClone = response.clone();
            caches.open(RUNTIME_CACHE).then((cache) => {
              cache.put(request, responseClone);
            });
          }
          return response;
        })
        .catch(() => {
          return caches.match(request).then((cached) => {
            if (cached) {
              return cached;
            }
            return new Response(
              JSON.stringify({
                success: false,
                error: "Offline - cached data unavailable",
              }),
              {
                headers: { "Content-Type": "application/json" },
                status: 503,
              },
            );
          });
        }),
    );
    return;
  }

  // Static assets - cache first
  event.respondWith(
    caches.match(request).then((cached) => {
      if (cached) return cached;

      return fetch(request).then((response) => {
        if (response.ok && url.origin === location.origin) {
          const responseClone = response.clone();
          caches.open(CACHE_NAME).then((cache) => {
            cache.put(request, responseClone);
          });
        }
        return response;
      });
    }),
  );
});

// Push notification event
self.addEventListener("push", (event) => {
  if (!event.data) return;

  let payload;
  try {
    payload = event.data.json();
  } catch {
    payload = { title: "Oryn Finance", body: event.data.text() };
  }

  const {
    title = "Oryn Finance",
    body = "",
    tag = "oryn-notification",
    url = "/",
  } = payload;

  event.waitUntil(
    self.registration.showNotification(title, {
      body,
      tag,
      icon: "/favicon.ico",
      badge: "/icons/icon-96x96.png",
      data: { url },
      vibrate: [200, 100, 200],
      requireInteraction: false,
    }),
  );
});

// Notification click event
self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const url = event.notification.data?.url || "/";

  event.waitUntil(
    clients
      .matchAll({ type: "window", includeUncontrolled: true })
      .then((clientList) => {
        for (const client of clientList) {
          if (client.url === url && "focus" in client) {
            return client.focus();
          }
        }
        if (clients.openWindow) {
          return clients.openWindow(url);
        }
      }),
  );
});

// Background sync event
self.addEventListener("sync", (event) => {
  if (event.tag === "sync-trades") {
    event.waitUntil(syncPendingTrades());
  }
});

async function syncPendingTrades() {
  try {
    const cache = await caches.open(RUNTIME_CACHE);
    const requests = await cache.keys();

    const pendingRequests = requests.filter(
      (req) => req.url.includes("/api/trades") && req.method === "POST",
    );

    for (const request of pendingRequests) {
      try {
        await fetch(request.clone());
        await cache.delete(request);
      } catch (error) {
        console.error("Failed to sync trade:", error);
      }
    }
  } catch (error) {
    console.error("Background sync failed:", error);
  }
}
