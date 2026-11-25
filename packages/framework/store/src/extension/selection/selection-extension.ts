import { BlockSuiteError, ErrorCode } from '@labre/global/exceptions';
import { computed, signal } from '@preact/signals-core';
import { Subject } from 'rxjs';

import { nanoid } from '../../utils/id-generator';
import type { StackItem } from '../../yjs';
import { StoreExtension } from '../store-extension';
import type { BaseSelection } from './base';
import { SelectionIdentifier } from './identifier';
import type { SelectionConstructor } from './types';

export class StoreSelectionExtension extends StoreExtension {
  static override readonly key = 'selection';

  private readonly _id = `${this.store.id}:${nanoid()}`;
  private _selectionConstructors: Record<string, SelectionConstructor> = {};
  private readonly _selections = signal<BaseSelection[]>([]);
  private readonly _remoteSelections = signal<Map<number, BaseSelection[]>>(
    new Map()
  );

  private readonly _itemAdded = (event: { stackItem: StackItem }) => {
    event.stackItem.meta.set('selection-state', this._selections.value);
  };

  private readonly _itemPopped = (event: { stackItem: StackItem }) => {
    const selection = event.stackItem.meta.get('selection-state');
    if (selection) {
      this.set(selection as BaseSelection[]);
    }
  };

  private readonly _jsonToSelection = (json: Record<string, unknown>) => {
    const ctor = this._selectionConstructors[json.type as string];
    if (!ctor) {
      throw new BlockSuiteError(
        ErrorCode.SelectionError,
        `Unknown selection type: ${json.type}`
      );
    }
    return ctor.fromJSON(json);
  };

  slots = {
    changed: new Subject<BaseSelection[]>(),
    remoteChanged: new Subject<Map<number, BaseSelection[]>>(),
  };

  override loaded() {
    this.store.provider.getAll(SelectionIdentifier).forEach(ctor => {
      [ctor].flat().forEach(ctor => {
        this._selectionConstructors[ctor.type] = ctor;
      });
    });

    // One handler, kept as a field: `load()` runs `loaded()` again, and the
    // awareness outlives the store, so an inline closure added here was one
    // more listener per load that nothing removed, each holding the store
    // (#746, ADR 0057). The awareness dedupes the same function.
    this.store.awarenessStore.awareness.on('change', this._onAwarenessChange);

    this.store.history.undoManager.on('stack-item-added', this._itemAdded);
    this.store.history.undoManager.on('stack-item-popped', this._itemPopped);
  }

  private readonly _onAwarenessChange = (change: {
    updated: number[];
    added: number[];
    removed: number[];
  }) => {
    const all = change.updated.concat(change.added).concat(change.removed);
    const localClientID = this.store.awarenessStore.awareness.clientID;
    const exceptLocal = all.filter(id => id !== localClientID);

    // Only consider remote selections from other clients
    if (exceptLocal.length > 0) {
      const map = new Map<number, BaseSelection[]>();
      this.store.awarenessStore.getStates().forEach((state, id) => {
        if (id === this.store.awarenessStore.awareness.clientID) return;
        // selection id starts with the same block collection id from others clients would be considered as remote selections
        const selection = Object.entries(state.selectionV2)
          .filter(([key]) => key.startsWith(this.store.id))
          .flatMap(([_, selection]) => selection);

        const selections = selection
          .map(json => {
            try {
              return this._jsonToSelection(json);
            } catch (error) {
              console.error('Parse remote selection failed:', id, json, error);
              return null;
            }
          })
          .filter((sel): sel is BaseSelection => !!sel);

        map.set(id, selections);
      });
      this._remoteSelections.value = map;
      this.slots.remoteChanged.next(map);
    }
  };

  override disposed() {
    super.disposed();
    this.store.awarenessStore.awareness.off('change', this._onAwarenessChange);
    this.store.history.undoManager.off('stack-item-added', this._itemAdded);
    this.store.history.undoManager.off('stack-item-popped', this._itemPopped);
    this._removeLocalSelection();
  }

  /**
   * Take this store's entry out of the local `selectionV2`: peers stop
   * seeing this client's selection in a document it closed, and the
   * awareness state stops growing by one key per store opened (ADR 0057).
   * Ephemeral presence, not the document: nothing is written to Yjs. An
   * absent key (no selection was ever set, or the awareness is destroyed)
   * changes nothing.
   */
  private _removeLocalSelection() {
    const awareness = this.store.awarenessStore;
    const selections = awareness.getLocalState()?.selectionV2;
    if (!selections || !(this._id in selections)) return;
    const { [this._id]: _, ...rest } = selections;
    awareness.setLocalStateField('selectionV2', rest);
  }

  get value() {
    return this._selections.value;
  }

  get remoteSelections() {
    return this._remoteSelections.value;
  }

  clear(types?: string[]) {
    if (types) {
      const values = this.value.filter(
        selection => !types.includes(selection.type)
      );
      this.set(values);
    } else {
      this.set([]);
    }
  }

  create<T extends SelectionConstructor>(
    Type: T,
    ...args: ConstructorParameters<T>
  ): InstanceType<T> {
    return new Type(...args) as InstanceType<T>;
  }

  getGroup(group: string) {
    return this.value.filter(s => s.group === group);
  }

  filter<T extends SelectionConstructor>(type: T) {
    return this.filter$(type).value;
  }

  filter$<T extends SelectionConstructor>(type: T) {
    return computed(() =>
      this.value.filter((sel): sel is InstanceType<T> => sel.is(type))
    );
  }

  find<T extends SelectionConstructor>(type: T) {
    return this.find$(type).value;
  }

  find$<T extends SelectionConstructor>(type: T) {
    return computed(() =>
      this.value.find((sel): sel is InstanceType<T> => sel.is(type))
    );
  }

  set(selections: BaseSelection[]) {
    this.store.awarenessStore.setLocalSelection(
      this._id,
      selections.map(s => s.toJSON())
    );
    this._selections.value = selections;
    this.slots.changed.next(selections);
  }

  setGroup(group: string, selections: BaseSelection[]) {
    const current = this.value.filter(s => s.group !== group);
    this.set([...current, ...selections]);
  }

  // This method is used to clear **current editor's remote selections**
  // When the editor is not active, the remote selections should be cleared
  // So other editors won't see the remote selections from this editor
  clearRemote() {
    this.store.awarenessStore.setLocalSelection(this._id, []);
  }

  update(fn: (currentSelections: BaseSelection[]) => BaseSelection[]) {
    const selections = fn(this.value);
    this.set(selections);
  }

  fromJSON(json: Record<string, unknown>[]) {
    const selections = json.map(json => {
      return this._jsonToSelection(json);
    });
    return this.set(selections);
  }
}
