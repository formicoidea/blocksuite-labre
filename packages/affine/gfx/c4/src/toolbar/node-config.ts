import { EditorChevronDown } from '@labre/affine-components/toolbar';
import { C4NodeElementModel } from '@labre/affine-model';
import {
  type ToolbarContext,
  type ToolbarModuleConfig,
  ToolbarModuleExtension,
  translateKey,
} from '@labre/affine-shared/services';
import { BlockFlavourIdentifier } from '@labre/std';
import { html } from 'lit';

/**
 * The selected C4 node's contextual toolbar: one "Details" popover carrying the
 * element's technology and its description.
 *
 * ## What is NOT here
 *
 * The node is a `ShapeElementModel` subclass, so the shape toolbar's own module
 * already contributes its colour and line-style entries to this very row —
 * `renderToolbar` collects the entries of every module contributing to the
 * element. Re-registering them here (the shape Wardley's `node-config.ts` takes,
 * which has to, because a Wardley node is not offered the shape row) would give
 * the user two colour pickers.
 *
 * The TITLE is not here either: it is the shape's inner text, edited in place on
 * a double-click. Which is the gesture the PO reported broken on the
 * glyph-bodied kinds, and which `C4NodeElementModel.includesPoint` now fixes for
 * all nine.
 *
 * ## Always on, like the board's resize toggle
 *
 * Registered by `C4RenderViewExtension`, not by the flag-gated half. Typing a
 * description is EDITING A STORED ELEMENT, not creating one: a diagram drawn
 * while the C4 button was on must stay fully editable when it goes off, which is
 * exactly what `docs/adr/0009` asks of a render-half registration. The flag
 * takes away the ways to add new elements and nothing else.
 */

const DETAILS_KEY = 'com.labre.c4.node.details';
const DETAILS_FALLBACK = 'Details';
const TECHNOLOGY_KEY = 'com.labre.c4.node.technology';
const TECHNOLOGY_FALLBACK = 'Technology';
const DESCRIPTION_KEY = 'com.labre.c4.node.description';
const DESCRIPTION_FALLBACK = 'Description';

/**
 * This module's contribution to the translation-key manifest.
 *
 * Exported as data so `translations.ts` composes it rather than restating it:
 * the keys and their English fallbacks are declared once, right beside the call
 * that renders them.
 */
export const C4_NODE_CHROME_KEYS: readonly (readonly [
  key: string,
  fallback: string,
])[] = [
  [DETAILS_KEY, DETAILS_FALLBACK],
  [TECHNOLOGY_KEY, TECHNOLOGY_FALLBACK],
  [DESCRIPTION_KEY, DESCRIPTION_FALLBACK],
];

const DetailsIcon = html`<svg
  width="24"
  height="24"
  viewBox="0 0 24 24"
  fill="none"
  stroke="currentColor"
  stroke-width="1.6"
  stroke-linecap="round"
  stroke-linejoin="round"
>
  <rect x="4" y="4" width="16" height="16" rx="2" />
  <path d="M8 9h8M8 13h8M8 17h5" />
</svg>`;

export const c4NodeToolbarConfig = {
  actions: [
    {
      id: 'c.details',
      content(ctx: ToolbarContext) {
        const models = ctx.getSurfaceModelsByType(C4NodeElementModel);
        if (!models.length) return null;
        // A read-only document is read: the popover would offer boxes whose
        // every write the store refuses.
        if (ctx.std.store.readonly) return null;

        const label = translateKey(ctx.std, DETAILS_KEY, DETAILS_FALLBACK);
        const onCommit = (
          field: 'technology' | 'description',
          value: string
        ) => {
          ctx.std.store.captureSync();
          for (const model of models) {
            // An empty box CLEARS the field rather than writing `''`: a cleared
            // element leaves no key in the document and is byte-identical to one
            // that never carried the field. `clearField` is the only path that
            // removes the key instead of leaving a tombstone.
            if (value) model[field] = value;
            else model.clearField(field);
          }
        };

        return html`
          <editor-menu-button
            .contentPadding="${'10px'}"
            .button=${html`
              <editor-icon-button
                aria-label="${label}"
                .tooltip="${label}"
                .justify="${'space-between'}"
                .labelHeight="${'20px'}"
              >
                ${DetailsIcon}
                <span class="label">${label}</span>
                ${EditorChevronDown}
              </editor-icon-button>
            `}
          >
            <c4-node-details-panel
              .models=${models}
              .onCommit=${onCommit}
              .technologyLabel=${translateKey(
                ctx.std,
                TECHNOLOGY_KEY,
                TECHNOLOGY_FALLBACK
              )}
              .descriptionLabel=${translateKey(
                ctx.std,
                DESCRIPTION_KEY,
                DESCRIPTION_FALLBACK
              )}
            ></c4-node-details-panel>
          </editor-menu-button>
        `;
      },
    },
  ],
  when: (ctx: ToolbarContext) =>
    ctx.getSurfaceModelsByType(C4NodeElementModel).length > 0,
} as const satisfies ToolbarModuleConfig;

export const c4NodeToolbarExtension = ToolbarModuleExtension({
  id: BlockFlavourIdentifier('affine:surface:c4Node'),
  config: c4NodeToolbarConfig,
});
