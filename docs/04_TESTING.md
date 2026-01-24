# Testing Guide

> Test matrices, manual test scenarios, and validation procedures

---

## Quick Validation

### After Any Code Change

1. **TypeScript**: `npx tsc --noEmit`
2. **ESLint**: `npx eslint .`
3. **Dev Build**: `npx expo start`

### After Firebase Changes

1. Deploy to emulator first
2. Test with local app pointing to emulator
3. Deploy to staging project (if exists)
4. Deploy to production

---

## Test Matrix

### Platform Coverage

| Feature            | iOS | Android | Web |
| ------------------ | :-: | :-----: | :-: |
| Auth (Google)      |  ✓  |    ✓    |  ✓  |
| Auth (Apple)       |  ✓  |    —    |  —  |
| Push Notifications |  ✓  |    ✓    |  —  |
| Photo Capture      |  ✓  |    ✓    | ✓\* |
| Photo Library      |  ✓  |    ✓    |  ✓  |
| Voice Recording    |  ✓  |    ✓    |  ✓  |
| Deep Links         |  ✓  |    ✓    |  ✓  |
| Background Sync    |  ✓  |    ✓    |  —  |

\*Web camera uses `getUserMedia` with MediaCapture API

---

## Chat V2 Test Scenarios

### DM Message Lifecycle

| #   | Scenario       | Steps                      | Expected                  |
| --- | -------------- | -------------------------- | ------------------------- |
| 1   | Send text      | Open DM, type, send        | Appears with checkmark    |
| 2   | Offline send   | Airplane mode, send        | Queued, sends when online |
| 3   | Long text      | Send 5000 chars            | Displays with scroll      |
| 4   | Reply          | Swipe message, reply       | Shows reply context       |
| 5   | Edit           | Long-press own, edit       | Shows "edited" badge      |
| 6   | Delete for me  | Long-press, delete for me  | Disappears, other sees it |
| 7   | Delete for all | Long-press, delete for all | Shows "deleted" for both  |
| 8   | React          | Long-press, add emoji      | Reaction bar appears      |
| 9   | Remove react   | Tap own reaction           | Reaction removed          |

### Group Message Lifecycle

| #   | Scenario            | Steps                    | Expected                |
| --- | ------------------- | ------------------------ | ----------------------- |
| 1   | Send to group       | Open group, send         | All members see message |
| 2   | @mention            | Type @, select user      | User gets notification  |
| 3   | Reply in group      | Swipe, reply             | Thread context shown    |
| 4   | Admin delete        | Admin deletes member msg | Works                   |
| 5   | Member delete other | Try delete others msg    | Not allowed             |

### Attachments

| #   | Scenario        | Steps               | Expected           |
| --- | --------------- | ------------------- | ------------------ |
| 1   | Single image    | Attach photo, send  | Displays thumbnail |
| 2   | Multi image     | Attach 4 photos     | Grid layout        |
| 3   | Image + text    | Attach and type     | Both show          |
| 4   | Video           | Record/attach video | Thumbnail + play   |
| 5   | View fullscreen | Tap attachment      | Gallery opens      |
| 6   | Download        | Long-press, save    | Saves to device    |

### Voice Messages

| #   | Scenario   | Steps           | Expected          |
| --- | ---------- | --------------- | ----------------- |
| 1   | Record     | Hold mic button | Timer shows       |
| 2   | Send voice | Release button  | Message sent      |
| 3   | Cancel     | Slide left      | "Cancelled" toast |
| 4   | Play       | Tap play button | Audio plays       |
| 5   | Seek       | Drag progress   | Jumps to position |

### Read State

| #   | Scenario         | Steps                 | Expected              |
| --- | ---------------- | --------------------- | --------------------- |
| 1   | Unread indicator | Receive message       | Badge shows           |
| 2   | Mark read        | Open conversation     | Badge clears          |
| 3   | Privacy off      | Disable read receipts | Others don't see read |
| 4   | Offline read     | Read while offline    | Syncs when online     |

### Notifications

| #   | Scenario           | Steps                    | Expected                    |
| --- | ------------------ | ------------------------ | --------------------------- |
| 1   | DM notification    | Receive while app closed | Push appears                |
| 2   | Group notification | Receive in group         | Push with group name        |
| 3   | Muted chat         | Send to muted user       | No push                     |
| 4   | Mentioned          | @mention in group        | Push regardless of settings |
| 5   | Tap notification   | Tap push                 | Opens correct chat          |

---

## Auth Test Scenarios

| #   | Scenario           | Steps               | Expected              |
| --- | ------------------ | ------------------- | --------------------- |
| 1   | Fresh Google login | Sign in with Google | Profile created       |
| 2   | Fresh Apple login  | Sign in with Apple  | Profile created (iOS) |
| 3   | Returning user     | Sign in again       | Same profile          |
| 4   | Sign out           | Profile → Sign out  | Returns to login      |
| 5   | Token refresh      | Wait 1hr            | Silent refresh        |
| 6   | Offline login      | Airplane, open app  | Cached data shown     |

---

## Profile Test Scenarios

| #   | Scenario           | Steps                 | Expected          |
| --- | ------------------ | --------------------- | ----------------- |
| 1   | Edit display name  | Profile → Edit → Save | Name updated      |
| 2   | Change avatar      | Photo or customize    | Avatar updated    |
| 3   | View own profile   | Tap profile icon      | Shows stats       |
| 4   | View other profile | Tap user avatar       | Shows their stats |
| 5   | Privacy settings   | Toggle read receipts  | Setting saved     |

---

## Groups Test Scenarios

| #   | Scenario           | Steps                | Expected          |
| --- | ------------------ | -------------------- | ----------------- |
| 1   | Create group       | Messages → New Group | Group created     |
| 2   | Add member         | Group Info → Add     | Member added      |
| 3   | Remove member      | Admin → Kick         | Member removed    |
| 4   | Leave group        | Menu → Leave         | You're removed    |
| 5   | Make admin         | Owner → Make Admin   | Role changed      |
| 6   | Transfer ownership | Owner → Transfer     | Ownership changed |
| 7   | Change name        | Group Info → Edit    | Name updated      |
| 8   | Change photo       | Group Info → Photo   | Photo updated     |

---

## Theme Test Scenarios

| #   | Scenario      | Steps                   | Expected          |
| --- | ------------- | ----------------------- | ----------------- |
| 1   | Toggle theme  | Settings → Theme toggle | Colors swap       |
| 2   | Persist theme | Toggle, restart app     | Theme persisted   |
| 3   | System sync   | Auto, change device     | Theme matches     |
| 4   | All screens   | Navigate everywhere     | Consistent colors |

---

## Cosmetics Test Scenarios

| #   | Scenario           | Steps               | Expected        |
| --- | ------------------ | ------------------- | --------------- |
| 1   | View shop          | Open cosmetics shop | Items displayed |
| 2   | Preview item       | Tap item            | Preview modal   |
| 3   | Purchase           | Tap buy (has coins) | Item unlocked   |
| 4   | Insufficient funds | Tap buy (no coins)  | Error message   |
| 5   | Equip item         | Owned → Equip       | Avatar updated  |

---

## Offline/Sync Test Scenarios

| #   | Scenario        | Steps                   | Expected          |
| --- | --------------- | ----------------------- | ----------------- |
| 1   | View offline    | Airplane mode           | Cached data shows |
| 2   | Queue message   | Offline → Send          | Queued locally    |
| 3   | Reconnect       | Go online               | Messages sync     |
| 4   | Conflict        | Edit same thing offline | Server wins       |
| 5   | Background sync | Switch apps, return     | Data fresh        |

---

## Edge Cases

### Text Input

- Empty message (should be blocked)
- Only whitespace (should be blocked)
- Max length (5000 chars)
- Unicode/emoji only
- RTL languages
- Code blocks / markdown

### Network

- Slow network (3G simulation)
- Intermittent connectivity
- Request timeout
- Server error (500)

### State

- Rapid send (tap-tap-tap)
- Same message twice (idempotency)
- Stale cache
- Race conditions

---

## Device Testing Checklist

### iOS

- [ ] iPhone SE (small screen)
- [ ] iPhone 15 Pro (notch/dynamic island)
- [ ] iPad (if supporting tablets)

### Android

- [ ] Small phone (320dp width)
- [ ] Large phone (411dp width)
- [ ] Android 10+ (API 29+)

### Web

- [ ] Chrome
- [ ] Safari
- [ ] Firefox
- [ ] Mobile Chrome (touch events)

---

## Performance Benchmarks

| Metric             | Target  | Measured |
| ------------------ | ------- | -------- |
| App cold start     | < 3s    | —        |
| Chat list load     | < 500ms | —        |
| Send message       | < 1s    | —        |
| Image upload (1MB) | < 5s    | —        |
| Pull to refresh    | < 1s    | —        |

---

## Debugging Commands

```bash
# TypeScript check
npx tsc --noEmit

# Lint
npx eslint .

# Clear cache
npx expo start --clear

# View logs
npx react-native log-ios
npx react-native log-android

# Firebase logs
firebase functions:log
```

---

## Automated Testing (Future)

### Planned Test Suites

1. **Unit Tests** — Utility functions, parsers, formatters
2. **Integration Tests** — Firebase operations with emulator
3. **E2E Tests** — Detox for critical flows

### Critical Paths for E2E

1. Sign up → Onboard → Send first message
2. Create group → Add members → Send message
3. Profile edit → Avatar change → Verify
4. Receive notification → Tap → Open chat
