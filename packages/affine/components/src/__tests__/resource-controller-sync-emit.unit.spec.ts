/**
 * `ResourceController.subscribe()` against a host whose `blobState$` emits
 * synchronously on subscribe (a `BehaviorSubject`, exactly what the playground
 * mock server and the labreapp blob engine hand back).
 *
 * Regression guard for issue #319: the subscription used to run inside an
 * `effect(...)` whose body ended up writing — and, worse, *reading* — the
 * `state$` signal. The read registered `state$` as a dependency of that very
 * effect, so every write re-ran the effect, which re-subscribed, which made
 * the `BehaviorSubject` replay its value, which wrote a brand-new object
 * again: signals-core stopped the runaway after 100 batch iterations with
 * `Cycle detected`.
 */
import type { BlobEngine, BlobState } from '@labre/sync';
import { computed, effect, signal } from '@preact/signals-core';
import { BehaviorSubject, Subject } from 'rxjs';
import { describe, expect, test } from 'vitest';

import { ResourceController } from '../resource/resource.js';

const defaultState = (): BlobState => ({
  uploading: false,
  downloading: false,
  overSize: false,
  errorMessage: null,
  needUpload: false,
  needDownload: false,
});

/** A blob engine whose `blobState$` replays its current state on subscribe. */
const engineWith = (state$: BehaviorSubject<BlobState> | Subject<BlobState>) =>
  ({
    blobState$: () => state$,
    get: async () => null,
    upload: async () => true,
  }) as unknown as BlobEngine;

describe('ResourceController against a synchronously emitting blobState$', () => {
  test('subscribe() survives a BehaviorSubject replaying on subscribe', () => {
    const state$ = new BehaviorSubject<BlobState>(defaultState());
    const controller = new ResourceController(signal('blob-id')).setEngine(
      engineWith(state$)
    );

    const dispose = controller.subscribe();

    expect(controller.state$.value.errorMessage).toBeNull();

    dispose();
  });

  test('a computed reading state$ inside an effect does not close a cycle', () => {
    const state$ = new BehaviorSubject<BlobState>(defaultState());
    const controller = new ResourceController(signal('blob-id')).setEngine(
      engineWith(state$)
    );

    const label$ = computed(() =>
      controller.resolvedState$.value.error ? 'error' : 'ok'
    );

    const seen: string[] = [];
    const stopWatcher = effect(() => {
      seen.push(label$.value);
    });

    const dispose = controller.subscribe();

    expect(seen.at(-1)).toBe('ok');

    // A later push from the host still reaches the computed.
    state$.next({ ...defaultState(), errorMessage: 'Blob not found' });

    expect(seen.at(-1)).toBe('error');
    expect(controller.resolvedState$.value.state).toBe('error');

    dispose();
    stopWatcher();
  });

  test('the subscription is not re-created by its own state writes', () => {
    let subscribeCount = 0;
    const state$ = new BehaviorSubject<BlobState>(defaultState());
    const engine = {
      blobState$: () => {
        subscribeCount++;
        return state$;
      },
      get: async () => null,
      upload: async () => true,
    } as unknown as BlobEngine;

    const blobId$ = signal<string | undefined>('blob-id');
    const controller = new ResourceController(blobId$).setEngine(engine);

    const dispose = controller.subscribe();
    expect(subscribeCount).toBe(1);

    state$.next({ ...defaultState(), downloading: true });
    expect(subscribeCount).toBe(1);
    expect(controller.resolvedState$.value.loading).toBe(true);

    // Only a new blob id re-runs the effect.
    blobId$.value = 'other-blob-id';
    expect(subscribeCount).toBe(2);

    dispose();
  });

  test('the host pushing from inside a state$ subscriber does not loop', () => {
    const state$ = new BehaviorSubject<BlobState>(defaultState());
    const controller = new ResourceController(signal('blob-id')).setEngine(
      engineWith(state$)
    );

    const dispose = controller.subscribe();

    // A host that reacts to the controller's own signal write by pushing a
    // further state (the shape the production stack shows: `updateState` ->
    // `Subject.next` -> a fresh subscription).
    let pushed = false;
    const stopWatcher = effect(() => {
      const { uploading } = controller.state$.value;
      if (uploading && !pushed) {
        pushed = true;
        state$.next({ ...defaultState(), uploading: false, needUpload: true });
      }
    });

    state$.next({ ...defaultState(), uploading: true });

    expect(controller.state$.value.needUpload).toBe(true);
    expect(controller.resolvedState$.value.needUpload).toBe(true);

    dispose();
    stopWatcher();
  });
});
