/**
 * A Notion user avatar is not imported as an image block (GitHub issue #734;
 * upstream toeverything/AFFiNE#15899, commit 7ee31d9).
 *
 * Notion exports a person value (a database person cell, a "created by"
 * property, a mention) as `<span class="user"><img class="icon user-icon">Name`.
 * The image matcher (`affine/blocks/image/src/adapters/notion-html.ts`)
 * accepted every `img`, so each avatar became a full-size image block above
 * the database or the paragraph. The person's name must still be imported.
 * (A Notion `<p>` always carries an id; the paragraph matcher skips one
 * without, so the fixtures give theirs one.)
 *
 * The avatar URL is served through the image proxy by an msw handler, so a
 * regression shows as an `affine:image` block rather than as a failed fetch.
 */
import { NotionHtmlAdapter } from '@labre/affine-shared/adapters';
import { DEFAULT_IMAGE_PROXY_ENDPOINT } from '@labre/affine-shared/consts';
import {
  AssetsManager,
  type BlockSnapshot,
  MemoryBlobCRUD,
} from '@labre/store';
import { http, HttpResponse } from 'msw';
import { setupServer } from 'msw/node';
import { afterAll, afterEach, beforeAll, describe, expect, test } from 'vitest';

import { createJob } from '../utils/create-job.js';
import { getProvider } from '../utils/get-provider.js';

const provider = getProvider();

const avatarUrl =
  'https://s3-us-west-2.amazonaws.com/public.notion-static.com/avatar.png';
const proxiedAvatarUrl = `${DEFAULT_IMAGE_PROXY_ENDPOINT}?url=${encodeURIComponent(avatarUrl)}`;

const server = setupServer(
  http.get(proxiedAvatarUrl, () => {
    return new HttpResponse(new Blob(['avatar'], { type: 'image/png' }), {
      headers: { 'Content-Type': 'image/png' },
    });
  })
);
beforeAll(() => server.listen({ onUnhandledRequest: 'error' }));
afterAll(() => server.close());
afterEach(() => server.resetHandlers());

const userAvatar = `<span class="user"><img src="${avatarUrl}" class="icon user-icon" />Alice</span>`;

function flavours(block: BlockSnapshot): string[] {
  return [block.flavour, ...block.children.flatMap(flavours)];
}

async function importBody(body: string): Promise<BlockSnapshot> {
  const adapter = new NotionHtmlAdapter(createJob(), provider);
  const snapshot = await adapter.toBlockSnapshot({
    file: `<div class="page-body">${body}</div>`,
    assets: new AssetsManager({ blob: new MemoryBlobCRUD() }),
  });
  if (!snapshot) throw new Error('the import produced no snapshot');
  return snapshot;
}

describe('a Notion user avatar', () => {
  test.each([
    {
      location: 'a database person cell',
      body: `<table class="collection-content">
          <thead><tr><th>Name</th><th>Person</th></tr></thead>
          <tbody><tr><td class="cell-title"><a>Row</a></td><td>${userAvatar}</td></tr></tbody>
        </table>`,
    },
    {
      location: 'a paragraph',
      body: `<p id="a1b2c3d4-0000-4000-8000-000000000001">${userAvatar}</p>`,
    },
  ])('in $location is not imported as an image', async ({ body }) => {
    expect(flavours(await importBody(body))).not.toContain('affine:image');
  });

  test('keeps the person name in a paragraph', async () => {
    const snapshot = await importBody(
      `<p id="a1b2c3d4-0000-4000-8000-000000000001">${userAvatar}</p>`
    );
    expect(JSON.stringify(snapshot)).toContain('Alice');
  });

  test('does not stop a plain img from importing as an image', async () => {
    const snapshot = await importBody(`<img src="${avatarUrl}" />`);
    expect(flavours(snapshot)).toContain('affine:image');
  });
});
