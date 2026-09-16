import type { ChromeWording } from '@labre/affine-shared/services';
import type { BlockStdScope } from '@labre/std';
import type { BlockModel } from '@labre/store';
import type { TemplateResult } from 'lit';

export type SlashMenuContext = {
  std: BlockStdScope;
  model: BlockModel;
};

export type SlashMenuTooltip = {
  figure: TemplateResult;
  caption: string;
  /**
   * {@link caption}, said as an i18n key with its English default — resolved
   * against the host's catalogue when the tooltip renders, and shown instead
   * of `caption` there. Mirrors `ToolbarAction.labelWording`: a static
   * literal is the one wording a host cannot override.
   */
  captionWording?: ChromeWording;
};

type SlashMenuItemBase = {
  name: string;
  /**
   * The same word as {@link name}, said as an i18n key with its English
   * default — resolved against the host's catalogue when the item renders,
   * and shown instead of `name` there. `name` stays the item's English
   * identity: it is what tests and `searchAlias` match against, and what
   * `slashItemClassName` derives a CSS class from.
   */
  nameWording?: ChromeWording;
  description?: string;
  /** {@link nameWording}, for {@link description}. */
  descriptionWording?: ChromeWording;
  icon?: TemplateResult;
  /**
   * This field defines sorting and grouping of menu items like VSCode.
   * The first number indicates the group index, the second number indicates the item index in the group.
   * The group name is the string between `_` and `@`.
   * You can find an example figure in https://code.visualstudio.com/api/references/contribution-points#menu-example
   */
  group?: `${number}_${string}@${number}`;

  searchAlias?: string[];
  /**
   * The condition to show the menu item.
   */
  when?: (ctx: SlashMenuContext) => boolean;
};

export type SlashMenuActionItem = SlashMenuItemBase & {
  action: (ctx: SlashMenuContext) => void;
  tooltip?: SlashMenuTooltip;
  /**
   * The alias of the menu item for search.
   */
  searchAlias?: string[];
};

export type SlashMenuSubMenu = SlashMenuItemBase & {
  subMenu: SlashMenuItem[];
};

export type SlashMenuItem = SlashMenuActionItem | SlashMenuSubMenu;

export type SlashMenuConfig = {
  /**
   * The items in the slash menu. It can be generated dynamically with the context.
   */
  items: SlashMenuItem[] | ((ctx: SlashMenuContext) => SlashMenuItem[]);

  /**
   * Slash menu will not be triggered when the condition is true.
   */
  disableWhen?: (ctx: SlashMenuContext) => boolean;
};
