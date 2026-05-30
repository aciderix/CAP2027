// Firebase Cloud Messaging service worker for the CAP 2027 web app.
// Loaded once when the main thread calls navigator.serviceWorker.register
// via src/lib/pushWeb.ts. Capacitor on Android ignores this file (it
// has its own native push channel) — it ships in the APK assets but
// no service worker registration ever happens there.
//
// Two responsibilities:
//   1. Render the OS notification when the page is in the background
//      or the tab is closed (onBackgroundMessage).
//   2. Open / focus the right tab when the user clicks the notif
//      (notificationclick handler).
//
// Foreground messages (active tab) are NOT handled here — they go
// through onMessage() in pushWeb.ts which both shows a notif and
// invalidates the TanStack Query caches.

/* eslint-disable no-undef */
importScripts('https://www.gstatic.com/firebasejs/10.14.1/firebase-app-compat.js');
importScripts('https://www.gstatic.com/firebasejs/10.14.1/firebase-messaging-compat.js');

firebase.initializeApp({
  apiKey: 'AIzaSyD1QptOBNFbJgeX9Ilg4K7_6Ztfp7vmEi4',
  authDomain: 'cap2027-app.firebaseapp.com',
  projectId: 'cap2027-app',
  storageBucket: 'cap2027-app.firebasestorage.app',
  messagingSenderId: '762607884594',
  appId: '1:762607884594:web:cc4eb1734a0eeaf309df2b',
});

const messaging = firebase.messaging();

messaging.onBackgroundMessage((payload) => {
  const title = (payload.notification && payload.notification.title)
    || (payload.data && payload.data.title)
    || 'CAP 2027';
  const body = (payload.notification && payload.notification.body)
    || (payload.data && payload.data.body)
    || '';
  // `tag` is the de-dupe key inside the browser: a second showNotification
  // with the same tag replaces the existing one instead of stacking. Using
  // the notif type as tag keeps things tidy when the user gets several
  // rapid pushes of the same kind (e.g. multiple articles in one ingest).
  const tag = (payload.data && payload.data.type) || 'cap2027';
  self.registration.showNotification(title, {
    body,
    icon: '/icon-192.png',
    badge: '/favicon-32.png',
    tag,
    data: payload.data || {},
  });
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const target = (event.notification.data && event.notification.data.url) || '/';
  event.waitUntil((async () => {
    const clientList = await clients.matchAll({ type: 'window', includeUncontrolled: true });
    for (const c of clientList) {
      if ('focus' in c) {
        try { await c.navigate(target); } catch { /* navigate can fail cross-origin */ }
        return c.focus();
      }
    }
    if (clients.openWindow) await clients.openWindow(target);
  })());
});

// Pass-through fetch handler. Required for Chrome / Edge to consider
// the site a real PWA and offer "Install app" instead of just "Add to
// home screen". We don't actually cache anything — every request still
// hits the network — but the presence of the handler is what unlocks
// the install banner. Activates the SW immediately on first install
// and takes control of the page so installability checks pass on the
// very first visit.

self.addEventListener('install', (event) => {
  event.waitUntil(self.skipWaiting());
});

self.addEventListener('activate', (event) => {
  event.waitUntil(self.clients.claim());
});

self.addEventListener('fetch', (event) => {
  // Default behaviour — let the browser handle the request. The empty
  // handler is enough to mark the SW as "fetch-handling" for the
  // installability check.
  if (event.request.mode === 'navigate') {
    event.respondWith(fetch(event.request).catch(() => caches.match('/')));
  }
});
