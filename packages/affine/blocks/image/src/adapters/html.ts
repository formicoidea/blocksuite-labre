import { ImageBlockSchema } from '@labre/affine-model';
import {
  BlockHtmlAdapterExtension,
  type BlockHtmlAdapterMatcher,
  HastUtils,
} from '@labre/affine-shared/adapters';
import { getAssetName } from '@labre/store';

import { processImageNodeToBlock } from './utils';

export const imageBlockHtmlAdapterMatcher: BlockHtmlAdapterMatcher = {
  flavour: ImageBlockSchema.model.flavour,
  toMatch: o => HastUtils.isElement(o.node) && o.node.tagName === 'img',
  fromMatch: o => o.node.flavour === ImageBlockSchema.model.flavour,
  toBlockSnapshot: {
    enter: async (o, context) => {
      if (!HastUtils.isElement(o.node)) {
        return;
      }
      const { assets, walkerContext, configs } = context;
      if (!assets) {
        return;
      }
      const image = o.node;
      const imageURL =
        typeof image?.properties.src === 'string' ? image.properties.src : '';
      if (!imageURL) {
        return;
      }
      await processImageNodeToBlock(imageURL, walkerContext, assets, configs);
    },
  },
  fromBlockSnapshot: {
    enter: async (o, context) => {
      const blobId = (o.node.props.sourceId ?? '') as string;
      const { assets, walkerContext, updateAssetIds } = context;
      if (!blobId) {
        return;
      }

      await assets?.readFromBlob(blobId);
      updateAssetIds?.(blobId);
      // No blob at hand, or no manager asked to read one: a stored image still
      // prints, under its id, so a server can map it without downloading it.
      const blobName = assets?.getAssets().has(blobId)
        ? getAssetName(assets.getAssets(), blobId)
        : blobId;
      const isScaledImage = o.node.props.width && o.node.props.height;
      const widthStyle = isScaledImage
        ? {
            width: `${o.node.props.width}px`,
            height: `${o.node.props.height}px`,
          }
        : {};

      walkerContext
        .openNode(
          {
            type: 'element',
            tagName: 'figure',
            properties: {
              className: ['affine-image-block-container'],
            },
            children: [],
          },
          'children'
        )
        .openNode(
          {
            type: 'element',
            tagName: 'img',
            properties: {
              src: `assets/${blobName}`,
              alt: blobName,
              title: (o.node.props.caption as string | undefined) ?? null,
              ...widthStyle,
            },
            children: [],
          },
          'children'
        )
        .closeNode()
        .closeNode();
    },
  },
};

export const ImageBlockHtmlAdapterExtension = BlockHtmlAdapterExtension(
  imageBlockHtmlAdapterMatcher
);
