import type { BlockStdScope } from '@labre/std';
import type { TemplateResult } from 'lit';

import { type ChromeWording, translateKey } from '../translation-service';
import type { ToolbarContext } from './context';

export enum ActionPlacement {
  Start = 0,
  Normal = 1 << 0,
  End = 1 << 1,
  More = 1 << 2,
}

type ActionBase = {
  id: string;
  score?: number;
  when?: ((cx: ToolbarContext) => boolean) | boolean;
  active?: ((cx: ToolbarContext) => boolean) | boolean;
  placement?: ActionPlacement;
  /**
   * How hard this entry holds its place when the row runs out of room —
   * **higher stays on the row longer**. Defaults to `0`, and among equals the
   * entry rendered LAST gives way first, so an action that says nothing keeps
   * the order the toolbar already has (see `layout.ts`).
   *
   * Declaring it is how an entry escapes that default: a rare, wordy entry that
   * happens to sort early asks to give way sooner with a negative number.
   */
  priority?: number;
};

export type ToolbarAction = ActionBase & {
  label?: string;
  /**
   * The same word as {@link label}, said as an i18n key with its English
   * default — resolved against the host's catalogue when the row is built, and
   * written over `label` there (`combine`, in the toolbar widget).
   *
   * It exists because `label` is a VALUE and the translation seam needs `std`:
   * a literal here is the one wording a host cannot override, which is what
   * left a fully translated editor saying "Duplicate" and "Card view" in
   * English (#183). Declaring the pair keeps a call site one line — the shape a
   * static label already had — instead of pushing every entry that has words
   * into a `generate`.
   *
   * Wordings are declared once in `@labre/affine-shared/services`
   * (`CHROME_WORDINGS`), which is also what the key manifest walks — a pair
   * spelt inline at a call site would be a key no host is ever offered.
   */
  labelWording?: ChromeWording;
  showLabel?: boolean;
  icon?: TemplateResult;
  tooltip?: string | TemplateResult;
  /** {@link labelWording}, for the tooltip. Written over `tooltip`. */
  tooltipWording?: ChromeWording;
  variant?: 'destructive';
  disabled?: ((cx: ToolbarContext) => boolean) | boolean;
  content?:
    | ((cx: ToolbarContext) => TemplateResult | null)
    | (TemplateResult | null);
  run?: (cx: ToolbarContext) => void;
};

// Generates an action at runtime
export type ToolbarActionGenerator = ActionBase & {
  generate: (cx: ToolbarContext) => Omit<ToolbarAction, 'id'> | null;
};

export type ToolbarActionGroup<
  T extends ActionBase = ToolbarAction | ToolbarActionGenerator,
> = ActionBase & {
  actions: T[];
  content?:
    | ((cx: ToolbarContext) => TemplateResult | null)
    | (TemplateResult | null);
};

// Generates an action group at runtime
export type ToolbarActionGroupGenerator = ActionBase & {
  generate: (cx: ToolbarContext) => Omit<ToolbarActionGroup, 'id'> | null;
};

export type ToolbarGenericAction =
  | ToolbarAction
  | ToolbarActionGenerator
  | ToolbarActionGroup
  | ToolbarActionGroupGenerator;

export type ToolbarActions<T extends ActionBase = ToolbarGenericAction> = T[];

/**
 * What an entry SAYS, whether it declared a wording or a literal label.
 *
 * The row itself never needs this — `combine` resolves `labelWording` onto
 * `label` before anything is drawn. It exists for the entries a widget renders
 * ITSELF out of the raw declarations, which is exactly what the view switcher
 * does: `content(ctx)` hands its own children to `affine-view-dropdown-menu`,
 * so those never pass through `combine` and would otherwise be the one control
 * in the editor left saying "Card view" in English (#183).
 */
export function toolbarActionLabel(
  std: BlockStdScope,
  action: ToolbarAction
): string {
  return action.labelWording
    ? translateKey(std, ...action.labelWording)
    : (action.label ?? '');
}
