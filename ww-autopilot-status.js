/* Wishwood · Autopilot status widget · floats on hub.html only.
 * Reads localStorage settings + event ring · renders a compact pill that
 * shows autonomy mode, provider, kernel state, event count. Click → autopilot.html.
 */
(function(){
  if (window.__ww_autopilot_status_loaded) return;
  window.__ww_autopilot_status_loaded = true;

  var HERE = (location.pathname.split('/').pop() || 'index.html').toLowerCase();
  if (HERE !== 'hub.html' && HERE !== '') return;

  function _read(key, fallback) {
    try { return JSON.parse(localStorage.getItem(key) || 'null') || fallback; }
    catch { return fallback; }
  }

  function state() {
    var settings = _read('wishwood.autopilot.settings', {});
    var autonomy = _read('wishwood.autopilot.autonomy', { mode: 'off' });
    var kernel = _read('wishwood.autopilot.kernel', null);
    var ring = _read('wishwood.events.ring', []);
    var last24h = ring.filter(function(e){
      return Date.now() - new Date(e.ts).getTime() < 86400000;
    }).length;
    return {
      mode: autonomy.mode || 'off',
      provider: settings.provider || null,
      kernel_ready: !!kernel,
      events_24h: last24h,
      last_event: ring[0] || null
    };
  }

  var css = ''
    + '#__ww_ap{position:fixed;bottom:18px;right:18px;z-index:9990;'
    +   'background:#1a1922;border:1px solid rgba(235,229,214,0.14);border-radius:12px;'
    +   'padding:10px 14px;color:#ebe5d6;font-family:"Inter",sans-serif;font-size:12.5px;'
    +   'box-shadow:0 6px 20px rgba(0,0,0,0.35);cursor:pointer;transition:transform .15s;'
    +   'max-width:280px;text-decoration:none;display:flex;flex-direction:column;gap:4px}'
    + '#__ww_ap:hover{transform:translateY(-2px);border-color:#c97a3d}'
    + '#__ww_ap .__row{display:flex;align-items:center;gap:8px}'
    + '#__ww_ap .__glyph{font-size:16px}'
    + '#__ww_ap .__label{font-family:"JetBrains Mono",monospace;font-size:10px;'
    +   'letter-spacing:0.14em;text-transform:uppercase;color:#7a7681}'
    + '#__ww_ap .__mode{font-weight:600}'
    + '#__ww_ap .__mode.watch{color:#d4a83d}'
    + '#__ww_ap .__mode.off{color:#7a7681}'
    + '#__ww_ap .__mode.suggest,#__ww_ap .__mode.live,#__ww_ap .__mode.full,'
    +   '#__ww_ap .__mode[class*="auto"]{color:#6b9d6f}'
    + '#__ww_ap .__meta{color:#7a7681;font-size:11px;letter-spacing:0.02em}'
    + '#__ww_ap .__pulse{width:8px;height:8px;border-radius:50%;background:#6b9d6f;'
    +   'animation:__ww_pulse 2s ease-in-out infinite}'
    + '#__ww_ap .__pulse.off{background:#7a7681;animation:none}'
    + '#__ww_ap .__pulse.watch{background:#d4a83d}'
    + '@keyframes __ww_pulse{0%,100%{opacity:1;transform:scale(1)}50%{opacity:0.55;transform:scale(1.35)}}'
    + '@media(max-width:600px){#__ww_ap{bottom:12px;right:12px;max-width:calc(100vw - 24px)}}';

  var style = document.createElement('style');
  style.textContent = css;
  document.head.appendChild(style);

  var el = document.createElement('a');
  el.id = '__ww_ap';
  el.href = 'autopilot.html';

  function render() {
    var s = state();
    var modeCls = s.mode.replace(/[^a-z-]/g, '-');
    el.innerHTML = ''
      + '<div class="__row">'
      +   '<span class="__pulse ' + modeCls + '"></span>'
      +   '<span class="__glyph">⚡</span>'
      +   '<span class="__label">Autopilot</span>'
      +   '<span class="__mode ' + modeCls + '">' + s.mode + '</span>'
      + '</div>'
      + '<div class="__meta">'
      +   (s.provider ? s.provider : 'no key') + ' · '
      +   (s.kernel_ready ? 'kernel ✓' : 'no kernel') + ' · '
      +   s.events_24h + ' evt/24h'
      + '</div>';
  }

  function inject() {
    document.body.appendChild(el);
    render();
  }
  if (document.body) inject();
  else document.addEventListener('DOMContentLoaded', inject);

  window.addEventListener('wishwood:event', render);
  window.addEventListener('storage', function(e){
    if (e.key && e.key.indexOf('wishwood.') === 0) render();
  });
  setInterval(render, 15000);
})();
