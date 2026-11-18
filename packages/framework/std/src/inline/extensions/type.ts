import type {
  AttributeRenderer,
  InlineEditor,
  InlineRange,
} from '@labre/std/inline';
import type { BaseTextAttributes, DeltaInsert } from '@labre/store';
import type * as Y from 'yjs';
import type { z } from 'zod';

export type InlineSpecs<
  TextAttributes extends BaseTextAttributes = BaseTextAttributes,
> = {
  name: keyof TextAttributes | string;
  /**
   * The attributes this spec owns, as a zod 4 schema: a `z.object` of
   * optional keys, or a record such as `dynamicSchema` builds. Intersected
   * with the others by `InlineManager.getSchema()`.
   */
  schema: z.ZodType<Partial<Record<string, unknown>>>;
  match: (delta: DeltaInsert<TextAttributes>) => boolean;
  renderer: AttributeRenderer<TextAttributes>;
  embed?: boolean;
  wrapper?: boolean;
};

export type InlineMarkdownMatchAction<
  // @ts-expect-error We allow to covariance for AffineTextAttributes
  in AffineTextAttributes extends BaseTextAttributes = BaseTextAttributes,
> = (props: {
  inlineEditor: InlineEditor<AffineTextAttributes>;
  prefixText: string;
  inlineRange: InlineRange;
  pattern: RegExp;
  undoManager: Y.UndoManager;
}) => void;

export type InlineMarkdownMatch<
  AffineTextAttributes extends BaseTextAttributes = BaseTextAttributes,
> = {
  name: string;
  pattern: RegExp;
  action: InlineMarkdownMatchAction<AffineTextAttributes>;
};
