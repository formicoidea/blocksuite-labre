import { translateKey } from '@labre/affine-shared/services';
import type { Disposable } from '@labre/global/disposable';
import type { BlockStdScope } from '@labre/std';
import type { BlobEngine, BlobState } from '@labre/sync';
import {
  computed,
  effect,
  type ReadonlySignal,
  signal,
  untracked,
} from '@preact/signals-core';
import type { TemplateResult } from 'lit-html';

import {
  RESOURCE_NOT_FOUND_WORDINGS,
  RESOURCE_RETRIEVE_FAILED_WORDINGS,
} from '../translations.js';

export type ResourceKind = 'Blob' | 'File' | 'Image';

export type StateKind =
  | 'loading'
  | 'uploading'
  | 'error'
  | 'error:oversize'
  | 'none';

export type StateInfo = {
  icon: TemplateResult;
  title?: string;
  description?: string | null;
};

export type ResolvedStateInfoPart = {
  loading: boolean;
  error: boolean;
  state: StateKind;
  url: string | null;
  needUpload: boolean;
};

export type ResolvedStateInfo = StateInfo & ResolvedStateInfoPart;

export class ResourceController implements Disposable {
  readonly blobUrl$ = signal<string | null>(null);

  // TODO(@fundon): default `loading` status.
  readonly state$ = signal<Partial<BlobState>>({});

  readonly resolvedState$ = computed<ResolvedStateInfoPart>(() => {
    const url = this.blobUrl$.value;
    const {
      needUpload = false,
      uploading = false,
      downloading = false,
      overSize = false,
      errorMessage,
    } = this.state$.value;
    const hasExceeded = overSize;
    const hasError = hasExceeded || Boolean(errorMessage);
    const state = this.determineState(
      hasExceeded,
      hasError,
      uploading,
      downloading
    );

    const loading = state === 'uploading' || state === 'loading';

    return {
      error: hasError,
      needUpload,
      loading,
      state,
      url,
    };
  });

  private engine?: BlobEngine;

  constructor(
    readonly blobId$: ReadonlySignal<string | undefined>,
    readonly kind: ResourceKind = 'File',
    /**
     * Optional: lets `blob()`'s error messages resolve through a host's
     * catalogue. Absent (the common case: most callers construct this
     * controller outside any rendered component), the English fallback shows
     * exactly as before.
     */
    readonly std?: BlockStdScope
  ) {}

  // This is a tradeoff, initializing `Blob Sync Engine`.
  setEngine(engine: BlobEngine) {
    this.engine = engine;
    return this;
  }

  determineState(
    hasExceeded: boolean,
    hasError: boolean,
    uploading: boolean,
    downloading: boolean
  ): StateKind {
    if (hasExceeded) return 'error:oversize';
    if (hasError) return 'error';
    if (uploading) return 'uploading';
    if (downloading) return 'loading';
    return 'none';
  }

  resolveStateWith(
    info: {
      loadingIcon: TemplateResult;
      errorIcon?: TemplateResult;
    } & StateInfo
  ): ResolvedStateInfo {
    const { error, loading, state, url, needUpload } =
      this.resolvedState$.value;

    const { icon, title, description, loadingIcon, errorIcon } = info;

    const result = {
      error,
      loading,
      state,
      icon,
      title,
      description,
      url,
      needUpload,
    };

    if (loading) {
      result.icon = loadingIcon ?? icon;
    } else if (error) {
      result.icon = errorIcon ?? icon;
      result.description = this.state$.value.errorMessage ?? description;
    }

    return result;
  }

  updateState(state: Partial<BlobState>) {
    // `peek()`, never `.value`: merging must not subscribe whatever effect
    // happens to be running to `state$`, otherwise the write below re-runs
    // that effect, which writes again — see `subscribe()` and issue #319.
    this.state$.value = { ...this.state$.peek(), ...state };
  }

  // The explicit return type keeps declaration emit off signals-core's
  // `DisposeFn`, whose `[Symbol.dispose]` member tsc cannot serialize.
  subscribe(): () => void {
    return effect(() => {
      // Only the blob id is tracked: a new id re-runs the effect, nothing else
      // does. The subscription body stays `untracked` because a host whose
      // `blobState$` replays on subscribe (a `BehaviorSubject`) writes `state$`
      // synchronously from inside this very effect; tracked, that write would
      // re-run the effect, re-subscribe, replay, write again — until
      // signals-core gives up with `Cycle detected` (issue #319).
      const blobId = this.blobId$.value;
      if (!blobId) return;

      return untracked(() => {
        const blobState$ = this.engine?.blobState$(blobId);
        if (!blobState$) return;

        const subscription = blobState$.subscribe(state => {
          let { uploading, downloading, errorMessage } = state;
          if (state.overSize) {
            uploading = false;
            downloading = false;
          } else if ((uploading || downloading) && errorMessage) {
            errorMessage = null;
          }

          // A later emission can land while some unrelated effect is being
          // evaluated; it must not become a dependency of that effect either.
          untracked(() =>
            this.updateState({ ...state, uploading, downloading, errorMessage })
          );
        });

        return () => subscription.unsubscribe();
      });
    });
  }

  async blob() {
    const blobId = this.blobId$.peek();
    if (!blobId) return null;

    let blob: Blob | null = null;
    let errorMessage: string | null = null;

    try {
      if (!this.engine) {
        throw new Error('Blob engine is not initialized');
      }

      blob = (await this.engine.get(blobId)) ?? null;

      if (!blob) {
        const wording = RESOURCE_NOT_FOUND_WORDINGS[this.kind];
        errorMessage = this.std
          ? translateKey(this.std, ...wording)
          : wording[1];
      }
    } catch (err) {
      console.error(err);
      const wording = RESOURCE_RETRIEVE_FAILED_WORDINGS[this.kind];
      errorMessage = this.std ? translateKey(this.std, ...wording) : wording[1];
    }

    if (errorMessage) this.updateState({ errorMessage });

    return blob;
  }

  async createUrlWith(type?: string) {
    let blob = await this.blob();
    if (!blob) return null;

    if (type) blob = new Blob([blob], { type });

    return URL.createObjectURL(blob);
  }

  async refreshUrlWith(type?: string) {
    // Resets the state.
    this.state$.value = {};

    const url = await this.createUrlWith(type);
    if (!url) return;

    const prevUrl = this.blobUrl$.peek();

    this.blobUrl$.value = url;

    if (!prevUrl) return;

    // Releases the previous url.
    URL.revokeObjectURL(prevUrl);
  }

  // Re-upload to the server.
  async upload() {
    const blobId = this.blobId$.peek();
    if (!blobId) return;

    const state = this.state$.peek();
    if (!state.needUpload) return;
    if (state.uploading) return;

    // Resets the state.
    this.state$.value = {};

    return await this.engine?.upload(blobId);
  }

  dispose() {
    const url = this.blobUrl$.peek();
    if (!url) return;

    // Releases the current url.
    URL.revokeObjectURL(url);
  }
}
