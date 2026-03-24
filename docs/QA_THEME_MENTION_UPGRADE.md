# QA Checklist: Theme, Mention & Notification Upgrade

> Generated after the comprehensive keyboard/theme/mention/notification production upgrade.

---

## 1. Files Modified

| File                                                  | Change Summary                                                                                                                                                  |
| ----------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `constants/theme.ts`                                  | Added 14 optional semantic tokens to `ThemeColors`; created `resolveSemanticTokens()` that auto-derives from core tokens; modified `getThemeById()`             |
| `src/components/ui/ThemedTextInput.tsx`               | **NEW** — Centralized themed TextInput wrapper with `keyboardAppearance`, theme text/placeholder colors, `selectionColor`                                       |
| `src/components/ui/index.ts`                          | Added `ThemedTextInput` + type export to barrel                                                                                                                 |
| `src/components/chat/ChatComposer.tsx`                | Replaced 5 hard-coded colors (`#f0f0f0`, `#e0e0e0`, `#999`, `#000`, `#fff`) with semantic tokens; added `keyboardAppearance` + `selectionColor`                 |
| `src/components/chat/MentionAutocomplete.tsx`         | **FULL REWRITE** — uses `useAppTheme()`, semantic tokens, Pressable with pressed state, avatar support, polished UI (16px radius, hairline dividers, 56px rows) |
| `src/screens/chat/ThreadScreen.tsx`                   | Replaced 4 hard-coded colors (`#F0F0F0`, `#FFFFFF`×2) with theme tokens; added `keyboardAppearance` + `selectionColor`                                          |
| `src/components/ScheduleMessageModal.tsx`             | Fixed `textColor="#000"` → `theme.colors.onPrimary` on Schedule button                                                                                          |
| `src/components/BlockUserModal.tsx`                   | Fixed `backgroundColor: "#fff"` → `"transparent"` on reason input                                                                                               |
| `src/screens/auth/SignupScreen.tsx`                   | Fixed `backgroundColor: "#E0E0E0"` → `theme.colors.outlineVariant` on strength bar                                                                              |
| `src/services/mentionParser.ts`                       | `extractMentionsExact` now includes `displayName`/`username` in spans + overlap detection; `segmentTextWithMentions` bounds-checking; `TextSegment` extended    |
| `src/types/messaging.ts`                              | `MentionSpan` extended with optional `displayName?` + `username?`                                                                                               |
| `src/services/notifications/normalizeNotification.ts` | `group_message` handler extracts `mentioned` flag + `messageId`, passes `highlightMessageId` in route params                                                    |
| `App.tsx`                                             | Added `expo-system-ui` `useEffect` to sync Android NavigationBar color with theme                                                                               |
| `__tests__/services/mentionParser.test.ts`            | **NEW** — 38 tests covering trigger detection, filtering, insertion, extraction, segmentation, edge cases                                                       |
| `__tests__/services/normalizeNotification.test.ts`    | Added 2 tests for mention notification routing (highlightMessageId present/absent)                                                                              |

---

## 2. QA Test Scenarios

### Theme & Keyboard

- [ ] **All 30 themes**: Switch through themes → verify no white/black flash on ChatComposer, ThreadScreen
- [ ] **Dark theme keyboard**: iOS shows dark keyboard in ChatComposer, ThreadScreen
- [ ] **Light theme keyboard**: iOS shows light keyboard in ChatComposer, ThreadScreen
- [ ] **Android nav bar**: Switch theme → Android navigation bar matches `colors.background`
- [ ] **Input backgrounds**: ChatComposer input uses `inputBackground` token (not hard-coded gray)
- [ ] **Selection color**: Tap-and-hold text in composer → selection handles use `colors.primary`
- [ ] **Placeholder text**: Composer placeholder matches `inputPlaceholder` token
- [ ] **Thread replies**: Thread reply bubbles use `surfaceVariant` (no `#F0F0F0` flash)
- [ ] **Thread send icon**: Send button icon uses `onPrimary` (no hard-coded white)
- [ ] **Schedule modal button**: "Schedule" button text uses `onPrimary`
- [ ] **Block modal input**: Reason TextInput has transparent background (inherits dialog surface)
- [ ] **Signup strength bar**: Progress bar background uses theme outline variant (no `#E0E0E0`)

### Mention System

- [ ] **Trigger detection**: Type `@` in group chat → suggestion panel appears
- [ ] **Query filtering**: Type `@ali` → filters to matching members
- [ ] **Case-insensitive**: `@BOB` matches "Bob Smith"
- [ ] **Selection**: Tap member → inserts `@DisplayName ` with trailing space
- [ ] **Multiple mentions**: Insert 5 mentions → 6th is blocked
- [ ] **Overlapping names**: Members "Alice" and "Alice B" → "@Alice B" matches the longer name
- [ ] **Avatar images**: Suggestion rows show avatar images when `avatarUrls` provided
- [ ] **Panel polish**: 16px border-radius, hairline dividers, "Done" cancel text
- [ ] **Panel animation**: Appears/disappears with 180ms fade animation
- [ ] **Read-time rendering**: Received message with mentions → `@Name` highlighted with `mentionHighlight` token
- [ ] **Bounds safety**: Old messages with stale mention spans → no crash (skips invalid spans)
- [ ] **Empty state**: Type `@zzz` (no match) → panel shows, no results, can cancel

### Notifications

- [ ] **Mention notification**: Receive mention in group → push notification arrives
- [ ] **Mention deep nav**: Tap mention notification → navigates to GroupChat with `highlightMessageId`
- [ ] **Non-mention group msg**: Normal group message notification → no `highlightMessageId` in params
- [ ] **Backend verified**: No backend changes needed — `legacy.ts` already sends `mentioned: isMentioned` + `messageId`

---

## 3. Assumptions & Decisions

1. **Auto-derived tokens**: The 14 new semantic tokens are _optional_ on `ThemeColors`. `resolveSemanticTokens()` derives them at runtime from core tokens. Zero manual edits to the 30 theme definitions.
2. **Backward-compatible MentionSpan**: Added `displayName?` and `username?` as optional fields. Existing Firestore documents with old spans still render correctly.
3. **Password strength colors kept**: The red/yellow/green strength indicator colors in SignupScreen are semantic (not theme colors) and intentionally left as fixed values.
4. **Error text colors kept**: `#ff4444` in ScheduleMessageModal and `#d32f2f` in BlockUserModal are destructive-action colors, left as-is.
5. **Paper TextInputs**: Components using `react-native-paper` `TextInput` (ScheduleMessageModal, SignupScreen) inherit keyboard appearance from the Paper theme provider. The `ThemedTextInput` wrapper is for raw RN TextInputs.
6. **No backend changes**: The notification backend (`legacy.ts`, `messaging.ts`, `notificationCenter.ts`) was verified to already handle mentions correctly — no modifications needed.

---

## 4. Legacy Removed / Replaced

| What                                                                         | Status                                         |
| ---------------------------------------------------------------------------- | ---------------------------------------------- |
| Hard-coded `#f0f0f0` / `#e0e0e0` / `#999` / `#000` in ChatComposer           | ✅ Replaced with semantic tokens               |
| Hard-coded `#F0F0F0` / `#FFFFFF` in ThreadScreen                             | ✅ Replaced with theme tokens                  |
| Hard-coded `#fff` icon color in ChatComposer                                 | ✅ Replaced with `colors.onPrimary`            |
| Hard-coded `#000` text color in ScheduleMessageModal                         | ✅ Replaced with `theme.colors.onPrimary`      |
| Hard-coded `#fff` background in BlockUserModal                               | ✅ Replaced with transparent                   |
| Hard-coded `#E0E0E0` in SignupScreen                                         | ✅ Replaced with `theme.colors.outlineVariant` |
| Old MentionAutocomplete (TouchableOpacity, Paper useTheme, inline constants) | ✅ Fully rewritten                             |
| MentionSpan without names                                                    | ✅ Extended with displayName/username          |
| Notification normalizer without mention routing                              | ✅ Enhanced with highlightMessageId            |

---

## 5. Test Results

```
mentionParser.test.ts        — 38 passed ✅
normalizeNotification.test.ts — 10 passed ✅ (including 2 new mention tests)
TypeScript check              — 0 errors across all modified files ✅
```
