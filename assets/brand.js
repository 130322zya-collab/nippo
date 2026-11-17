/* 濱崎組 現場アプリ 共通の部品（ロゴ・音声入力・通知の登録） */
(function(){
  const MARK = '<div class="hm-mark" aria-hidden="true"><svg viewBox="0 0 26 26"><path d="M4 2h4v16h16v4H4z" fill="#d4ad6e"/><path d="M8 5h3M8 8h2M8 11h3M8 14h2M11 18v-3M14 18v-2M17 18v-3M20 18v-2" stroke="#d4ad6e" stroke-width="1.2"/></svg></div>';
  const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
  let active = null;
  function stop(){ if(active){ try{ active.rec.stop(); }catch(e){} active.btn.classList.remove("rec"); active.btn.querySelector("span").textContent = "話して入力"; active = null; } }
  function micFor(ta){
    if(!SR || !ta || ta.dataset.hmMic) return;
    ta.dataset.hmMic = "1";
    ta.classList.add("hm-ruled");
    const btn = document.createElement("button");
    btn.type = "button"; btn.className = "hm-mic"; btn.innerHTML = "<i></i><span>話して入力</span>";
    btn.addEventListener("click", e => {
      e.preventDefault(); e.stopPropagation();
      if(active && active.btn === btn){ stop(); return; }
      stop();
      const rec = new SR(); rec.lang = "ja-JP"; rec.interimResults = false; rec.continuous = false;
      rec.onresult = ev => {
        const text = Array.from(ev.results).map(r => r[0].transcript).join("");
        if(!text) return;
        ta.value = ta.value ? ta.value.replace(/\s*$/, "") + (/[。．\n]$/.test(ta.value.trim()) ? "" : "。") + text : text;
        ta.dispatchEvent(new Event("input", { bubbles:true }));
      };
      rec.onerror = ev => { stop(); if(ev.error === "not-allowed" || ev.error === "service-not-allowed") alert("マイクが使えません。設定でこのサイトのマイクを許可してください。\n（キーボードのマイクボタンでも音声入力できます）"); };
      rec.onend = () => { if(active && active.btn === btn) stop(); };
      active = { rec, btn };
      btn.classList.add("rec"); btn.querySelector("span").textContent = "聞いています…（押すと止まる）";
      try{ rec.start(); }catch(e){ stop(); }
    });
    ta.insertAdjacentElement("afterend", btn);
  }
  window.HM = {
    mark: () => MARK,
    canMic: !!SR,
    /* root の中の textarea に「話して入力」を付ける（skip に当たるものは除く） */
    mics(root, skip){ (root || document).querySelectorAll("textarea").forEach(ta => { if(skip && ta.matches(skip)) return; if(SR) micFor(ta); else ta.classList.add("hm-ruled"); }); },
    stopMic: stop,
    pushSetup(opts){ if(window.HMPush) window.HMPush.setup(opts); else alert("通知の設定は準備中です"); }
  };
})();

/* ---- 日報の書き忘れ通知（17:15） ---- */
(function(){
  const API = "https://hamasaki-nippo-notify.zoza.workers.dev";
  const KEY = "hamasaki1147";
  const VAPID = "BIgF50rzhclmZQ8hvg6roL0iE6EqYEK_uwyUcjA2jZycMQ7_DJteF7L_FBVGwyApWFOU4anbrBTsHwR_1ceqtWE";
  const swPath = () => location.pathname.includes("/kantoku/") || location.pathname.includes("/kanri/") ? "../sw.js" : "sw.js";
  const scope = () => swPath() === "sw.js" ? "./" : "../";
  const u8 = s => { s = s.replace(/-/g,"+").replace(/_/g,"/"); while(s.length % 4) s += "="; return Uint8Array.from(atob(s), c => c.charCodeAt(0)); };
  const isIOS = /iP(hone|ad|od)/.test(navigator.userAgent) || (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1);
  const standalone = () => window.matchMedia("(display-mode: standalone)").matches || navigator.standalone === true;
  const supported = () => "serviceWorker" in navigator && "PushManager" in window && "Notification" in window;
  function state(){
    if(!supported()) return isIOS && !standalone() ? "home" : "none";
    if(Notification.permission === "denied") return "denied";
    try{ return localStorage.getItem("hm_push_on") === "1" && Notification.permission === "granted" ? "on" : "off"; }catch(e){ return "off"; }
  }
  async function send(path, body){
    const r = await fetch(API + path, { method:"POST", headers:{ "Content-Type":"application/json", "Authorization":"Bearer " + KEY }, body: JSON.stringify(body) });
    if(!r.ok) throw new Error("status " + r.status);
    return r.json();
  }
  async function setup(opts){
    const st = state();
    if(!opts || !opts.name){ alert("先に名前を選んでください"); return; }
    if(st === "home"){ alert("iPhone・iPadで通知を受けるには、先にこのサイトをホーム画面に追加してください。\n\n① 画面下の共有ボタン（□に↑）を押す\n②「ホーム画面に追加」\n③ ホーム画面にできたアイコンから開いて、もう一度「通知の設定」を押す"); return; }
    if(st === "none"){ alert("この端末・ブラウザは通知に対応していません。\niPhoneはiOS 16.4以降で、ホーム画面に追加して使ってください。"); return; }
    if(st === "denied"){ alert("通知がオフになっています。\n端末の「設定」→ 通知 → このアプリ（大工日報／監督日報）で、通知を許可してください。"); return; }
    if(st === "on"){
      if(confirm(`${opts.name}さんの通知は設定済みです（月〜土の17:15、日報がまだのときだけ）。\n\nテストの通知を今送りますか？\n（キャンセルで通知を止める方を選べます）`)){
        try{ const r = await send("/test", { app:opts.app, name:opts.name }); alert(r.sent ? "テストの通知を送りました。数秒で届きます。" : "通知を送れませんでした。もう一度設定し直してください。"); }catch(e){ alert("通信できませんでした：" + e.message); }
      }else if(confirm("この端末の通知を止めますか？")){
        try{ const reg = await navigator.serviceWorker.getRegistration(scope()); const sub = reg && await reg.pushManager.getSubscription();
          if(sub){ await send("/subscribe", { app:opts.app, name:opts.name, sub:sub.toJSON(), remove:true }); await sub.unsubscribe(); }
          localStorage.removeItem("hm_push_on"); alert("通知を止めました"); if(opts.onChange) opts.onChange(); }catch(e){ alert("止められませんでした：" + e.message); }
      }
      return;
    }
    if(!confirm(`月〜土の17:15に、日報をまだ書いていなければ、この端末に通知を出します。\n${opts.name}さんの通知として登録しますか？`)) return;
    try{
      const perm = await Notification.requestPermission();
      if(perm !== "granted"){ alert("通知が許可されませんでした。設定から許可するとあとで使えます。"); return; }
      const reg = await navigator.serviceWorker.register(swPath(), { scope: scope() });
      await navigator.serviceWorker.ready;
      let sub = await reg.pushManager.getSubscription();
      if(!sub) sub = await reg.pushManager.subscribe({ userVisibleOnly:true, applicationServerKey: u8(VAPID) });
      await send("/subscribe", { app:opts.app, name:opts.name, sub:sub.toJSON() });
      localStorage.setItem("hm_push_on", "1");
      alert("通知を設定しました。月〜土の17:15に、日報がまだなら通知が届きます。");
      if(opts.onChange) opts.onChange();
    }catch(e){ alert("通知を設定できませんでした：" + e.message); }
  }
  window.HMPush = { setup, state };
})();
