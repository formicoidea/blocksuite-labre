import {
  canReplaceBlockWithShape,
  cardStyleFor,
  type FileReplacement,
  IMAGE_REPLACE_WITH_ASSET,
  IMAGE_REPLACE_WITH_SHAPE,
  replaceBlockWithShape,
  type ReplacementAnswer,
  replaceElementParams,
  type ReplaceElementParams,
  replaceFromDialog,
  replaceTarget,
  replaceWithAnswer,
  replaceWithShapeParams,
  type ReplaceWithShapeParams,
  reportReplaced,
  selectReplaced,
} from '@labre/affine-block-image';
import {
  AttachmentBlockModel,
  AttachmentBlockStyles,
} from '@labre/affine-model';
import { Bound } from '@labre/global/gfx';
import type {
  AnyCommandDescriptor,
  BlockStdScope,
  CommandDescriptor,
} from '@labre/std';

import type { AttachmentBlockComponent } from './attachment-block.js';
import { AttachmentEmbedProvider } from './embed';
import { isHtmlAttachment } from './html-attachment.js';
import {
  ATTACHMENT_REPLACE_DESCRIPTION,
  ATTACHMENT_REPLACE_WITH_SHAPE_DESCRIPTION,
} from './translations.js';

/**
 * « Replace » on an attachment (ADR 0044, amendment of 2026-11-04). What crosses
 * kinds goes through the image package's one way (`replaceWithAnswer`); only another
 * file stays here, in the same block, since this package knows how a file is shown.
 * They emit from their body, like the image's (`registry.unit.spec.ts`).
 */

export const REPLACE_ATTACHMENT = 'canvas.attachment.replace';
export const REPLACE_ATTACHMENT_WITH_SHAPE =
  'canvas.attachment.replaceWithShape';

/**
 * Another file in the same block, in its frame, in one undo step: an embed view stays
 * one if the new file has one, an html file opens on it, and a view's own size
 * (`convertTo`) gives way to the frame. Answers the block's id, or `null` when it is
 * gone or the document read-only.
 */
export function replaceAttachmentFile(
  std: BlockStdScope,
  model: AttachmentBlockModel,
  { name, size, type, sourceId }: FileReplacement
): string | null {
  const { store } = std;
  if (store.readonly || !store.getBlock(model.id)) return null;
  const { xywh, embed: wasEmbed, style } = model.props;
  const provider = std.get(AttachmentEmbedProvider);

  store.captureSync();
  store.transact(() => {
    store.updateBlock(model, { name, size, type, sourceId, embed: false });
    const embed =
      (wasEmbed || isHtmlAttachment(model.props)) && provider.embedded(model);
    if (embed) provider.convertTo(model);
    const onCard =
      !embed && !(AttachmentBlockStyles as readonly unknown[]).includes(style);
    store.updateBlock(model, {
      xywh,
      // The style of a view that is gone would size the card.
      ...(onCard ? { style: cardStyleFor(Bound.deserialize(xywh)) } : {}),
    });
  });
  (std.view?.getBlock(model.id) as AttachmentBlockComponent | null)?.reload?.();
  return model.id;
}

/** The one place an answer to an attachment's « Replace » is sorted. */
export function writeAttachmentAnswer(
  std: BlockStdScope,
  model: AttachmentBlockModel,
  answer: ReplacementAnswer
): string | null {
  return answer.kind === 'file'
    ? replaceAttachmentFile(std, model, answer.source)
    : replaceWithAnswer(std, model, answer);
}

function canvasAttachment(std: BlockStdScope, params?: unknown) {
  const model = replaceTarget(std, params);
  if (std.store.readonly || !(model instanceof AttachmentBlockModel)) {
    return null;
  }
  return model.parent?.flavour === 'affine:surface' ? model : null;
}

/** The canvas attachment the dialog would replace, or `null`. A citation's card is
 *  held by its footnote. */
export function replaceableAttachment(std: BlockStdScope, params?: unknown) {
  const model = canvasAttachment(std, params);
  return model && !model.isLocked() && !model.props.footnoteIdentifier
    ? model
    : null;
}

/** The canvas attachment a shape could replace, or `null`. */
export function attachmentForShape(std: BlockStdScope, params?: unknown) {
  const model = canvasAttachment(std, params);
  return canReplaceBlockWithShape(std, model) ? model : null;
}

export const replaceAttachmentCommand: CommandDescriptor<ReplaceElementParams> =
  {
    id: REPLACE_ATTACHMENT,
    owner: 'core',
    kind: 'action',
    labelKey: IMAGE_REPLACE_WITH_ASSET[0],
    labelFallback: IMAGE_REPLACE_WITH_ASSET[1],
    descriptionKey: ATTACHMENT_REPLACE_DESCRIPTION[0],
    descriptionFallback: ATTACHMENT_REPLACE_DESCRIPTION[1],
    keywords: ['replace', 'file', 'attachment', 'html', 'image', 'library'],
    // Not `agent`: the file comes from a dialog a person answers.
    surfaces: ['contextual-toolbar', 'palette'],
    scope: 'edgeless',
    defaultKeys: { mac: [], other: [] },
    availability: 'editable',
    when: std => replaceableAttachment(std) !== null,
    params: replaceElementParams,
    run: (std, invocation, params) =>
      replaceFromDialog(std, invocation, params, {
        target: replaceableAttachment,
        from: 'attachment',
        request: 'file',
        write: writeAttachmentAnswer,
      }),
  };

export const replaceAttachmentWithShapeCommand: CommandDescriptor<ReplaceWithShapeParams> =
  {
    id: REPLACE_ATTACHMENT_WITH_SHAPE,
    owner: 'core',
    kind: 'action',
    labelKey: IMAGE_REPLACE_WITH_SHAPE[0],
    labelFallback: IMAGE_REPLACE_WITH_SHAPE[1],
    descriptionKey: ATTACHMENT_REPLACE_WITH_SHAPE_DESCRIPTION[0],
    descriptionFallback: ATTACHMENT_REPLACE_WITH_SHAPE_DESCRIPTION[1],
    keywords: ['replace', 'shape', 'rectangle', 'placeholder', 'file'],
    surfaces: ['contextual-toolbar', 'palette'],
    scope: 'edgeless',
    defaultKeys: { mac: [], other: [] },
    availability: 'editable',
    when: std => attachmentForShape(std) !== null,
    params: replaceWithShapeParams,
    run: (std, invocation, params) => {
      const model = attachmentForShape(std, params);
      if (!model) return;
      const parsed = replaceWithShapeParams.safeParse(params ?? {});
      if (!parsed.success) return;
      const { shapeType, radius } = parsed.data;
      const id = replaceBlockWithShape(std, model, { shapeType, radius });
      if (!id) return;
      selectReplaced(std, id);
      reportReplaced(std, invocation, 'attachment', 'shape');
    },
  };

export const attachmentReplaceCommands: AnyCommandDescriptor[] = [
  replaceAttachmentCommand,
  replaceAttachmentWithShapeCommand,
];
