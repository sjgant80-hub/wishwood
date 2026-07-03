// ══════════════════════════════════════════════════════════════════
// Wishwood · Universal top bar · v2 · built for Chrissy
// Two clear modes: SETUP (getting live) · OPERATOR (daily use)
// Giant obvious HOME + BACK · title of where you are · no clutter.
// Small overflow menu for everything else.
// ══════════════════════════════════════════════════════════════════
(function () {
  if (window.__ww_nav_loaded) return;
  window.__ww_nav_loaded = true;

  var HERE = (location.pathname.split('/').pop() || 'index.html').toLowerCase();

  // Every page: title + mode + destination-if-back-not-history
  var PAGES = {
    'index.html':            { title: 'Home',                   mode: null,       parent: null },
    '':                      { title: 'Home',                   mode: null,       parent: null },
    'hub.html':              { title: 'Operator hub',           mode: 'operator', parent: 'index.html' },
    'admin.html':            { title: 'Admin · connections',    mode: 'operator', parent: 'index.html' },
    'book.html':             { title: 'Guest booking site',     mode: 'operator', parent: 'index.html' },
    'hubphone.html':         { title: 'Duty phone',             mode: 'operator', parent: 'index.html' },
    'media.html':            { title: 'Media tools',            mode: 'operator', parent: 'index.html' },
    'credentials.html':      { title: 'Setup checklist',        mode: 'setup',    parent: 'index.html' },
    'credentials-guide.html':{ title: 'Setup guide (plain English)', mode: 'setup', parent: 'credentials.html' },
    'howitworks.html':       { title: 'How it works',           mode: 'setup',    parent: 'index.html' },
    'relaunch.html':         { title: 'Relaunch wizard',        mode: 'setup',    parent: 'index.html' },
    'wa.html':               { title: 'WhatsApp setup',         mode: 'setup',    parent: 'credentials.html' },
    'sync-setup.html':       { title: 'Share on other devices', mode: 'setup',    parent: 'admin.html' },
    'login.html':            { title: 'Login',                  mode: null,       parent: 'index.html' },
    'ai.html':               { title: 'AI agent dossier',       mode: 'setup',    parent: 'index.html' },
    'roost.html':            { title: 'About roost',            mode: 'setup',    parent: 'index.html' },
  };
  var page = PAGES[HERE] || { title: HERE.replace('.html',''), mode: null, parent: 'index.html' };
  var isHome = (HERE === '' || HERE === 'index.html');

  var OVERFLOW = [
    { group: 'Operator (daily)',  items: [
      { href: 'hub.html',       label: 'Operator hub' },
      { href: 'admin.html',     label: 'Admin · connections' },
      { href: 'book.html',      label: 'Guest booking site' },
      { href: 'hubphone.html',  label: 'Duty phone' },
      { href: 'media.html',     label: 'Media tools' },
    ]},
    { group: 'Setup (once)',      items: [
      { href: 'credentials.html',       label: 'Setup checklist' },
      { href: 'credentials-guide.html', label: 'Setup guide (plain English)' },
      { href: 'howitworks.html',        label: 'How it works' },
      { href: 'wa.html',                label: 'WhatsApp setup' },
      { href: 'sync-setup.html',        label: 'Share on other devices (mesh)' },
      { href: 'relaunch.html',          label: 'Relaunch wizard' },
    ]},
    { group: 'Reference', items: [
      { href: 'ai.html',        label: 'AI agent dossier' },
      { href: 'roost.html',     label: 'About roost' },
    ]},
  ];

  var css = ''
    + '#__wwnav{position:fixed;top:0;left:0;right:0;z-index:9998;background:#18171a;border-bottom:1px solid rgba(235,229,214,0.14);height:56px;display:flex;align-items:center;padding:0 12px;gap:8px;font-family:"Inter",-apple-system,system-ui,sans-serif;box-shadow:0 2px 12px rgba(0,0,0,0.35)}'
    + '#__wwnav .btn{color:#ebe5d6;background:rgba(235,229,214,0.06);border:1px solid rgba(235,229,214,0.14);text-decoration:none;font-family:inherit;font-size:13px;font-weight:600;padding:9px 14px;border-radius:6px;transition:background .15s,border-color .15s,transform .1s;cursor:pointer;display:flex;align-items:center;gap:6px;white-space:nowrap;line-height:1}'
    + '#__wwnav .btn:hover{background:rgba(201,122,61,0.14);border-color:#c97a3d;color:#c97a3d}'
    + '#__wwnav .btn:active{transform:translateY(1px)}'
    + '#__wwnav .btn.home{background:linear-gradient(135deg,#c97a3d,#a86428);color:#18171a;border-color:transparent;font-weight:700}'
    + '#__wwnav .btn.home:hover{filter:brightness(1.1);color:#18171a}'
    + '#__wwnav .btn.back svg{width:16px;height:16px}'
    + '#__wwnav .where{flex:1;text-align:center;color:#ebe5d6;font-family:"Cormorant Garamond",serif;font-size:18px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;padding:0 8px}'
    + '#__wwnav .where .mode{display:inline-block;font-family:"JetBrains Mono",monospace;font-size:9px;letter-spacing:0.14em;text-transform:uppercase;padding:2px 8px;border-radius:99px;margin-right:8px;vertical-align:middle}'
    + '#__wwnav .where .mode.setup{background:rgba(107,157,111,0.15);color:#8ce0a5;border:1px solid rgba(107,157,111,0.4)}'
    + '#__wwnav .where .mode.operator{background:rgba(201,122,61,0.15);color:#e8b077;border:1px solid rgba(201,122,61,0.4)}'
    + '#__wwnav .where em{color:#c97a3d;font-style:italic}'
    + '#__wwnav .more{position:relative}'
    + '#__wwnav .morebtn svg{width:16px;height:16px}'
    + '#__wwnav .moremenu{display:none;position:absolute;top:calc(100% + 4px);right:0;background:#1f1e22;border:1px solid rgba(235,229,214,0.18);border-radius:8px;box-shadow:0 12px 32px rgba(0,0,0,0.6);min-width:300px;padding:8px;max-height:calc(100vh - 80px);overflow-y:auto}'
    + '#__wwnav .moremenu.open{display:block}'
    + '#__wwnav .moremenu .grp{font-family:"JetBrains Mono",monospace;font-size:9px;letter-spacing:0.14em;text-transform:uppercase;color:#7a7681;padding:10px 12px 4px}'
    + '#__wwnav .moremenu a{display:block;padding:9px 14px;font-size:13px;color:#ebe5d6;text-decoration:none;border-radius:6px;line-height:1.3}'
    + '#__wwnav .moremenu a:hover{background:rgba(201,122,61,0.12);color:#c97a3d}'
    + '#__wwnav .moremenu a.active{background:rgba(201,122,61,0.18);color:#c97a3d}'
    + '@media(max-width:520px){'
    + '#__wwnav .btn{font-size:11px;padding:8px 10px}'
    + '#__wwnav .btn.home span{display:none}'
    + '#__wwnav .btn.back span{display:none}'
    + '#__wwnav .where{font-size:14px}'
    + '#__wwnav .where .mode{display:none}'
    + '}'
    + 'body{padding-top:56px !important}'
    + '#__ww_bottom_home{display:block;max-width:520px;margin:40px auto 32px;padding:0 22px}'
    + '#__ww_bottom_home a{display:flex;align-items:center;justify-content:center;gap:10px;background:linear-gradient(135deg,#c97a3d,#a86428);color:#18171a;padding:16px 22px;border-radius:10px;text-decoration:none;font-family:"Inter",sans-serif;font-size:16px;font-weight:700;letter-spacing:0.02em;box-shadow:0 4px 16px rgba(201,122,61,0.3);transition:transform .15s}'
    + '#__ww_bottom_home a:hover{transform:translateY(-2px)}'
  ;
  var style = document.createElement('style');
  style.textContent = css;
  document.head.appendChild(style);

  var backArrow = '<svg viewBox="0 0 20 20" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><path d="M12 4l-6 6 6 6"/></svg>';
  var moreIcon = '<svg viewBox="0 0 20 20" fill="currentColor"><circle cx="4" cy="10" r="1.6"/><circle cx="10" cy="10" r="1.6"/><circle cx="16" cy="10" r="1.6"/></svg>';

  var nav = document.createElement('nav');
  nav.id = '__wwnav';

  if (!isHome) {
    var homeBtn = document.createElement('a');
    homeBtn.className = 'btn home';
    homeBtn.href = 'index.html';
    homeBtn.innerHTML = '<span style="font-size:16px">◊</span><span>Home</span>';
    homeBtn.title = 'Back to Home';
    nav.appendChild(homeBtn);

    var backBtn = document.createElement('a');
    backBtn.className = 'btn back';
    backBtn.href = page.parent || 'index.html';
    backBtn.innerHTML = backArrow + '<span>Back</span>';
    backBtn.title = 'Go back';
    backBtn.onclick = function (e) {
      // Prefer browser history if we have any, else fall back to parent
      if (history.length > 1 && document.referrer && document.referrer.indexOf(location.host) !== -1) {
        e.preventDefault();
        history.back();
      }
    };
    nav.appendChild(backBtn);
  } else {
    // On home page: just show the brand
    var brand = document.createElement('span');
    brand.className = 'btn home';
    brand.style.cursor = 'default';
    brand.innerHTML = '<span style="font-size:16px">◊</span><span>Wishwood</span>';
    nav.appendChild(brand);
  }

  var where = document.createElement('div');
  where.className = 'where';
  var modeHtml = page.mode
    ? '<span class="mode ' + page.mode + '">' + (page.mode === 'setup' ? '🌱 Setup' : '⌬ Operator') + '</span>'
    : '';
  where.innerHTML = modeHtml + (isHome ? 'Welcome <em>back</em>' : page.title);
  nav.appendChild(where);

  var moreWrap = document.createElement('div');
  moreWrap.className = 'more';
  var moreBtn = document.createElement('button');
  moreBtn.className = 'btn morebtn';
  moreBtn.innerHTML = moreIcon + '<span style="margin-left:2px">More</span>';
  moreBtn.setAttribute('aria-expanded', 'false');
  var moreMenu = document.createElement('div');
  moreMenu.className = 'moremenu';
  var menuHtml = '';
  OVERFLOW.forEach(function (grp) {
    menuHtml += '<div class="grp">' + grp.group + '</div>';
    grp.items.forEach(function (it) {
      var active = (it.href === HERE) ? ' active' : '';
      menuHtml += '<a class="' + active + '" href="' + it.href + '">' + it.label + '</a>';
    });
  });
  moreMenu.innerHTML = menuHtml;
  moreWrap.appendChild(moreBtn);
  moreWrap.appendChild(moreMenu);
  moreBtn.addEventListener('click', function (e) {
    e.stopPropagation();
    var open = moreMenu.classList.toggle('open');
    moreBtn.setAttribute('aria-expanded', open ? 'true' : 'false');
  });
  document.addEventListener('click', function () { moreMenu.classList.remove('open'); });
  nav.appendChild(moreWrap);

  // Inject nav
  function inject() {
    document.body.insertBefore(nav, document.body.firstChild);
    // Also inject a big "back to Home" button at the bottom of every non-home page
    if (!isHome) {
      var bottom = document.createElement('div');
      bottom.id = '__ww_bottom_home';
      bottom.innerHTML = '<a href="index.html">◊ Back to Home</a>';
      document.body.appendChild(bottom);
    }
  }
  if (document.body) inject();
  else document.addEventListener('DOMContentLoaded', inject);
})();
