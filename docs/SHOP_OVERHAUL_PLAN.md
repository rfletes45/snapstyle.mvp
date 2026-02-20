# Shop System Reference (Condensed)

Last updated: 2026-02-19

This file is a compact compatibility reference for shop-related code comments.

## Canonical Paths

- Shop UI: `src/screens/shop/`, `src/components/shop/`
- Shop services: `src/services/pointsShop.ts`, `src/services/premiumShop.ts`, `src/services/purchaseHistory.ts`, `src/services/promotions.ts`
- Backend handlers: `firebase-backend/functions/src/shop.ts`, `iap.ts`, `gifting.ts`, `dailyDeals.ts`
- Rules and contracts: `docs/02_FIREBASE.md`, `docs/FIRESTORE_CONTRACT.md`, `firebase-backend/firestore.rules`

## System Notes

- Keep economy writes aligned with Firestore rules and callable auth checks.
- Treat premium/points/deals/purchase-history changes as contract-sensitive.
- Validate any new query patterns for index requirements.

## Note

The original long-form overhaul plan was removed during documentation cleanup.
Use git history for prior planning detail.
