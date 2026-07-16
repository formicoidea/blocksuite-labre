import { IS_MAC } from '@labre/global/env';
import { BlockSuiteError, ErrorCode } from '@labre/global/exceptions';
import { base, keyName } from 'w3c-keyname';

import type { UIEventHandler } from './base.js';

/**
 * Parse one keystroke name (`'Mod-z'`) into the runtime form used for event
 * matching (`'Ctrl-z'` / `'Meta-z'`, `'Space'` → `' '`), or return `null`
 * when a modifier is not recognized. Shared by the binding path (which
 * throws on `null`) and the shortcut canonicalizer (which must validate
 * host-provided overrides without throwing).
 */
export function tryNormalizeKeyName(name: string): string | null {
  const parts = name.split(/-(?!$)/);
  let result = parts.at(-1);
  if (result === 'Space') {
    result = ' ';
  }
  let alt, ctrl, shift, meta;
  for (const mod of parts.slice(0, -1)) {
    if (/^(cmd|meta|m)$/i.test(mod)) {
      meta = true;
    } else if (/^a(lt)?$/i.test(mod)) {
      alt = true;
    } else if (/^(c|ctrl|control)$/i.test(mod)) {
      ctrl = true;
    } else if (/^s(hift)?$/i.test(mod)) {
      shift = true;
    } else if (/^mod$/i.test(mod)) {
      if (IS_MAC) {
        meta = true;
      } else {
        ctrl = true;
      }
    } else {
      return null;
    }
  }
  if (alt) result = 'Alt-' + result;
  if (ctrl) result = 'Ctrl-' + result;
  if (meta) result = 'Meta-' + result;
  if (shift) result = 'Shift-' + result;
  return result as string;
}

function normalizeKeyName(name: string) {
  const normalized = tryNormalizeKeyName(name);
  if (normalized === null) {
    throw new BlockSuiteError(
      ErrorCode.EventDispatcherError,
      'Unrecognized modifier name: ' + name
    );
  }
  return normalized;
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
 * Lets an armed chord preempt the rest of the dispatcher chain: the
 * continuation handler registered here must run BEFORE every existing keyDown
 * handler (the dispatcher unshifts new handlers, so registering at arm time
 * achieves this). Without it, a chord like `w c` would lose its second
 * keystroke to an earlier single-key binding (e.g. `c` = connector tool).
 */
export interface ChordInterceptorRegistry {
  /** Register a keyDown handler that runs first; returns a dispose fn. */
  register(handler: UIEventHandler): () => void;
}

/**
 * Bind a keymap. A binding key is one keystroke (`'Mod-z'`) or a
 * space-separated sequence of keystrokes (`'w c'`): pressing the first
 * keystroke arms the sequence, and the next keystroke (within a short
 * timeout) resolves it. The prefix scopes the continuation to its namespace:
 * an unknown continuation is swallowed (no such shortcut), it never falls
 * through to the generic single-keystroke bindings.
 *
 * Pass `interceptors` (the dispatcher does) so an armed chord consumes its
 * continuation before earlier-registered handlers; without it, continuations
 * are only matched when this handler is reached in the chain.
 */
/**
 * A bound keymap handler. `dispose` tears down any armed chord state (pending
 * timer + arm-time interceptor) — the owner of the binding MUST call it when
 * the binding is disposed, otherwise an armed chord outlives its keymap for
 * up to the chord timeout.
 */
export type KeymapHandler = UIEventHandler & { dispose: () => void };

export function bindKeymap(
  bindings: Record<string, UIEventHandler>,
  interceptors?: ChordInterceptorRegistry
): KeymapHandler {
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
  let disposeInterceptor: (() => void) | null = null;

  const disarm = () => {
    armed = [];
    armedDepth = 0;
    if (armedTimer !== null) {
      clearTimeout(armedTimer);
      armedTimer = null;
    }
    if (disposeInterceptor !== null) {
      disposeInterceptor();
      disposeInterceptor = null;
    }
  };

  const rearmTimeout = () => {
    if (armedTimer !== null) clearTimeout(armedTimer);
    armedTimer = setTimeout(disarm, CHORD_TIMEOUT_MS);
  };

  /**
   * Match one keystroke against the armed sequences. Returns true when the
   * keystroke was consumed (advanced or completed a chord), false when it
   * should fall through to the normal bindings (and the chord is disarmed).
   */
  const continueChord: UIEventHandler = ctx => {
    const event = ctx.get('keyboardState').raw;
    const name = keyName(event);

    // A lone modifier press must not break an armed chord.
    if (MODIFIER_KEYS.has(name)) return false;

    // Focus moved into an editable mid-chord: give the keystroke back.
    if (isTypingTarget(event)) {
      disarm();
      return false;
    }

    const stroke = modifiers(name, event);
    const matches = armed.filter(s => s.steps[armedDepth] === stroke);

    if (!matches.length) {
      // No continuation matched. The prefix scopes the next keystroke to
      // its namespace ("in wardley, shortcut X"): an unknown key there
      // means "no such shortcut" and is swallowed, never handed to the
      // generic single-key bindings (w+e must not trigger the eraser).
      disarm();
      return true;
    }

    const complete = matches.find(s => s.steps.length === armedDepth + 1);
    if (complete) {
      disarm();
      complete.handler(ctx);
      return true;
    }
    armed = matches;
    armedDepth += 1;
    rearmTimeout();
    return true;
  };

  const run: UIEventHandler = ctx => {
    const state = ctx.get('keyboardState');
    const event = state.raw;
    const name = keyName(event);

    if (sequences.length && !isTypingTarget(event)) {
      // Without an interceptor registry, continuations are handled here.
      if (armedDepth > 0 && !interceptors) {
        if (MODIFIER_KEYS.has(name)) return false;
        if (continueChord(ctx)) return true;
        // fall through: the keystroke starts fresh below
      }

      if (armedDepth === 0) {
        const stroke = modifiers(name, event);
        const starting = sequences.filter(s => s.steps[0] === stroke);
        // An existing single binding on the prefix key wins over the chord.
        if (starting.length && !map[stroke]) {
          armed = starting;
          armedDepth = 1;
          rearmTimeout();
          if (interceptors) {
            disposeInterceptor = interceptors.register(continueChord);
          }
          return true;
        }
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

  return Object.assign(run, { dispose: disarm });
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
