// ══════════════════════════════════════════════════════════════════
// Wishwood · PWA install · v2 · nothing downloads to files
// Install adds an icon to the home screen. That icon IS the app.
// No .apk, no .exe, no download folder file · just an icon.
// ══════════════════════════════════════════════════════════════════
(function () {
  if (window.__ww_pwa_loaded) return;
  window.__ww_pwa_loaded = true;

  if (!document.querySelector('link[rel="manifest"]')) {
    var mfLink = document.createElement('link');
    mfLink.rel = 'manifest';
    mfLink.href = 'manifest.webmanifest';
    document.head.appendChild(mfLink);
  }

  if ('serviceWorker' in navigator) {
    window.addEventListener('load', function () {
      navigator.serviceWorker.register('sw.js').catch(function () { /* silent · sw is optional */ });
    });
  }

  var standalone = window.matchMedia('(display-mode: standalone)').matches || window.navigator.standalone;
  var isIOS = /iPhone|iPad|iPod/.test(navigator.userAgent) && !window.MSStream;
  if (standalone) return;

  function injectPill() {
    if (document.getElementById('__ww_install_wrap')) return;

    var wrap = document.createElement('div');
    wrap.id = '__ww_install_wrap';
    wrap.style.cssText = 'position:fixed;bottom:16px;right:16px;z-index:9997;font-family:"Inter",system-ui,sans-serif';

    var btn = document.createElement('button');
    btn.id = '__ww_install_btn';
    btn.innerHTML = '<span style="font-size:18px;line-height:1">📱</span><span>Install Wishwood</span>';
    btn.style.cssText = 'display:flex;align-items:center;gap:8px;background:linear-gradient(135deg,#c97a3d,#a86428);color:#18171a;border:none;padding:12px 18px;border-radius:99px;cursor:pointer;font-family:inherit;font-size:14px;font-weight:700;letter-spacing:0.02em;box-shadow:0 6px 20px rgba(201,122,61,0.45);transition:transform .15s';
    btn.onmouseover = function () { btn.style.transform = 'translateY(-2px)'; };
    btn.onmouseout = function () { btn.style.transform = ''; };
    wrap.appendChild(btn);
    document.body.appendChild(wrap);

    var deferredPrompt = null;
    window.addEventListener('beforeinstallprompt', function (e) {
      e.preventDefault();
      deferredPrompt = e;
    });

    btn.onclick = function () { showModal(deferredPrompt); };

    window.addEventListener('appinstalled', function () {
      var el = document.getElementById('__ww_install_wrap');
      if (el) el.remove();
    });
  }

  function showModal(deferredPrompt) {
    if (document.getElementById('__ww_install_modal')) return;
    var isIOSnow = /iPhone|iPad|iPod/.test(navigator.userAgent) && !window.MSStream;

    var overlay = document.createElement('div');
    overlay.id = '__ww_install_modal';
    overlay.style.cssText = 'position:fixed;inset:0;background:rgba(11,10,15,0.86);backdrop-filter:blur(6px);z-index:9999;display:flex;align-items:center;justify-content:center;padding:20px;font-family:"Inter",system-ui,sans-serif';

    var modal = document.createElement('div');
    modal.style.cssText = 'background:#1f1e22;border:1px solid rgba(201,122,61,0.4);border-radius:14px;padding:32px 30px;max-width:460px;width:100%;color:#ebe5d6;position:relative;box-shadow:0 20px 60px rgba(0,0,0,0.6)';

    var iosStepsHtml = isIOSnow
      ? '<div style="background:rgba(45,74,62,0.4);border:1px solid rgba(107,157,111,0.4);border-radius:10px;padding:18px 22px;margin:16px 0"><div style="font-family:\'JetBrains Mono\',monospace;font-size:10px;letter-spacing:0.16em;text-transform:uppercase;color:#8ce0a5;margin-bottom:12px">◆ On iPhone / iPad</div><ol style="margin:0 0 0 22px;padding:0;font-size:15px;line-height:1.7"><li style="margin-bottom:8px">Tap the <strong style="color:#ebe5d6">Share button</strong> (⬆) at the bottom of Safari</li><li style="margin-bottom:8px">Scroll down and tap <strong style="color:#ebe5d6">Add to Home Screen</strong></li><li>Tap <strong style="color:#ebe5d6">Add</strong> in the top-right corner</li></ol></div>'
      : (deferredPrompt
        ? '<button id="__ww_do_install" style="display:block;width:100%;background:linear-gradient(135deg,#c97a3d,#a86428);color:#18171a;border:none;padding:14px;border-radius:8px;cursor:pointer;font:600 15px \'Inter\',sans-serif;letter-spacing:0.02em;margin:16px 0">Yes, install Wishwood now</button>'
        : '<div style="background:rgba(201,122,61,0.1);border:1px solid rgba(201,122,61,0.4);border-radius:10px;padding:18px 22px;margin:16px 0;font-size:14px;line-height:1.65">Your browser doesn\'t have a native install button on this page yet. Try one of these:<br><br><strong style="color:#ebe5d6">Chrome / Edge desktop:</strong> click the ⊕ install icon in the address bar (right-hand side).<br><br><strong style="color:#ebe5d6">Chrome Android:</strong> tap the ⋮ menu → <em style="color:#c97a3d">Install app</em>.<br><br><strong style="color:#ebe5d6">Firefox:</strong> menu → <em style="color:#c97a3d">Install</em>.</div>'
      );

    modal.innerHTML =
        '<button style="position:absolute;top:12px;right:14px;background:none;border:none;color:#7a7681;font-size:24px;cursor:pointer;line-height:1" onclick="this.parentNode.parentNode.remove()">×</button>'
      + '<div style="font-family:\'Cormorant Garamond\',serif;font-size:28px;color:#ebe5d6;margin-bottom:6px;font-weight:400">Install Wishwood</div>'
      + '<div style="font-family:\'JetBrains Mono\',monospace;font-size:10px;letter-spacing:0.16em;text-transform:uppercase;color:#c97a3d;margin-bottom:20px">◆ what actually happens</div>'
      + '<div style="font-size:15px;line-height:1.65;color:#d4cfc8;margin-bottom:16px">A <strong style="color:#ebe5d6">Wishwood icon</strong> appears on your home screen or app drawer · that icon <strong style="color:#ebe5d6">is the app</strong>. Tap it any time to open Wishwood in its own window · no browser bar, no clutter, works offline.</div>'
      + '<div style="background:rgba(107,157,111,0.08);border-left:3px solid #6b9d6f;border-radius:0 6px 6px 0;padding:12px 16px;margin-bottom:16px;font-size:13px;color:#d4cfc8;line-height:1.55"><strong style="color:#8ce0a5;font-family:\'JetBrains Mono\',monospace;font-size:10px;letter-spacing:0.14em;text-transform:uppercase;display:block;margin-bottom:4px">Nothing lands in Downloads</strong>Wishwood is a website that pretends to be an app. Nothing downloads to your files. If you delete the home-screen icon later, everything is gone · no leftovers.</div>'
      + iosStepsHtml
      + '<div style="font-size:12px;color:#7a7681;text-align:center;margin-top:10px;line-height:1.5">Works on iPhone, iPad, Android, Mac, Windows, Chromebook.</div>';
    overlay.appendChild(modal);
    overlay.onclick = function (e) { if (e.target === overlay) overlay.remove(); };
    document.body.appendChild(overlay);

    if (deferredPrompt && !isIOSnow) {
      var doBtn = document.getElementById('__ww_do_install');
      if (doBtn) doBtn.onclick = function () {
        overlay.remove();
        deferredPrompt.prompt();
        deferredPrompt.userChoice.finally(function () { deferredPrompt = null; });
      };
    }
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', injectPill);
  } else {
    injectPill();
  }
})();
