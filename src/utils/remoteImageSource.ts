import type { ImageProps } from "expo-image";

export function normalizeRemoteImageUrl(
  url: string | null | undefined,
): string | null {
  if (typeof url !== "string") return null;
  const trimmed = url.trim();
  return trimmed.length > 0 ? trimmed : null;
}

export function buildRemoteImageSource(
  url: string | null | undefined,
): ImageProps["source"] | undefined {
  const normalized = normalizeRemoteImageUrl(url);
  return normalized ? { uri: normalized } : undefined;
}
