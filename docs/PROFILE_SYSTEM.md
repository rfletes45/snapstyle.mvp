# Profile System - Cosmetics, Ownership, and Equip Flows

Last verified: 2026-03-30

## Scope

This document covers the cosmetic and ownership layer of the profile system:

- cosmetic ownership and entitlements
- equip flows
- profile/chat appearance writes
- rendering contracts that depend on equipped profile or chat cosmetics

It does not try to be the board-layout source of truth. For board mechanics and widget behavior, start at [docs/profile/PROFILE_SYSTEM_OVERVIEW.md](profile/PROFILE_SYSTEM_OVERVIEW.md).

## Current Status

- canonical ownership model: implemented
- customization/equip flow: implemented
- shop and purchase integrations: implemented
- legacy ownership shims: still present for back-compat

## Main Files

Client:

- [CustomizationHubScreen.tsx](/c:/Users/rflet/OneDrive/Desktop/snapstyle-mvp/src/screens/customization/CustomizationHubScreen.tsx)
- [entitlements.ts](/c:/Users/rflet/OneDrive/Desktop/snapstyle-mvp/src/services/entitlements.ts)
- [profileService.ts](/c:/Users/rflet/OneDrive/Desktop/snapstyle-mvp/src/services/profileService.ts)
- `src/cosmetics/catalog.ts`
- `src/cosmetics/chatCatalog.ts`
- `src/cosmetics/themeRegistry.ts`
- `src/cosmetics/assetRegistry.ts`

Backend:

- `firebase-backend/functions/src/cosmeticEntitlements.ts`
- `firebase-backend/functions/src/shop.ts`
- `firebase-backend/functions/src/messaging.ts`

## Canonical Ownership Model

Canonical entitlement path:

- `Users/{uid}/Entitlements/{cosmeticId}`

Canonical entitlement fields:

- `cosmeticId`
- `type`
- `grantedAt`
- `source`

The entitlements subcollection is the source of truth for whether a user owns a cosmetic item.

## Current Back-Compat State

The repo still writes or reads some older ownership fields and compatibility paths:

- `Users/{uid}.ownedDecorations`
- `Users/{uid}.ownedThemes`
- legacy owned subcollections
- older inventory-style documents in some flows

These exist to keep older reads or migration-era paths working. They should not be re-documented as the canonical ownership model.

## Equip Surfaces

Customization is currently equip-only.

Current behavior in `CustomizationHubScreen`:

- profile/chat section toggle
- owned-only browsing
- search/filter over owned cosmetics
- live profile preview or chat preview
- direct equip actions

Current chat appearance categories include:

- bubble colors
- fonts
- font colors
- animal themes

Current profile appearance categories include:

- decorations
- backgrounds
- badges
- themes

## Profile Fields Touched By Equip Flows

Common equipped fields on `Users/{uid}` include:

- `avatarDecoration`
- `equippedBackgroundId`
- `theme`
- `featuredBadges`
- `chatAppearance`

These profile fields drive both owner and viewer rendering because:

- own profile uses them in board widget data
- viewed profiles use the same underlying user data in read-only board widgets
- outgoing chat messages stamp the relevant chat appearance fields into sender style

## Rendering Contracts

### Profile rendering

Profile visuals depend on:

- avatar/picture data
- equipped decoration
- equipped background
- theme metadata

The widget board and profile adapters consume these fields, but the board docs own layout behavior.

### Chat rendering

Outgoing chat rendering resolves:

- bubble color
- font
- font color
- animal theme

Messaging then stamps the sender style so recipients can render the sender’s chosen chat appearance without performing profile lookups for every message.

## Purchase and Grant Flows

Current write model:

- purchases and most grants should go through Functions
- the client service can still grant free/starter items as a convenience path
- the client entitlement service is read-heavy; it is not the money-like authority

## Relationship To Profile Board Docs

Important current-state truth:

- owner profile and viewed profile are both board-driven now
- this document does not describe those screens as fixed card stacks

Use these docs for the board system:

- [PROFILE_SYSTEM_OVERVIEW.md](profile/PROFILE_SYSTEM_OVERVIEW.md)
- [WIDGET_BOARD_ARCHITECTURE.md](profile/WIDGET_BOARD_ARCHITECTURE.md)
- [PROFILE_WIDGETS_REFERENCE.md](profile/PROFILE_WIDGETS_REFERENCE.md)

## Known Rough Edges

- legacy ownership shims still exist and can mislead code readers into thinking multiple ownership stores are equally canonical
- some older docs and comments still talk about profile/header cards rather than board widgets

## Recommended Validation

```bash
npm run type-check
npm run lint
npm run test
npm --prefix firebase-backend/functions run build
```
