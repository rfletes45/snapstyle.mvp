# Chat V3 Reference (Condensed)

Last updated: 2026-02-19

This file now serves as a compact reference target for V3 feature-flag comments.

## Canonical Chat Docs

- Primary contract doc: `docs/CHAT_SYSTEM.md`
- Detailed implementation/history: `docs/03_CHAT_V2.md`
- Security/rules context: `docs/02_FIREBASE.md`, `docs/FIRESTORE_CONTRACT.md`

## V3 Flags

`CHAT_FEATURES` in `constants/featureFlags.ts` controls staged rollout for:

- settings resolver
- signed media URLs
- staged uploads
- message requests
- global rate limiting
- inbox aggregation
- delivery acknowledgements
- server-enforced privacy writes

For behavior and invariants, prefer `docs/CHAT_SYSTEM.md`.
