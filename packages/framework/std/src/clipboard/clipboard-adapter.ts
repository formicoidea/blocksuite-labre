import { createIdentifier, type ServiceProvider } from '@labre/global/di';
import type { BaseAdapter, ExtensionType, Transformer } from '@labre/store';

type AdapterConstructor = new (
  job: Transformer,
  provider: ServiceProvider
) => BaseAdapter;

/** Reads one flavour of the pasted data: a string, the files, or `''`. */
export type ClipboardItemReader = (mimeType: string) => string | File[];

export interface ClipboardAdapterConfig {
  mimeType: string;
  priority: number;
  adapter: AdapterConstructor;
  /**
   * Steps this adapter aside for one paste, so the next one by priority reads
   * it. The paste takes the first adapter that returns a slice, and an
   * adapter only sees its own flavour: it cannot know that a lower-priority
   * flavour of the same clipboard says more. `defer` reads every flavour, so
   * the trade-off lives with the config that owns it rather than in the loop.
   * Absent, the adapter is never skipped (labre P4-11: a flat `text/html`
   * copy of a Markdown table hid the `text/plain` one).
   */
  defer?: (read: ClipboardItemReader) => boolean;
}

export const ClipboardAdapterConfigIdentifier =
  createIdentifier<ClipboardAdapterConfig>('clipboard-adapter-config');

export function ClipboardAdapterConfigExtension(
  config: ClipboardAdapterConfig
): ExtensionType {
  return {
    setup: di => {
      di.addImpl(
        ClipboardAdapterConfigIdentifier(config.mimeType),
        () => config
      );
    },
  };
}
