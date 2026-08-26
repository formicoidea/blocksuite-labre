import { describe, expect, test } from 'vitest';

import { parseFrontmatter } from '../transformers/markdown.js';
import { parseMatter } from '../transformers/utils.js';

describe('parseMatter', () => {
  test('splits the metadata off the content', () => {
    const parsed = parseMatter(`---
title: Web developer
tags: [a, b]
---
Hello world
`);
    expect(parsed?.metadata).toEqual({
      title: 'Web developer',
      tags: ['a', 'b'],
    });
    expect(parsed?.body).toBe('Hello world\n');
  });

  test('reads a block sequence', () => {
    expect(
      parseMatter(`---
tags:
  - alpha
  - "beta gamma"
---
body
`)?.metadata
    ).toEqual({ tags: ['alpha', 'beta gamma'] });
  });

  test('keeps a value that contains colons', () => {
    expect(
      parseMatter(`---
created: 2018-04-12T09:51:00
---
body
`)?.metadata
    ).toEqual({ created: '2018-04-12T09:51:00' });
  });

  test('ignores comments and blank lines', () => {
    expect(
      parseMatter(`---
# a comment

title: Kept
---
body
`)?.metadata
    ).toEqual({ title: 'Kept' });
  });

  test('leaves a horizontal rule alone', () => {
    expect(parseMatter('Some text\n\n---\n\nMore text\n')).toBeNull();
    expect(parseMatter('---\n\nnot frontmatter\n')).toBeNull();
  });

  test('returns null without frontmatter', () => {
    expect(parseMatter('# Just a heading\n')).toBeNull();
  });
});

describe('parseFrontmatter', () => {
  test('maps the recognised keys onto doc meta', () => {
    const { content, meta } = parseFrontmatter(`---
title: Web developer
created: 2018-04-12T09:51:00
updated: 2018-04-12T10:00:00
tags: [a, b]
favorite: true
unknown: whatever
---
Hello world
`);
    expect(content).toBe('Hello world\n');
    expect(meta).toEqual({
      title: 'Web developer',
      createDate: Date.parse('2018-04-12T09:51:00'),
      updatedDate: Date.parse('2018-04-12T10:00:00'),
      tags: ['a', 'b'],
      favorite: true,
    });
  });

  test('accepts the alternative spellings and an epoch in seconds', () => {
    const { meta } = parseFrontmatter(`---
name: Alternative
last_edited_time: 1523526660
starred: no
categories: one, two, one
---
body
`);
    expect(meta).toEqual({
      title: 'Alternative',
      updatedDate: 1523526660000,
      tags: ['one', 'two'],
      favorite: false,
    });
  });

  test('leaves a file without frontmatter untouched', () => {
    const markdown = '# Heading\n\nbody\n';
    expect(parseFrontmatter(markdown)).toEqual({ content: markdown, meta: {} });
  });
});
