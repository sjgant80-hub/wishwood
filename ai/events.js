/* Wishwood · append-only event log.
 * Every agent action is logged, Ed25519-signed, and tail-able from hub.html.
 * Storage: IndexedDB (unbounded) with a mirror ring buffer in localStorage (last 200) for fast read.
 * Signature: Web Crypto Ed25519 · keypair generated + stored on first use.
 */

const DB_NAME = 'wishwood.events';
const STORE = 'events';
const RING_KEY = 'wishwood.events.ring';
const KEY_STORE = 'wishwood.events.keypair';
const RING_MAX = 200;

let _keypair = null;

async function _keys() {
  if (_keypair) return _keypair;
  const stored = localStorage.getItem(KEY_STORE);
  if (stored) {
    const j = JSON.parse(stored);
    const pub = await crypto.subtle.importKey('jwk', j.pub, { name: 'Ed25519' }, true, ['verify']);
    const priv = await crypto.subtle.importKey('jwk', j.priv, { name: 'Ed25519' }, true, ['sign']);
    _keypair = { pub, priv };
    return _keypair;
  }
  const kp = await crypto.subtle.generateKey({ name: 'Ed25519' }, true, ['sign', 'verify']);
  const pubJwk = await crypto.subtle.exportKey('jwk', kp.publicKey);
  const privJwk = await crypto.subtle.exportKey('jwk', kp.privateKey);
  localStorage.setItem(KEY_STORE, JSON.stringify({ pub: pubJwk, priv: privJwk }));
  _keypair = { pub: kp.publicKey, priv: kp.privateKey };
  return _keypair;
}

async function _sign(payload) {
  const { priv } = await _keys();
  const bytes = new TextEncoder().encode(JSON.stringify(payload));
  const sig = await crypto.subtle.sign({ name: 'Ed25519' }, priv, bytes);
  return _hex(new Uint8Array(sig));
}

function _hex(u8) {
  return Array.from(u8).map(b => b.toString(16).padStart(2, '0')).join('');
}

async function _db() {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, 1);
    req.onupgradeneeded = () => {
      req.result.createObjectStore(STORE, { keyPath: 'id', autoIncrement: true });
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

export async function logEvent({ type, payload, actor = 'agent', confidence = null }) {
  const evt = {
    ts: new Date().toISOString(),
    type,
    actor,
    confidence,
    payload
  };
  evt.signature = await _sign(evt);

  // IDB persist
  try {
    const db = await _db();
    const tx = db.transaction(STORE, 'readwrite');
    tx.objectStore(STORE).add(evt);
  } catch (e) { console.warn('[events] IDB persist failed', e); }

  // Ring buffer for fast read
  try {
    const ring = JSON.parse(localStorage.getItem(RING_KEY) || '[]');
    ring.unshift(evt);
    if (ring.length > RING_MAX) ring.length = RING_MAX;
    localStorage.setItem(RING_KEY, JSON.stringify(ring));
  } catch (e) {}

  window.dispatchEvent(new CustomEvent('wishwood:event', { detail: evt }));
  return evt;
}

export function tailRing(n = 50) {
  try {
    const ring = JSON.parse(localStorage.getItem(RING_KEY) || '[]');
    return ring.slice(0, n);
  } catch { return []; }
}

export async function allEvents(limit = 500) {
  try {
    const db = await _db();
    const tx = db.transaction(STORE, 'readonly');
    const store = tx.objectStore(STORE);
    return new Promise((resolve) => {
      const out = [];
      const cur = store.openCursor(null, 'prev');
      cur.onsuccess = (e) => {
        const c = e.target.result;
        if (c && out.length < limit) { out.push(c.value); c.continue(); }
        else resolve(out);
      };
    });
  } catch { return tailRing(limit); }
}

export async function publicKey() {
  const { pub } = await _keys();
  const jwk = await crypto.subtle.exportKey('jwk', pub);
  return jwk;
}
