# Wishwood · Auth setup (for Simon · one-time)

One master password gates the hub, admin, and all sensitive Worker endpoints. Chrissy chooses it. She shares it with trusted staff (Marius etc.) via Signal / iMessage. If a staff member leaves, Chrissy rotates the password and re-shares — everyone re-logs-in.

**Sensitive endpoints stay protected** — the Worker verifies the session JWT on every request to `/bookings`, `/messages`, `/draft`, `/pricing/*`, `/journey/*`. No password → no data.

---

## 1 · Set the two secrets

Only two secrets are needed to enable login. Run in the wishwood repo root:

```bash
# Chrissy's chosen password (she picks this)
npx wrangler secret put MASTER_PASSWORD --config=wrangler.toml
# → paste her chosen password when prompted (long, memorable, or use a passphrase)

# Random signing secret · you generate this once, never share it
openssl rand -hex 32 | npx wrangler secret put SESSION_SECRET --config=wrangler.toml
# → the openssl output is auto-piped in
```

That's it. No other config changes.

## 2 · Verify

```bash
curl -X POST https://wishwood-engine.workers.dev/auth/login \
  -H 'Content-Type: application/json' \
  -d '{"password":"the-master-password-you-set"}'
```

Should return:
```json
{ "token": "eyJhbGc...", "exp": 1730000000, "sub": "operator" }
```

Wrong password gives `401 { "error": "wrong password" }` after a 400ms delay (basic brute-force slowdown).

## 3 · Chrissy's flow

1. Chrissy opens `https://wishwood.co.uk/hub.html` (or `sjgant80-hub.github.io/wishwood/hub.html`)
2. Auth gate redirects her to `login.html` because she has no session
3. She enters the master password → JWT stored in `localStorage` under key `wishwood.session` (30-day expiry)
4. Redirected back to `hub.html` · everything works
5. Green "WhatsApp" pill + "Log out" pill float top-right on every protected page

## 4 · Sharing with Marius (or other trusted staff)

Chrissy tells Marius the password over Signal / iMessage · Marius opens `/login.html` on his own laptop / phone, enters the same password, gets his own 30-day session on his own device.

Same password across devices is fine · the JWT is per-device.

## 5 · When a staff member leaves

Chrissy rotates the password:

```bash
npx wrangler secret put MASTER_PASSWORD
# enter new password
```

That doesn't invalidate existing JWTs immediately (they last until expiry). To invalidate everyone right now, rotate `SESSION_SECRET` too:

```bash
openssl rand -hex 32 | npx wrangler secret put SESSION_SECRET
```

All existing tokens fail verification within seconds. Chrissy and remaining trusted staff re-log-in with the new password.

## 6 · What's protected

The auth-gate script at the top of `hub.html` and `admin.html` redirects any unauthenticated visitor straight to `login.html` before any protected content renders.

Server-side, `requireOperator()` in `worker.js` now accepts EITHER:

- The legacy `OPERATOR_TOKEN` (kept for API clients, cron, dev)
- **OR** a valid session JWT signed by `SESSION_SECRET` (issued by `/auth/login`)

Both paths hit exactly the same endpoint. No new endpoints exposed.

Protected endpoints (per `worker.js`):
- `GET /bookings`
- `GET /messages`
- `POST /draft`
- `GET /pricing/:cabin/:date`
- `POST /journey/trigger`

Public endpoints (no auth, deliberately):
- `GET /`, `GET /health` · discovery
- `GET /ical/:cabin` · Airbnb / Booking.com need to hit these
- `POST /booking/direct` · guests booking via `book.html`
- `POST /webhook/*` · Meta / Stripe · these use their own signature verification

## 7 · Segregation (later, when Chrissy wants roles)

Right now: one password · all staff see everything · Chrissy trusts her people.

When Chrissy wants staff-level restriction (e.g. staff can see the calendar but not the money):

- Extend the JWT payload with a `role` claim: `{ sub: 'operator', role: 'owner' }` or `{ sub: 'operator', role: 'staff' }`
- Give staff a different password (`STAFF_PASSWORD` secret) that mints a `role: 'staff'` JWT
- Wrap the sensitive endpoints with a `requireOwner()` check

Not built yet — waiting for Chrissy's feedback on which specific actions she wants staff-restricted.

## 8 · Cloudflare Access upgrade path (enterprise-grade later)

If Chrissy ever wants Google / Microsoft SSO instead of a password:

1. Enable Cloudflare Access on the wishwood.co.uk zone
2. Create an Access policy: allow `chrissy@wishwood.co.uk`, `marius@wishwood.co.uk`
3. Attach the policy to `wishwood.co.uk/hub.html` and `/admin.html`
4. Access verifies Google login → sets a JWT cookie → Chrissy hits hub instantly (no password page)

That's a 15-minute upgrade whenever ready. The current password-based flow keeps working alongside — remove `login.html` if you fully migrate.

## 9 · WhatsApp Multi-Device (separate concern)

Nothing to configure server-side · the [`wa.html`](../wa.html) page walks Chrissy through linking her phone + up to 3 more devices. That's a WhatsApp Business app feature, not a Worker one.

`◊·κ=1`
