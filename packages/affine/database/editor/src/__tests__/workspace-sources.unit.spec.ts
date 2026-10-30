/**
 * GUARD — one source list for the whole workspace (ADR 0035 amendment of
 * 2026-10-30, labre « Base de données v3 »): `workspaceSources`, the order
 * the view settings' "Source" and "+ view" draw.
 *
 * What it would have caught:
 * - another database's sources listed without the host's
 *   `crossDatabaseViews` (2.3 hosts must see their block's database only);
 * - this database's sources not first, or reordered (the host's order);
 * - the other databases' sources in the host's order of databases rather
 *   than by name (accents, case and numbers folded), or ties left to chance;
 * - a source of another database without its database, or one of this
 *   database carrying one (its entry would be labelled, its pick written);
 * - the check on the view's source matching a source id alone: the same id
 *   in another database is another source.
 */
import type { DataSourcePickerDatabase } from '@labre/affine-shared/services';
import { describe, expect, test } from 'vitest';

import {
  crossDatabaseViews,
  inDatabase,
  isViewSource,
  workspaceSources,
} from '../workspace-sources.js';

const DATABASES: DataSourcePickerDatabase[] = [
  {
    id: 'db-z',
    title: 'Zoo',
    sources: [
      { id: 's-2', title: 'émeus' },
      { id: 's-10', title: 'Lot 10' },
    ],
  },
  {
    id: 'db-home',
    title: 'Home',
    sources: [
      { id: 's-b', title: 'Beta' },
      { id: 's-a', title: 'Alpha' },
    ],
  },
  {
    id: 'db-a',
    title: 'Atlas',
    sources: [
      { id: 's-2', title: 'Lot 9' },
      { id: 's-3', title: 'Emeus' },
    ],
  },
];

const rows = (home: string, across: boolean) =>
  workspaceSources(DATABASES, home, across).map(source => [
    source.title,
    source.databaseTitle ?? null,
  ]);

describe('workspaceSources', () => {
  test("without crossDatabaseViews: this database's sources, in the host's order", () => {
    expect(rows('db-home', false)).toEqual([
      ['Beta', null],
      ['Alpha', null],
    ]);
    expect(workspaceSources(DATABASES, undefined, false)).toEqual([]);
  });

  test("with it: this database's first, then the others by name, labelled", () => {
    expect(rows('db-home', true)).toEqual([
      ['Beta', null],
      ['Alpha', null],
      // Accents and case folded, a tie by database title.
      ['Emeus', 'Atlas'],
      ['émeus', 'Zoo'],
      // Numbers in numeric order.
      ['Lot 9', 'Atlas'],
      ['Lot 10', 'Zoo'],
    ]);
  });

  test('a source of another database carries it, one of this database none', () => {
    const [own, , foreign] = workspaceSources(DATABASES, 'db-home', true);
    expect(own).toEqual({ sourceId: 's-b', title: 'Beta' });
    expect(foreign).toEqual({
      sourceId: 's-3',
      title: 'Emeus',
      databaseId: 'db-a',
      databaseTitle: 'Atlas',
    });
  });

  test('the check matches database and source, never the id alone', () => {
    const list = workspaceSources(DATABASES, 'db-home', true);
    const checked = (sourceId: string, databaseId?: string) =>
      list
        .filter(source => isViewSource(source, sourceId, databaseId))
        .map(source => source.title);
    expect(checked('s-2', 'db-a')).toEqual(['Lot 9']);
    expect(checked('s-2', 'db-z')).toEqual(['émeus']);
    expect(checked('s-a')).toEqual(['Alpha']);
    expect(checked('s-2')).toEqual([]);
  });

  test('the opt-in is read as a strict true; a database argument only when there is one', () => {
    expect(crossDatabaseViews(null)).toBe(false);
    expect(crossDatabaseViews({})).toBe(false);
    expect(crossDatabaseViews({ crossDatabaseViews: true })).toBe(true);
    expect(inDatabase(undefined)).toEqual([]);
    expect(inDatabase('db-a')).toEqual(['db-a']);
  });
});
