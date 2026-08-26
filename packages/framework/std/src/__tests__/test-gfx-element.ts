import { Bound, type SerializedXYWH } from '@labre/global/gfx';
import * as Y from 'yjs';

import {
  type BaseElementProps,
  canSafeAddToContainer,
  convert,
  derive,
  field,
  GfxGroupLikeElementModel,
  GfxLocalElementModel,
  type GfxModel,
  GfxPrimitiveElementModel,
  observe,
} from '../gfx/index.js';

export class TestShapeElement extends GfxPrimitiveElementModel {
  get type() {
    return 'testShape';
  }

  @field()
  accessor rotate: number = 0;

  @field()
  accessor xywh: SerializedXYWH = '[0,0,10,10]';

  @convert(val => {
    if (['rect', 'triangle'].includes(val)) {
      return val;
    }

    return 'rect';
  })
  @derive(val => {
    if (val === 'triangle') {
      return {
        rotate: 0,
      };
    }

    return {};
  })
  @field()
  accessor shapeType: 'rect' | 'triangle' = 'rect';
}

/**
 * A shape whose bound is NOT only its `xywh`: `padding` inflates it, the way
 * our polygon shape folds its vertices in and our connector its label. Used to
 * check that the group bound cache still follows such a prop.
 */
export class TestPaddedElement extends GfxPrimitiveElementModel {
  get type() {
    return 'testPadded';
  }

  override get elementBound() {
    return super.elementBound.expand(this.padding);
  }

  @field()
  accessor rotate: number = 0;

  @field()
  accessor xywh: SerializedXYWH = '[0,0,10,10]';

  @field()
  accessor padding: number = 0;
}

type TestGroupProps = BaseElementProps & {
  children: Y.Map<boolean>;
};

export class TestGroupElement extends GfxGroupLikeElementModel<TestGroupProps> {
  get rotate() {
    return 0;
  }

  set rotate(_: number) {}

  get type() {
    return 'testGroup';
  }

  static propsToY(props: Record<string, unknown>) {
    if (props.children && !(props.children instanceof Y.Map)) {
      const children = new Y.Map<boolean>();

      Object.keys(props.children).forEach(key => {
        children.set(key, true);
      });

      props.children = children;
    }

    return props;
  }

  override addChild(element: GfxModel) {
    if (!canSafeAddToContainer(this, element)) {
      return;
    }

    this.surface.store.transact(() => {
      this.children.set(element.id, true);
    });
  }

  override containsBound(bound: Bound): boolean {
    return bound.contains(Bound.deserialize(this.xywh));
  }

  override removeChild(element: GfxModel) {
    if (!this.children) {
      return;
    }

    this.surface.store.transact(() => {
      this.children.delete(element.id);
    });
  }

  @observe(
    (_, instance: GfxGroupLikeElementModel<TestGroupProps>, transaction) => {
      if (instance.children.doc) {
        instance.setChildIds(
          Array.from(instance.children.keys()),
          transaction?.local ?? false
        );
      }
    }
  )
  @field()
  accessor children: Y.Map<boolean> = new Y.Map<boolean>();
}

export class TestLocalElement extends GfxLocalElementModel {
  override type: string = 'testLocal';
}
