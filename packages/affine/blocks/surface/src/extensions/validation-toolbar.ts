import { EditorChevronDown } from '@labre/affine-components/toolbar';
import {
  TelemetryProvider,
  type ToolbarContext,
  type ToolbarModuleConfig,
  ToolbarModuleExtension,
  translateKey,
} from '@labre/affine-shared/services';
import { BlockFlavourIdentifier } from '@labre/std';
import { GfxPrimitiveElementModel } from '@labre/std/gfx';
import { html, nothing, type TemplateResult } from 'lit';

import { ValidationManager, type ValidationProfile } from './validation.js';

/**
 * The tick on the profile in force. Drawn inline rather than pulled from
 * `@blocksuite/icons`, which this package does not depend on and which is not
 * worth a new dependency for one glyph — the same call the framework toolbars
 * already make for their own icons.
 */
const CheckIcon = html`<svg
  width="20"
  height="20"
  viewBox="0 0 24 24"
  fill="none"
  stroke="currentColor"
  stroke-width="2"
  stroke-linecap="round"
  stroke-linejoin="round"
>
  <path d="M5 12.5l4.5 4.5L19 7.5" />
</svg>`;

/**
 * The validation entry of a framework instance's contextual toolbar (PF9).
 *
 * Select a Wardley map and its toolbar gains a **Validation** dropdown naming
 * the level of requirement the map is checked against, and offering the others.
 *
 * ## Why here and not on a canvas marker
 *
 * PF9 first shipped this as a chip pinned to the instance's top-left corner.
 * It was the wrong place twice over: the contextual toolbar lands on the same
 * pixels and buried it, and at a low zoom the chip was unreadable. The toolbar
 * that hid it is the toolbar that should have carried it — a per-instance
 * setting belongs with the instance's other per-instance settings (axes,
 * labels, legend), not floating over the canvas.
 *
 * ## Generic, not Wardley
 *
 * Nothing here names a framework, a type or a role. The entry appears when the
 * selected element is one the ENGINE recognises as a framework's root instance
 * and whose framework declares more than one profile —
 * {@link ValidationManager.profilesFor} answers both off the REGISTERED rules'
 * `backgroundRole`. A second framework shipping profiles gets this dropdown by
 * registering the same config on its own flavour, with no change here.
 *
 * ## Gating
 *
 * This config is registered by a framework's FLAG-GATED view extension, beside
 * its rules and its profiles: a level of requirement is tooling. Flag off, the
 * module does not exist, so there is no entry, no DOM and no evaluation — and
 * the id already written on a map goes unread until the flag comes back.
 *
 * That is a deliberate departure from the framework's OWN toolbar module, which
 * is registered always-on (`…RenderViewExtension`) so that a map drawn while
 * the flag was on keeps its axes and its labels — see `docs/adr/0009`. Painting
 * and editing a stored document is content; deciding how hard to check it is
 * not. The two live in two modules for exactly that reason, and the `custom:`
 * flavour slot is what lets them coexist on one element (the pattern
 * `gfx/mindmap` already uses on `custom:affine:surface:shape`).
 *
 * ## Room for its neighbours
 *
 * The dropdown renders SECTIONS. PF9 shipped one — the level of requirement —
 * and PF7.11 added the second: **Map quality**, one more block in
 * {@link renderSections} rather than another toolbar button competing for
 * width, which is exactly what the section shape was built for.
 *
 * The two appear on their own merits and neither drags the other onto the
 * toolbar: a framework may ship a checklist and a single profile, or two
 * profiles and no checklist, and the dropdown shows whichever half has
 * something to say ({@link hasValidationMenu}).
 */

/** The one selected element a profile can be chosen on. */
interface ProfileTarget {
  element: GfxPrimitiveElementModel;
  profiles: readonly ValidationProfile[];
  active: ValidationProfile | undefined;
}

/**
 * The single selected canvas element the dropdown is about, or `null`.
 *
 * A single element on purpose: every entry in this menu is one decision about
 * one instance, and a multi-selection spanning two maps has no honest "current"
 * value to show.
 */
function selectedInstance(
  ctx: ToolbarContext
): GfxPrimitiveElementModel | null {
  const models = ctx.getSurfaceModels();
  if (models.length !== 1) return null;
  const [element] = models;
  return element instanceof GfxPrimitiveElementModel ? element : null;
}

/**
 * The selection, if it is a single root instance with a choice to make.
 *
 * Fewer than two profiles is not a choice — a picker with one entry is chrome
 * that decides nothing.
 */
function profileTarget(ctx: ToolbarContext): ProfileTarget | null {
  const validation = ctx.std.getOptional(ValidationManager);
  if (!validation) return null;

  const element = selectedInstance(ctx);
  if (!element) return null;

  const profiles = validation.profilesFor(element);
  if (profiles.length < 2) return null;

  return { element, profiles, active: validation.profileOf(element) };
}

/**
 * The selection, if it is a root instance whose framework declares a nudge
 * (PF7.11).
 *
 * Independent of {@link profileTarget}: a framework may ship a checklist and no
 * second profile, or the other way round, and the dropdown must show whichever
 * of its sections has something to say.
 */
function mapQualityTarget(
  ctx: ToolbarContext
): GfxPrimitiveElementModel | null {
  const validation = ctx.std.getOptional(ValidationManager);
  if (!validation) return null;

  const element = selectedInstance(ctx);
  if (!element) return null;
  return validation.hasMapQuality(element) ? element : null;
}

/** Whether the dropdown has anything at all to offer for this selection. */
function hasValidationMenu(ctx: ToolbarContext): boolean {
  return profileTarget(ctx) !== null || mapQualityTarget(ctx) !== null;
}

/**
 * Put the instance on `profile`, and report it.
 *
 * The write, the "choosing the default clears the key" rule and the immediate
 * re-evaluation all belong to {@link ValidationManager.setProfile}; this is the
 * gesture and the event. `captureSync` opens an undo checkpoint first, like
 * every other write this toolbar makes, so one click is one undo.
 */
function pickProfile(
  ctx: ToolbarContext,
  element: GfxPrimitiveElementModel,
  profile: ValidationProfile
) {
  const validation = ctx.std.getOptional(ValidationManager);
  if (!validation) return;

  const previous = validation.profileOf(element);
  ctx.std.store.captureSync();
  // A choice that changes nothing is not a decision and is not reported.
  if (!validation.setProfile(element, profile.id)) return;

  ctx.std.getOptional(TelemetryProvider)?.track('ValidationProfileChanged', {
    page: 'whiteboard editor',
    segment: 'whiteboard',
    module: 'validation toolbar',
    control: 'profile',
    framework: profile.framework,
    profileId: profile.id,
    ...(previous !== undefined ? { previousProfileId: previous.id } : {}),
  });
}

/** One titled block of the dropdown. */
function renderSection(
  label: string,
  testid: string,
  items: TemplateResult[]
): TemplateResult {
  return html`<div
    role="group"
    aria-label=${label}
    data-testid=${testid}
    style="display: flex; flex-direction: column;"
  >
    <div
      style="padding: 4px 8px; font-size: 12px; color: var(--affine-text-secondary-color);"
    >
      ${label}
    </div>
    ${items}
  </div>`;
}

/**
 * The Map quality section (PF7.11): one entry, which OPENS the panel.
 *
 * A menu is the wrong shape for a checklist — four tickable lines do not belong
 * in a dropdown that closes on the first click. So the entry does the one thing
 * a menu entry is good at, which is to open something;
 * `ValidationManager.mapQualityFor$` carries the request across to the widget
 * that draws it (`map-quality-widget.ts`).
 *
 * Nothing here names a framework: the entry appears when the ENGINE says the
 * selected instance has a checklist
 * ({@link ValidationManager.hasMapQuality}), which is derived from what the
 * frameworks registered. A second framework declaring nudges gets this entry
 * with no change to this file.
 */
function renderMapQualitySection(
  ctx: ToolbarContext,
  element: GfxPrimitiveElementModel
): TemplateResult {
  const label = translateKey(
    ctx.std,
    'com.labre.validation.map-quality.open',
    'Map quality…'
  );

  return renderSection(
    translateKey(
      ctx.std,
      'com.labre.validation.map-quality.section',
      'Map quality'
    ),
    'validation-map-quality-section',
    [
      html`<editor-menu-action
        data-testid="validation-map-quality-open"
        aria-label=${label}
        @click=${() => {
          ctx.std.getOptional(ValidationManager)?.openMapQuality(element);
        }}
      >
        <span style="width: 20px;"></span>
        <span class="label">${label}</span>
      </editor-menu-action>`,
    ]
  );
}

/**
 * Everything the Validation dropdown offers: the level of requirement (PF9) and
 * the map quality panel (PF7.11), each appearing on its own merits.
 */
function renderSections(
  ctx: ToolbarContext,
  target: ProfileTarget | null,
  quality: GfxPrimitiveElementModel | null
): TemplateResult[] {
  const sections: TemplateResult[] = [];

  if (target) {
    const { element, profiles, active } = target;
    const options = profiles.map(profile => {
      const selected = profile.id === active?.id;
      return html`<editor-menu-action
        data-testid="validation-profile-option"
        data-profile-id=${profile.id}
        data-selected=${selected ? 'true' : nothing}
        aria-label=${translateKey(ctx.std, profile.labelKey, profile.fallback)}
        aria-pressed=${selected}
        @click=${() => pickProfile(ctx, element, profile)}
      >
        ${selected ? CheckIcon : html`<span style="width: 20px;"></span>`}
        <span class="label"
          >${translateKey(ctx.std, profile.labelKey, profile.fallback)}</span
        >
      </editor-menu-action>`;
    });

    sections.push(
      renderSection(
        translateKey(
          ctx.std,
          'com.labre.validation.profile.section',
          'Profile'
        ),
        'validation-profile-section',
        options
      )
    );
  }

  if (quality) sections.push(renderMapQualitySection(ctx, quality));

  return sections;
}

export const validationToolbarConfig = {
  actions: [
    {
      // Sorted after a framework's own per-instance toggles (`a.` … `d.`), and
      // before anything the generic surface module places at the End: the
      // level of requirement is a setting of this instance, read last.
      id: 'z.validation',
      when: hasValidationMenu,
      content(ctx: ToolbarContext) {
        const target = profileTarget(ctx);
        const quality = mapQualityTarget(ctx);
        if (!target && !quality) return null;

        const label = translateKey(
          ctx.std,
          'com.labre.validation.toolbar.label',
          'Validation'
        );
        // The dropdown's own trigger names the level in force, so the current
        // profile is readable without opening anything. An instance whose
        // framework ships no second profile has no level to name, and the
        // trigger falls back to the menu's own label.
        const current =
          target?.active === undefined
            ? label
            : translateKey(
                ctx.std,
                target.active.labelKey,
                target.active.fallback
              );

        // The testid sits on the HOST as well as on the trigger: the trigger
        // is handed to `editor-menu-button` as a property and rendered into
        // its shadow root, so the host is the only handle from the toolbar's
        // own DOM.
        return html`<editor-menu-button
          data-testid="validation-toolbar-entry"
          .contentPadding=${'8px'}
          .button=${html`
            <editor-icon-button
              data-testid="validation-toolbar-button"
              aria-label=${label}
              .tooltip=${label}
              .justify=${'space-between'}
              .labelHeight=${'20px'}
            >
              <span class="label">${current}</span>
              ${EditorChevronDown}
            </editor-icon-button>
          `}
        >
          <div
            data-testid="validation-toolbar-menu"
            data-orientation="vertical"
            data-size="large"
          >
            ${renderSections(ctx, target, quality)}
          </div>
        </editor-menu-button>`;
      },
    },
  ],
  // The whole module stands down unless the selection has a choice to make, so
  // a framework registering it pays one length check per selection change.
  when: hasValidationMenu,
} as const satisfies ToolbarModuleConfig;

/**
 * "Revoke the exception", on the contextual toolbar of the element that carries
 * it (PF8, PO acceptance of 01/08).
 *
 * ## Why the toolbar and not the badge
 *
 * PF8 shipped the way back on a grey badge pinned to the canvas: an excused
 * finding kept a marker, and clicking it opened the bubble that could revoke.
 * That put a permanent dot on the board for something the user had explicitly
 * decided to stop caring about — the affordance argued with the decision it was
 * reporting. Selecting the element is the path everybody already knows, so the
 * way back lives where every other thing you can do to an element lives, and
 * the canvas goes quiet. The amber badge of a LIVE violation is untouched: that
 * one is still asking for something (PF7).
 *
 * The same reasoning that moved the profile chip into this file, one entry up.
 *
 * ## Which element gets the entry
 *
 * Whichever one ANSWERS for the exception, in exactly the sense the canvas mark
 * uses ({@link ValidationManager.revocableExceptionsOn} →
 * `exceptionsAnchoredOn` → `anchorOf`): the outermost enclosing canvas group —
 * i.e. the whole Wardley component built by the senior menu — or the element
 * itself when it is not grouped. Dissolve the group and the entry moves down to
 * the element, with nothing to invalidate. A framework background answers for
 * the map-wide arbitration written on it, so the same entry on the background
 * revokes the map scope.
 *
 * ## Where it is registered, and how it shares an element with Validation
 *
 * `custom:affine:surface:*` — the free wildcard slot, merged into the toolbar of
 * EVERY canvas element. One registration therefore covers a group, a bare
 * framework element and a background alike, and no framework's own toolbar
 * config is touched.
 *
 * It coexists with the Validation dropdown above, which a framework registers on
 * its OWN flavour (`custom:affine:surface:wardley`): `renderToolbar` collects
 * the flavour slot, the `custom:` flavour slot, both surface wildcards and both
 * `affine:*` slots, and CONCATENATES their actions. Selecting a Wardley map
 * therefore offers Revoke exception (`c.validation-revoke-exception`, from
 * here) and Validation (`z.validation`, from the framework) side by side,
 * ordered by id. `affine:surface:*` is taken by the root's built-in module, and
 * two modules on one key would collide — hence the `custom:` wildcard.
 *
 * The two are gated independently and that is the point: Validation is a
 * framework's tooling and dies with its flag; this one asks the ENGINE whether a
 * registered rule can still be arbitrated on, so it dies with the flag too,
 * without either module knowing the other exists.
 */

const REVOKE_LABEL_KEY = 'com.labre.validation.action.revoke-exception';
const REVOKE_LABEL_FALLBACK = 'Revoke exception';

/**
 * The single selected canvas element, or `null`.
 *
 * One element only: "revoke the exception" has no honest meaning across a mixed
 * bag of shapes, and the entry is about one arbitration on one thing.
 */
function selectedElement(ctx: ToolbarContext): GfxPrimitiveElementModel | null {
  const models = ctx.getSurfaceModels();
  if (models.length !== 1) return null;
  const [model] = models;
  return model instanceof GfxPrimitiveElementModel ? model : null;
}

function revocableOn(ctx: ToolbarContext) {
  const element = selectedElement(ctx);
  if (!element) return [];
  return (
    ctx.std.getOptional(ValidationManager)?.revocableExceptionsOn(element) ?? []
  );
}

export const validationExceptionToolbarConfig = {
  actions: [
    {
      // Ordered after a framework's own per-instance toggles, before the
      // built-in surface actions and before `z.validation`.
      id: 'c.validation-revoke-exception',
      // Sorting early is right — it is a decision about this element, read
      // before the generic canvas actions — but on a narrow row the default
      // "later entries give way first" would then keep this ahead of the core
      // actions, which is backwards: it is the rarest entry of the toolbar and
      // the wordiest, with no icon to fall back to. So it says so, and it is
      // the first thing to move into the "⋮" — where it keeps its full label
      // and its behaviour.
      priority: -1,
      // No exception answered for by this element — including every board with
      // no framework enabled — means no entry at all.
      when: (ctx: ToolbarContext) => revocableOn(ctx).length > 0,
      // `label` is static on a ToolbarAction, so the i18n seam needs the
      // generator form: it is the only shape that receives the context, and
      // `translateKey` needs `std` to reach the host's catalogue.
      generate: (ctx: ToolbarContext) => {
        const label = translateKey(
          ctx.std,
          REVOKE_LABEL_KEY,
          REVOKE_LABEL_FALLBACK
        );
        return {
          label,
          // Shown as words, not as a mystery glyph: taking back a recorded
          // decision is not something to guess at from an icon.
          showLabel: true,
          tooltip: label,
          run: (runCtx: ToolbarContext) => {
            const element = selectedElement(runCtx);
            if (!element) return;
            const validation = runCtx.std.getOptional(ValidationManager);
            // One click is one undo, like every other write this toolbar makes.
            runCtx.std.store.captureSync();
            const revoked = validation?.revokeExceptionsOn(element) ?? [];

            for (const entry of revoked) {
              runCtx.track('ValidationExceptionRevoked', {
                control: 'revoke exception',
                ruleId: entry.ruleId,
                framework: entry.framework,
                scope: entry.scope,
                elementCount: entry.elementCount,
              });
            }
          },
        };
      },
    },
  ],
} as const satisfies ToolbarModuleConfig;

export const validationExceptionToolbarExtension = ToolbarModuleExtension({
  id: BlockFlavourIdentifier('custom:affine:surface:*'),
  config: validationExceptionToolbarConfig,
});
