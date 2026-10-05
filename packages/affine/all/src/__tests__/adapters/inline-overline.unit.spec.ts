/**
 * Inline overline (ADR 0030 §5): an affine-level attribute, declared and
 * rendered exactly the way underline is, without touching the store.
 *
 * Pinned here because the pieces live in four packages and only the assembly
 * sees them together:
 *
 * - the inline spec is registered, so the editor schema (the intersection of
 *   the store's base attributes and every spec) keeps `overline`;
 * - the format bar offers it beside underline, with its own key and NO default
 *   chord (`Mod-u` is underline's; a host binds one through the shortcuts
 *   pane);
 * - the rich-text style composes it into `text-decoration`;
 * - HTML writes and reads it as `text-decoration: overline`, and Markdown,
 *   which cannot say it, drops it and keeps the words.
 */
import {
  InlineSpecExtensions,
  OverlineInlineSpecExtension,
  textFormatConfigs,
  toggleOverline,
} from '@labre/affine-inline-preset';
import { DefaultTheme, NoteDisplayMode } from '@labre/affine-model';
import { HtmlAdapter, MarkdownAdapter } from '@labre/affine-shared/adapters';
import { TEXT_FORMAT_OVERLINE } from '@labre/affine-shared/services';
import { affineTextStyles } from '@labre/affine-shared/styles';
import type { BlockSnapshot } from '@labre/store';
import { describe, expect, test } from 'vitest';

import { createJob } from '../utils/create-job.js';
import { getProvider } from '../utils/get-provider.js';

const provider = getProvider();

/** A page holding one paragraph made of these runs. */
function pageWith(
  delta: { insert: string; attributes?: Record<string, unknown> }[]
): BlockSnapshot {
  return {
    type: 'block',
    id: 'block:page',
    flavour: 'affine:page',
    props: {
      title: { '$blocksuite:internal:text$': true, delta: [] },
    },
    children: [
      {
        type: 'block',
        id: 'block:note',
        flavour: 'affine:note',
        props: {
          xywh: '[0,0,800,95]',
          background: DefaultTheme.noteBackgrounColor,
          index: 'a0',
          hidden: false,
          displayMode: NoteDisplayMode.DocAndEdgeless,
        },
        children: [
          {
            type: 'block',
            id: 'block:paragraph',
            flavour: 'affine:paragraph',
            props: {
              type: 'text',
              text: { '$blocksuite:internal:text$': true, delta },
            },
            children: [],
          },
        ],
      },
    ],
  };
}

/** The runs of the first paragraph an HTML import produced. */
async function importHtml(body: string) {
  const adapter = new HtmlAdapter(createJob(), provider);
  const snapshot = await adapter.toBlockSnapshot({
    file: `<html><body>${body}</body></html>`,
  });
  const paragraph = (function find(block: BlockSnapshot): BlockSnapshot | null {
    if (block.flavour === 'affine:paragraph') return block;
    for (const child of block.children) {
      const found = find(child);
      if (found) return found;
    }
    return null;
  })(snapshot!);
  return (paragraph!.props.text as { delta: unknown[] }).delta;
}

describe('the overline attribute', () => {
  test('is a registered inline spec', () => {
    expect(InlineSpecExtensions).toContain(OverlineInlineSpecExtension);
  });

  test('is offered by the format bar beside underline, with no chord', () => {
    const ids = textFormatConfigs.map(config => config.id);
    expect(ids.indexOf('overline')).toBe(ids.indexOf('underline') + 1);

    const overline = textFormatConfigs.find(
      config => config.id === 'overline'
    )!;
    expect(overline.nameWording).toEqual(TEXT_FORMAT_OVERLINE);
    expect(overline.hotkey).toBeUndefined();
    expect(typeof toggleOverline).toBe('function');
  });

  test('composes into the rich-text decoration', () => {
    expect(affineTextStyles({ overline: true })['text-decoration']).toBe(
      'overline'
    );
    expect(
      affineTextStyles({ underline: true, overline: true, strike: true })[
        'text-decoration'
      ]
    ).toBe('underline overline line-through');
    expect(affineTextStyles({})['text-decoration']).toBe('none');
  });
});

describe('overline through the adapters', () => {
  test('HTML export writes text-decoration: overline', async () => {
    const adapter = new HtmlAdapter(createJob(), provider);
    const target = await adapter.fromBlockSnapshot({
      snapshot: pageWith([
        { insert: 'aaa ' },
        { insert: 'bbb', attributes: { overline: true } },
      ]),
    });

    expect(target.file).toContain(
      '<span style="text-decoration: overline;">bbb</span>'
    );
  });

  test('HTML import reads text-decoration: overline', async () => {
    expect(
      await importHtml(
        '<p>aaa <span style="text-decoration: overline;">bbb</span></p>'
      )
    ).toEqual([
      { insert: 'aaa ' },
      { insert: 'bbb', attributes: { overline: true } },
    ]);
  });

  test('HTML round-trips an underlined and overlined run', async () => {
    // Export nests one element per attribute, which is what import unwraps.
    const adapter = new HtmlAdapter(createJob(), provider);
    const target = await adapter.fromBlockSnapshot({
      snapshot: pageWith([
        { insert: 'ccc', attributes: { underline: true, overline: true } },
      ]),
    });
    const body = target.file.slice(
      target.file.indexOf('<p'),
      target.file.lastIndexOf('</p>') + 4
    );

    expect(await importHtml(body)).toEqual([
      { insert: 'ccc', attributes: { underline: true, overline: true } },
    ]);
  });

  test('Markdown export drops it and keeps the words', async () => {
    const adapter = new MarkdownAdapter(createJob(), provider);
    const target = await adapter.fromBlockSnapshot({
      snapshot: pageWith([
        { insert: 'aaa ' },
        { insert: 'bbb', attributes: { overline: true } },
        { insert: ' ccc' },
      ]),
    });

    expect(target.file).toBe('aaa bbb ccc\n');
  });
});
