# Project Reorganization Prompt for Claude Opus 4.6

> Copy and paste this entire document as a prompt to initiate a comprehensive project reorganization.

---

## 🎯 Objective

You are tasked with performing an **extensive and thorough reorganization** of this React Native/Expo project (Vibe App). Your goals are:

1. **Audit** the entire codebase for structural inconsistencies, dead code, and technical debt
2. **Reorganize** files and folders to follow best practices and improve discoverability
3. **Remove** all obsolete, unused, or deprecated code
4. **Document** every change made during this process
5. **Optimize** the structure to make future feature implementation easier for both humans and AI assistants

---

## 📋 Phase 1: Discovery & Audit

### 1.1 Codebase Inventory

First, build a complete mental map of the project by examining:

```
Priority Order:
1. docs/00_INDEX.md          → Understand documentation structure
2. docs/01_ARCHITECTURE.md   → Understand intended architecture
3. package.json              → Dependencies and scripts
4. tsconfig.json             → TypeScript configuration
5. src/types/                → All type definitions
6. src/services/             → All service files
7. src/screens/              → All screen components
8. src/components/           → All reusable components
9. src/hooks/                → All custom hooks
10. src/store/               → State management
11. src/utils/               → Utility functions
12. src/navigation/          → Navigation structure
13. firebase-backend/        → Cloud Functions and rules
```

### 1.2 Audit Checklist

For each directory, answer these questions:

- [ ] Are files named consistently? (e.g., `PascalCase.tsx` for components, `camelCase.ts` for utilities)
- [ ] Do related files live together? (e.g., component + styles + tests)
- [ ] Are there orphaned files not imported anywhere?
- [ ] Are there duplicate implementations of the same functionality?
- [ ] Are there files with misleading names that don't match their content?
- [ ] Are imports clean (no circular dependencies, no deep relative paths)?
- [ ] Are barrel exports (`index.ts`) used consistently?
- [ ] Is there commented-out code that should be deleted?
- [ ] Are there `console.log` statements that should be removed?
- [ ] Are there TODO/FIXME comments for completed work?

### 1.3 Dead Code Detection

Search for and identify:

```typescript
// Patterns to search for:
- Functions/components never imported
- Exported but unused types/interfaces
- Unused dependencies in package.json
- Unused assets in assets/ folder
- Unused constants
- Legacy files with names like *_old.ts, *_backup.ts, *_deprecated.ts
- Comments containing: "deprecated", "legacy", "old", "remove", "delete", "temporary", "hack", "TODO: remove"
```

---

## 📋 Phase 2: Reorganization Plan

### 2.1 Ideal Structure

Reorganize toward this target structure:

```
src/
├── components/
│   ├── common/              # Truly generic (Button, Card, Modal, etc.)
│   ├── chat/                # Chat-specific components
│   ├── games/               # Game-specific components
│   ├── profile/             # Profile-specific components
│   └── [feature]/           # Other feature-specific components
│
├── screens/
│   ├── auth/                # Authentication screens
│   ├── chat/                # Chat/messaging screens
│   ├── games/               # Game screens
│   ├── profile/             # Profile screens
│   └── [feature]/           # Other feature screens
│
├── services/
│   ├── firebase/            # Firebase-specific services
│   ├── api/                 # API clients (if any)
│   └── [domain].ts          # Domain services (auth, chat, games, etc.)
│
├── hooks/
│   ├── common/              # Generic hooks (useDebounce, useAsync, etc.)
│   ├── chat/                # Chat-specific hooks
│   ├── games/               # Game-specific hooks
│   └── index.ts             # Barrel export
│
├── store/
│   └── [Context].tsx        # Context providers
│
├── types/
│   ├── models.ts            # Core data models
│   ├── [feature].ts         # Feature-specific types
│   └── index.ts             # Barrel export
│
├── utils/
│   ├── formatting/          # Date, string, number formatters
│   ├── validation/          # Validators
│   ├── [domain]/            # Domain-specific utilities
│   └── index.ts             # Barrel export
│
├── constants/
│   ├── theme.ts             # Theme/colors
│   ├── config.ts            # App configuration
│   └── [feature].ts         # Feature constants
│
├── navigation/
│   └── RootNavigator.tsx    # Navigation configuration
│
└── assets/
    ├── images/
    ├── fonts/
    └── animations/
```

### 2.2 Naming Conventions

Enforce these conventions:

| Type       | Convention                 | Example                     |
| ---------- | -------------------------- | --------------------------- |
| Components | PascalCase                 | `GameCard.tsx`              |
| Screens    | PascalCase + Screen suffix | `ChatScreen.tsx`            |
| Hooks      | camelCase + use prefix     | `useGameLoop.ts`            |
| Services   | camelCase                  | `auth.ts`, `gameInvites.ts` |
| Types      | PascalCase                 | `GameState`, `UserProfile`  |
| Constants  | SCREAMING_SNAKE_CASE       | `MAX_RETRY_COUNT`           |
| Utilities  | camelCase                  | `formatDate.ts`             |
| Test files | _.test.ts or _.spec.ts     | `auth.test.ts`              |

### 2.3 Import Organization

Standardize imports in this order:

```typescript
// 1. React/React Native
import React, { useState, useEffect } from "react";
import { View, Text, StyleSheet } from "react-native";

// 2. Third-party libraries (alphabetical)
import { useNavigation } from "@react-navigation/native";
import { Button } from "react-native-paper";

// 3. Internal absolute imports (alphabetical)
import { useAuth } from "@/hooks";
import { UserProfile } from "@/types";
import { formatDate } from "@/utils";

// 4. Relative imports (parent before sibling)
import { GameCard } from "../components";
import { styles } from "./styles";
```

---

## 📋 Phase 3: Execution

### 3.1 Safe Deletion Process

Before deleting any file:

1. **Search for imports** of that file across the entire codebase
2. **Check git history** for recent activity (skip if actively maintained)
3. **Verify no dynamic imports** reference it
4. **Document the deletion** with reason

### 3.2 Change Log Template

Create and maintain `docs/REORGANIZATION_CHANGELOG.md`:

```markdown
# Reorganization Changelog

## [Date] - Phase X: [Description]

### Files Deleted

| File            | Reason                     | Lines Removed |
| --------------- | -------------------------- | ------------- |
| path/to/file.ts | Unused since [date/commit] | 150           |

### Files Moved

| From        | To          | Reason              |
| ----------- | ----------- | ------------------- |
| old/path.ts | new/path.ts | Better organization |

### Files Renamed

| Old Name   | New Name   | Reason            |
| ---------- | ---------- | ----------------- |
| oldName.ts | newName.ts | Naming convention |

### Code Removed

| File    | Description                   | Lines Removed |
| ------- | ----------------------------- | ------------- |
| file.ts | Removed deprecated function X | 45            |

### New Files Created

| File          | Purpose       |
| ------------- | ------------- |
| path/index.ts | Barrel export |
```

### 3.3 Verification Steps

After each major change:

1. Run `npx tsc --noEmit` — Verify no TypeScript errors
2. Run `npm test` — Verify tests pass (if applicable)
3. Run `npm start` — Verify app starts without errors
4. Check for circular dependency warnings

---

## 📋 Phase 4: Documentation Updates

### 4.1 Required Updates

After reorganization, update:

- [ ] `docs/00_INDEX.md` — Update file references
- [ ] `docs/01_ARCHITECTURE.md` — Update folder structure section
- [ ] `README.md` — Update project structure if documented
- [ ] Any other docs referencing moved/deleted files

### 4.2 Architecture Documentation

Ensure `docs/01_ARCHITECTURE.md` contains:

- Updated folder structure diagram
- File naming conventions
- Import conventions
- Component organization rules
- Service layer architecture
- State management patterns

---

## 📋 Phase 5: Final Verification

### 5.1 Quality Checklist

- [ ] No TypeScript errors (`npx tsc --noEmit`)
- [ ] No ESLint errors (`npm run lint` if configured)
- [ ] No orphaned files (every file is imported somewhere or is an entry point)
- [ ] No circular dependencies
- [ ] All barrel exports (`index.ts`) are up to date
- [ ] Documentation reflects current structure
- [ ] No commented-out code blocks
- [ ] No debug `console.log` statements (except in designated debug utilities)

### 5.2 AI-Friendliness Checklist

Ensure the codebase is optimized for AI assistants:

- [ ] Clear, descriptive file names that indicate purpose
- [ ] Consistent patterns across similar files
- [ ] Type definitions are comprehensive and well-documented
- [ ] Each file has a clear single responsibility
- [ ] Related code is co-located (easier context gathering)
- [ ] Barrel exports reduce import complexity
- [ ] Documentation is current and accurate

---

## ⚠️ Important Guidelines

### DO:

- Work incrementally — commit logical chunks of changes
- Verify after each phase before proceeding
- Document every deletion with clear reasoning
- Preserve git history (use `git mv` for moves when possible)
- Ask for clarification if unsure about a file's purpose

### DO NOT:

- Delete files without verifying they're unused
- Make sweeping changes without intermediate verification
- Remove "TODO" comments for incomplete work
- Change public API signatures without updating callers
- Skip documentation updates

---

## 🚀 Begin

Start by reading the documentation index (`docs/00_INDEX.md`) and architecture document (`docs/01_ARCHITECTURE.md`), then proceed through each phase systematically. Report findings and proposed changes before executing deletions.

**First Task:** Perform the Phase 1 audit and report:

1. Total file count by directory
2. Suspected dead code locations
3. Naming inconsistencies found
4. Proposed reorganization priorities (high/medium/low impact)
