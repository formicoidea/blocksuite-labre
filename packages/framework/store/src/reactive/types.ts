import type { Array as YArray, Map as YMap } from 'yjs';

import type { ReleaseScope } from './release-scope.js';

export type UnRecord = Record<string, unknown>;

export type Native2Y<T> =
  T extends Record<string, infer U>
    ? YMap<U>
    : T extends Array<infer U>
      ? YArray<U>
      : T;

export type TransformOptions = {
  deep?: boolean;
  transform?: (value: unknown, origin: unknown) => unknown;
};

export type ProxyOptions<T> = {
  onChange?: (data: T, isLocal: boolean) => void;
  /**
   * @internal
   * The block scope the proxy belongs to: its registry, and the handle a
   * store release detaches (ADR 0057). Omitted, the module-level registry.
   */
  scope?: ReleaseScope;
};
