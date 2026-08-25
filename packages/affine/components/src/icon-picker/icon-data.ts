import * as allIcons from '@blocksuite/icons/lit';
import { nothing, type TemplateResult } from 'lit';

export type IconFactory = (options?: {
  width?: string;
  height?: string;
  style?: string;
}) => TemplateResult<1>;

export interface PickerIcon {
  /** The icon name without its `Icon` suffix, e.g. `AddTag`. */
  name: string;
  /** Lower-cased tokens the filter matches against. */
  keywords: string[];
  render: IconFactory;
}

const isIconFactory = (value: unknown): value is IconFactory =>
  typeof value === 'function';

/**
 * Upstream ships a curated `Emoji Panel` list inside a newer
 * `@blocksuite/icons` release, keyed by hand-written keywords. We keep the
 * version we already depend on and derive both the list and its keywords from
 * the module's own exports: every `…Icon` export is offered, and its name is
 * split on camel-case boundaries so that `AddTag` answers to `add` and `tag`.
 */
const toKeywords = (name: string) => {
  const tokens = new Set<string>([name.toLowerCase()]);
  for (const word of name.split(/(?=[A-Z0-9])/)) {
    const token = word.trim().toLowerCase();
    if (token) tokens.add(token);
  }
  return [...tokens];
};

let cachedIcons: PickerIcon[] | null = null;

export const getIcons = (): PickerIcon[] => {
  if (cachedIcons) return cachedIcons;

  const icons: PickerIcon[] = [];
  for (const [exportName, value] of Object.entries(allIcons)) {
    if (!exportName.endsWith('Icon') || !isIconFactory(value)) continue;

    const name = exportName.slice(0, -'Icon'.length);
    if (!name) continue;

    icons.push({ name, keywords: toKeywords(name), render: value });
  }

  cachedIcons = icons.sort((a, b) => a.name.localeCompare(b.name));
  return cachedIcons;
};

export const findIcon = (name: string): PickerIcon | undefined =>
  getIcons().find(icon => icon.name === name);

/**
 * Renders a picked icon by name. Unknown names render nothing rather than
 * throwing, so a document holding an icon this build no longer knows about
 * still paints.
 */
export const renderAffineIcon = (
  name: string,
  options?: { width?: string; height?: string; style?: string }
): TemplateResult<1> | typeof nothing => {
  const icon = findIcon(name);
  if (!icon) return nothing;
  return icon.render(options);
};

export const filterIcons = (
  icons: PickerIcon[],
  keyword: string
): PickerIcon[] => {
  const needle = keyword.trim().toLowerCase();
  if (!needle) return icons;

  return icons.filter(icon =>
    icon.keywords.some(candidate => candidate.includes(needle))
  );
};

/**
 * The nine tints upstream offers for a picked icon.
 */
export const ICON_COLORS: ReadonlyArray<{ name: string; value: string }> = [
  { name: 'red', value: 'var(--affine-v2-block-callout-icon-red, #c83030)' },
  {
    name: 'orange',
    value: 'var(--affine-v2-block-callout-icon-orange, #ffae63)',
  },
  {
    name: 'yellow',
    value: 'var(--affine-v2-block-callout-icon-yellow, #fde047)',
  },
  {
    name: 'green',
    value: 'var(--affine-v2-block-callout-icon-green, #22bf07)',
  },
  { name: 'teal', value: 'var(--affine-v2-block-callout-icon-teal, #448e86)' },
  { name: 'blue', value: 'var(--affine-v2-block-callout-icon-blue, #53b2ef)' },
  {
    name: 'purple',
    value: 'var(--affine-v2-block-callout-icon-purple, #7c3aed)',
  },
  {
    name: 'magenta',
    value: 'var(--affine-v2-block-callout-icon-magenta, #cc4187)',
  },
  { name: 'grey', value: 'var(--affine-v2-block-callout-icon-grey, #cdcdcd)' },
];

export const DEFAULT_ICON_COLOR = ICON_COLORS[5].value;
