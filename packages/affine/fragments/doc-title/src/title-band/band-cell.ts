import type { TitleBandProperty } from '@labre/affine-shared/services';
import {
  type PropertyMetaConfig,
  type SelectTag,
  selectOptionColors,
} from '@labre/affine-database-engine';
import { propertyPresets } from '@labre/affine-database-engine/property-presets';

import { chipOptions } from './format.js';

/**
 * Which data-view cell draws a band property, and the value and config that
 * cell is handed (ADR 0035 §11, amended 2026-10-13: the chips are the table's
 * own cells).
 *
 * The band speaks the data-view types (§9d), plus the aliases a host's sheet
 * holds whose shape a preset already reads: a URL is the table's `link` cell,
 * the text-like types the `text` cell, the time stamps a read-only `date`.
 * A type with no cell here (`relation`, `image`, an invented one) keeps the
 * band's plain-text reading and opens the properties panel instead.
 *
 * The host's JSON is never trusted to have the preset's shape: a renderer
 * that meets a string where it maps an array throws mid-render, so each value
 * is narrowed to its cell's raw shape, and anything else reads as empty.
 */
const CELL_TYPES: Readonly<Record<string, string>> = Object.assign(
  Object.create(null),
  {
    checkbox: 'checkbox',
    select: 'select',
    'multi-select': 'multi-select',
    date: 'date',
    'created-time': 'date',
    'modified-time': 'date',
    number: 'number',
    progress: 'progress',
    text: 'text',
    'rich-text': 'text',
    title: 'text',
    email: 'text',
    phone: 'text',
    link: 'link',
    url: 'link',
  }
);

/** Drawn by their cell, never edited from the band. */
const READ_ONLY_TYPES = new Set(['created-time', 'modified-time']);

const PRESETS = new Map<string, PropertyMetaConfig>(
  [
    propertyPresets.checkboxPropertyConfig,
    propertyPresets.datePropertyConfig,
    propertyPresets.multiSelectPropertyConfig,
    propertyPresets.numberPropertyConfig,
    propertyPresets.progressPropertyConfig,
    propertyPresets.selectPropertyConfig,
    propertyPresets.textPropertyConfig,
  ].map(meta => [meta.type, meta as PropertyMetaConfig])
);

const DEFAULT_TAG_COLOR = selectOptionColors.at(-1)?.color ?? '';

/** The data-view cell type that draws a band property of `type`, if any. */
export function bandCellType(type: string): string | undefined {
  return CELL_TYPES[type];
}

/**
 * The cell's meta: one a package above registered for that cell type (the
 * database block's `link`), else this package's preset. Without its
 * registration a link is drawn by the `text` cell.
 */
export function bandCellMeta(
  type: string,
  registered: (cellType: string) => PropertyMetaConfig | null
): PropertyMetaConfig | null {
  const cellType = bandCellType(type);
  if (!cellType) return null;
  return (
    registered(cellType) ??
    PRESETS.get(cellType) ??
    (cellType === 'link' ? (PRESETS.get('text') ?? null) : null)
  );
}

export function isBandReadonlyType(type: string): boolean {
  return READ_ONLY_TYPES.has(type);
}

const isFiniteNumber = (value: unknown): value is number =>
  typeof value === 'number' && Number.isFinite(value);

/** The value in the raw shape of the cell type `cellType` reads. */
export function bandCellValue(cellType: string, value: unknown): unknown {
  switch (cellType) {
    case 'checkbox':
      return value === true;
    case 'select':
      return typeof value === 'string' && value !== '' ? value : undefined;
    case 'multi-select':
      return Array.isArray(value)
        ? value.filter((id): id is string => typeof id === 'string')
        : undefined;
    case 'date':
    case 'number':
    case 'progress':
      return isFiniteNumber(value) ? value : undefined;
    default:
      if (typeof value === 'string') return value;
      if (isFiniteNumber(value)) return String(value);
      return undefined;
  }
}

/** The property's config as the cell reads it: a select's tags, complete. */
export function bandCellData(
  cellType: string,
  property: TitleBandProperty
): Record<string, unknown> {
  if (cellType !== 'select' && cellType !== 'multi-select') {
    return property.data;
  }
  const options: SelectTag[] = chipOptions(property).map(tag => ({
    id: tag.id,
    value: tag.label,
    color: tag.color ?? DEFAULT_TAG_COLOR,
  }));
  return { ...property.data, options };
}

/**
 * What the band writes back for a value a cell commits: `null` for an empty
 * one (the seam's "clear"), the value itself otherwise.
 */
export function bandWriteValue(value: unknown): unknown {
  if (value === undefined) return null;
  if (typeof value === 'string' && value.trim() === '') return null;
  if (typeof value === 'number' && Number.isNaN(value)) return null;
  return value;
}

/** Whether a committed value is the one the chip already shows. */
export function sameBandValue(
  cellType: string,
  current: unknown,
  next: unknown
): boolean {
  const a = bandWriteValue(bandCellValue(cellType, current));
  const b = bandWriteValue(next);
  if (Array.isArray(a) && Array.isArray(b)) {
    return a.length === b.length && a.every((item, i) => item === b[i]);
  }
  return a === b;
}

/**
 * Whether a chip's tag menu creates and renames options (product owner,
 * 2026-10-14): a select or multi-select whose host takes a definition write
 * (`setData`) and says so for this property (`dataWritable: true`). Anything
 * else keeps its options fixed, the 0.48 band. A read-only chip opens no
 * editor whatever this says.
 */
export function bandOptionsWritable(
  cellType: string,
  property: TitleBandProperty,
  hasSetData: boolean
): boolean {
  return (
    hasSetData &&
    property.dataWritable === true &&
    (cellType === 'select' || cellType === 'multi-select')
  );
}
