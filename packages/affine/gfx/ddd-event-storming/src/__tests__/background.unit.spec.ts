import { backgroundAxisFact, backgroundSize } from '@labre/affine-block-surface';
import { ES_STICKIES } from '@labre/affine-gfx-ddd-shared';
import { EventStormingBoardElementModel } from '@labre/affine-model';
import { describe, expect, it } from 'vitest';

import { EVENT_STORMING_BACKGROUND } from '../background';
import { eventStormingCommands } from '../commands';
import { ES_ROLE } from '../roles';

describe('the event storming board declaration', () => {
  it('declares the element type the model persists', () => {
    expect(EVENT_STORMING_BACKGROUND.type).toBe('eventStorming');
    // Read off a real instance rather than restated: the two halves of a new
    // element type are the only place this repo has ever drifted.
    expect(EventStormingBoardElementModel.prototype.type).toBe('eventStorming');
  });

  it('carries the board role, so rules have a frame to measure against', () => {
    expect(EVENT_STORMING_BACKGROUND.role).toBe(ES_ROLE.board);
  });

  it('declares ONE axis: time, along the bottom, running right', () => {
    expect(EVENT_STORMING_BACKGROUND.axes).toHaveLength(1);
    const [time] = EVENT_STORMING_BACKGROUND.axes!;
    expect(time.id).toBe('time');
    expect(time.orientation).toBe('horizontal');
    // `1` is the bottom of the plot: under the frieze, not through it.
    expect(time.at).toBe(1);
    expect(time.arrow).toBe('forward');
    expect(time.title?.labelKey).toBe(
      'com.labre.event-storming.background.axis.time'
    );
    expect(time.title?.fallback).toBe('Time');
    // The fact `es.against-timeline` reads: forward is +x, i.e. later is right.
    expect(backgroundAxisFact(EVENT_STORMING_BACKGROUND, 'time')?.forward).toEqual(
      [1, 0]
    );
  });

  it('declares no zones and no variant — swimlanes are cut from v1', () => {
    // A lane would be a variant declaration plus a rule family that reads it.
    // Painting bands nothing can read would put a semantic on the vertical the
    // framework does not have. See `EventStormingBoardElementModel`.
    expect(EVENT_STORMING_BACKGROUND.zones).toBeUndefined();
    expect(EVENT_STORMING_BACKGROUND.variantProp).toBeUndefined();
    expect(EVENT_STORMING_BACKGROUND.transitionBandWidth).toBeUndefined();
  });

  it('is created 3200 × 1400, freely resizable in both directions', () => {
    expect(backgroundSize(EVENT_STORMING_BACKGROUND)).toEqual({
      width: 3200,
      height: 1400,
    });
    expect(EVENT_STORMING_BACKGROUND.geometry.lockAspectRatio).toBe(false);
    expect(EVENT_STORMING_BACKGROUND.geometry.resizable).toBe(true);
    // A second board dropped on a busy canvas matches the biggest thing there
    // rather than shrinking beside it — and, unlocked, in one axis at a time.
    expect(backgroundSize(EVENT_STORMING_BACKGROUND, 4000, 600)).toEqual({
      width: 4000,
      height: 1400,
    });
  });

  it('resolves every palette reference it uses', () => {
    const palette = EVENT_STORMING_BACKGROUND.chrome?.palette ?? {};
    const surface = EVENT_STORMING_BACKGROUND.chrome?.surface;
    const axis = EVENT_STORMING_BACKGROUND.axes![0];
    for (const colour of [
      surface?.fill,
      surface?.border?.color,
      axis.stroke.color,
      axis.title?.style.color,
    ]) {
      expect(colour?.startsWith('@')).toBe(true);
      expect(palette[colour!.slice(1)]).toMatch(/^#[0-9a-f]{6}$/i);
    }
  });

  it('names the eight sticky colours as declared references', () => {
    // Nothing here paints them; the day a `tone-convention` rule asks whether a
    // sticky is drawn in one of the notation's own colours, the answer is
    // already written down beside the card. The Wardley precedent.
    const palette = EVENT_STORMING_BACKGROUND.chrome?.palette ?? {};
    for (const preset of ES_STICKIES) {
      expect(palette[preset.kind], preset.kind).toBe(preset.fill);
    }
  });
});

describe('the palette entries that changed in WS5', () => {
  it('adds two commands: the board, first, and the aggregate sticky', () => {
    expect(eventStormingCommands).toHaveLength(11);
    expect(eventStormingCommands[0].id).toBe('ddd-event-storming.addBoard');
    expect(eventStormingCommands[0].telemetry).toEqual({
      framework: 'ddd-event-storming',
      element: 'board',
    });
    expect(eventStormingCommands.map(command => command.id)).toContain(
      'ddd-event-storming.addAggregate'
    );
  });

  it('renames none of the historical telemetry values', () => {
    // ADR 0008's no-analytics-breakage rule. `board` and `sticky:aggregate` are
    // the only new ones; `flow` still says `flow` even though the entry now
    // arms the connector tool instead of dropping a drawing.
    expect(
      eventStormingCommands.map(command => command.telemetry?.element)
    ).toEqual([
      'board',
      'sticky:domainEvent',
      'sticky:command',
      'sticky:aggregate',
      'sticky:actor',
      'sticky:constraint',
      'sticky:policy',
      'sticky:readModel',
      'sticky:system',
      'sticky:hotspot',
      'flow',
    ]);
  });
});
