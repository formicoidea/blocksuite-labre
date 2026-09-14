import type { SerializedXYWH } from '@labre/global/gfx';
import { field } from '@labre/std/gfx';

import type { FrameworkBackgroundProps } from '../framework-background/index.js';
import { FrameworkBackgroundElementModel } from '../framework-background/index.js';

export type UmlSubjectProps = FrameworkBackgroundProps & {
  /** The subject name, written top-left — edited inline on dblclick. */
  name?: string;
};

/**
 * A UML use case SUBJECT: the system boundary of UML 2.5.1 §18.1.4 — the plain
 * rectangle drawn around the use cases a system offers, with its name written
 * top-left and the actors left outside it.
 *
 * A framework background, so use cases are dropped on it and connectors never
 * snap to it — but a TRANSPARENT one, like {@link C4BoundaryElementModel} and
 * for the same reason: a subject is drawn over the diagram frame it sits on,
 * and an opaque card would hide the use cases it encloses. Containment is
 * visual only; membership, as for every board in the library, is computed from
 * geometry at read time (R11).
 *
 * ## Why no variant, and no compartments
 *
 * The notation gives it none. §18.1.4 draws one rectangle with one name — there
 * is no dashed flavour, no keyword line and no second tier — so, unlike a C4
 * boundary (which draws system and container identically and tells them apart
 * by the label), there is nothing here for a discriminant to discriminate. A
 * field with one possible value is a field that can only ever go stale.
 *
 * What it LOOKS like is declared, not coded: see `UML_SUBJECT_BACKGROUND` in
 * `@labre/affine-gfx-uml`.
 */
export class UmlSubjectElementModel extends FrameworkBackgroundElementModel<UmlSubjectProps> {
  get type() {
    return 'umlSubject';
  }

  @field('Subject')
  accessor name: string = 'Subject';

  @field(true)
  accessor resizeEnabled: boolean = true;

  @field(0)
  accessor rotate: number = 0;

  @field()
  accessor xywh: SerializedXYWH = '[0,0,520,360]';
}
