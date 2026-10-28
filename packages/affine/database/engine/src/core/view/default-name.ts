import { translateKey } from '@labre/affine-shared/services';
import type { BlockStdScope } from '@labre/std';

import type { Wording } from '../utils/wording.js';
import type { DataViewModel } from './data-view.js';

/**
 * The name a view created now is given: the preset's `defaultNameKey`
 * resolved through the host's catalogue, its English `defaultName` without
 * an editor (`std` absent) or without a key. A creation site writes what
 * this returns, at the gesture, so the stored name is the one the author saw
 * and the preset's seed never changes (ADR 0023). Never call it on load.
 */
export function viewDefaultName(
  meta: Pick<DataViewModel, 'model'>,
  std: BlockStdScope | undefined
): string {
  const { defaultName, defaultNameKey } = meta.model;
  if (!std || !defaultNameKey) return defaultName;
  return translateKey(std, defaultNameKey, defaultName);
}

/**
 * A preset's name as a menu shows it (the view settings' "Layout"), through
 * the opener's words; the English `defaultName` without a key.
 */
export function viewPresetName(
  meta: Pick<DataViewModel, 'model'>,
  wording: Wording
): string {
  const { defaultName, defaultNameKey } = meta.model;
  return defaultNameKey ? wording([defaultNameKey, defaultName]) : defaultName;
}
