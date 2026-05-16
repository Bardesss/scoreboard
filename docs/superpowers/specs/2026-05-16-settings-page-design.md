# Dice Vault — User Settings Page Design
*Date: 2026-05-16*

---

## Overview

`/app/settings` becomes the account-security and preferences hub for end users. Three sections:

1. **Two-factor authentication (TOTP)** — enable, disable, regenerate backup codes
2. **Language preference** — NL / EN toggle (persisted to `User.locale`, propagated to the JWT)
3. **Change password** — current password required

Profile fields (email, username, connections) stay on `/app/profile` — out of scope here.

---

## 1. Two-factor authentication

### State machine

| State | UI |
|---|---|
| `totpEnabled = false` | "Not enabled" badge + **Enable 2FA** button |
| `totpEnabled = false && requiresMfa = true` | Same as above, but with an amber warning: "MFA is required for your account. Set it up to keep signing in." |
| `totpEnabled = true` | "Active" green badge · count of remaining backup codes · **Regenerate backup codes** + **Disable 2FA** buttons |

### Enable flow

1. Click "Enable 2FA" → server action `initTotpSetup()`
   - Generates new secret + provisioning URI via existing `generateTOTPSecret(email)`
   - Stores the **pending** secret in Redis at `totp_setup:<userId>` with 10-minute TTL
   - Returns `{ secret, uri, qrDataUrl }` (QR rendered server-side with `qrcode` dep — already installed)
2. Client shows the QR + the base32 secret (copy button) + an input for the 6-digit code
3. User enters code → server action `confirmTotpSetup(code)`
   - Reads pending secret from Redis; verifies code; on success:
     - Generates 8 backup codes
     - bcrypt-hashes each code (cost 8 — these are high-entropy already, cost 12 is overkill)
     - Persists `totpSecret`, `totpEnabled = true`, `totpBackupCodes = [hashes...]`
     - Deletes Redis pending key
     - Returns plaintext backup codes ONCE for display
   - Client renders backup codes with copy-all + download-as-txt buttons and a "I've saved them" confirmation
4. After confirmation, client calls `useSession().update({ totpEnabled: true })` to refresh the JWT and `router.refresh()`

### Disable flow

1. Click "Disable 2FA" → reveals a confirm input asking for current TOTP code
2. Submit → `disableTotp(code)` verifies via current `totpSecret`, then clears `totpSecret`, `totpEnabled = false`, `totpBackupCodes = []`
3. Client `update({ totpEnabled: false })` + refresh
4. Refuse the disable when `user.requiresMfa = true`: server action returns an error and the UI shows "MFA is required for your account."

### Regenerate backup codes

1. Click "Regenerate" → reveals confirm input for current TOTP code
2. Submit → `regenerateBackupCodes(code)` verifies, generates 8 new codes, replaces hashes, returns plaintext once

---

## 2. Language preference

- Segmented control: 🇬🇧 English / 🇳🇱 Nederlands
- Click → `setLocale('nl' | 'en')`
  - Updates `User.locale`
  - Client calls `update({ locale })` to refresh JWT
  - `router.refresh()` re-renders with new strings
- A subtle saved-checkmark confirms the change

---

## 3. Change password

- Three fields: current password · new password · confirm new password
- Validation: new password min 11 chars (matches register/reset rules), must equal confirm
- `changePassword(formData)`:
  - Verifies current password via bcrypt
  - Hashes new password (cost 12) — matches register flow
  - Updates `User.passwordHash`
  - Optional but skipped for v1: revoke other sessions (would require a session-token table; we use stateless JWTs so we'd just need to bump a `tokenVersion` field — out of scope)

---

## 4. JWT refresh

To make session.update() propagate locale + totpEnabled to the JWT without forcing a re-login, the `jwt` callback in `auth.config.ts` gains a `trigger === 'update'` branch:

```ts
async jwt({ token, user, trigger, session }) {
  if (user) { /* initial sign-in copy */ }
  if (trigger === 'update' && session && typeof session === 'object') {
    if (typeof session.locale === 'string') token.locale = session.locale
    if (typeof session.totpEnabled === 'boolean') token.totpEnabled = session.totpEnabled
  }
  return token
}
```

Client-side `useSession().update({ locale: 'nl' })` then refreshes the token without round-tripping through DB lookup.

---

## 5. Files

- New: `src/app/app/settings/actions.ts` — all six server actions
- New: `src/app/app/settings/SettingsClient.tsx` — section composition + state
- New: `src/app/app/settings/sections/TwoFactorSection.tsx`
- New: `src/app/app/settings/sections/LanguageSection.tsx`
- New: `src/app/app/settings/sections/PasswordSection.tsx`
- Modify: `src/app/app/settings/page.tsx` — server component fetching user state + render client
- Modify: `src/lib/auth.config.ts` — JWT update branch
- Modify: `messages/{en,nl}/app.json` — `app.settings.*` expansion

---

## 6. Out of scope (v1)

- Account deletion
- Active-sessions list / "sign out of all devices"
- Email change (with verification email)
- Username change (collision handling + cascade)
- Notification preferences
- Theme switch (the app is single-themed by design)

These can come later as a "more" submenu once the core is in place.
