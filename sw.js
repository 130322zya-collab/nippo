// 濱崎組 日報アプリの通知用（画面の保存はしない。通知を受けて表示するだけ）
self.addEventListener("install", () => self.skipWaiting());
self.addEventListener("activate", e => e.waitUntil(self.clients.claim()));
self.addEventListener("push", e => {
  let d = {}; try{ d = e.data ? e.data.json() : {}; }catch(_){ d = { title:"日報", body: e.data ? e.data.text() : "" }; }
  e.waitUntil(self.registration.showNotification(d.title || "日報", {
    body: d.body || "", tag: "nippo-reminder", renotify: true,
    icon: new URL("assets/icon-daiku-192.png", self.registration.scope).href,
    badge: new URL("assets/icon-daiku-192.png", self.registration.scope).href,
    data: { url: d.url || self.registration.scope }
  }));
});
self.addEventListener("notificationclick", e => {
  e.notification.close();
  const url = (e.notification.data && e.notification.data.url) || self.registration.scope;
  e.waitUntil(self.clients.matchAll({ type:"window", includeUncontrolled:true }).then(list => {
    for(const c of list){ if(c.url.startsWith(url) && "focus" in c) return c.focus(); }
    return self.clients.openWindow(url);
  }));
});
