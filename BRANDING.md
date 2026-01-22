# Vibe — Brand Guide

## App Identity

| Field               | Value                                                    |
| ------------------- | -------------------------------------------------------- |
| **Public Name**     | Vibe                                                     |
| **Internal Name**   | vibe-app (was snapstyle-mvp)                             |
| **Tagline**         | "Share moments, build connections"                       |
| **App Description** | A calm, playful space to share moments with your circle. |

## Terminology Mapping

Rebranding from Snapchat-like terminology to unique, calm, friendly language:

| Old (Snapchat-like) | New (Vibe)             | Notes                        |
| ------------------- | ---------------------- | ---------------------------- |
| Stories             | **Moments**            | Ephemeral photo/video shares |
| Snaps               | **Shots**              | Direct photo messages        |
| Friends             | **Connections**        | Your social circle           |
| Streaks             | **Rituals**            | Daily consistency rewards    |
| Games               | **Play**               | Arcade/mini-games section    |
| Chat                | **Inbox**              | Direct and group messaging   |
| Story Viewer        | **Moment Viewer**      | Fullscreen moment display    |
| Friend Request      | **Connection Request** | Invitation to connect        |
| Add Friend          | **Add Connection**     | Action to request            |
| Unfriend            | **Remove Connection**  | Action to disconnect         |
| Block               | **Block**              | Keep as-is (clear meaning)   |
| Report              | **Report**             | Keep as-is (clear meaning)   |

## Tone of Voice

### Principles

1. **Calm** — Avoid urgency, FOMO language, or aggressive notifications
2. **Friendly** — Warm, welcoming, approachable
3. **Playful** — Light humor where appropriate, not forced
4. **Clear** — Simple language, avoid jargon or teen-slang by default
5. **Respectful** — Inclusive, no shaming for inactivity

### Copy Examples

| Context        | ❌ Avoid                        | ✅ Prefer                                    |
| -------------- | ------------------------------- | -------------------------------------------- |
| Empty moments  | "No stories yet! Be the first!" | "No moments shared yet. Share something?"    |
| Empty inbox    | "Start chatting NOW!"           | "Your inbox is quiet. Start a conversation?" |
| No connections | "You have NO friends!"          | "No connections yet. Find someone to add?"   |
| Ritual broken  | "You LOST your streak! 😭"      | "Ritual paused. Send a shot to restart it."  |
| Error state    | "Something went wrong!"         | "Couldn't load that. Tap to try again."      |
| Loading        | "Loading..."                    | "Just a moment..."                           |
| Success        | "Done!"                         | "All set!"                                   |

### Button & Action Labels

| Action            | Label            |
| ----------------- | ---------------- |
| Post a moment     | "Share Moment"   |
| Send a shot       | "Send Shot"      |
| Add connection    | "Add Connection" |
| Accept request    | "Accept"         |
| Decline request   | "Decline"        |
| Remove connection | "Remove"         |
| Start chat        | "Message"        |
| Open camera       | "Camera"         |
| Pick from gallery | "Gallery"        |

## Visual Identity

### No Snapchat Cues

- ❌ No yellow (#FFFC00) as primary or accent
- ❌ No ghost iconography
- ❌ No story "rings" (circular progress indicators)
- ❌ No black + yellow combinations
- ✅ Soft pastel palette (Catppuccin-inspired)
- ✅ Rounded cards with subtle shadows
- ✅ Gentle gradients (optional)
- ✅ Progress chips instead of rings

### Design Tokens

See `constants/theme.ts` for full token definitions:

- Light mode: "Latte" inspired pastels
- Dark mode: "Mocha" inspired deep tones
- Primary: Soft lavender/mauve
- Accent: Peach/coral
- Success: Mint green
- Warning: Warm yellow (not Snapchat yellow)
- Error: Soft red/maroon

## Icon & Asset Guidelines

### Icons

- Use **MaterialCommunityIcons** (already in project)
- Prefer outlined variants for tabs, filled for actions
- Icon names for rebranded features:
  - Inbox: `message-outline` / `message`
  - Moments: `image-multiple-outline` / `image-multiple`
  - Play: `gamepad-variant-outline` / `gamepad-variant`
  - Connections: `account-group-outline` / `account-group`
  - Profile: `account-circle-outline` / `account-circle`

### Splash & App Icon

- TODO: Create new app icon (not ghost-like)
- TODO: Create splash screen with "Vibe" wordmark
- Current assets retained as placeholders

## Future Considerations

1. **Custom typography** — Consider a friendly rounded font like Nunito
2. **Illustrations** — Add friendly empty-state illustrations
3. **Haptics** — Subtle feedback on key actions (Expo Haptics)
4. **Sound** — Optional soft sounds for sent/received
5. **Onboarding** — Friendly tour introducing the app
