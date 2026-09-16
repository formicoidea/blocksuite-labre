import {
  type StoreExtensionContext,
  StoreExtensionProvider,
} from '@labre/affine-ext-loader';

import {
  groupToMarkdownAdapterMatcher,
  groupToPlainTextAdapterMatcher,
} from './adapter';

export class GroupStoreExtension extends StoreExtensionProvider {
  override name = 'affine-group-gfx';

  override setup(context: StoreExtensionContext) {
    super.setup(context);
    context.register(groupToPlainTextAdapterMatcher);
    context.register(groupToMarkdownAdapterMatcher);
  }
}
