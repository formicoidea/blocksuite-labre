/// <reference types="vite/client" />
/**
 * An html file is an ordinary attachment that the shared frame previews
 * (ADR 0048).
 *
 * What it would have caught:
 * - an html attachment offered an embed view without a page from the host: no
 *   `srcdoc` for this case, it stays a card;
 * - the preview reaching for the attachment's `blob:` url, which has the origin
 *   of the app, whatever the block declares;
 * - a host's `AttachmentEmbedConfig` of the previous shape no longer compiling.
 */
import type { AttachmentBlockModel } from '@labre/affine-model';
import { HtmlFileConfigExtension } from '@labre/affine-shared/services';
import { FileSizeLimitProvider } from '@labre/affine-shared/services';
import { Container } from '@labre/global/di';
import { type BlockStdScope, StdIdentifier } from '@labre/std';
import { render, type TemplateResult } from 'lit';
import { describe, expect, test } from 'vitest';

import {
  type AttachmentEmbedConfig,
  AttachmentEmbedConfigExtension,
  AttachmentEmbedProvider,
  AttachmentEmbedService,
} from '../embed.js';
import { isHtmlAttachment, withHtmlDefaultView } from '../html-attachment.js';

const MAX_FILE_SIZE = 1024;
const FILE_SIZE = 10;
const BLOB_URL = 'blob:http://localhost/app-origin';

// A host's config of the shape before `std` and `renderThumbnail`: `yarn build`
// fails if a minor narrows the type it implements.
export const previousShape: AttachmentEmbedConfig = {
  name: 'host',
  check: (_model: AttachmentBlockModel, _maxFileSize: number) => true,
  render: (_model: AttachmentBlockModel, _blobUrl: string) => null,
};

function provider(frameUrl?: string) {
  const di = new Container();
  const std = {
    get: (identifier: never) => di.provider().get(identifier),
    getOptional: (identifier: unknown) =>
      identifier === HtmlFileConfigExtension.identifier && frameUrl
        ? { frameUrl }
        : null,
  } as unknown as BlockStdScope;
  di.addImpl(StdIdentifier, () => std);
  di.addImpl(FileSizeLimitProvider, () => ({
    maxFileSize: MAX_FILE_SIZE,
    onOverFileSize: undefined,
  }));
  AttachmentEmbedConfigExtension().setup(di);
  AttachmentEmbedService.setup(di);
  return di.provider().get(AttachmentEmbedProvider);
}

function model(props: Partial<AttachmentBlockModel['props']>) {
  return {
    store: { schema: { flavourSchemaMap: new Map() } },
    props: {
      name: 'report.html',
      type: 'text/html',
      size: FILE_SIZE,
      ...props,
    },
  } as unknown as AttachmentBlockModel;
}

describe('what counts as html', () => {
  test.each([
    ['report.html', 'text/html'],
    ['REPORT.HTM', 'TEXT/HTML; charset=utf-8'],
    ['report', 'application/xhtml+xml'],
    ['report.html', ''],
    ['report.xhtml', 'application/octet-stream'],
  ])('%s declared %j', (name, type) => {
    expect(isHtmlAttachment({ name, type })).toBe(true);
  });

  test.each([
    ['report.pdf', 'application/pdf'],
    ['report.html', 'application/pdf'],
    ['photo.html', 'image/png'],
    ['report', ''],
  ])('%s declared %j is not', (name, type) => {
    expect(isHtmlAttachment({ name, type })).toBe(false);
  });
});

describe('the embed view of an html attachment', () => {
  test('without a page from the host it stays a card', () => {
    const service = provider();
    expect(service.embedded(model({}))).toBe(false);
    expect(service.getRender(model({}))).toBeNull();
    expect(service.renderThumbnail(model({}))).toBeNull();
  });

  test('with a page it has an embed view and a thumbnail', () => {
    const service = provider('/frame.html');
    expect(service.embedded(model({}))).toBe(true);
    expect(service.getRender(model({}))).not.toBeNull();
    expect(service.renderThumbnail(model({}))).not.toBeNull();
  });

  test('over the size limit it stays a card, as a pdf does', () => {
    const service = provider('/frame.html');
    const big = model({ size: MAX_FILE_SIZE + 1 });
    expect(service.embedded(big)).toBe(false);
  });

  test('a pdf keeps its own config: the name does not decide', () => {
    const service = provider('/frame.html');
    const pdf = model({ name: 'report.html', type: 'application/pdf' });
    expect(service.renderThumbnail(pdf)).toBeNull();
  });

  test('it is mounted without the blob url, whatever is declared', () => {
    const service = provider('/frame.html');
    const attachment = model({});
    const std = { getOptional: () => ({ frameUrl: '/frame.html' }) };
    const template = service.getRender(attachment)?.(
      attachment,
      BLOB_URL,
      std as unknown as BlockStdScope
    ) as TemplateResult;
    const container = document.createElement('div');
    render(template, container);

    const view = container.firstElementChild as HTMLElement & {
      frameUrl: string;
    };
    expect(view.localName).toBe('affine-attachment-html-view');
    expect(view.frameUrl).toBe('/frame.html');
    expect(container.innerHTML).not.toContain('blob:');
    expect(template.values).not.toContain(BLOB_URL);
  });
});

describe('the view an html file opens on', () => {
  const props = { name: 'report.html', type: 'text/html' };
  const withPage = {
    getOptional: () => ({ frameUrl: '/frame.html' }),
  } as unknown as BlockStdScope;
  const withoutPage = {
    getOptional: () => null,
  } as unknown as BlockStdScope;

  test('its embed view, once the host has named its page', () => {
    expect(withHtmlDefaultView(withPage, props)).toEqual({
      ...props,
      embed: true,
      style: 'html',
    });
  });

  test('its card without a page, and any other file its card', () => {
    expect(withHtmlDefaultView(withoutPage, props)).toEqual(props);
    const pdf = { name: 'a.pdf', type: 'application/pdf' };
    expect(withHtmlDefaultView(withPage, pdf)).toEqual(pdf);
  });
});

describe('the source of the html view', () => {
  const source = Object.values(
    import.meta.glob<string>('../html-view.ts', {
      query: '?raw',
      import: 'default',
      eager: true,
    })
  ).join('\n');

  test('it never touches a url of the file, and draws no frame of its own', () => {
    expect(source).not.toContain('blobUrl');
    expect(source).not.toContain('createObjectURL');
    expect(source).not.toContain('window.open');
    expect(source).not.toContain('<iframe');
  });
});
