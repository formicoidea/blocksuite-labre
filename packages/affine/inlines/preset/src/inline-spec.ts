import type { AffineTextAttributes } from '@labre/affine-shared/types';
import { type InlineRootElement, InlineSpecExtension } from '@labre/std/inline';
import type { ExtensionType } from '@labre/store';
import { html } from 'lit';
import { z } from 'zod';

export type AffineInlineRootElement = InlineRootElement<AffineTextAttributes>;

export const BoldInlineSpecExtension =
  InlineSpecExtension<AffineTextAttributes>({
    name: 'bold',
    schema: z.object({
      bold: z.literal(true).optional().nullable().catch(undefined),
    }),
    match: delta => {
      return !!delta.attributes?.bold;
    },
    renderer: ({ delta }) => {
      return html`<affine-text .delta=${delta}></affine-text>`;
    },
  });

export const ItalicInlineSpecExtension =
  InlineSpecExtension<AffineTextAttributes>({
    name: 'italic',
    schema: z.object({
      italic: z.literal(true).optional().nullable().catch(undefined),
    }),
    match: delta => {
      return !!delta.attributes?.italic;
    },
    renderer: ({ delta }) => {
      return html`<affine-text .delta=${delta}></affine-text>`;
    },
  });

export const UnderlineInlineSpecExtension =
  InlineSpecExtension<AffineTextAttributes>({
    name: 'underline',
    schema: z.object({
      underline: z.literal(true).optional().nullable().catch(undefined),
    }),
    match: delta => {
      return !!delta.attributes?.underline;
    },
    renderer: ({ delta }) => {
      return html`<affine-text .delta=${delta}></affine-text>`;
    },
  });

/** Underline's twin, declared at the affine level only (ADR 0030 §5). */
export const OverlineInlineSpecExtension =
  InlineSpecExtension<AffineTextAttributes>({
    name: 'overline',
    schema: z.object({
      overline: z.literal(true).optional().nullable().catch(undefined),
    }),
    match: delta => {
      return !!delta.attributes?.overline;
    },
    renderer: ({ delta }) => {
      return html`<affine-text .delta=${delta}></affine-text>`;
    },
  });

export const StrikeInlineSpecExtension =
  InlineSpecExtension<AffineTextAttributes>({
    name: 'strike',
    schema: z.object({
      strike: z.literal(true).optional().nullable().catch(undefined),
    }),
    match: delta => {
      return !!delta.attributes?.strike;
    },
    renderer: ({ delta }) => {
      return html`<affine-text .delta=${delta}></affine-text>`;
    },
  });

export const CodeInlineSpecExtension =
  InlineSpecExtension<AffineTextAttributes>({
    name: 'inline-code',
    schema: z.object({
      code: z.literal(true).optional().nullable().catch(undefined),
    }),
    match: delta => {
      return !!delta.attributes?.code;
    },
    renderer: ({ delta }) => {
      return html`<affine-text .delta=${delta}></affine-text>`;
    },
  });

export const BackgroundInlineSpecExtension =
  InlineSpecExtension<AffineTextAttributes>({
    name: 'background',
    schema: z.object({
      background: z.string().optional().nullable().catch(undefined),
    }),
    match: delta => {
      return !!delta.attributes?.background;
    },
    renderer: ({ delta }) => {
      return html`<affine-text .delta=${delta}></affine-text>`;
    },
  });

export const ColorInlineSpecExtension =
  InlineSpecExtension<AffineTextAttributes>({
    name: 'color',
    schema: z.object({
      color: z.string().optional().nullable().catch(undefined),
    }),
    match: delta => {
      return !!delta.attributes?.color;
    },
    renderer: ({ delta }) => {
      return html`<affine-text .delta=${delta}></affine-text>`;
    },
  });

export const InlineSpecExtensions: ExtensionType[] = [
  BoldInlineSpecExtension,
  ItalicInlineSpecExtension,
  UnderlineInlineSpecExtension,
  OverlineInlineSpecExtension,
  StrikeInlineSpecExtension,
  CodeInlineSpecExtension,
  BackgroundInlineSpecExtension,
  ColorInlineSpecExtension,
];
