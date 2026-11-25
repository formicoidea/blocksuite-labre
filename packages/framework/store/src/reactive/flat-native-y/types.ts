import type { Subject } from 'rxjs';
import type { Map as YMap } from 'yjs';

import type { ReleaseScope } from '../release-scope.js';
import type { UnRecord } from '../types';

export type OnChange = (key: string, isLocal: boolean) => void;
export type Transform = (
  key: string,
  value: unknown,
  origin: unknown
) => unknown;

export type CreateProxyOptions = {
  yMap: YMap<unknown>;
  base: UnRecord;
  root: UnRecord;
  basePath?: string;
  onChange?: OnChange;
  transform: Transform;
  onDispose: Subject<void>;
  shouldByPassSignal: () => boolean;
  shouldByPassYjs: () => boolean;
  byPassSignalUpdate: (fn: () => void) => void;
  stashed: Set<string | number>;
  initialized: () => boolean;
  /**
   * The block scope of the store (ADR 0057): a `Text` or `Boxed` written
   * through the proxy is bound to it, and released with it.
   */
  scope?: ReleaseScope;
};
