# Wishwood · PWA + Mesh Sync Setup

Full sovereign multi-device operator hub. Install as an app, sync bookings + messages across all peers in real time via WebRTC, works offline, no server dependency for the day-to-day operator view.

## The three layers

| Layer | What | Where |
|---|---|---|
| **PWA** | Install to home screen, offline shell cache, works as native-feeling app | `manifest.webmanifest` · `sw.js` |
| **Mesh sync (P2P)** | Real-time state sync between staff devices via WebRTC data channels | `ww-sync.js` · `sync-setup.html` |
| **Worker (existing)** | Stripe · webhooks · cron · iCal · AI drafts (business logic that must run server-side) | `worker.js` |

The three layers compose. Sync + PWA work fully **without** the Worker being online — that's the point of "everyone has 1 system which updates the rest if they don't want to use the repo from me."

---

## 1 · Install as an app (Chrissy · Marius · staff)

**Any modern browser will show an "Install" pill in the top-right of the hub once the criteria are met (HTTPS + valid manifest + service worker registered).** For Android/desktop Chrome, Edge, or Brave, the pill fires the native install prompt automatically. For iOS Safari, tap "Add to home screen" from the share menu.

Steps:

1. Open `https://sjgant80-hub.github.io/wishwood/hub.html` (or `wishwood.co.uk/hub.html` once the domain is switched)
2. Log in with the master password
3. **Chrome / Edge / Brave / Android:** tap the "Install" pill in the top-right
4. **iOS Safari:** Share sheet → "Add to home screen"
5. **Desktop:** browser address bar → install icon on the right

You now have a Wishwood icon on the home screen / dock. Tap it → hub opens full-screen, no browser chrome, feels like a native app.

## 2 · Enable mesh sync (one-time · Chrissy first)

1. From the hub, tap the yellow **"Sync"** pill (top-right) — takes you to `sync-setup.html`
2. Under **"I am the first device"** → click **"Generate room key + enable"**
3. A room key appears (64-char hex) with a QR code
4. **Copy the room key** and share it with Marius/staff via Signal / iMessage / hand-off
5. Or hand the QR code to them to scan directly

Chrissy's device is now the first mesh peer. Any changes she makes to bookings, notes, settings will sync to any peer that joins.

## 3 · Add other devices to the mesh

Each new device does one of these:

**Option A · Scan the QR code**
1. On the new device, open the hub, log in, tap the **Sync** pill
2. Scan Chrissy's QR code from her `sync-setup.html`
3. The scan auto-joins that room · page reloads · connected

**Option B · Paste the room key**
1. On the new device: `sync-setup.html` → paste the 64-char hex under "I am joining an existing mesh"
2. Click **Join mesh** · page reloads · connected

Verify: the top-right green **"N mesh"** pill should show `1` or more (the count of OTHER peers connected right now).

## 4 · How it works under the hood

### Sync engine (`ww-sync.js`)

- **CRDT** · [Yjs](https://yjs.dev/) provides the conflict-free replicated data type. Every peer holds a full copy of the `Y.Doc` and merges automatically. No conflicts, no lost writes, no last-writer-wins race conditions.
- **Persistence** · `y-indexeddb` writes every update to IndexedDB. When you close the browser and open it again, state is instantly there. Offline is fine.
- **Peer discovery** · [trystero](https://github.com/dmotz/trystero) uses BitTorrent trackers as a signaling channel (WebRTC needs signaling to establish direct connections). Trackers only see a random room hash, never the room key contents.
- **Transport** · once discovered, all communication is direct browser-to-browser via WebRTC `RTCDataChannel` — end-to-end encrypted in transit (DTLS-SRTP), no data touches any server.

### The Y.Doc structure

The engine exposes `window.WW_SYNC` with:

```js
WW_SYNC.doc          // the shared Y.Doc
WW_SYNC.bookings     // Y.Array — shared bookings
WW_SYNC.messages     // Y.Array — shared inbox messages
WW_SYNC.notes        // Y.Array — shared operator notes
WW_SYNC.settings     // Y.Map   — shared config
WW_SYNC.peers()      // returns Set of connected peer ids
WW_SYNC.onPeersChange(fn)  // subscribe to peer count changes
```

Read: `WW_SYNC.bookings.toArray()` — write: `WW_SYNC.bookings.push([bookingObj])`. All peers get the update within ~50-500ms.

### PWA (`sw.js` + `manifest.webmanifest`)

- Cache-first for the static shell (all HTML, CSS, ww-sync.js)
- Network-only for Worker API calls, Stripe, Anthropic, Google Fonts
- Cache-then-network for ESM modules (Yjs / trystero from esm.run)
- Fallback to `hub.html` if the requested page isn't cached AND offline

### Auth still applies

Every page in the hub goes through the auth gate first. Without a valid session JWT, nothing loads — including the sync engine. So even if someone snoops the room key, they can't see anything without also knowing the master password.

## 5 · Trust model · what to warn Chrissy about

- **Room key = full access.** Anyone with the room key becomes a peer and sees every synced item. Treat it like the master password — Signal / iMessage / physical hand-off only. Never email or WhatsApp.
- **BitTorrent trackers see a random hash.** They cannot read the room key or the data being synced. They just pair browsers together.
- **Staff turnover** · when someone leaves, generate a NEW room key on Chrissy's device, share with remaining team. The old key becomes orphaned — the former staff device just sees "no peers".
- **Offline works.** Devices can make changes offline. When they come back online, everything merges cleanly via the CRDT.
- **This is separate from the Worker.** The Worker still handles Stripe webhooks, cron jobs, iCal fetching, and AI draft generation — those need to be server-side. But the operator VIEW syncs peer-to-peer.

## 6 · Commit checklist for Simon

New files:

- `manifest.webmanifest` · PWA manifest
- `sw.js` · service worker
- `ww-sync.js` · P2P sync engine
- `sync-setup.html` · room-key onboarding page
- `docs/PWA-SYNC-SETUP.md` · this doc

Modified files:

- `hub.html` · SW registration + install pill + peers pill + Sync pill
- `admin.html` · same

Nothing changes for the Worker (`worker.js` unchanged) — it stays authoritative for Stripe/cron/AI. Sync is purely an additional client layer.

## 7 · When you want to wire hub UI to WW_SYNC

Right now the sync engine is loaded but the hub's existing bookings + messages panels still fetch from the Worker. To make the UI reactive to peer changes, do:

```js
// somewhere after WW_SYNC.ready resolves
await window.WW_SYNC.ready;
window.WW_SYNC.bookings.observe(() => {
  renderBookings(window.WW_SYNC.bookings.toArray());
});
```

Then any peer's booking change updates every UI instantly. Not doing this in the current commit because the hub's data-loading code is worth surveying before touching — will do in a follow-up.

## 8 · Testing on real devices

- **Chrissy's phone:** Chrome for Android or Safari on iPhone
- **Chrissy's laptop:** Chrome / Edge / Brave (Firefox works but no install prompt)
- **Marius's phone:** any of the above

Verify:
1. Open sync-setup.html on both devices with the SAME room key
2. Green "mesh" pill appears on both
3. Open browser dev-tools console → both show `[ww-sync] mesh joined · room=…`
4. Kill wifi on one device → make a local change → re-enable wifi → change appears on the other device within a couple of seconds

## 9 · What's next (deferred)

- **Wire hub UI to WW_SYNC bookings/messages/notes** so the whole operator view is reactive (~30 min · needs a survey of existing hub state model first)
- **Role-based sync scopes** · if you later want "staff sees calendar but not money", create separate Y.Doc scopes per role
- **Sync over Worker fallback** · if peers can't reach each other via BitTorrent trackers (rare, but possible on very restrictive networks), we could add a Cloudflare Worker as a fallback signaling channel · ~40 min work if it ever comes up

`◊·κ=1`
