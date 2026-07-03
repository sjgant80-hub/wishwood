// ══════════════════════════════════════════════════════════════════
// Wishwood · PWA install · v3
// Users get BOTH: home-screen icon (the app) AND a real file in Downloads
// (a Wishwood shortcut). Visible proof for less-technical users.
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
      navigator.serviceWorker.register('sw.js').catch(function () {});
    });
  }

  var standalone = window.matchMedia('(display-mode: standalone)').matches || window.navigator.standalone;
  if (standalone) return;

  // ─── the shortcut file that gets downloaded to Downloads folder ───
  // Self-contained · double-click opens Wishwood in browser · works offline shortcut
  function buildShortcutHTML() {
    var url = 'https://sjgant80-hub.github.io/wishwood/';
    return ''
      + '<!doctype html>\n<html lang="en">\n<head>\n<meta charset="utf-8">\n'
      + '<title>Wishwood · Open the app</title>\n'
      + '<meta http-equiv="refresh" content="0; url=' + url + '">\n'
      + '<link rel="icon" href="data:image/svg+xml,%3Csvg xmlns=%22http://www.w3.org/2000/svg%22 viewBox=%220 0 64 64%22%3E%3Crect width=%2264%22 height=%2264%22 fill=%22%2318171a%22 rx=%2210%22/%3E%3Ctext x=%2232%22 y=%2246%22 font-family=%22serif%22 font-size=%2244%22 fill=%22%23c97a3d%22 text-anchor=%22middle%22%3E%E2%97%8A%3C/text%3E%3C/svg%3E">\n'
      + '<style>body{margin:0;padding:60px 24px;background:#18171a;color:#ebe5d6;font-family:-apple-system,system-ui,sans-serif;text-align:center;line-height:1.6}h1{font-family:Georgia,serif;color:#c97a3d;font-size:36px;margin-bottom:14px}a.b{display:inline-block;background:linear-gradient(135deg,#c97a3d,#a86428);color:#18171a;padding:14px 24px;border-radius:10px;text-decoration:none;font-weight:700;margin-top:20px}.g{color:#c97a3d;font-size:44px}</style>\n'
      + '</head>\n<body>\n'
      + '<div class="g">◊</div>\n'
      + '<h1>Wishwood</h1>\n'
      + '<p>Opening the Wishwood app…</p>\n'
      + '<a class="b" href="' + url + '">If nothing happens, tap here to open Wishwood</a>\n'
      + '<p style="margin-top:40px;color:#7a7681;font-size:13px">This shortcut file is safe to keep in Downloads · double-click any time to open Wishwood.<br>Delete it to remove.</p>\n'
      + '<script>setTimeout(function(){location.href="' + url + '"},400);</script>\n'
      + '</body>\n</html>';
  }

  function downloadShortcut() {
    try {
      var html = buildShortcutHTML();
      var blob = new Blob([html], { type: 'text/html' });
      var url = URL.createObjectURL(blob);
      var a = document.createElement('a');
      a.href = url;
      a.download = 'Wishwood.html';
      document.body.appendChild(a);
      a.click();
      setTimeout(function () { document.body.removeChild(a); URL.revokeObjectURL(url); }, 200);
      return true;
    } catch (e) {
      return false;
    }
  }

  function injectPill() {
    if (document.getElementById('__ww_install_wrap')) return;
    var wrap = document.createElement('div');
    wrap.id = '__ww_install_wrap';
    wrap.style.cssText = 'position:fixed;bottom:16px;right:16px;z-index:9997;font-family:"Inter",system-ui,sans-serif';
    var btn = document.createElement('button');
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
    modal.style.cssText = 'background:#1f1e22;border:1px solid rgba(201,122,61,0.4);border-radius:14px;padding:32px 30px;max-width:500px;width:100%;color:#ebe5d6;position:relative;box-shadow:0 20px 60px rgba(0,0,0,0.6);max-height:90vh;overflow-y:auto';

    var installBtnHtml = isIOSnow
      ? '<div style="background:rgba(45,74,62,0.4);border:1px solid rgba(107,157,111,0.4);border-radius:10px;padding:18px 22px;margin:14px 0"><div style="font-family:\'JetBrains Mono\',monospace;font-size:10px;letter-spacing:0.16em;text-transform:uppercase;color:#8ce0a5;margin-bottom:12px">◆ Add Wishwood to your iPhone home screen</div><ol style="margin:0 0 0 22px;padding:0;font-size:15px;line-height:1.7"><li style="margin-bottom:6px">Tap <strong style="color:#ebe5d6">Share</strong> (⬆) at the bottom of Safari</li><li style="margin-bottom:6px">Tap <strong style="color:#ebe5d6">Add to Home Screen</strong></li><li>Tap <strong style="color:#ebe5d6">Add</strong> in the top-right</li></ol></div>'
      : (deferredPrompt
        ? '<button id="__ww_do_install" style="display:block;width:100%;background:linear-gradient(135deg,#c97a3d,#a86428);color:#18171a;border:none;padding:14px;border-radius:8px;cursor:pointer;font:700 15px \'Inter\',sans-serif;letter-spacing:0.02em;margin:14px 0">Add to home screen</button>'
        : '<div style="background:rgba(201,122,61,0.1);border:1px solid rgba(201,122,61,0.4);border-radius:10px;padding:14px 18px;margin:14px 0;font-size:13px;line-height:1.6"><strong style="color:#ebe5d6">Look for the install icon in your address bar</strong> (⊕ or ⋮ → Install app). If you don\'t see it, use the download below.</div>'
      );

    modal.innerHTML =
        '<button style="position:absolute;top:12px;right:14px;background:none;border:none;color:#7a7681;font-size:24px;cursor:pointer;line-height:1" onclick="this.parentNode.parentNode.remove()">×</button>'
      + '<div style="font-family:\'Cormorant Garamond\',serif;font-size:28px;color:#ebe5d6;margin-bottom:4px;font-weight:400">Install Wishwood</div>'
      + '<div style="font-family:\'JetBrains Mono\',monospace;font-size:10px;letter-spacing:0.16em;text-transform:uppercase;color:#c97a3d;margin-bottom:20px">◆ Two ways · either works</div>'

      + '<div style="background:rgba(201,122,61,0.08);border:1px solid rgba(201,122,61,0.3);border-left:3px solid #c97a3d;border-radius:0 8px 8px 0;padding:16px 20px;margin-bottom:14px"><div style="font-family:\'JetBrains Mono\',monospace;font-size:10px;letter-spacing:0.14em;text-transform:uppercase;color:#e8b077;margin-bottom:8px">1 · Home screen icon</div><div style="font-size:14px;line-height:1.55;color:#d4cfc8;margin-bottom:8px">Adds a Wishwood icon to your phone/desktop. Tap the icon to open Wishwood full-screen · no browser bar, works offline.</div>' + installBtnHtml + '</div>'

      + '<div style="background:rgba(107,157,111,0.08);border:1px solid rgba(107,157,111,0.3);border-left:3px solid #6b9d6f;border-radius:0 8px 8px 0;padding:16px 20px;margin-bottom:14px"><div style="font-family:\'JetBrains Mono\',monospace;font-size:10px;letter-spacing:0.14em;text-transform:uppercase;color:#8ce0a5;margin-bottom:8px">2 · Downloads folder shortcut</div><div style="font-size:14px;line-height:1.55;color:#d4cfc8;margin-bottom:12px">Saves a small file called <strong style="color:#ebe5d6">Wishwood.html</strong> to your Downloads folder. Double-click any time to open Wishwood. Handy if you ever forget where you saved the app.</div><button id="__ww_dl_shortcut" style="display:block;width:100%;background:transparent;color:#8ce0a5;border:1px solid #6b9d6f;padding:12px;border-radius:8px;cursor:pointer;font:600 14px \'Inter\',sans-serif;letter-spacing:0.02em">📥 Download Wishwood shortcut</button></div>'

      + '<div style="font-size:12px;color:#7a7681;text-align:center;margin-top:10px;line-height:1.5">Works on iPhone · iPad · Android · Mac · Windows · Chromebook.<br>Both options are free · nothing collects your data.</div>';

    overlay.appendChild(modal);
    overlay.onclick = function (e) { if (e.target === overlay) overlay.remove(); };
    document.body.appendChild(overlay);

    // Wire up: home-screen install
    if (deferredPrompt && !isIOSnow) {
      var doBtn = document.getElementById('__ww_do_install');
      if (doBtn) doBtn.onclick = function () {
        deferredPrompt.prompt();
        deferredPrompt.userChoice.finally(function () { deferredPrompt = null; overlay.remove(); });
      };
    }

    // Wire up: downloads shortcut
    var dlBtn = document.getElementById('__ww_dl_shortcut');
    if (dlBtn) dlBtn.onclick = function () {
      var ok = downloadShortcut();
      if (ok) {
        dlBtn.innerHTML = '✓ Wishwood.html saved to your Downloads folder';
        dlBtn.style.background = 'rgba(107,157,111,0.2)';
        dlBtn.style.color = '#8ce0a5';
        dlBtn.style.borderColor = '#6b9d6f';
        setTimeout(function () { overlay.remove(); }, 2200);
      } else {
        dlBtn.textContent = 'Download blocked · check browser settings';
      }
    };
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', injectPill);
  } else {
    injectPill();
  }
})();
