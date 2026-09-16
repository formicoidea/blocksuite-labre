import { openSingleFileWith } from '@labre/affine-shared/utils';
import { type SlashMenuConfig } from '@labre/affine-widget-slash-menu';
import { ExportToPdfIcon, FileIcon } from '@blocksuite/icons/lit';

import {
  ATTACHMENT_SLASH_DESCRIPTION,
  ATTACHMENT_SLASH_NAME,
  ATTACHMENT_SLASH_PDF_DESCRIPTION,
  ATTACHMENT_SLASH_PDF_NAME,
} from '../translations';
import { addSiblingAttachmentBlocks } from '../utils';
import { AttachmentTooltip, PDFTooltip } from './tooltips';

export const attachmentSlashMenuConfig: SlashMenuConfig = {
  items: [
    {
      name: 'Attachment',
      nameWording: ATTACHMENT_SLASH_NAME,
      description: 'Attach a file to document.',
      descriptionWording: ATTACHMENT_SLASH_DESCRIPTION,
      icon: FileIcon(),
      tooltip: {
        figure: AttachmentTooltip,
        caption: 'Attachment',
        captionWording: ATTACHMENT_SLASH_NAME,
      },
      searchAlias: ['file'],
      group: '4_Content & Media@3',
      when: ({ model }) =>
        model.store.schema.flavourSchemaMap.has('affine:attachment'),
      action: ({ std, model }) => {
        (async () => {
          const file = await openSingleFileWith();
          if (!file) return;

          await addSiblingAttachmentBlocks(std, [file], model);
          if (model.text?.length === 0) {
            std.store.deleteBlock(model);
          }
        })().catch(console.error);
      },
    },
    {
      name: 'PDF',
      nameWording: ATTACHMENT_SLASH_PDF_NAME,
      description: 'Upload a PDF to document.',
      descriptionWording: ATTACHMENT_SLASH_PDF_DESCRIPTION,
      icon: ExportToPdfIcon(),
      tooltip: {
        figure: PDFTooltip,
        caption: 'PDF',
        captionWording: ATTACHMENT_SLASH_PDF_NAME,
      },
      group: '4_Content & Media@4',
      when: ({ model }) =>
        model.store.schema.flavourSchemaMap.has('affine:attachment'),
      action: ({ std, model }) => {
        (async () => {
          const file = await openSingleFileWith();
          if (!file) return;

          await addSiblingAttachmentBlocks(std, [file], model);
          if (model.text?.length === 0) {
            std.store.deleteBlock(model);
          }
        })().catch(console.error);
      },
    },
  ],
};
