import {
  type StoreExtensionContext,
  StoreExtensionProvider,
} from '@labre/affine-ext-loader';
import { SurfaceRefBlockSchemaExtension } from '@labre/affine-model';

import { SurfaceRefBlockHtmlAdapterExtension } from './adapters/html';

export class SurfaceRefStoreExtension extends StoreExtensionProvider {
  override name = 'affine-surface-ref-block';

  override setup(context: StoreExtensionContext) {
    super.setup(context);
    context.register(SurfaceRefBlockSchemaExtension);
    context.register(SurfaceRefBlockHtmlAdapterExtension);
  }
}
