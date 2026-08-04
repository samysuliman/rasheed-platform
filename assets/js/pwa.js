
(() => {
  'use strict';
  const APP_NAME = "منصة رشيد التعليمية";
  const SPLASH_TEXT = "إدارة ذكية للمؤسسات التعليمية";
  const ICON = './assets/icons/icon-192.png';
  let deferredPrompt = null;

  const isStandalone = () => window.matchMedia('(display-mode: standalone)').matches || window.navigator.standalone === true;
  const isIOS = () => /iphone|ipad|ipod/i.test(navigator.userAgent);

  function injectUI(){
    if (!document.getElementById('pwa-install-button')) {
      const btn = document.createElement('button');
      btn.id = 'pwa-install-button';
      btn.type = 'button';
      btn.setAttribute('aria-label','تثبيت التطبيق');
      btn.innerHTML = '<span aria-hidden="true">⬇</span><span>تثبيت التطبيق</span>';
      document.body.appendChild(btn);
      btn.addEventListener('click', installApp);
    }
    if (!document.getElementById('pwa-ios-help')) {
      const help = document.createElement('div');
      help.id = 'pwa-ios-help';
      help.innerHTML = '<div class="pwa-card"><h2>تثبيت '+APP_NAME+'</h2><p>اضغط زر المشاركة في Safari، ثم اختر <strong>إضافة إلى الشاشة الرئيسية</strong>.</p><button type="button">حسنًا</button></div>';
      document.body.appendChild(help);
      help.querySelector('button').addEventListener('click',()=>help.style.display='none');
      help.addEventListener('click',e=>{if(e.target===help)help.style.display='none'});
    }
    if (!document.getElementById('pwa-splash')) {
      const splash = document.createElement('div');
      splash.id = 'pwa-splash';
      splash.innerHTML = '<div class="pwa-splash-inner"><img src="'+ICON+'" alt=""><h1>'+APP_NAME+'</h1><p>'+SPLASH_TEXT+'</p></div>';
      document.body.appendChild(splash);
    }
  }

  async function installApp(){
    if (deferredPrompt) {
      deferredPrompt.prompt();
      try { await deferredPrompt.userChoice; } catch (_) {}
      deferredPrompt = null;
      document.getElementById('pwa-install-button').style.display='none';
      return;
    }
    if (isIOS()) document.getElementById('pwa-ios-help').style.display='flex';
  }

  function showSplash(){
    if (!isStandalone() || sessionStorage.getItem('pwaSplashShown')) return;
    const splash = document.getElementById('pwa-splash');
    splash.style.display='flex';
    sessionStorage.setItem('pwaSplashShown','1');
    setTimeout(()=>{splash.style.opacity='0';setTimeout(()=>splash.remove(),380)},1300);
  }

  window.addEventListener('beforeinstallprompt', e => {
    e.preventDefault();
    deferredPrompt = e;
    const btn=document.getElementById('pwa-install-button');
    if(btn && !isStandalone()) btn.style.display='flex';
  });
  window.addEventListener('appinstalled',()=>{
    const btn=document.getElementById('pwa-install-button');
    if(btn) btn.style.display='none';
    deferredPrompt=null;
  });

  document.addEventListener('DOMContentLoaded',()=>{
    injectUI();
    if (isIOS() && !isStandalone()) {
      const btn=document.getElementById('pwa-install-button');
      btn.style.display='flex';
    }
    showSplash();
  });
})();
