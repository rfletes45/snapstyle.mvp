/**
 * Loader for starforge_modules_v1.json
 * Fetches, parses, and validates the spec file.
 */
import type { StarforgeSpec } from "../types/schema";
import { validateSpec, type ValidationResult } from "./validator";

export interface LoadResult {
  spec: StarforgeSpec;
  validation: ValidationResult;
}

/**
 * Load the Starforge module spec from a URL or inline object.
 */
export async function loadSpec(
  urlOrData: string | StarforgeSpec,
): Promise<LoadResult> {
  let spec: StarforgeSpec;

  if (typeof urlOrData === "string") {
    const resp = await fetch(urlOrData);
    if (!resp.ok) {
      throw new Error(
        `Failed to fetch spec from "${urlOrData}": ${resp.status} ${resp.statusText}`,
      );
    }
    spec = (await resp.json()) as StarforgeSpec;
  } else {
    spec = urlOrData;
  }

  const validation = validateSpec(spec);

  if (validation.errors.length > 0) {
    console.error("⚠ Starforge spec validation errors:");
    validation.errors.forEach((e) => console.error("  ✗", e));
  }
  if (validation.warnings.length > 0) {
    console.warn("⚡ Starforge spec validation warnings:");
    validation.warnings.forEach((w) => console.warn("  ⚠", w));
  }
  if (validation.todos.length > 0) {
    console.info("📋 Starforge TODOs:");
    validation.todos.forEach((t) => console.info("  •", t));
  }

  return { spec, validation };
}
