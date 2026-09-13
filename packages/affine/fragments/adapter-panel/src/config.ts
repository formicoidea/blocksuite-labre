import {
  translateKey,
  type ChromeWording,
} from '@labre/affine-shared/services';
import type { BlockStdScope } from '@labre/std';
import type { DocSnapshot } from '@labre/store';
import { createContext } from '@lit/context';
import type { Signal } from '@preact/signals-core';

import {
  ADAPTER_FORMAT_HTML,
  ADAPTER_FORMAT_MARKDOWN,
  ADAPTER_FORMAT_PLAINTEXT,
  ADAPTER_FORMAT_SNAPSHOT,
} from './translations';

export type AdapterItem = {
  id: string;
  label: string;
  labelWording: ChromeWording;
};

export const ADAPTERS: AdapterItem[] = [
  {
    id: 'markdown',
    label: 'Markdown',
    labelWording: ADAPTER_FORMAT_MARKDOWN,
  },
  {
    id: 'plaintext',
    label: 'PlainText',
    labelWording: ADAPTER_FORMAT_PLAINTEXT,
  },
  { id: 'html', label: 'HTML', labelWording: ADAPTER_FORMAT_HTML },
  { id: 'snapshot', label: 'Snapshot', labelWording: ADAPTER_FORMAT_SNAPSHOT },
];

export type AdapterPanelContext = {
  activeAdapter$: Signal<AdapterItem>;
  isHtmlPreview$: Signal<boolean>;
  docSnapshot$: Signal<DocSnapshot | null>;
  htmlContent$: Signal<string>;
  markdownContent$: Signal<string>;
  plainTextContent$: Signal<string>;
  /**
   * The editor's std scope, when the host mounts this debug panel inside an
   * editor rather than standalone against a bare `store` — resolves the
   * wordings above through the translation seam. Optional: a host that
   * mounts this panel with only a `store` (as the playground's debug tool
   * does today) keeps the English literal, exactly as before this existed.
   */
  std?: BlockStdScope;
};

export const adapterPanelContext = createContext<AdapterPanelContext>(
  'adapterPanelContext'
);

/** `translateKey(std, ...wording)` when `std` is available, else the literal. */
export function adapterPanelLabel(
  std: BlockStdScope | undefined,
  wording: ChromeWording
): string {
  return std ? translateKey(std, ...wording) : wording[1];
}
