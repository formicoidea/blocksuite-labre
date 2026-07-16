import { IS_MAC } from '@labre/global/env';
import { BlockSuiteError, ErrorCode } from '@labre/global/exceptions';
import { base, keyName } from 'w3c-keyname';

import type { UIEventHandler } from './base.js';

function normalizeKeyName(name: string) {
  const parts = name.split(/-(?!$)/);
  let result = parts.at(-1);
  if (result === 'Space') {
    result = ' ';
  }
  let alt, ctrl, shift, meta;
  parts.slice(0, -1).forEach(mod => {
    if (/^(cmd|meta|m)$/i.test(mod)) {
      meta = true;
      return;
    }
    if (/^a(lt)?$/i.test(mod)) {
      alt = true;
      return;
    }
    if (/^(c|ctrl|control)$/i.test(mod)) {
      ctrl = true;
      return;
    }
    if (/^s(hift)?$/i.test(mod)) {
      shift = true;
      return;
    }
    if (/^mod$/i.test(mod)) {
      if (IS_MAC) {
        meta = true;
      } else {
        ctrl = true;
      }
      return;
    }

    throw new BlockSuiteError(
      ErrorCode.EventDispatcherError,
      'Unrecognized modifier name: ' + mod
    );
  });
  if (alt) result = 'Alt-' + result;
  if (ctrl) result = 'Ctrl-' + result;
  if (meta) result = 'Meta-' + result;
  if (shift) result = 'Shift-' + result;
  return result as string;
}

function modifiers(name: string, event: KeyboardEvent, shift = true) {
  if (event.altKey) name = 'Alt-' + name;
  if (event.ctrlKey) name = 'Ctrl-' + name;
  if (event.metaKey) name = 'Meta-' + name;
  if (shift && event.shiftKey) name = 'Shift-' + name;
  return name;
}

/** How long a chord prefix stays armed before it is forgotten. */
const CHORD_TIMEOUT_MS = 1200;

const MODIFIER_KEYS = new Set(['Shift', 'Control', 'Alt', 'Meta']);

/**
 * Chords must never swallow keystrokes the user is typing into an editable
 * (rich text, inputs) — a chord prefix like `w` is a plain letter there.
 */
function isTypingTarget(event: KeyboardEvent) {
  const target = event.composedPath?.()[0] ?? event.target;
  if (!(target instanceof HTMLElement)) return false;
  return (
    target.isContentEditable ||
    target.tagName === 'INPUT' ||
    target.tagName === 'TEXTAREA'
  );
}

/**
 * Bind a keymap. A binding key is one keystroke (`'Mod-z'`) or a
 * space-separated sequence of keystrokes (`'w c'`): pressing the first
 * keystroke arms the sequence, and the next keystroke (within a short
 * timeout) resolves it. A failed second keystroke falls through to the
 * regular single-keystroke bindings.
 */
export function bindKeymap(
  bindings: Record<string, UIEventHandler>
): UIEventHandler {
  const map: Record<string, UIEventHandler> = Object.create(null);
  const sequences: { steps: string[]; handler: UIEventHandler }[] = [];

  for (const prop in bindings) {
    const steps = prop.split(' ').filter(Boolean);
    if (steps.length > 1) {
      sequences.push({
        steps: steps.map(normalizeKeyName),
        handler: bindings[prop],
      });
    } else {
      map[normalizeKeyName(prop)] = bindings[prop];
    }
  }

  let armed: { steps: string[]; handler: UIEventHandler }[] = [];
  let armedDepth = 0;
  let armedTimer: ReturnType<typeof setTimeout> | null = null;

  const disarm = () => {
    armed = [];
    armedDepth = 0;
    if (armedTimer !== null) {
      clearTimeout(armedTimer);
      armedTimer = null;
    }
  };

  const rearmTimeout = () => {
    if (armedTimer !== null) clearTimeout(armedTimer);
    armedTimer = setTimeout(disarm, CHORD_TIMEOUT_MS);
  };

  return ctx => {
    const state = ctx.get('keyboardState');
    const event = state.raw;
    const name = keyName(event);

    if (sequences.length && !isTypingTarget(event)) {
      // A lone modifier press must not break an armed chord.
      if (armedDepth > 0 && MODIFIER_KEYS.has(name)) {
        return false;
      }

      const stroke = modifiers(name, event);

      if (armedDepth > 0) {
        const matches = armed.filter(s => s.steps[armedDepth] === stroke);
        if (matches.length) {
          const complete = matches.find(
            s => s.steps.length === armedDepth + 1
          );
          if (complete) {
            disarm();
            complete.handler(ctx);
            return true;
          }
          armed = matches;
          armedDepth += 1;
          rearmTimeout();
          return true;
        }
        // No continuation matched: forget the prefix and treat this
        // keystroke as a fresh one below.
        disarm();
      }

      const starting = sequences.filter(s => s.steps[0] === stroke);
      if (starting.length && !map[stroke]) {
        armed = starting;
        armedDepth = 1;
        rearmTimeout();
        return true;
      }
    }

    const direct = map[modifiers(name, event)];
    if (direct && direct(ctx)) {
      return true;
    }
    if (name.length !== 1 || name === ' ') {
      return false;
    }

    if (event.shiftKey) {
      const noShift = map[modifiers(name, event, false)];
      if (noShift && noShift(ctx)) {
        return true;
      }
    }

    // none standard keyboard, fallback to keyCode
    const special =
      event.shiftKey ||
      event.altKey ||
      event.metaKey ||
      name.charCodeAt(0) > 127;
    const baseName = base[event.keyCode];
    if (special && baseName && baseName !== name) {
      const fromCode = map[modifiers(baseName, event)];
      if (fromCode && fromCode(ctx)) {
        return true;
      }
    }

    return false;
  };
}

// In Android, the keypress event  dose not contain
// the information about what key is pressed. See
// https://stackoverflow.com/a/68188679
// https://stackoverflow.com/a/66724830
export function androidBindKeymapPatch(
  bindings: Record<string, UIEventHandler>
): UIEventHandler {
  return ctx => {
    const event = ctx.get('defaultState').event;
    if (!(event instanceof InputEvent)) return;

    if (
      event.inputType === 'deleteContentBackward' &&
      'Backspace' in bindings
    ) {
      return bindings['Backspace'](ctx);
    }

    return false;
  };
}
