/**
 * GUARD — the database's slash entries speak the host's language (#572,
 * labre recette of 1.1).
 *
 * « Table View » and « Kanban View » hard-coded their name, description and
 * tooltip caption in English: a French host showed them in English right
 * beside « Vue liée d'une base », which was keyed.
 *
 * What it would have caught: an entry whose name, description or caption
 * has no wording, or a wording whose fallback is not the English the entry
 * is matched by (`name` stays the entry's English identity for search and
 * tests).
 */
import {
  VIEW_NAME_KANBAN,
  VIEW_NAME_TABLE,
} from '@labre/affine-database-engine/translations';
import type { SlashMenuActionItem } from '@labre/affine-widget-slash-menu';
import { describe, expect, test } from 'vitest';

import { databaseSlashMenuConfig } from '../configs/slash-menu.js';

const items = databaseSlashMenuConfig.items as SlashMenuActionItem[];

describe('the database slash entries', () => {
  test.each([
    ['Table View', VIEW_NAME_TABLE],
    ['Kanban View', VIEW_NAME_KANBAN],
  ] as const)('%s: name, description and caption are keyed', (name, word) => {
    const item = items.find(entry => entry.name === name);
    expect(item, name).toBeDefined();
    expect(item!.nameWording).toBe(word);
    expect(item!.tooltip?.captionWording).toBe(word);
    expect(item!.descriptionWording?.[0]).toMatch(/^com\.labre\.database\./);
    expect(item!.descriptionWording?.[1]).toBe(item!.description);
  });
});
