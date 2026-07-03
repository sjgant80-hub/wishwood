// ══════════════════════════════════════════════════════════════════
// Wishwood · Universal top nav bar
// Lifts the SaaS hospitality-ops nav pattern (Hostaway / Lodgify / Guesty
// / Cloudbeds / Sirvoy converge on: 5-7 primary tabs + overflow menu +
// notifications area). Injects a fixed top nav on every page that
// includes this script.
//
// Body top-padding is auto-adjusted so nothing gets hidden underneath.
// ══════════════════════════════════════════════════════════════════
(function () {
  if (window.__ww_nav_loaded) return;
  window.__ww_nav_loaded = true;

  var HERE = (location.pathname.split('/').pop() || 'index.html').toLowerCase();

  // Primary tabs · always visible on desktop · match SaaS canonical set
  var PRIMARY = [
    { href: 'index.html',       label: 'Home',        match: ['', 'index.html'] },
    { href: 'hub.html',         label: 'Hub',         match: ['hub.html'] },
    { href: 'book.html',        label: 'Book site',   match: ['book.html'] },
    { href: 'credentials.html', label: 'Setup',       match: ['credentials.html', 'credentials-guide.html'] },
    { href: 'howitworks.html',  label: 'How it works',match: ['howitworks.html'] },
    { href: 'ai.html',          label: 'AI',          match: ['ai.html'] },
  ];

  // Overflow menu · secondary destinations
  var MORE = [
    { href: 'admin.html',            label: 'Admin · settings' },
    { href: 'credentials-guide.html',label: 'Setup guide (plain English)' },
    { href: 'hub.html#inbox',        label: 'Inbox' },
    { href: 'hub.html#calendar',     label: 'Calendar' },
    { href: 'hub.html#dashboard',    label: 'Dashboard' },
    { href: 'hubphone.html',         label: 'Duty phone' },
    { href: 'wa.html',               label: 'WhatsApp launcher' },
    { href: 'sync-setup.html',       label: 'Share on multiple devices (mesh)' },
    { href: 'media.html',            label: 'Media tools' },
    { href: 'relaunch.html',         label: 'Relaunch wizard' },
    { href: 'roost.html',            label: 'About roost' },
  ];

  // Inject styles
  var css = ''
    + '#__wwnav{position:fixed;top:0;left:0;right:0;z-index:9998;background:rgba(11,10,15,0.94);backdrop-filter:blur(12px);border-bottom:1px solid rgba(235,229,214,0.1);height:48px;display:flex;align-items:center;padding:0 16px;font-family:"Inter",-apple-system,system-ui,sans-serif}'
    + '#__wwnav a,#__wwnav button{color:#7a7681;text-decoration:none;font-family:inherit;font-size:12px;letter-spacing:0.06em;padding:8px 14px;border-radius:4px;transition:background .15s,color .15s;cursor:pointer;background:transparent;border:none;white-space:nowrap}'
    + '#__wwnav a:hover,#__wwnav button:hover{color:#c97a3d;background:rgba(201,122,61,0.08)}'
    + '#__wwnav a.__active{color:#c97a3d;background:rgba(201,122,61,0.12)}'
    + '#__wwnav .__brand{color:#ebe5d6;font-family:"Cormorant Garamond",serif;font-size:18px;padding-right:12px;margin-right:8px;border-right:1px solid rgba(235,229,214,0.08);letter-spacing:0.02em}'
    + '#__wwnav .__brand .__glyph{color:#c97a3d;margin-right:6px}'
    + '#__wwnav .__primary{display:flex;gap:2px;flex:1;overflow-x:auto;-ms-overflow-style:none;scrollbar-width:none}'
    + '#__wwnav .__primary::-webkit-scrollbar{display:none}'
    + '#__wwnav .__more{position:relative}'
    + '#__wwnav .__morebtn{color:#c97a3d;font-weight:600}'
    + '#__wwnav .__moremenu{display:none;position:absolute;top:100%;right:0;background:#1f1e22;border:1px solid rgba(235,229,214,0.12);border-radius:6px;box-shadow:0 8px 24px rgba(0,0,0,0.4);min-width:280px;padding:6px;margin-top:4px}'
    + '#__wwnav .__moremenu.__open{display:block}'
    + '#__wwnav .__moremenu a{display:block;padding:9px 14px;font-size:13px;text-transform:none;letter-spacing:0}'
    + '@media (max-width:820px){#__wwnav .__primary a{display:none}#__wwnav .__primary a.__mobshow{display:inline-block}}'
    + '@media (max-width:600px){#__wwnav .__brand{font-size:16px;padding-right:8px}#__wwnav .__primary a.__mobshow{padding:6px 8px;font-size:11px}}'
    + 'body{padding-top:48px !important}'
  ;
  var style = document.createElement('style');
  style.textContent = css;
  document.head.appendChild(style);

  // Build nav
  var nav = document.createElement('nav');
  nav.id = '__wwnav';

  var brand = document.createElement('a');
  brand.className = '__brand';
  brand.href = 'index.html';
  brand.innerHTML = '<span class="__glyph">◊</span>Wishwood';
  nav.appendChild(brand);

  var primaryWrap = document.createElement('div');
  primaryWrap.className = '__primary';
  PRIMARY.forEach(function (tab, i) {
    var a = document.createElement('a');
    a.href = tab.href;
    a.textContent = tab.label;
    if (tab.match.indexOf(HERE) !== -1) a.className = '__active';
    // First 3 tabs stay visible on mobile
    if (i < 3) a.className = (a.className || '') + ' __mobshow';
    primaryWrap.appendChild(a);
  });
  nav.appendChild(primaryWrap);

  var moreWrap = document.createElement('div');
  moreWrap.className = '__more';
  var moreBtn = document.createElement('button');
  moreBtn.className = '__morebtn';
  moreBtn.innerHTML = 'More ▾';
  moreBtn.setAttribute('aria-expanded', 'false');
  moreWrap.appendChild(moreBtn);
  var moreMenu = document.createElement('div');
  moreMenu.className = '__moremenu';
  MORE.forEach(function (m) {
    var a = document.createElement('a');
    a.href = m.href;
    a.textContent = m.label;
    moreMenu.appendChild(a);
  });
  moreWrap.appendChild(moreMenu);
  moreBtn.addEventListener('click', function (e) {
    e.stopPropagation();
    var open = moreMenu.classList.toggle('__open');
    moreBtn.setAttribute('aria-expanded', open ? 'true' : 'false');
  });
  document.addEventListener('click', function () { moreMenu.classList.remove('__open'); });
  nav.appendChild(moreWrap);

  // Inject
  if (document.body) {
    document.body.insertBefore(nav, document.body.firstChild);
  } else {
    document.addEventListener('DOMContentLoaded', function () {
      document.body.insertBefore(nav, document.body.firstChild);
    });
  }
})();
