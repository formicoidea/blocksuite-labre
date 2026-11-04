import {
  type AttachmentBlockModel,
  type ImageBlockProps,
  MAX_IMAGE_WIDTH,
} from '@labre/affine-model';
import {
  EMBED_CARD_HEIGHT,
  EMBED_CARD_WIDTH,
} from '@labre/affine-shared/consts';
import {
  EmbedHtmlConfigExtension,
  FileSizeLimitProvider,
} from '@labre/affine-shared/services';
import {
  readImageSize,
  transformModel,
  withTempBlobData,
} from '@labre/affine-shared/utils';
import type { Container } from '@labre/global/di';
import { createIdentifier } from '@labre/global/di';
import { Bound } from '@labre/global/gfx';
import { BlockSelection, type BlockStdScope, StdIdentifier } from '@labre/std';
import { GfxControllerIdentifier } from '@labre/std/gfx';
import type { ExtensionType } from '@labre/store';
import { Extension } from '@labre/store';
import type { TemplateResult } from 'lit';
import { html } from 'lit';
import { styleMap } from 'lit/directives/style-map.js';

import { isHtmlAttachment } from './html-attachment';
import { getAttachmentBlob } from './utils';

export type AttachmentEmbedConfig = {
  name: string;
  /**
   * Check if the attachment can be turned into embed view.
   */
  check: (
    model: AttachmentBlockModel,
    maxFileSize: number,
    std?: BlockStdScope
  ) => boolean;
  /**
   * The action will be executed when the 「Turn into embed view」 button is clicked.
   */
  action?: (
    model: AttachmentBlockModel,
    std: BlockStdScope
  ) => Promise<void> | void;
  /**
   * Renders the embed view.
   */
  render?: (
    model: AttachmentBlockModel,
    blobUrl: string,
    std?: BlockStdScope
  ) => TemplateResult | null;

  /**
   * Draws in the card in place of the file icon. Absent, the card keeps the icon.
   */
  renderThumbnail?: (
    model: AttachmentBlockModel,
    std: BlockStdScope
  ) => TemplateResult | null;

  /**
   * Should show status when turned on.
   */
  shouldShowStatus?: boolean;

  /**
   * Should block type conversion be required.
   */
  shouldBeConverted?: boolean;
};

// Single embed config.
export const AttachmentEmbedConfigIdentifier =
  createIdentifier<AttachmentEmbedConfig>(
    'AffineAttachmentEmbedConfigIdentifier'
  );

export function AttachmentEmbedConfigExtension(
  configs: AttachmentEmbedConfig[] = embedConfig
): ExtensionType {
  return {
    setup: di => {
      configs.forEach(option => {
        di.addImpl(AttachmentEmbedConfigIdentifier(option.name), () => option);
      });
    },
  };
}

// A embed config map.
export const AttachmentEmbedConfigMapIdentifier = createIdentifier<
  Map<string, AttachmentEmbedConfig>
>('AffineAttachmentEmbedConfigMapIdentifier');

export const AttachmentEmbedProvider = createIdentifier<AttachmentEmbedService>(
  'AffineAttachmentEmbedProvider'
);

export class AttachmentEmbedService extends Extension {
  private get _maxFileSize() {
    return this.std.get(FileSizeLimitProvider).maxFileSize;
  }

  private _configOf(model: AttachmentBlockModel, maxFileSize: number) {
    return this.values.find(config =>
      config.check(model, maxFileSize, this.std)
    );
  }

  get keys() {
    return this.configs.keys();
  }

  get values() {
    return this.configs.values();
  }

  get configs(): Map<string, AttachmentEmbedConfig> {
    return this.std.get(AttachmentEmbedConfigMapIdentifier);
  }

  constructor(private readonly std: BlockStdScope) {
    super();
  }

  static override setup(di: Container) {
    di.addImpl(AttachmentEmbedConfigMapIdentifier, provider =>
      provider.getAll(AttachmentEmbedConfigIdentifier)
    );
    di.addImpl(AttachmentEmbedProvider, this, [StdIdentifier]);
  }

  // Converts to embed view.
  convertTo(model: AttachmentBlockModel, maxFileSize = this._maxFileSize) {
    const config = this._configOf(model, maxFileSize);

    if (config?.action) {
      config.action(model, this.std)?.catch(console.error);
      return;
    }

    model.store.updateBlock(model, { embed: true });
  }

  embedded(model: AttachmentBlockModel, maxFileSize = this._maxFileSize) {
    return this.values.some(config =>
      config.check(model, maxFileSize, this.std)
    );
  }

  getRender(model: AttachmentBlockModel, maxFileSize = this._maxFileSize) {
    return this._configOf(model, maxFileSize)?.render ?? null;
  }

  renderThumbnail(
    model: AttachmentBlockModel,
    maxFileSize = this._maxFileSize
  ) {
    return (
      this._configOf(model, maxFileSize)?.renderThumbnail?.(model, this.std) ??
      null
    );
  }

  shouldShowStatus(
    model: AttachmentBlockModel,
    maxFileSize = this._maxFileSize
  ) {
    return this._configOf(model, maxFileSize)?.shouldShowStatus ?? false;
  }

  shouldBeConverted(
    model: AttachmentBlockModel,
    maxFileSize = this._maxFileSize
  ) {
    return this._configOf(model, maxFileSize)?.shouldBeConverted ?? false;
  }
}

const embedConfig: AttachmentEmbedConfig[] = [
  {
    name: 'image',
    shouldBeConverted: true,
    check: model =>
      model.store.schema.flavourSchemaMap.has('affine:image') &&
      model.props.type.startsWith('image/'),
    async action(model, std) {
      const component = std.view.getBlock(model.id);
      if (!component) return;

      // Read now: the block is about to go. A selection left on it keeps a
      // stray toolbar on the canvas.
      const select = selectionFollowing(std, model.id);
      const imageId = await turnIntoImageBlock(model);
      if (imageId) select(imageId);
    },
  },
  {
    name: 'pdf',
    shouldShowStatus: true,
    check: (model, maxFileSize) =>
      model.props.type === 'application/pdf' && model.props.size <= maxFileSize,
    action: model => {
      const bound = Bound.deserialize(model.props.xywh);
      bound.w = EMBED_CARD_WIDTH.pdf;
      bound.h = EMBED_CARD_HEIGHT.pdf;
      model.store.updateBlock(model, {
        embed: true,
        style: 'pdf',
        xywh: bound.serialize(),
      });
    },
    render: (_, blobUrl) => {
      // More options: https://tinytip.co/tips/html-pdf-params/
      // https://chromium.googlesource.com/chromium/src/+/refs/tags/121.0.6153.1/chrome/browser/resources/pdf/open_pdf_params_parser.ts
      const parameters = '#toolbar=0';
      return html`
        <iframe
          style=${styleMap({
            width: '100%',
            minHeight: '480px',
            colorScheme: 'auto',
          })}
          src=${blobUrl + parameters}
          loading="lazy"
          scrolling="no"
          frameborder="no"
          allowTransparency
          allowfullscreen
          type="application/pdf"
          credentialless
        ></iframe>
        <div class="affine-attachment-embed-event-mask"></div>
      `;
    },
  },
  {
    name: 'video',
    shouldShowStatus: true,
    check: (model, maxFileSize) =>
      model.props.type.startsWith('video/') && model.props.size <= maxFileSize,
    action: model => {
      const bound = Bound.deserialize(model.props.xywh);
      bound.w = EMBED_CARD_WIDTH.video;
      bound.h = EMBED_CARD_HEIGHT.video;
      model.store.updateBlock(model, {
        embed: true,
        style: 'video',
        xywh: bound.serialize(),
      });
    },
    render: (_, blobUrl) =>
      html`<video
        style=${styleMap({
          display: 'flex',
          objectFit: 'cover',
          backgroundSize: 'cover',
          width: '100%',
          height: '100%',
        })}
        src=${blobUrl}
        width="100%"
        height="100%"
        controls
      ></video>`,
  },
  {
    name: 'audio',
    check: (model, maxFileSize) =>
      model.props.type.startsWith('audio/') && model.props.size <= maxFileSize,
    render: (_, blobUrl) =>
      html`<audio
        style=${styleMap({ margin: '4px' })}
        src=${blobUrl}
        controls
      ></audio>`,
  },
  {
    name: 'html',
    shouldShowStatus: true,
    // Without a page from the host it stays a card: never a `srcdoc` for this
    // case, and never the blob url, which has the app's origin (ADR 0048).
    check: (model, maxFileSize, std) =>
      isHtmlAttachment(model.props) &&
      model.props.size <= maxFileSize &&
      Boolean(std && htmlFrameUrl(std)),
    action: model => {
      // Around its centre: anchored by its corner, a wide view leaves its buttons
      // off the screen on a canvas (ADR 0048).
      const bound = Bound.fromCenter(
        Bound.deserialize(model.props.xywh).center,
        EMBED_CARD_WIDTH.html,
        EMBED_CARD_HEIGHT.html
      );
      model.store.updateBlock(model, {
        embed: true,
        style: 'html',
        xywh: bound.serialize(),
      });
    },
    render: (model, _, std) => (std ? renderHtmlView(model, std, true) : null),
    renderThumbnail: (model, std) => renderHtmlView(model, std, false),
  },
];

function htmlFrameUrl(std: BlockStdScope) {
  return std.getOptional(EmbedHtmlConfigExtension.identifier)?.frameUrl ?? null;
}

function renderHtmlView(
  model: AttachmentBlockModel,
  std: BlockStdScope,
  embed: boolean
) {
  const frameUrl = htmlFrameUrl(std);
  if (!frameUrl) return null;
  return html`<affine-attachment-html-view
    .model=${model}
    .std=${std}
    .frameUrl=${frameUrl}
    ?embed=${embed}
  ></affine-attachment-html-view>`;
}

/** What selects another block the way `blockId` is selected now, if it is. */
function selectionFollowing(std: BlockStdScope, blockId: string) {
  const { selection: surface } = std.get(GfxControllerIdentifier);
  if (surface.has(blockId)) {
    return (id: string) => surface.set({ elements: [id], editing: false });
  }
  const { selection } = std;
  if (selection.filter(BlockSelection).some(s => s.blockId === blockId)) {
    return (id: string) =>
      selection.setGroup('note', [
        selection.create(BlockSelection, { blockId: id }),
      ]);
  }
  return () => undefined;
}

/**
 * Turn the attachment block into an image block. Answers the image's id.
 */
async function turnIntoImageBlock(model: AttachmentBlockModel) {
  if (!model.store.schema.flavourSchemaMap.has('affine:image')) {
    console.error('The image flavour is not supported!');
    return null;
  }

  const sourceId = model.props.sourceId;
  if (!sourceId) return null;

  const { saveAttachmentData, getImageData } = withTempBlobData();
  saveAttachmentData(sourceId, { name: model.props.name });

  let imageSize = model.props.sourceId
    ? getImageData(model.props.sourceId)
    : undefined;

  const bounds = model.xywh
    ? Bound.fromXYWH(model.deserializedXYWH)
    : undefined;

  if (bounds) {
    if (!imageSize?.width || !imageSize?.height) {
      const blob = await getAttachmentBlob(model);
      if (blob) {
        imageSize = await readImageSize(blob);
      }
    }

    if (imageSize?.width && imageSize?.height) {
      const p = imageSize.height / imageSize.width;
      imageSize.width = Math.min(imageSize.width, MAX_IMAGE_WIDTH);
      imageSize.height = imageSize.width * p;
      bounds.w = imageSize.width;
      bounds.h = imageSize.height;
    }
  }

  const others = bounds ? { xywh: bounds.serialize() } : undefined;

  const imageProp: Partial<ImageBlockProps> = {
    sourceId,
    caption: model.props.caption,
    size: model.props.size,
    // Its place on a canvas is its depth too.
    index: model.props.index,
    ...imageSize,
    ...others,
  };
  return transformModel(model, 'affine:image', imageProp);
}
