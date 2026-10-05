import {
  ReadingManager,
  readingProfileFor,
  readName,
} from '@labre/affine-block-surface';
import { FrameBlockModel, GroupElementModel } from '@labre/affine-model';
import { translateKey } from '@labre/affine-shared/services';
import type { BlockStdScope } from '@labre/std';
import {
  findRoleDef,
  GfxBlockElementModel,
  type GfxModel,
  GfxPrimitiveElementModel,
  RoleVocabularyIdentifier,
} from '@labre/std/gfx';
import {
  AttachmentIcon,
  BookmarkIcon,
  ConnectorCIcon,
  EmbedWebIcon,
  FrameIcon,
  GroupIcon,
  ImageIcon,
  MindmapIcon,
  PageIcon,
  PenIcon,
  ShapeIcon,
  TextIcon,
} from '@blocksuite/icons/lit';
import type { TemplateResult } from 'lit';

import {
  SELECTION_PANE_TYPE_ELEMENT,
  SELECTION_PANE_TYPE_EMBED,
  SELECTION_PANE_TYPE_WORDINGS,
} from '../translations.js';

/** For an element no reading profile governs: its own text, no label sibling. */
const NO_PROFILE = { roles: {} } as const;

/**
 * Every key of the library starts with it. A host catalogue that echoes a key
 * it does not hold (i18next's default) is not a wording either.
 */
const KEY_PREFIX = 'com.labre.';

/** The type wording of a row: its kind, translated. */
export function selectionPaneTypeLabel(
  std: BlockStdScope,
  type: string
): string {
  const wording =
    SELECTION_PANE_TYPE_WORDINGS[type] ??
    (type.startsWith('affine:embed-')
      ? SELECTION_PANE_TYPE_EMBED
      : SELECTION_PANE_TYPE_ELEMENT);
  return translateKey(std, ...wording);
}

/**
 * The wording of a row, read off the model at render time (ADR 0031 §12: the
 * headless tree carries ids only).
 *
 * In order: a group's or a frame's own stored title; then an element's own
 * text, or its label sibling's — `readName`, the very rule the reversed
 * reading names an artefact by, so a Wardley component reads as its label and
 * not as "Shape"; then its role's wording; then its kind.
 */
export function selectionPaneRowLabel(
  std: BlockStdScope,
  model: GfxModel
): string {
  if (model instanceof GroupElementModel) {
    const title = model.title.toString().trim();
    if (title) return title;
  } else if (model instanceof FrameBlockModel) {
    const title = model.props.title.toString().trim();
    if (title) return title;
  } else if (model instanceof GfxPrimitiveElementModel) {
    const profiles = std.getOptional(ReadingManager)?.profiles ?? [];
    const profile = readingProfileFor(model, profiles) ?? NO_PROFILE;
    const name = readName(model, profile);
    if (name) return name;

    const vocabularies = [
      ...std.provider.getAll(RoleVocabularyIdentifier).values(),
    ];
    const role = findRoleDef(vocabularies, model.role);
    if (role?.labelKey) {
      // `''`, not the key, when the role ships no wording: `translateKey`
      // defaults its fallback to the key, and a row once printed
      // `com.labre.wardley.role.…` that way. No wording reads as the kind.
      const wording = translateKey(
        std,
        role.labelKey,
        role.labelFallback ?? ''
      );
      if (wording && !wording.startsWith(KEY_PREFIX)) return wording;
    }
  }

  const type =
    model instanceof GfxBlockElementModel
      ? model.flavour
      : (model as GfxPrimitiveElementModel).type;
  return selectionPaneTypeLabel(std, type);
}

/** The icon of a row, by element type or block flavour. */
export function selectionPaneRowIcon(type: string): TemplateResult {
  switch (type) {
    case 'connector':
      return ConnectorCIcon();
    case 'text':
    case 'affine:edgeless-text':
    case 'affine:latex':
      return TextIcon();
    case 'group':
      return GroupIcon();
    case 'mindmap':
      return MindmapIcon();
    case 'brush':
    case 'highlighter':
      return PenIcon();
    case 'affine:frame':
      return FrameIcon();
    case 'affine:note':
      return PageIcon();
    case 'affine:image':
      return ImageIcon();
    case 'affine:attachment':
      return AttachmentIcon();
    case 'affine:bookmark':
      return BookmarkIcon();
    default:
      return type.startsWith('affine:embed-') ? EmbedWebIcon() : ShapeIcon();
  }
}
