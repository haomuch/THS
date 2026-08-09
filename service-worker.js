const CACHE_NAME = 'ths-simulator-cache-v4';
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

// 后台静默更新：不阻塞对页面的响应
function revalidate(request) {
  return fetch(request)
    .then((networkResponse) => {
      if (
        networkResponse &&
        networkResponse.status === 200 &&
        (networkResponse.type === 'basic' || networkResponse.type === 'cors')
      ) {
        return caches.open(CACHE_NAME).then((cache) => cache.put(request, networkResponse.clone()));
      }
    })
    .catch(() => { /* 离线时忽略 */ });
}

// 策略：Stale-While-Revalidate（先回缓存，再后台刷新）
self.addEventListener('fetch', (event) => {
  const request = event.request;

  if (request.method !== 'GET') return;

  // 只接管同源请求，跨域资源直接走浏览器默认通道，避免无谓的 SW 往返
  let url;
  try {
    url = new URL(request.url);
  } catch (e) {
    return;
  }
  if (url.origin !== self.location.origin) return;

  event.respondWith(
    // caches.match 指定 cacheName，比 caches.open().then(cache.match) 少一次
    // Promise 跳转；iOS Safari 上每次刷新都要唤醒 SW 线程，这段延迟直接叠加在
    // 首屏之前，能省则省。
    caches.match(request, { cacheName: CACHE_NAME }).then((cachedResponse) => {
      if (cachedResponse) {
        // 缓存命中：立即回包，更新放到 waitUntil 里跑，不占用响应路径
        event.waitUntil(revalidate(request));
        return cachedResponse;
      }
      return fetch(request).catch(() => caches.match('./index.html', { cacheName: CACHE_NAME }));
    })
  );
});

