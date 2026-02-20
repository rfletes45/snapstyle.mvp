/**
 * AchievementsScreen.tsx
 *
 * Thin wrapper that delegates to the V2 achievements screen.
 * The V1 achievement UI has been retired in favour of the V2 system which
 * provides server-authoritative evaluation, per-game stats, social counters
 * and a richer UI with progress bars, tiers and categories.
 *
 * The original V1 implementation lived in this file (~800 lines) but is no
 * longer needed.  If you ever need to revert, check git history.
 */

import type { PlayStackParamList } from "@/types/navigation/root";
import { NativeStackScreenProps } from "@react-navigation/native-stack";
import React from "react";

import AchievementsV2Screen from "./AchievementsV2Screen";

type Props = NativeStackScreenProps<PlayStackParamList, "Achievements">;

export default function AchievementsScreen({ navigation, route }: Props) {
  return <AchievementsV2Screen navigation={navigation} route={route} />;
}
