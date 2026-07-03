// ══════════════════════════════════════════════════════════════════
// Wishwood · PWA install pill · universal top-bar injector
// Adds manifest link, service-worker registration, and a floating
// Install pill to every page that includes this script.
//
// Public-page safe · no auth required · no external deps.
// ══════════════════════════════════════════════════════════════════
(function () {
  if (window.__ww_pwa_loaded) return;
  window.__ww_pwa_loaded = true;

  // 1. Manifest link (if not already present)
  if (!document.querySelector('link[rel="manifest"]')) {
    var mfLink = document.createElement('link');
    mfLink.rel = 'manifest';
    mfLink.href = 'manifest.webmanifest';
    document.head.appendChild(mfLink);
  }

  // 2. Service-worker registration (deferred so it never blocks page render)
  if ('serviceWorker' in navigator) {
    window.addEventListener('load', function () {
      navigator.serviceWorker.register('sw.js').catch(function () { /* fail silent */ });
    });
  }

  // 3. Standalone check · skip pill if already installed
  var standalone = window.matchMedia('(display-mode: standalone)').matches || window.navigator.standalone;

  // 4. Inject the pill · positioned top-right, floats above content
  function injectPill() {
    if (document.getElementById('__ww_install_pill')) return;
    if (standalone) return;

    var pill = document.createElement('div');
    pill.id = '__ww_install_pill';
    pill.style.cssText = 'position:fixed;top:12px;right:14px;z-index:9999;display:flex;gap:6px;font-family:"JetBrains Mono",monospace;font-size:.72rem;letter-spacing:.06em;pointer-events:auto';

    var btn = document.createElement('button');
    btn.id = '__ww_install_btn';
    btn.textContent = '◊ Install app';
    btn.style.cssText = 'background:linear-gradient(135deg,#c97a3d,#a86428);color:#18171a;border:none;padding:8px 14px;border-radius:99px;cursor:pointer;font:inherit;font-weight:600;letter-spacing:.05em;box-shadow:0 2px 8px rgba(201,122,61,0.35);transition:transform .15s';
    btn.onmouseover = function () { btn.style.transform = 'translateY(-1px)'; };
    btn.onmouseout = function () { btn.style.transform = ''; };

    var iosBtn = document.createElement('button');
    iosBtn.textContent = '◊ Add to home';
    iosBtn.style.cssText = 'background:transparent;color:#c9a84c;border:1px solid #c9a84c;padding:7px 13px;border-radius:99px;cursor:pointer;font:inherit;letter-spacing:.05em;display:none';

    pill.appendChild(btn);
    pill.appendChild(iosBtn);
    document.body.appendChild(pill);

    // 5. beforeinstallprompt · Chrome/Edge/Android
    var deferredPrompt = null;
    window.addEventListener('beforeinstallprompt', function (e) {
      e.preventDefault();
      deferredPrompt = e;
      btn.style.display = 'block';
    });

    btn.onclick = function () {
      if (deferredPrompt) {
        deferredPrompt.prompt();
        deferredPrompt.userChoice.then(function () { deferredPrompt = null; btn.style.display = 'none'; });
      } else {
        showFallbackHelp();
      }
    };

    // 6. iOS Safari · no beforeinstallprompt, show Add-to-Home Screen tip
    var isIOS = /iPhone|iPad|iPod/.test(navigator.userAgent) && !window.MSStream;
    if (isIOS) {
      btn.style.display = 'none';
      iosBtn.style.display = 'block';
      iosBtn.onclick = function () {
        alert("To install Wishwood as an app on iOS:\n\n1. Tap the Share button (⬆) at the bottom of Safari\n2. Scroll down and tap 'Add to Home Screen'\n3. Tap Add\n\nWishwood will appear on your home screen like a native app.");
      };
    }

    // 7. Track once dismissed via installed event
    window.addEventListener('appinstalled', function () {
      var p = document.getElementById('__ww_install_pill');
      if (p) p.remove();
    });
  }

  function showFallbackHelp() {
    alert("To install Wishwood as an app:\n\nOn Chrome/Edge/Android: look for the install icon in the address bar, or tap ⋮ → 'Install Wishwood'.\n\nOn iOS Safari: tap Share (⬆) → 'Add to Home Screen'.\n\nOnce installed, Wishwood opens like a native app · works offline · syncs across devices.");
  }

  // Wait for DOM
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', injectPill);
  } else {
    injectPill();
  }
})();
