import {
  BulletedListIcon,
  CheckBoxIcon,
  CodeBlockIcon,
  DividerIcon,
  Heading1Icon,
  Heading2Icon,
  Heading3Icon,
  Heading4Icon,
  Heading5Icon,
  Heading6Icon,
  NumberedListIcon,
  QuoteIcon,
  TextIcon,
} from '@labre/affine-components/icons';
import {
  BLOCK_TYPE_BULLETED_LIST,
  BLOCK_TYPE_BULLETED_LIST_DESCRIPTION,
  BLOCK_TYPE_CODE_BLOCK,
  BLOCK_TYPE_CODE_BLOCK_DESCRIPTION,
  BLOCK_TYPE_DIVIDER,
  BLOCK_TYPE_DIVIDER_DESCRIPTION,
  BLOCK_TYPE_HEADING_1,
  BLOCK_TYPE_HEADING_1_DESCRIPTION,
  BLOCK_TYPE_HEADING_2,
  BLOCK_TYPE_HEADING_2_DESCRIPTION,
  BLOCK_TYPE_HEADING_3,
  BLOCK_TYPE_HEADING_3_DESCRIPTION,
  BLOCK_TYPE_HEADING_4,
  BLOCK_TYPE_HEADING_4_DESCRIPTION,
  BLOCK_TYPE_HEADING_5,
  BLOCK_TYPE_HEADING_5_DESCRIPTION,
  BLOCK_TYPE_HEADING_6,
  BLOCK_TYPE_HEADING_6_DESCRIPTION,
  BLOCK_TYPE_NUMBERED_LIST,
  BLOCK_TYPE_NUMBERED_LIST_DESCRIPTION,
  BLOCK_TYPE_QUOTE,
  BLOCK_TYPE_QUOTE_DESCRIPTION,
  BLOCK_TYPE_TEXT,
  BLOCK_TYPE_TEXT_DESCRIPTION,
  BLOCK_TYPE_TODO_LIST,
  BLOCK_TYPE_TODO_LIST_DESCRIPTION,
  type ChromeWording,
} from '@labre/affine-shared/services';
import type { TemplateResult } from 'lit';

/**
 * Text primitive entries used in slash menu and format bar,
 * which are also used for registering hotkeys for converting block flavours.
 *
 * `nameWording` / `descriptionWording` mirror the "static config rendered by
 * a widget" pattern (`packages/affine/shared/src/services/translation-service/README.md`):
 * this file has no `std` of its own — it is data, not a component — so the
 * WORDS are declared once in `chrome.ts`'s "Block types" section (shared with
 * `blocks/note` / `blocks/paragraph` / `blocks/list` / `widgets/slash-menu`,
 * a different lot) and the widget that renders an entry resolves the sibling
 * field with `translateKey` at render, the same way the slash menu resolves
 * its own `nameWording`. The English `name` / `description` stay the
 * identity and fallback.
 */
export interface TextConversionConfig {
  flavour: string;
  type?: string;
  name: string;
  description?: string;
  hotkey: string[] | null;
  icon: TemplateResult<1>;
  nameWording?: ChromeWording;
  descriptionWording?: ChromeWording;
}

export const textConversionConfigs: TextConversionConfig[] = [
  {
    flavour: 'affine:paragraph',
    type: 'text',
    name: 'Text',
    description: 'Start typing with plain text.',
    hotkey: [`Mod-Alt-0`, `Mod-Shift-0`],
    icon: TextIcon,
    nameWording: BLOCK_TYPE_TEXT,
    descriptionWording: BLOCK_TYPE_TEXT_DESCRIPTION,
  },
  {
    flavour: 'affine:paragraph',
    type: 'h1',
    name: 'Heading 1',
    description: 'Headings in the largest font.',
    hotkey: [`Mod-Alt-1`, `Mod-Shift-1`],
    icon: Heading1Icon,
    nameWording: BLOCK_TYPE_HEADING_1,
    descriptionWording: BLOCK_TYPE_HEADING_1_DESCRIPTION,
  },
  {
    flavour: 'affine:paragraph',
    type: 'h2',
    name: 'Heading 2',
    description: 'Headings in the 2nd font size.',
    hotkey: [`Mod-Alt-2`, `Mod-Shift-2`],
    icon: Heading2Icon,
    nameWording: BLOCK_TYPE_HEADING_2,
    descriptionWording: BLOCK_TYPE_HEADING_2_DESCRIPTION,
  },
  {
    flavour: 'affine:paragraph',
    type: 'h3',
    name: 'Heading 3',
    description: 'Headings in the 3rd font size.',
    hotkey: [`Mod-Alt-3`, `Mod-Shift-3`],
    icon: Heading3Icon,
    nameWording: BLOCK_TYPE_HEADING_3,
    descriptionWording: BLOCK_TYPE_HEADING_3_DESCRIPTION,
  },
  {
    flavour: 'affine:paragraph',
    type: 'h4',
    name: 'Heading 4',
    description: 'Headings in the 4th font size.',
    hotkey: [`Mod-Alt-4`, `Mod-Shift-4`],
    icon: Heading4Icon,
    nameWording: BLOCK_TYPE_HEADING_4,
    descriptionWording: BLOCK_TYPE_HEADING_4_DESCRIPTION,
  },
  {
    flavour: 'affine:paragraph',
    type: 'h5',
    name: 'Heading 5',
    description: 'Headings in the 5th font size.',
    hotkey: [`Mod-Alt-5`, `Mod-Shift-5`],
    icon: Heading5Icon,
    nameWording: BLOCK_TYPE_HEADING_5,
    descriptionWording: BLOCK_TYPE_HEADING_5_DESCRIPTION,
  },
  {
    flavour: 'affine:paragraph',
    type: 'h6',
    name: 'Heading 6',
    description: 'Headings in the 6th font size.',
    hotkey: [`Mod-Alt-6`, `Mod-Shift-6`],
    icon: Heading6Icon,
    nameWording: BLOCK_TYPE_HEADING_6,
    descriptionWording: BLOCK_TYPE_HEADING_6_DESCRIPTION,
  },
  {
    flavour: 'affine:list',
    type: 'bulleted',
    name: 'Bulleted List',
    description: 'Create a bulleted list.',
    hotkey: [`Mod-Alt-8`, `Mod-Shift-8`],
    icon: BulletedListIcon,
    nameWording: BLOCK_TYPE_BULLETED_LIST,
    descriptionWording: BLOCK_TYPE_BULLETED_LIST_DESCRIPTION,
  },
  {
    flavour: 'affine:list',
    type: 'numbered',
    name: 'Numbered List',
    description: 'Create a numbered list.',
    hotkey: [`Mod-Alt-9`, `Mod-Shift-9`],
    icon: NumberedListIcon,
    nameWording: BLOCK_TYPE_NUMBERED_LIST,
    descriptionWording: BLOCK_TYPE_NUMBERED_LIST_DESCRIPTION,
  },
  {
    flavour: 'affine:list',
    type: 'todo',
    name: 'To-do List',
    description: 'Add tasks to a to-do list.',
    hotkey: null,
    icon: CheckBoxIcon,
    nameWording: BLOCK_TYPE_TODO_LIST,
    descriptionWording: BLOCK_TYPE_TODO_LIST_DESCRIPTION,
  },
  {
    flavour: 'affine:code',
    type: undefined,
    name: 'Code Block',
    description: 'Code snippet with formatting.',
    hotkey: [`Mod-Alt-c`],
    icon: CodeBlockIcon,
    nameWording: BLOCK_TYPE_CODE_BLOCK,
    descriptionWording: BLOCK_TYPE_CODE_BLOCK_DESCRIPTION,
  },
  {
    flavour: 'affine:paragraph',
    type: 'quote',
    name: 'Quote',
    description: 'Add a blockquote for emphasis.',
    hotkey: null,
    icon: QuoteIcon,
    nameWording: BLOCK_TYPE_QUOTE,
    descriptionWording: BLOCK_TYPE_QUOTE_DESCRIPTION,
  },
  {
    flavour: 'affine:divider',
    type: 'divider',
    name: 'Divider',
    description: 'Visually separate content.',
    hotkey: [`Mod-Alt-d`, `Mod-Shift-d`],
    icon: DividerIcon,
    nameWording: BLOCK_TYPE_DIVIDER,
    descriptionWording: BLOCK_TYPE_DIVIDER_DESCRIPTION,
  },
];
