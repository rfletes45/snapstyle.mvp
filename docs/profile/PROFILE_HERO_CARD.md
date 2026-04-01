# Profile Header Widget

Last verified: 2026-04-01

## Identity

The “hero card” is the `profile-header` widget in the current board system.

Current registry metadata:

- widget type: `profile-header`
- default size: `hero`
- supported sizes: `wide`, `large`, `hero`, `mega`
- removable: no
- resizable: yes

## Role In The Board

This widget is:

- the primary identity surface on both owner and viewed profiles
- present in the default layout
- repaired by validation if a saved layout somehow loses it

## Content Responsibilities

The widget is responsible for the main identity and progression summary:

- display name
- username
- avatar / profile picture
- decoration/background-aware visuals
- status/bio presentation
- level/progression summary

Owner-only actions are also surfaced through this widget where the current screen context allows them, such as settings/customization/shop/profile editing entry points.

## Owner vs Viewer Behavior

### Owner

On the owner’s profile, the widget is interactive and feeds into the broader customization/profile settings flow.

### Viewer

On viewed profiles, the same widget type renders the target user’s identity data in read-only form. Relationship actions are not embedded into the header widget itself; they live in the synthetic `viewer-actions` widget.

This is another place older docs drifted by describing the viewed profile as if it still had a separate standalone header architecture.

## Size Behavior

Current supported sizes:

- `wide` (4x1, 88px) — compact bar with PFP (56px), name, level
- `large` (4x2, 184px) — medium card with PFP (76px), name (21px), username, status, level bar
- `hero` (4x4, 376px) — full rich header with PFP (96px), name (26px), username, status, bio (2 lines), actions, level bar (flex child, not absolute)
- `mega` (4x6, 568px) — expanded hero with PFP (128px), name (30px), username (18px), status, bio (5 lines), actions, rich level bar

The exact visual density changes by size, but the verified truth to preserve is:

- bigger sizes expose richer identity/progression content
- the widget remains the same widget type across sizes
- the board engine, not navigation, decides the active size

## Data Dependencies

The widget currently depends on:

- profile document data from `Users/{uid}`
- picture/decoration/background data
- progression/level data
- pending reward data for owner-facing progression cues

## Current Truths To Preserve

1. `profile-header` is the non-removable anchor widget.
2. Owner and viewer profiles both use the board-based header widget now.
3. Viewer actions belong to `viewer-actions`, not to a separate legacy profile header stack.
