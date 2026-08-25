/**
 * Where the "show line numbers" answer comes from — upstream #15381.
 *
 * Three voices can speak: the embedder's feature flag (mobile switches line
 * numbers off outright), the host's global preference, and the block's own
 * override set from the code toolbar. The library owns none of the storage:
 * the global preference is read from whatever `EditorSettingProvider` the host
 * injects, the same seam as the telemetry adapter.
 */

/** Key the host uses in its editor-setting payload for this preference. */
export const CODE_BLOCK_LINE_NUMBERS_SETTING_KEY = 'codeBlockLineNumbers';

/**
 * The host's global preference, defaulting to "shown" when the host injects no
 * setting service, or injects one that says nothing about code blocks.
 */
export function readGlobalLineNumbers(setting: unknown): boolean {
  return (
    (setting as Record<string, unknown> | undefined)?.[
      CODE_BLOCK_LINE_NUMBERS_SETTING_KEY
    ] !== false
  );
}

/**
 * The feature flag has the last word; otherwise the block's own override wins
 * over the global default, and an untouched block follows the global default.
 */
export function resolveShowLineNumbers(options: {
  featureEnabled: boolean;
  blockOverride: boolean | undefined;
  globalDefault: boolean;
}): boolean {
  if (!options.featureEnabled) return false;
  return options.blockOverride ?? options.globalDefault;
}
