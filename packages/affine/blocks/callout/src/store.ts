import {
  type StoreExtensionContext,
  StoreExtensionProvider,
} from '@labre/affine-ext-loader';
import { CalloutBlockSchemaExtension } from '@labre/affine-model';

import { CalloutBlockHtmlAdapterExtension } from './adapters/html';
import { CalloutBlockMarkdownAdapterExtension } from './adapters/markdown';

export class CalloutStoreExtension extends StoreExtensionProvider {
  override name = 'affine-callout-block';

  override setup(context: StoreExtensionContext) {
    super.setup(context);
    context.register(CalloutBlockSchemaExtension);
    context.register(CalloutBlockHtmlAdapterExtension);
    context.register(CalloutBlockMarkdownAdapterExtension);
  }
}
