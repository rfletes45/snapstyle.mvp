# Profile Migration Notes

Last verified: 2026-03-30

## What Changed

Older profile docs described:

- an editable owner profile board
- a separate viewed-profile card stack
- fewer widget types
- no wallet/tasks/theme/chat-layout widgets in the default profile mental model

Current reality:

- both owner and viewed profiles are board-driven
- viewed profiles use the target user’s saved board in read-only mode
- `viewer-actions` is injected synthetically for viewer-specific controls
- the widget inventory now includes tasks, wallet, theme mode, and chat layout widgets

## Ownership Model Migration

Older docs sometimes treated multiple cosmetic ownership fields as peers.

Current truth:

- `Users/{uid}/Entitlements/{cosmeticId}` is the canonical ownership store
- older arrays/subcollections remain only for back-compat

## How To Read Older References

If you find references like these:

- “UserProfileScreen still uses the traditional card layout”
- “Social proof is a standalone section below the profile header”
- “Profile overview cards are fixed in order”
- “The default board ends at achievements”

Translate them to the current system as follows:

- viewed profiles are read-only boards
- social data is expressed through widgets
- widget order is user-controlled
- default layout now continues through tasks and wallet

## Historical Docs

Treat these as historical context rather than current truth:

- older profile audit docs
- early profile overhaul plans
- any doc that predates the current read-only viewer board behavior

## Current Truths To Preserve

1. One board system now powers both owner and viewed profile screens.
2. The viewer surface differs by mode and synthetic widgets, not by a separate persistence model.
3. Entitlements are the canonical cosmetic ownership source.
