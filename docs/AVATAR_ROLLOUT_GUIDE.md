# Digital Avatar Rollout Guide

**Version:** 1.0  
**Created:** February 3, 2026  
**Status:** Phase 8 Implementation

---

## Overview

This document describes the rollout strategy and implementation for the Digital Avatar System. The rollout is designed to be gradual, monitored, and reversible.

## Rollout Stages

| Stage        | Percentage | Description            | Duration   |
| ------------ | ---------- | ---------------------- | ---------- |
| **Disabled** | 0%         | Feature completely off | Pre-launch |
| **Internal** | 0%         | Beta users only        | 1-2 days   |
| **Beta**     | 5%         | Beta + 5% of users     | 3-5 days   |
| **Canary**   | 10%        | 10% of users           | 3-5 days   |
| **Gradual**  | 50%        | 50% of users           | 5-7 days   |
| **General**  | 90%        | 90% of users           | 3-5 days   |
| **Full**     | 100%       | All users              | Permanent  |

## Feature Flags

### Location

`constants/featureFlags.ts` → `AVATAR_FEATURES`

### Available Flags

```typescript
AVATAR_FEATURES = {
  // Core features
  DIGITAL_AVATAR_ENABLED: false, // Master toggle
  AVATAR_CUSTOMIZER: false, // Customization UI
  AVATAR_MIGRATION_PROMPT: false, // Migration prompts

  // Enhancement features
  AVATAR_ANIMATIONS: true, // Idle animations
  AVATAR_CACHING: true, // Render caching
  AVATAR_PRESETS: true, // Quick presets
  PREMIUM_AVATAR_ITEMS: false, // Shop integration
  AVATAR_EXPRESSIONS: false, // Future feature
  FULL_BODY_AVATAR: true, // Body view

  // Debug flags
  DEBUG_AVATAR_RENDERING: __DEV__,
  DEBUG_AVATAR_BOUNDS: false,
  DEBUG_AVATAR_CACHE: __DEV__,
  DEBUG_FORCE_LEGACY: false,
};
```

## Rollout Implementation

### 1. Percentage-Based Rollout

Users are bucketed using consistent hashing:

```typescript
import { isUserInPercentage } from "@/utils/rollout";

// Check if user is in the 10% rollout
const isEnabled = isUserInPercentage(userId, 10, "digital_avatar");
```

The same user always gets the same result for a given feature.

### 2. Beta User Management

```typescript
import { addBetaUser, removeBetaUser, isBetaUser } from "@/utils/rollout";

// Add beta tester
await addBetaUser("user123");

// Check beta status
const isBeta = await isBetaUser("user123");

// Remove from beta
await removeBetaUser("user123");
```

### 3. Local Overrides (Development)

```typescript
import { setLocalOverride, clearLocalOverrides } from "@/utils/rollout";

// Force enable for testing
await setLocalOverride("digital_avatar", true);

// Force disable for comparison
await setLocalOverride("digital_avatar", false);

// Clear all overrides
await clearLocalOverrides();
```

### 4. Using the Rollout Hook

```typescript
import { useAvatarRollout } from '@/hooks/useAvatarRollout';

function ProfileScreen() {
  const {
    isDigitalAvatarEnabled,
    isCustomizerEnabled,
    isBetaUser,
    needsMigration,
    rolloutStage,
  } = useAvatarRollout(userData);

  if (!isDigitalAvatarEnabled) {
    return <LegacyAvatar />;
  }

  return <DigitalAvatar />;
}
```

## Monitoring & Analytics

### Tracked Events

| Event                    | Description              |
| ------------------------ | ------------------------ |
| `avatar_rendered`        | Digital avatar rendered  |
| `legacy_avatar_rendered` | Legacy avatar rendered   |
| `customizer_opened`      | User opened customizer   |
| `customizer_saved`       | User saved changes       |
| `migration_started`      | User began migration     |
| `migration_completed`    | Migration successful     |
| `rollout_enabled`        | Feature enabled for user |

### Session Metrics

```typescript
import { getSessionSummary } from "@/services/avatarAnalytics";

const { stats, adoptionRate } = getSessionSummary();
// stats.avatarsRendered: 150
// stats.legacyAvatarsRendered: 50
// adoptionRate: 75%
```

## Migration Strategy

### Automatic Conversion

Legacy configs are automatically converted:

```typescript
// Legacy: { baseColor: '#FF6B6B', hat: '🎩' }
// Becomes: { version: 2, body: { skinTone: 'skin_06', ... }, ... }
```

### Migration Prompt

Users with legacy avatars see a migration prompt:

```typescript
import { AvatarMigrationPrompt } from '@/components/avatar/AvatarMigrationPrompt';

<AvatarMigrationPrompt
  visible={showPrompt}
  onMigrate={handleMigrate}
  onDismiss={handleDismiss}
/>
```

Prompt urgency increases as removal date approaches:

- **Low** (30+ days): Friendly suggestion
- **Medium** (7-30 days): Encouraging prompt
- **High** (<7 days): Urgent notice

### Batch Migration Script

For admin-triggered migrations:

```powershell
# Dry run
npx ts-node scripts/migrate-avatars.ts --dry-run

# Production (10 users for testing)
npx ts-node scripts/migrate-avatars.ts --production --limit=10

# Full production
npx ts-node scripts/migrate-avatars.ts --production --batch-size=100
```

## Rollback Procedures

### Immediate Rollback

1. Set feature flag to `false`:

```typescript
DIGITAL_AVATAR_ENABLED: false;
```

2. Deploy the change

3. Clear any cached rollout decisions:

```typescript
await clearLocalOverrides();
```

### Partial Rollback

Reduce percentage to limit exposure:

```typescript
DEFAULT_ROLLOUTS.digital_avatar.percentage = 10; // Reduce to 10%
```

### Emergency Disable

```typescript
DEFAULT_ROLLOUTS.digital_avatar.disabled = true;
```

## What's New Communication

### Automatic Display

First-time users see the What's New modal:

```typescript
import { useAvatarWhatsNew } from "@/components/avatar/AvatarWhatsNewModal";

const { hasNewContent, show, isVisible } = useAvatarWhatsNew();

useEffect(() => {
  if (hasNewContent) {
    show();
  }
}, [hasNewContent]);
```

### Manual Trigger

```typescript
// From settings or help menu
<Pressable onPress={show}>
  <Text>What's New in Avatars</Text>
</Pressable>
```

## Deprecation Timeline

| Date         | Milestone                     |
| ------------ | ----------------------------- |
| Feb 3, 2026  | Digital Avatar Released       |
| Feb 17, 2026 | Migration Prompts Begin       |
| Mar 3, 2026  | Legacy Marked Deprecated      |
| Apr 3, 2026  | Increased Migration Reminders |
| May 3, 2026  | Legacy Avatar Removed         |

## Checklist

### Pre-Launch

- [ ] Feature flags set to `false`
- [ ] Beta users list populated
- [ ] Analytics integration verified
- [ ] Rollback procedures tested

### Beta Phase

- [ ] Enable for internal testers
- [ ] Monitor error rates
- [ ] Collect feedback
- [ ] Fix critical issues

### Canary Phase

- [ ] Set percentage to 10%
- [ ] Monitor performance metrics
- [ ] Check memory usage
- [ ] Verify migration flow

### Gradual Phase

- [ ] Increase to 50%
- [ ] Monitor adoption rate
- [ ] Check server load
- [ ] Verify caching effectiveness

### General Availability

- [ ] Increase to 90%
- [ ] Enable migration prompts
- [ ] Activate What's New modal
- [ ] Start deprecation countdown

### Full Rollout

- [ ] Set to 100%
- [ ] Remove legacy code (deferred)
- [ ] Archive migration scripts
- [ ] Update documentation

## Troubleshooting

### Feature Not Enabling

1. Check feature flag value
2. Verify user ID is valid
3. Check rollout percentage
4. Look for local overrides
5. Check beta user status

### Migration Issues

1. Verify legacy config exists
2. Check conversion mapping
3. Look for validation errors
4. Check Firestore write permissions

### Performance Issues

1. Disable animations: `AVATAR_ANIMATIONS: false`
2. Enable caching: `AVATAR_CACHING: true`
3. Check render count with debug flag
4. Profile with React DevTools

## Support Contacts

- **Technical Issues**: Check GitHub issues
- **Rollout Decisions**: Product team
- **Emergency Rollback**: On-call engineer

---

_Last updated: February 3, 2026_
