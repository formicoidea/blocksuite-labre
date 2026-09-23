import type { MenuConfig } from '@labre/affine-components/context-menu';
import type { ChromeWording } from '@labre/affine-shared/services';
import type { BlockComponent, BlockStdScope } from '@labre/std';
import type { GfxController } from '@labre/std/gfx';
import type { TemplateResult } from 'lit';

export type MenuItem<T> = {
  key?: string;
  /**
   * {@link key}, said as an i18n key with its English default — resolved
   * ahead of `key` by `renderMenu` / `renderMenuItems` / `resolveMenuItemLabel`
   * when the caller passes `std`. A caller that does not (every framework
   * this widget did not yet reach) keeps the English literal, exactly as
   * before this field existed.
   */
  keyWording?: ChromeWording;
  value: T;
  icon?: TemplateResult;
  disabled?: boolean;
};

export type Menu<T> = {
  label: string;
  /** {@link label}, for the translation seam. See {@link MenuItem.keyWording}. */
  labelWording?: ChromeWording;
  icon?: TemplateResult;
  tooltip?: string;
  /** {@link tooltip}, for the translation seam. */
  tooltipWording?: ChromeWording;
  /**
   * The accessible name of the MENU shell (`aria-label` on
   * `editor-menu-button`) — its own key, never a composition (#390).
   *
   * Before this field the shell's name was sewn together as
   * `` `${resolvedLabel.toLowerCase()}-menu` ``, which was a stable
   * identifier while `label` was English and became half-translated
   * ("changer le type de forme-menu") the day `label` joined the seam. The
   * precedent is `ROOT_ALIGNMENT_MENU_ARIA` (`blocks/root`): a menu's aria is
   * a wording of its own.
   *
   * Left out, the name is composed from the ENGLISH {@link label}, so a
   * caller that declares nothing keeps exactly the identifier it had.
   */
  menuAriaWording?: ChromeWording;
  items: MenuItem<T>[];
  currentValue: T;
  onPick: (value: T) => void;
  /** The editor's std scope, needed to resolve any `…Wording` above. Optional
   * for the same reason they are: a caller with no `std` at hand renders the
   * English literal it always has. */
  std?: BlockStdScope;
};

/**
 * Helper function to build a menu configuration for a tool in dense mode
 */
export type DenseMenuBuilder = (
  edgeless: BlockComponent,
  gfx: GfxController
) => MenuConfig;
