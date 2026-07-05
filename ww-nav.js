// ══════════════════════════════════════════════════════════════════
// Wishwood · Left sidebar v3 · FallCube pattern
// Persistent left sidebar · section groups · click item → open page
// Body content shifts right on desktop · hamburger drawer on mobile
// ══════════════════════════════════════════════════════════════════
(function () {
  if (window.__ww_nav_loaded) return;
  window.__ww_nav_loaded = true;

  var HERE = (location.pathname.split('/').pop() || 'index.html').toLowerCase();
  var isHome = (HERE === '' || HERE === 'index.html');

  // Sidebar structure · groups map to how Chrissy thinks about her day
  var SIDEBAR = [
    { header: null, items: [
      { href: 'index.html', icon: '◊',  label: 'Home' },
    ]},
    { header: 'DAILY · operator', items: [
      { href: 'hub.html',       icon: '⌬',  label: 'Operator hub' },
      { href: 'autopilot.html', icon: '⚡', label: 'AI autopilot' },
      { href: 'book.html',      icon: '◊',  label: 'Guest booking site' },
      { href: 'hubphone.html',  icon: '📱', label: 'Duty phone' },
      { href: 'media.html',     icon: '⛁',  label: 'Media tools' },
    ]},
    { header: 'SETUP · once', items: [
      { href: 'credentials.html',       icon: '🔑', label: 'Setup checklist' },
      { href: 'credentials-guide.html', icon: '📖', label: 'Setup guide' },
      { href: 'admin.html',             icon: '⚙',  label: 'Admin · connections' },
      { href: 'relaunch.html',          icon: '🌱', label: 'Relaunch wizard' },
    ]},
    { header: 'HELP · reference', items: [
      { href: 'howitworks.html', icon: '📘', label: 'How it works' },
      { href: 'wa.html',         icon: '💬', label: 'WhatsApp setup' },
      { href: 'sync-setup.html', icon: '🔗', label: 'Share on devices' },
      { href: 'ai.html',         icon: '🤖', label: 'AI agent dossier' },
      { href: 'roost.html',      icon: '◊',  label: 'About roost' },
    ]},
  ];

  var css = ''
    // Sidebar frame
    + '#__wwside{position:fixed;top:0;left:0;bottom:0;width:264px;background:#1a1922;border-right:1px solid rgba(235,229,214,0.1);z-index:9998;display:flex;flex-direction:column;font-family:"Inter",-apple-system,system-ui,sans-serif;overflow-y:auto;overflow-x:hidden;box-shadow:2px 0 20px rgba(0,0,0,0.3)}'
    + '#__wwside::-webkit-scrollbar{width:6px}'
    + '#__wwside::-webkit-scrollbar-track{background:transparent}'
    + '#__wwside::-webkit-scrollbar-thumb{background:rgba(235,229,214,0.1);border-radius:3px}'
    // Brand block
    + '#__wwside .__brand{display:flex;align-items:center;gap:12px;padding:20px 18px 14px;border-bottom:1px solid rgba(235,229,214,0.08)}'
    + '#__wwside .__brandlogo{width:38px;height:38px;border-radius:10px;background:#0b0a0f;display:grid;place-items:center;color:#c97a3d;font-size:22px;font-family:"Cormorant Garamond",serif;flex-shrink:0}'
    + '#__wwside .__brandtxt{display:flex;flex-direction:column;line-height:1.2;overflow:hidden}'
    + '#__wwside .__brandtxt .n{font-family:"Cormorant Garamond",serif;font-size:20px;color:#ebe5d6;font-weight:500;letter-spacing:0.02em}'
    + '#__wwside .__brandtxt .s{font-family:"JetBrains Mono",monospace;font-size:10px;color:#7a7681;letter-spacing:0.05em;margin-top:2px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}'
    // Seal pill
    + '#__wwside .__seal{margin:14px 18px;padding:8px 12px;background:rgba(201,168,76,0.08);border:1px solid rgba(201,168,76,0.3);border-radius:8px;font-family:"JetBrains Mono",monospace;font-size:11px;color:#c9a84c;text-align:center;letter-spacing:0.1em}'
    // Group headers
    + '#__wwside .__hdr{padding:14px 22px 6px;font-family:"JetBrains Mono",monospace;font-size:9.5px;color:#5a5750;letter-spacing:0.16em;text-transform:uppercase;font-weight:600}'
    // Menu items
    + '#__wwside .__group{padding:2px 10px}'
    + '#__wwside a.__it{display:flex;align-items:center;gap:12px;padding:10px 14px;color:#a09d95;text-decoration:none;border-radius:8px;font-size:13.5px;line-height:1.2;transition:background .12s,color .12s;position:relative;font-weight:500}'
    + '#__wwside a.__it:hover{background:rgba(201,122,61,0.08);color:#e8b077}'
    + '#__wwside a.__it .__ic{font-size:16px;width:18px;text-align:center;flex-shrink:0;opacity:0.85}'
    + '#__wwside a.__it.__active{background:rgba(201,122,61,0.16);color:#c97a3d;font-weight:600}'
    + '#__wwside a.__it.__active::before{content:"";position:absolute;left:-10px;top:8px;bottom:8px;width:3px;background:#c97a3d;border-radius:0 3px 3px 0}'
    // Bottom card
    + '#__wwside .__foot{margin-top:auto;padding:14px 18px 18px;border-top:1px solid rgba(235,229,214,0.06)}'
    + '#__wwside .__foot .__mode{background:linear-gradient(135deg,rgba(107,157,111,0.15),rgba(45,74,62,0.35));border:1px solid rgba(107,157,111,0.3);border-radius:8px;padding:10px 12px}'
    + '#__wwside .__foot .__mlabel{font-family:"JetBrains Mono",monospace;font-size:9.5px;color:#8ce0a5;letter-spacing:0.1em;text-transform:uppercase;margin-bottom:4px}'
    + '#__wwside .__foot .__mval{color:#ebe5d6;font-size:12.5px;line-height:1.35}'
    // Hamburger toggle (mobile)
    + '#__wwtoggle{position:fixed;top:12px;left:12px;z-index:9999;width:44px;height:44px;border-radius:10px;background:#1a1922;border:1px solid rgba(235,229,214,0.15);color:#ebe5d6;font-size:20px;cursor:pointer;display:none;align-items:center;justify-content:center;box-shadow:0 4px 16px rgba(0,0,0,0.35)}'
    + '#__wwback{position:fixed;top:12px;left:64px;z-index:9999;height:44px;padding:0 14px;border-radius:10px;background:#1a1922;border:1px solid rgba(235,229,214,0.15);color:#c97a3d;font-size:13px;font-weight:600;cursor:pointer;display:none;align-items:center;gap:6px;font-family:"Inter",sans-serif;box-shadow:0 4px 16px rgba(0,0,0,0.35);text-decoration:none}'
    + '#__wwback:hover{border-color:#c97a3d}'
    // Body shift
    + 'body{padding-left:264px !important;transition:padding-left .2s}'
    // Backdrop (mobile drawer)
    + '#__wwback_drop{position:fixed;inset:0;background:rgba(11,10,15,0.6);z-index:9997;display:none}'
    // Mobile
    + '@media(max-width:820px){'
    + '#__wwside{transform:translateX(-100%);transition:transform .22s}'
    + '#__wwside.__open{transform:translateX(0)}'
    + '#__wwback_drop.__show{display:block}'
    + '#__wwtoggle{display:flex}'
    + '#__wwback{display:flex}'
    + 'body{padding-left:0 !important;padding-top:64px !important}'
    + '}'
  ;
  var style = document.createElement('style');
  style.textContent = css;
  document.head.appendChild(style);

  // Build sidebar
  var side = document.createElement('aside');
  side.id = '__wwside';

  var brand = document.createElement('a');
  brand.href = 'index.html';
  brand.style.textDecoration = 'none';
  brand.className = '__brand';
  brand.innerHTML = '<div class="__brandlogo">◊</div><div class="__brandtxt"><span class="n">Wishwood</span><span class="s">ai-nativesolutions.com</span></div>';
  side.appendChild(brand);

  var seal = document.createElement('div');
  seal.className = '__seal';
  seal.textContent = '◊ Konomi · ◊·κ=1';
  side.appendChild(seal);

  SIDEBAR.forEach(function (grp) {
    if (grp.header) {
      var h = document.createElement('div');
      h.className = '__hdr';
      h.textContent = grp.header;
      side.appendChild(h);
    }
    var g = document.createElement('div');
    g.className = '__group';
    grp.items.forEach(function (it) {
      var a = document.createElement('a');
      a.className = '__it' + (it.href === HERE ? ' __active' : '');
      a.href = it.href;
      a.innerHTML = '<span class="__ic">' + it.icon + '</span><span>' + it.label + '</span>';
      g.appendChild(a);
    });
    side.appendChild(g);
  });

  // Bottom mode card
  var foot = document.createElement('div');
  foot.className = '__foot';
  var currentMode = 'Setup mode';
  var currentModeText = 'Getting live · gathering credentials';
  var operatorPages = ['hub.html', 'autopilot.html', 'book.html', 'hubphone.html', 'media.html'];
  if (operatorPages.indexOf(HERE) !== -1) {
    currentMode = 'Operator mode';
    currentModeText = 'Daily operations · live tools';
  } else if (isHome) {
    currentMode = 'Home';
    currentModeText = 'Pick a door';
  }
  foot.innerHTML = '<div class="__mode"><div class="__mlabel">◆ ' + currentMode + '</div><div class="__mval">' + currentModeText + '</div></div>';
  side.appendChild(foot);

  // Mobile hamburger + back
  var toggle = document.createElement('button');
  toggle.id = '__wwtoggle';
  toggle.innerHTML = '☰';
  toggle.setAttribute('aria-label', 'Open menu');

  var backdrop = document.createElement('div');
  backdrop.id = '__wwback_drop';

  var backBtn = null;
  if (!isHome) {
    backBtn = document.createElement('a');
    backBtn.id = '__wwback';
    backBtn.href = 'index.html';
    backBtn.innerHTML = '<span style="font-size:16px">◊</span>Home';
  }

  function inject() {
    document.body.insertBefore(side, document.body.firstChild);
    document.body.appendChild(toggle);
    document.body.appendChild(backdrop);
    if (backBtn) document.body.appendChild(backBtn);
  }
  if (document.body) inject();
  else document.addEventListener('DOMContentLoaded', inject);

  toggle.addEventListener('click', function () {
    side.classList.add('__open');
    backdrop.classList.add('__show');
  });
  backdrop.addEventListener('click', function () {
    side.classList.remove('__open');
    backdrop.classList.remove('__show');
  });
})();
