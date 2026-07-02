/* Wishwood mesh sync · Yjs CRDT · trystero WebRTC · IndexedDB persistence
 * ─────────────────────────────────────────────────────────────────────
 * Multi-device, multi-peer, offline-first shared state for the operator hub.
 * Chrissy + Marius + up to N devices see the same bookings, messages, notes,
 * settings — updated in real time via WebRTC data channels between browsers.
 *
 * Signaling: BitTorrent trackers via trystero/torrent · no server needed.
 * CRDT: Yjs · handles concurrent edits, merges cleanly, offline-capable.
 * Persistence: y-indexeddb · state survives browser reload.
 *
 * How to enable: visit /sync-setup.html · generate or paste a room key.
 * Once a room key is stored in localStorage under 'wishwood.mesh.room',
 * loading this module wires everything up.
 *
 * Exposes: window.WW_SYNC = {
 *   ready         Promise · resolves when Y.Doc + IDB + WebRTC connected
 *   doc           Y.Doc      · the shared document
 *   bookings      Y.Array    · shared bookings
 *   messages      Y.Array    · shared inbox
 *   notes         Y.Array    · shared operator notes
 *   settings      Y.Map      · shared config (prices, unit info)
 *   peers         () => Set  · connected peer ids right now
 *   onPeersChange (fn)       · subscribe to peer count changes
 *   room          string     · current room key (or null if not enabled)
 *   disable       ()         · leave the mesh, clear local room key
 * }
 * ─────────────────────────────────────────────────────────────────────
 */
(function(){
  const ROOM_KEY_STORAGE = 'wishwood.mesh.room';
  const APP_ID           = 'wishwood-mesh-v1';

  // Peer count subscribers
  const peerListeners = new Set();
  let peerSet = new Set();

  function fireChange(){
    peerListeners.forEach(fn => { try { fn(peerSet.size); } catch(e){} });
  }

  async function boot() {
    const room = localStorage.getItem(ROOM_KEY_STORAGE);
    if (!room) {
      // Mesh sync not configured · expose stub so callers can safely await ready
      window.WW_SYNC = {
        ready: Promise.resolve({ enabled: false }),
        room: null,
        peers: () => new Set(),
        onPeersChange: (fn) => { peerListeners.add(fn); return () => peerListeners.delete(fn); },
        disable: () => {},
      };
      return;
    }

    let Y, IndexeddbPersistence, joinRoom;
    try {
      Y = await import('https://esm.run/yjs@13.6.20');
      const idb = await import('https://esm.run/y-indexeddb@9.0.12');
      IndexeddbPersistence = idb.IndexeddbPersistence;
      const tr = await import('https://esm.run/trystero@0.20.0/torrent');
      joinRoom = tr.joinRoom;
    } catch (e) {
      console.error('[ww-sync] module load failed', e);
      window.WW_SYNC = { ready: Promise.reject(e), room, peers: () => new Set(), onPeersChange: () => () => {}, disable };
      return;
    }

    // The shared document
    const doc = new Y.Doc();

    // Shared collections
    const bookings = doc.getArray('bookings');
    const messages = doc.getArray('messages');
    const notes    = doc.getArray('notes');
    const settings = doc.getMap('settings');

    // Local persistence · state survives reload even offline
    const persistence = new IndexeddbPersistence('wishwood-mesh-' + room.slice(0,12), doc);
    await new Promise(res => persistence.once('synced', res));

    // Join the peer mesh
    const trysteroRoom = joinRoom({ appId: APP_ID }, room);
    const [sendUpdate, getUpdate] = trysteroRoom.makeAction('yjs-update');
    const [sendSnapshot, getSnapshot] = trysteroRoom.makeAction('yjs-snap');

    // Broadcast local doc updates to all peers
    doc.on('update', (update, origin) => {
      if (origin === 'remote') return;
      sendUpdate(update);
    });

    // Apply remote updates
    getUpdate((update, peerId) => {
      try { Y.applyUpdate(doc, update, 'remote'); } catch(e){ console.warn('[ww-sync] apply', e); }
    });

    // On new peer: send a full state snapshot so they catch up quickly
    trysteroRoom.onPeerJoin(peerId => {
      peerSet.add(peerId); fireChange();
      try { sendSnapshot(Y.encodeStateAsUpdate(doc), peerId); } catch(e){}
    });
    trysteroRoom.onPeerLeave(peerId => {
      peerSet.delete(peerId); fireChange();
    });
    getSnapshot((snapshot) => {
      try { Y.applyUpdate(doc, snapshot, 'remote'); } catch(e){ console.warn('[ww-sync] snap', e); }
    });

    // Expose API
    window.WW_SYNC = {
      ready: Promise.resolve({ enabled: true, room }),
      doc, bookings, messages, notes, settings,
      room,
      peers: () => new Set(peerSet),
      onPeersChange: (fn) => {
        peerListeners.add(fn);
        try { fn(peerSet.size); } catch(e){}
        return () => peerListeners.delete(fn);
      },
      disable: () => {
        try { trysteroRoom.leave(); } catch(e){}
        try { persistence.destroy(); } catch(e){}
        localStorage.removeItem(ROOM_KEY_STORAGE);
        location.reload();
      },
    };

    console.log('[ww-sync] mesh joined · room=' + room.slice(0,8) + '… · appId=' + APP_ID);
  }

  function disable() {
    localStorage.removeItem(ROOM_KEY_STORAGE);
    location.reload();
  }

  boot();
})();
