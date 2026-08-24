import type { TemplateResult } from 'lit';

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
  showLabel?: boolean;
  icon?: TemplateResult;
  tooltip?: string | TemplateResult;
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
