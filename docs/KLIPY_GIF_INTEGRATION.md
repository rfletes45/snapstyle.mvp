# KLIPY GIF Integration

> Powered by [KLIPY](https://klipy.com) — a Tenor v2 drop-in replacement.

## Overview

The GIF feature adds a full-featured GIF picker to the chat composer toolbar, letting users search and send animated GIFs in both DM and group chat flows.

### Architecture

```
┌───────────────────────────────────────────────────────────┐
│                   UI Layer                                │
│  GifButton → GifPicker (DraggableBottomSheet)             │
│    ↕ onGifSelected                                        │
│  ChatComposer (toolbar case "gif")                        │
│    ↕ onGifSelected                                        │
│  ChatScreen / GroupChatScreen (handleGifSelected)          │
│    → sendMediaAttachmentMessage() + registerGifShare()    │
├───────────────────────────────────────────────────────────┤
│                Service Layer                              │
│  gifService.ts  — facade with caching                     │
│    ↕                                                      │
│  klipyProvider.ts  — KLIPY adapter (GifProvider interface)│
│    ↕                                                      │
│  https://api.klipy.com  (Tenor v2 compatible)             │
└───────────────────────────────────────────────────────────┘
```

### Key Files

| File                                                             | Purpose                                                  |
| ---------------------------------------------------------------- | -------------------------------------------------------- |
| `src/services/gif/types.ts`                                      | Provider-agnostic types (`GifItem`, `GifProvider`, etc.) |
| `src/services/gif/klipyProvider.ts`                              | KLIPY API adapter                                        |
| `src/services/gif/gifService.ts`                                 | Service facade with 5-min cache                          |
| `src/components/chat/GifPicker.tsx`                              | Full GIF picker UI in DraggableBottomSheet               |
| `src/components/chat/GifButton.tsx`                              | Toolbar button (40×40 target)                            |
| `src/components/chat/ChatComposer.tsx`                           | Added `gif` case to `renderToolbarItem`                  |
| `src/screens/chat/ChatScreen.tsx`                                | DM flow handler                                          |
| `src/screens/groups/GroupChatScreen.tsx`                         | Group flow handler                                       |
| `constants/featureFlags.ts`                                      | `GIF_PICKER_ENABLED` flag                                |
| `src/components/chat/ComposerToolbar/ComposerToolbarRegistry.ts` | GIF item `available: true`                               |

## Feature Flag

```ts
// constants/featureFlags.ts
export const GIF_PICKER_ENABLED = true;
```

Set to `false` to hide the GIF button without removing any code. When disabled, `onGifSelected` is passed as `undefined` and the toolbar `gif` case renders `null`.

## KLIPY API

### Endpoints Used

| Endpoint                 | Method | Purpose                       |
| ------------------------ | ------ | ----------------------------- |
| `/v2/featured`           | GET    | Trending GIFs (shown on open) |
| `/v2/search`             | GET    | Search GIFs by query          |
| `/v2/search_suggestions` | GET    | Related terms for a query     |
| `/v2/autocomplete`       | GET    | Autocomplete while typing     |
| `/v2/categories`         | GET    | Browsable categories          |
| `/v2/registershare`      | POST   | Track share events            |

### Authentication

API key is passed as a `key` query parameter. Currently hardcoded as a test key in `klipyProvider.ts`.

**Production TODO:** Proxy API calls through a Firebase Cloud Function so the key is never shipped in the client bundle.

### Rate Limits

- **Testing:** 100 requests/minute
- **Production:** Unlimited after Partner Panel approval

### Attribution Requirements

| Requirement                                   | Status | Implementation              |
| --------------------------------------------- | ------ | --------------------------- |
| "Search KLIPY" placeholder (REQUIRED)         | ✅     | Search bar placeholder text |
| "Powered by KLIPY" footer (OPTIONAL)          | ✅     | Attribution bar in picker   |
| KLIPY watermark on message card (RECOMMENDED) | ❌     | Not yet implemented         |

## Provider Pattern

The system uses a provider/adapter pattern for easy swapping:

```ts
// To swap providers, implement GifProvider and change gifService.ts:
import { createMyNewProvider } from "./myNewProvider";
// in getProvider(): return createMyNewProvider();
```

The UI layer only depends on `GifItem` and friends from `types.ts` — never on raw API shapes.

## Caching

- First page of trending GIFs: cached 5 minutes
- Categories: cached 5 minutes
- Search results: not cached (always fresh)
- Call `clearGifCache()` on account switch

## Message Flow

1. User taps GIF button in composer toolbar
2. `GifPicker` opens in `DraggableBottomSheet`
3. Trending GIFs load automatically
4. User searches or browses, taps a GIF
5. `onGifSelected(gif)` fires up through `GifButton` → `ChatComposer` → `ChatScreen`
6. `handleGifSelected` calls `sendMediaAttachmentMessage()` with the GIF's `fullUrl`
7. `registerGifShare(gif.id)` fires in the background (fire-and-forget)

## Known Limitations

1. **API key in client** — Test key only. Must proxy through backend for production.
2. **No MP4 playback** — The picker uses static GIF previews (`Image`). For better performance, consider `expo-video` for MP4 variants.
3. **No KLIPY watermark on sent messages** — The "strongly recommended" watermark on the message bubble is not yet implemented.
4. **No content filtering config** — Content filtering is configured via the KLIPY Partner Dashboard, not in-app.
5. **Masonry layout uses FlatList wrapper** — A dedicated masonry library (e.g. `@shopify/flash-list` with masonry) could improve scroll performance for very long lists.
