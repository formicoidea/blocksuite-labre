import {
  FrameworkBackgroundInteractionExtension,
  InterchangeExtension,
  morphToolbarConfig,
  ReadingProfileExtension,
  ValidationProfileExtension,
  ValidationRuleExtension,
} from '@labre/affine-block-surface';
import {
  type ViewExtensionContext,
  ViewExtensionProvider,
} from '@labre/affine-ext-loader';
import { TemplateCategoryExtension } from '@labre/affine-gfx-template';
import {
  ToolbarModuleExtension,
  toolbarModuleKey,
} from '@labre/affine-shared/services';
import { BlockFlavourIdentifier, CommandExtension } from '@labre/std';
import { RoleVocabularyExtension } from '@labre/std/gfx';

import { UML_DIAGRAM_FRAME, UML_SUBJECT_FRAME } from './background.js';
import { umlCommandIcons, umlCommands } from './commands.js';
import { UML_EDGE_MORPH_SPEC } from './edge-morph.js';
import { effects } from './effects.js';
import {
  UmlDiagramRendererExtension,
  UmlSubjectRendererExtension,
} from './element-renderer.js';
import { UmlDiagramView, UmlSubjectView } from './element-view.js';
import { UML_INTERCHANGE } from './interchange.js';
import { UML_MORPH_SPEC } from './morph.js';
import { UmlNodeRendererExtension } from './node/node-renderer.js';
import { UmlNodeView } from './node/node-view.js';
import { UML_PROFILES } from './profiles.js';
import { UML_READINGS } from './reading.js';
import { UML_ROLES } from './roles.js';
import { UML_RULES } from './rules.js';
import { umlTemplateCategory } from './templates.js';
import {
  umlDiagramToolbarExtension,
  umlDiagramToolingToolbarExtension,
} from './toolbar/config.js';
import { umlSeniorTool } from './toolbar/senior-tool.js';

/**
 * UML rendering — ALWAYS registered, independent of any flag. Diagram frames,
 * subjects and nodes already drawn must paint, stay selectable, stay editable
 * and keep their resize gating whatever the tooling flag says. See
 * `docs/adr/0009`.
 *
 * This is the RENDER half. The creation tooling — the senior button, its menu
 * and its twenty-one commands — is {@link UmlViewExtension} below, exactly as
 * `C4ViewExtension` is separate from `C4RenderViewExtension`. Nothing in this
 * class may become flag-gated: a stored document needs every one of these
 * registrations to load and paint.
 */
export class UmlRenderViewExtension extends ViewExtensionProvider {
  override name = 'affine-uml-render-gfx';

  override setup(context: ViewExtensionContext) {
    super.setup(context);
    context.register(UmlDiagramView);
    context.register(UmlDiagramRendererExtension);
    context.register(UmlSubjectView);
    context.register(UmlSubjectRendererExtension);
    context.register(UmlNodeView);
    context.register(UmlNodeRendererExtension);
    // The role VOCABULARY, always on. A role is written in the document, not in
    // the tooling: the direction reveal of a typed edge, the inversion command
    // and the toolbar entry that must not lie about a generalization all read
    // this, and they have to keep working on a diagram drawn while the flag was
    // on and opened while it is off (`docs/adr/0009`, `docs/adr/0010`).
    context.register(RoleVocabularyExtension(UML_ROLES));
    if (this.isEdgeless(context.scope)) {
      // Resize gating, driven by the declarations like every other framework
      // background: the handles follow `resizeEnabled`, which both declarations
      // seed to `true` — a diagram and a subject are both stretched to fit.
      context.register(
        FrameworkBackgroundInteractionExtension(UML_DIAGRAM_FRAME)
      );
      context.register(
        FrameworkBackgroundInteractionExtension(UML_SUBJECT_FRAME)
      );
      // The selected frame's own row — the resize toggle and the two exports in
      // its "⋮". Always-on for the reason `docs/adr/0009` gives: a stored
      // diagram must keep its handles usable with the UML button switched off,
      // and each "⋮" entry hides itself when its command is absent from the
      // registry, so nothing on the row can be clicked into a no-op.
      context.register(umlDiagramToolbarExtension);
    }
  }
}

/**
 * UML creation tooling — flag-gated (`uml`): the senior toolbar button, its
 * sub-menu, the twenty-one commands behind them, its templates category, the
 * frame's legend button and kind picker, the reading profiles and the two
 * interchange capabilities.
 *
 * All of it is tooling in the sense `docs/adr/0009` means: a diagram drawn
 * while the flag was on keeps painting, stays selectable and keeps its
 * contextual toolbar when it goes off — only the ways to add new elements go
 * away, the legend included since generating one CREATES elements.
 */
export class UmlViewExtension extends ViewExtensionProvider {
  override name = 'affine-uml-gfx';

  override effect(): void {
    super.effect();
    // Defines the senior button and its menu — tooling-only custom elements.
    effects();
  }

  override setup(context: ViewExtensionContext) {
    super.setup(context);
    if (this.isEdgeless(context.scope)) {
      // Writing PlantUML and XMI files, declared rather than assumed
      // (`docs/adr/0012`). Tooling like the rest of this class: with the flag
      // off there is nothing to export WITH, while a stored diagram keeps
      // painting (`docs/adr/0009`).
      context.register(InterchangeExtension(UML_INTERCHANGE));
      // The reversed reading (MF3): what the diagram says about an element, on
      // demand. One profile per node role, because a class, an actor and a use
      // case are read as three different things. The CLICK that triggers it is
      // registered once by the surface and gated by the presence of a profile.
      for (const reading of UML_READINGS) {
        context.register(ReadingProfileExtension(reading));
      }
      // The review checklist and its two levels of requirement — DATA, like the
      // roles and the readings above (`rules.ts`, `profiles.ts`). Tooling in the
      // sense `docs/adr/0009` means: with the flag off a stored diagram keeps
      // painting and simply stops being checked, and a frame already set to the
      // strict level keeps that id written, untouched.
      context.register(ValidationRuleExtension(UML_RULES));
      context.register(ValidationProfileExtension(UML_PROFILES));
      context.register(umlSeniorTool);
      // The Templates-panel category — tooling, so it goes with the flag (#244).
      context.register(TemplateCategoryExtension(umlTemplateCategory));
      context.register(CommandExtension(umlCommands, umlCommandIcons));
      // The flag-gated half of the selected FRAME's row, through the `custom:`
      // flavour slot — the shape wardley, bpmn and C4 all use to hang
      // flag-gated entries off a row whose base is always-on. One module,
      // carrying the legend button AND the diagram-kind picker, because both
      // are gated by this one flag and there is no reason to spend a second
      // registration on them.
      context.register(umlDiagramToolingToolbarExtension);
      // The "Change type" dropdown on a selected CLASSIFIER's contextual
      // toolbar — the generic module, parameterized by UML's own families.
      //
      // ## Why the key carries an owner
      //
      // A UML artefact is a native `group`, so the row the toolbar draws for it
      // is the GROUP's row, merged from `affine:surface:group`,
      // `custom:affine:surface:group` and the two surface wildcards. Both group
      // keys were claimed long ago — the first by the native group operations
      // (rename, ungroup), the second by Wardley's qualification dropdown — and
      // C4's morph is already hanging off a third. `toolbarModuleKey` is what
      // lifts the ceiling of two contributors per element: the module is
      // registered under the distinct variant
      // `custom:affine:surface:group#uml-morph` and the registry hands it to the
      // same row (`toolbar-service/registry.ts`).
      //
      // ## Why here
      //
      // In the flag-gated half, because a morph is TOOLING: a classifier drawn
      // while the flag was on keeps its kind, its role, its colours, its words
      // and its place in every rule when the flag goes off — it just stops being
      // something the toolbar offers to say differently (`docs/adr/0009`).
      context.register(
        ToolbarModuleExtension({
          id: BlockFlavourIdentifier(
            toolbarModuleKey('custom:affine:surface:group', 'uml-morph')
          ),
          config: morphToolbarConfig(UML_MORPH_SPEC),
        })
      );
      // The same dropdown on a selected RELATIONSHIP. A second registration
      // rather than a second family inside the first, because the two speak
      // about different element types: a classifier is a group, a relationship
      // is a connector, and `modelType` is what each spec filters the selection
      // with. The connector's own row is always-on (stroke, ends, routing) and
      // this is an addition to it, so it takes the `custom:` twin under the same
      // owner suffix.
      context.register(
        ToolbarModuleExtension({
          id: BlockFlavourIdentifier(
            toolbarModuleKey('custom:affine:surface:connector', 'uml-morph')
          ),
          config: morphToolbarConfig(UML_EDGE_MORPH_SPEC),
        })
      );
    }
  }
}
