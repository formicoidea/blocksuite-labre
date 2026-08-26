import emojiMartData, { type EmojiMartData } from '@emoji-mart/data';

export interface PickerEmoji {
  id: string;
  name: string;
  /** Lower-cased tokens the filter matches against. */
  keywords: string[];
  /** Native strings, one per skin tone. Index 0 is the neutral variant. */
  skins: string[];
}

export interface EmojiGroup {
  id: string;
  name: string;
  /** The emoji shown for this group in the group navigation bar. */
  symbol: string;
  emojis: PickerEmoji[];
}

/**
 * Upstream groups its emojis into eight buckets with hand-drawn nav icons. The
 * dataset we already ship (`@emoji-mart/data`, used by the callout block) is
 * carved into the very same eight categories, so we reuse them rather than add
 * a second emoji dataset. `component` (skin-tone modifiers and hair
 * components) is skipped for the same reason upstream skips group 2: those are
 * not standalone emojis.
 */
const GROUP_ORDER: ReadonlyArray<{ id: string; name: string; symbol: string }> =
  [
    { id: 'people', name: 'Smileys & People', symbol: '😀' },
    { id: 'nature', name: 'Animals & Nature', symbol: '🐻' },
    { id: 'foods', name: 'Food & Drink', symbol: '🍔' },
    { id: 'activity', name: 'Activity', symbol: '⚽' },
    { id: 'places', name: 'Travel & Places', symbol: '🚗' },
    { id: 'objects', name: 'Objects', symbol: '💡' },
    { id: 'symbols', name: 'Symbols', symbol: '🔣' },
    { id: 'flags', name: 'Flags', symbol: '🏳️' },
  ];

export const RECENT_GROUP_NAME = 'Recent';

const toKeywords = (id: string, name: string, keywords: string[]) => {
  const tokens = new Set<string>();
  for (const keyword of keywords) tokens.add(keyword.toLowerCase());
  for (const word of name.toLowerCase().split(/[\s-]+/)) {
    if (word) tokens.add(word);
  }
  tokens.add(id.toLowerCase());
  return [...tokens];
};

let cachedGroups: EmojiGroup[] | null = null;

/**
 * Builds (once) the grouped emoji list the picker renders. Upstream pays this
 * cost at build time by committing a generated JSON; grouping 1.8k entries
 * costs a couple of milliseconds, so we do it lazily at first use instead.
 */
export const getEmojiGroups = (): EmojiGroup[] => {
  if (cachedGroups) return cachedGroups;

  const data = emojiMartData as unknown as EmojiMartData;
  const byId = data.emojis ?? {};

  cachedGroups = GROUP_ORDER.map(({ id, name, symbol }) => {
    const category = data.categories?.find(candidate => candidate.id === id);
    const emojis: PickerEmoji[] = [];

    for (const emojiId of category?.emojis ?? []) {
      const emoji = byId[emojiId];
      if (!emoji) continue;

      const skins = emoji.skins.map(skin => skin.native).filter(Boolean);
      if (!skins.length) continue;

      emojis.push({
        id: emoji.id,
        name: emoji.name,
        keywords: toKeywords(emoji.id, emoji.name, emoji.keywords ?? []),
        skins,
      });
    }

    return { id, name, symbol, emojis };
  });

  return cachedGroups;
};

/**
 * Resolves the native string for a skin tone, falling back to the neutral
 * variant whenever an emoji has no tone of its own.
 */
export const emojiUnicode = (emoji: PickerEmoji, skin?: number): string => {
  if (skin === undefined) return emoji.skins[0];
  return emoji.skins[skin] ?? emoji.skins[0];
};

/**
 * Filters every group by keyword, dropping the groups left empty. An empty
 * keyword returns the groups untouched.
 */
export const filterEmojiGroups = (
  groups: EmojiGroup[],
  keyword: string
): EmojiGroup[] => {
  const needle = keyword.trim().toLowerCase();
  if (!needle) return groups;

  return groups
    .map(group => ({
      ...group,
      emojis: group.emojis.filter(emoji =>
        emoji.keywords.some(candidate => candidate.includes(needle))
      ),
    }))
    .filter(group => group.emojis.length > 0);
};

/**
 * The tone swatches shown in the skin-tone menu. `undefined` is the neutral
 * (yellow) variant.
 */
export const SKIN_TONES: ReadonlyArray<{
  unicode: string;
  value: number | undefined;
}> = [
  { unicode: '👋', value: undefined },
  { unicode: '👋🏻', value: 1 },
  { unicode: '👋🏼', value: 2 },
  { unicode: '👋🏽', value: 3 },
  { unicode: '👋🏾', value: 4 },
  { unicode: '👋🏿', value: 5 },
];
