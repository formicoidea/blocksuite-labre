import type { SurfaceElementModelMap } from '@labre/affine-model';
import { EditPropsStore } from '@labre/affine-shared/services';
import { type Container, createIdentifier } from '@labre/global/di';
import { type BlockStdScope, StdIdentifier } from '@labre/std';
import {
  GfxBlockElementModel,
  GfxControllerIdentifier,
  type GfxModel,
  isGfxGroupCompatibleModel,
} from '@labre/std/gfx';
import { type BlockModel, Extension } from '@labre/store';

import type { SurfaceBlockModel } from '../surface-model';
import { getLastPropsKey } from '../utils/get-last-props-key';
import { isConnectable, isNoteBlock } from './query';

export const EdgelessCRUDIdentifier = createIdentifier<EdgelessCRUDExtension>(
  'AffineEdgelessCrudService'
);

export class EdgelessCRUDExtension extends Extension {
  constructor(readonly std: BlockStdScope) {
    super();
  }

  static override setup(di: Container) {
    di.add(this, [StdIdentifier]);
    di.addImpl(EdgelessCRUDIdentifier, provider => provider.get(this));
  }

  private get _gfx() {
    return this.std.get(GfxControllerIdentifier);
  }

  private get _surface() {
    return this._gfx.surface as SurfaceBlockModel | null;
  }

  /**
   * `SurfaceBlockModel` already REFUSES element writes on a readonly document —
   * it throws (`Cannot add / remove / update element in readonly mode`). This
   * guard does not plug a hole: it turns those throws into a quiet refusal at
   * the layer callers actually use, which is what the store's block CRUD does
   * (`updateBlock` / `deleteBlock` / `moveBlocks` all `console.error` and
   * return). Hence the log — a silent `return` would be the only refusal in the
   * repo with no signal at all.
   *
   * Callers that consume the return value all test it (`clipboard/canvas.ts`,
   * `group-api.ts`, `shape-draggable.ts` guard on `if (!id) return`), so
   * `addElement` returning `undefined` introduces no new dereference.
   */
  private _refuseOnReadonly(action: string) {
    if (!this.std.store.readonly) return false;
    console.error(`cannot ${action} in readonly mode`);
    return true;
  }

  deleteElements = (elements: GfxModel[]) => {
    if (this._refuseOnReadonly('delete elements')) return;
    const surface = this._surface;
    if (!surface) {
      console.error('surface is not initialized');
      return;
    }

    const gfx = this.std.get(GfxControllerIdentifier);
    const set = new Set(elements);
    elements.forEach(element => {
      if (isConnectable(element)) {
        const connectors = surface.getConnectors(element.id);
        connectors.forEach(connector => set.add(connector));
      }
    });

    set.forEach(element => {
      if (isNoteBlock(element)) {
        const children = gfx.doc.root?.children ?? [];
        if (children.length > 1) {
          gfx.doc.deleteBlock(element);
        }
      } else {
        gfx.deleteElement(element.id);
      }
    });
  };

  addBlock = (
    flavour: string,
    props: Record<string, unknown>,
    parentId?: string | BlockModel,
    parentIndex?: number
  ) => {
    const gfx = this.std.get(GfxControllerIdentifier);
    const key = getLastPropsKey(flavour, props);
    if (key) {
      props = this.std.get(EditPropsStore).applyLastProps(key, props);
    }

    const nProps = {
      ...props,
      index: gfx.layer.generateIndex(),
    };

    return this.std.store.addBlock(
      flavour as never,
      nProps,
      parentId,
      parentIndex
    );
  };

  addElement = <T extends Record<string, unknown>>(type: string, props: T) => {
    if (this._refuseOnReadonly('add an element')) return;
    const surface = this._surface;
    if (!surface) {
      console.error('surface is not initialized');
      return;
    }

    const gfx = this.std.get(GfxControllerIdentifier);
    const key = getLastPropsKey(type, props);
    if (key) {
      props = this.std.get(EditPropsStore).applyLastProps(key, props) as T;
    }

    const nProps = {
      ...props,
      type,
      index: props.index ?? gfx.layer.generateIndex(),
    };

    return surface.addElement(nProps);
  };

  updateElement = (id: string, props: Record<string, unknown>) => {
    if (this._refuseOnReadonly('update an element')) return;
    const surface = this._surface;
    if (!surface) {
      console.error('surface is not initialized');
      return;
    }

    const element = this._surface.getElementById(id);
    if (element) {
      const merged = { ...element.yMap.toJSON(), ...props };
      const key = getLastPropsKey(element.type, merged);
      // A role-carrying framework artefact (a BPMN message flow, a C4
      // relationship…) must not teach the shared last-props its costume:
      // last-props are keyed by TYPE, and the next plain element of that type
      // would draw dressed as the framework (sibling of review #144 M1). A
      // plain element restyling still records, as it should.
      if (key && merged.role === undefined) {
        this.std.get(EditPropsStore).recordLastProps(key, props);
      }
      this._surface.updateElement(id, props);
      return;
    }

    const block = this.std.store.getModelById(id);
    if (block) {
      const key = getLastPropsKey(block.flavour, {
        ...block.yBlock.toJSON(),
        ...props,
      });
      key && this.std.get(EditPropsStore).recordLastProps(key, props);
      this.std.store.updateBlock(block, props);
    }
  };

  getElementById(id: string): GfxModel | null {
    const surface = this._surface;
    if (!surface) {
      return null;
    }
    const el = surface.getElementById(id) ?? this.std.store.getModelById(id);
    return el as GfxModel | null;
  }

  getElementsByType<K extends keyof SurfaceElementModelMap>(
    type: K
  ): SurfaceElementModelMap[K][] {
    if (!this._surface) {
      return [];
    }
    return this._surface.getElementsByType(type);
  }

  removeElement(id: string | GfxModel) {
    if (this._refuseOnReadonly('remove an element')) return;
    id = typeof id === 'string' ? id : id.id;

    const el = this.getElementById(id);
    if (isGfxGroupCompatibleModel(el)) {
      el.childIds.forEach(childId => {
        this.removeElement(childId);
      });
    }

    if (el instanceof GfxBlockElementModel) {
      this.std.store.deleteBlock(el);
      return;
    }

    if (this._surface?.hasElementById(id)) {
      this._surface.deleteElement(id);
      return;
    }
  }
}
