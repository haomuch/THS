const CACHE_NAME = 'ths-simulator-cache-v3';
const ASSETS_TO_CACHE = [
  './',
  './index.html',
  './icon.png',
  './style.css',
  './js/app.js',
  './js/physics.js',
  './js/ice-map.js',
  './js/nomograph.js',
  './js/psd.js',
];

// 安装阶段：缓存核心静态资源（使用相对路径以支持二级目录部署）
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      // 逐个缓存并捕捉异常，防止单个资源请求失败导致整个 Service Worker 安装失败
      return Promise.all(
        ASSETS_TO_CACHE.map((url) =>
          cache.add(url).catch((err) => {
            console.warn(`[ServiceWorker] 预缓存失败: ${url}`, err);
          })
        )
      );
    })
  );
  self.skipWaiting();
});

// 激活阶段：清理旧缓存
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames
          .filter((cacheName) => cacheName !== CACHE_NAME)
          .map((cacheName) => caches.delete(cacheName))
      );
    })
  );
  self.clients.claim();
});

// 策略：Stale-While-Revalidate（优先返回缓存，同时后台更新）
self.addEventListener('fetch', (event) => {
  // 仅拦截 GET 请求与 http/https 协议请求
  if (event.request.method !== 'GET' || !event.request.url.startsWith('http')) {
    return;
  }

  event.respondWith(
    caches.open(CACHE_NAME).then((cache) => {
      return cache.match(event.request).then((cachedResponse) => {
        // 发起网络请求获取最新版本
        const fetchPromise = fetch(event.request)
          .then((networkResponse) => {
            // 仅对成功的同源/响应进行缓存更新
            if (networkResponse && networkResponse.status === 200 && (networkResponse.type === 'basic' || networkResponse.type === 'cors')) {
              cache.put(event.request, networkResponse.clone());
            }
            return networkResponse;
          })
          .catch(() => cachedResponse);

        // 如果有缓存优先返回，否则等待网络响应
        return cachedResponse || fetchPromise;
      });
    })
  );
});

