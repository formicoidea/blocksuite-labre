import {
  BoldIcon,
  CodeIcon,
  ItalicIcon,
  LinkIcon,
  StrikethroughIcon,
  UnderlineIcon,
} from '@labre/affine-components/icons';
import { toggleLink } from '@labre/affine-inline-link';
import { type ChromeWording } from '@labre/affine-shared/services';
import { type EditorHost, TextSelection } from '@labre/std';
import type { TemplateResult } from 'lit';

import {
  isTextAttributeActive,
  toggleBold,
  toggleCode,
  toggleItalic,
  toggleStrike,
  toggleUnderline,
} from './text-style.js';
import {
  TEXT_FORMAT_BOLD,
  TEXT_FORMAT_CODE,
  TEXT_FORMAT_ITALIC,
  TEXT_FORMAT_LINK,
  TEXT_FORMAT_STRIKETHROUGH,
  TEXT_FORMAT_UNDERLINE,
} from '../translations.js';

export interface TextFormatConfig {
  id: string;
  name: string;
  /** {@link name}, said as an i18n key — resolved by the widget that renders it. */
  nameWording?: ChromeWording;
  icon: TemplateResult<1>;
  hotkey?: string;
  activeWhen: (host: EditorHost) => boolean;
  action: (host: EditorHost) => void;
  textChecker?: (host: EditorHost) => boolean;
}

export const textFormatConfigs: TextFormatConfig[] = [
  {
    id: 'bold',
    name: 'Bold',
    nameWording: TEXT_FORMAT_BOLD,
    icon: BoldIcon,
    hotkey: 'Mod-b',
    activeWhen: host => {
      const [result] = host.std.command
        .chain()
        .pipe(isTextAttributeActive, { key: 'bold' })
        .run();
      return result;
    },
    action: host => {
      host.std.command.chain().pipe(toggleBold).run();
    },
  },
  {
    id: 'italic',
    name: 'Italic',
    nameWording: TEXT_FORMAT_ITALIC,
    icon: ItalicIcon,
    hotkey: 'Mod-i',
    activeWhen: host => {
      const [result] = host.std.command
        .chain()
        .pipe(isTextAttributeActive, { key: 'italic' })
        .run();
      return result;
    },
    action: host => {
      host.std.command.chain().pipe(toggleItalic).run();
    },
  },
  {
    id: 'underline',
    name: 'Underline',
    nameWording: TEXT_FORMAT_UNDERLINE,
    icon: UnderlineIcon,
    hotkey: 'Mod-u',
    activeWhen: host => {
      const [result] = host.std.command
        .chain()
        .pipe(isTextAttributeActive, { key: 'underline' })
        .run();
      return result;
    },
    action: host => {
      host.std.command.chain().pipe(toggleUnderline).run();
    },
  },
  {
    id: 'strike',
    name: 'Strikethrough',
    nameWording: TEXT_FORMAT_STRIKETHROUGH,
    icon: StrikethroughIcon,
    hotkey: 'Mod-shift-s',
    activeWhen: host => {
      const [result] = host.std.command
        .chain()
        .pipe(isTextAttributeActive, { key: 'strike' })
        .run();
      return result;
    },
    action: host => {
      host.std.command.chain().pipe(toggleStrike).run();
    },
  },
  {
    id: 'code',
    name: 'Code',
    nameWording: TEXT_FORMAT_CODE,
    icon: CodeIcon,
    hotkey: 'Mod-e',
    activeWhen: host => {
      const [result] = host.std.command
        .chain()
        .pipe(isTextAttributeActive, { key: 'code' })
        .run();
      return result;
    },
    action: host => {
      host.std.command.chain().pipe(toggleCode).run();
    },
  },
  {
    id: 'link',
    name: 'Link',
    nameWording: TEXT_FORMAT_LINK,
    icon: LinkIcon,
    hotkey: 'Mod-k',
    activeWhen: host => {
      const [result] = host.std.command
        .chain()
        .pipe(isTextAttributeActive, { key: 'link' })
        .run();
      return result;
    },
    action: host => {
      host.std.command.chain().pipe(toggleLink).run();
    },
    // should check text length
    textChecker: host => {
      const textSelection = host.std.selection.find(TextSelection);
      if (!textSelection || textSelection.isCollapsed()) return false;

      return Boolean(
        textSelection.from.length + (textSelection.to?.length ?? 0)
      );
    },
  },
];
