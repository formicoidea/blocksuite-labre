import { AttachmentBlockSchema } from '@labre/affine-model';
import {
  BlockHtmlAdapterExtension,
  type BlockHtmlAdapterMatcher,
} from '@labre/affine-shared/adapters';
import { formatSize } from '@labre/affine-shared/utils';
import { getAssetName } from '@labre/store';

export const attachmentBlockHtmlAdapterMatcher: BlockHtmlAdapterMatcher = {
  flavour: AttachmentBlockSchema.model.flavour,
  toMatch: () => false,
  fromMatch: o => o.node.flavour === AttachmentBlockSchema.model.flavour,
  toBlockSnapshot: {},
  fromBlockSnapshot: {
    // Never reads the blob: rendering or copying a page must not download every
    // file it lists. `updateAssetIds` tells the caller which blobs to serve; a
    // blob the caller already read keeps the name an image would get.
    enter: (o, context) => {
      const { assets, updateAssetIds, walkerContext } = context;
      const { name, size, sourceId } = o.node.props;
      const blobId = typeof sourceId === 'string' ? sourceId : '';
      if (blobId) updateAssetIds?.(blobId);
      const blobName = assets?.getAssets().has(blobId)
        ? getAssetName(assets.getAssets(), blobId)
        : blobId;
      const label = [
        String(name ?? ''),
        typeof size === 'number' && size > 0 ? formatSize(size) : null,
      ].filter(Boolean);
      walkerContext
        .openNode(
          {
            type: 'element',
            tagName: 'a',
            // Still uploading: the name stays, the link waits for a blob.
            properties: {
              className: ['affine-attachment'],
              ...(blobName ? { href: `assets/${blobName}` } : {}),
            },
            children: [{ type: 'text', value: label.join(' · ') }],
          },
          'children'
        )
        .closeNode();
    },
  },
};

export const AttachmentBlockHtmlAdapterExtension = BlockHtmlAdapterExtension(
  attachmentBlockHtmlAdapterMatcher
);
