import {
  BulletedListIcon,
  CheckBoxIcon,
  CodeBlockIcon,
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
  BLOCK_NAME_BULLETED_LIST,
  BLOCK_NAME_CODE_BLOCK,
  BLOCK_NAME_HEADING_1,
  BLOCK_NAME_HEADING_2,
  BLOCK_NAME_HEADING_3,
  BLOCK_NAME_HEADING_4,
  BLOCK_NAME_HEADING_5,
  BLOCK_NAME_HEADING_6,
  BLOCK_NAME_NUMBERED_LIST,
  BLOCK_NAME_QUOTE,
  BLOCK_NAME_TEXT,
  BLOCK_NAME_TODO_LIST,
  type ChromeWording,
} from '@labre/affine-shared/services';
import type { NoteChildrenFlavour } from '@labre/affine-shared/types';
import type { TemplateResult } from 'lit';

export const BUTTON_GROUP_LENGTH = 10;

export type NoteMenuItem = {
  icon: TemplateResult<1>;
  tooltipWording: ChromeWording;
  childFlavour: NoteChildrenFlavour;
  childType: string | null;
};

/**
 * The "add to note" quick-tool row's own items — text, then every heading,
 * then the code/quote blocks, then the three list kinds. Deliberately NOT
 * "Divider": the original menu built it and then filtered it back out
 * (`item.name !== 'Divider'`), so it never actually reached the row; this
 * table just never adds it, which is why there is no `BLOCK_NAME_DIVIDER`
 * entry below.
 */
const MENU_ITEM_SOURCE: {
  flavour: string;
  type: string | null;
  icon: TemplateResult<1>;
  wording: ChromeWording;
}[] = [
  {
    flavour: 'affine:paragraph',
    type: 'text',
    icon: TextIcon,
    wording: BLOCK_NAME_TEXT,
  },
  {
    flavour: 'affine:paragraph',
    type: 'h1',
    icon: Heading1Icon,
    wording: BLOCK_NAME_HEADING_1,
  },
  {
    flavour: 'affine:paragraph',
    type: 'h2',
    icon: Heading2Icon,
    wording: BLOCK_NAME_HEADING_2,
  },
  {
    flavour: 'affine:paragraph',
    type: 'h3',
    icon: Heading3Icon,
    wording: BLOCK_NAME_HEADING_3,
  },
  {
    flavour: 'affine:paragraph',
    type: 'h4',
    icon: Heading4Icon,
    wording: BLOCK_NAME_HEADING_4,
  },
  {
    flavour: 'affine:paragraph',
    type: 'h5',
    icon: Heading5Icon,
    wording: BLOCK_NAME_HEADING_5,
  },
  {
    flavour: 'affine:paragraph',
    type: 'h6',
    icon: Heading6Icon,
    wording: BLOCK_NAME_HEADING_6,
  },
  {
    flavour: 'affine:code',
    type: 'code',
    icon: CodeBlockIcon,
    wording: BLOCK_NAME_CODE_BLOCK,
  },
  {
    flavour: 'affine:paragraph',
    type: 'quote',
    icon: QuoteIcon,
    wording: BLOCK_NAME_QUOTE,
  },
  {
    flavour: 'affine:list',
    type: 'bulleted',
    icon: BulletedListIcon,
    wording: BLOCK_NAME_BULLETED_LIST,
  },
  {
    flavour: 'affine:list',
    type: 'numbered',
    icon: NumberedListIcon,
    wording: BLOCK_NAME_NUMBERED_LIST,
  },
  {
    flavour: 'affine:list',
    type: 'todo',
    icon: CheckBoxIcon,
    wording: BLOCK_NAME_TODO_LIST,
  },
];

// TODO: add image, bookmark, database blocks
export const NOTE_MENU_ITEMS: NoteMenuItem[] = MENU_ITEM_SOURCE.map(item => ({
  icon: item.icon,
  tooltipWording: item.wording,
  childFlavour: item.flavour as NoteChildrenFlavour,
  childType: item.type,
}));
