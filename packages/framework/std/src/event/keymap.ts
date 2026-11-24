import { IS_MAC } from '@labre/global/env';
import { BlockSuiteError, ErrorCode } from '@labre/global/exceptions';
import { base, keyName } from 'w3c-keyname';

import type { UIEventHandler, UIEventStateContext } from './base.js';

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
 * A keystroke that is never a printable continuation: pressed with Ctrl, Meta
 * or Alt, a named key (Delete, Backspace, Escape, Enter, Tab, the arrows,
 * Home / End, the page and function keys), or Space. When it completes no
 * armed chord, it is handed on to the canvas's own bindings rather than
 * swallowed: a stray prefix letter must not cost the user the Delete, the
 * undo or the arrow that follows it (`docs/adr/0055`). Shift alone does not
 * count: a Shift-ed letter is printable and stays in the namespace.
 */
function isCanvasKeystroke(name: string, event: KeyboardEvent) {
  return (
    event.ctrlKey ||
    event.metaKey ||
    event.altKey ||
    name.length !== 1 ||
    name === ' '
  );
}

/**
 * A binding of a chord may say whether it could run right now. A prefix arms
 * only when at least one of the chords it starts could: with none runnable (a
 * read-only document, a canvas element in edit mode), the prefix letter is
 * left to whatever else binds it and the next keystroke is never swallowed.
 * Absent = always runnable, which is every binding that predates it.
 */
export type ChordBinding = UIEventHandler & {
  canRun?: (ctx: UIEventStateContext) => boolean;
};

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
 * an unknown printable continuation is swallowed (no such shortcut), it never
 * falls through to the generic single-keystroke bindings; a keystroke that is
 * no printable continuation (a named key, a modified key, Space) disarms and
 * is handed on. A prefix whose chords all say they cannot run
 * ({@link ChordBinding}) does not arm.
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
  /** The keystroke that armed or advanced the chord: its auto-repeat is ignored. */
  let lastStroke: string | null = null;

  /**
   * A key HELD after completing a chord: its auto-repeat is swallowed until it
   * is released (a new, non-repeat press) or another key is pressed. Without
   * it, `b` then `p` held placed the pool and then the repeats, no longer in
   * the namespace, switched to the Pen tool (`docs/adr/0055`).
   */
  let guardedStroke: string | null = null;
  let disposeGuard: (() => void) | null = null;

  const stopGuard = () => {
    guardedStroke = null;
    if (disposeGuard !== null) {
      disposeGuard();
      disposeGuard = null;
    }
  };

  const guardRepeats: UIEventHandler = ctx => {
    const event = ctx.get('keyboardState').raw;
    const name = keyName(event);
    if (MODIFIER_KEYS.has(name)) return false;
    if (event.repeat && modifiers(name, event) === guardedStroke) return true;
    stopGuard();
    return false;
  };

  const disarm = () => {
    armed = [];
    armedDepth = 0;
    lastStroke = null;
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
    // The prefix (or a step) still held: its repeats stay in the namespace
    // and change nothing, rather than disarming and re-arming in a loop.
    if (event.repeat && stroke === lastStroke) return true;
    const matches = armed.filter(s => s.steps[armedDepth] === stroke);

    if (!matches.length) {
      disarm();
      // Delete, an arrow, Ctrl+Z, Space…: not a letter of the namespace, so
      // it goes to the canvas exactly as it would have without the prefix.
      if (isCanvasKeystroke(name, event)) return false;
      // An unknown LETTER is the namespace's own business: "no such
      // shortcut", swallowed, never handed to the generic single-key
      // bindings (w then h must not reach the hand tool).
      return true;
    }

    const complete = matches.find(s => s.steps.length === armedDepth + 1);
    if (complete) {
      disarm();
      complete.handler(ctx);
      stopGuard();
      guardedStroke = stroke;
      if (interceptors) disposeGuard = interceptors.register(guardRepeats);
      return true;
    }
    armed = matches;
    armedDepth += 1;
    lastStroke = stroke;
    rearmTimeout();
    return true;
  };

  const run: UIEventHandler = ctx => {
    const state = ctx.get('keyboardState');
    const event = state.raw;
    const name = keyName(event);

    // Without an interceptor registry, the held-key guard is checked here.
    if (guardedStroke !== null && !interceptors && guardRepeats(ctx)) {
      return true;
    }

    if (sequences.length && !isTypingTarget(event)) {
      // Without an interceptor registry, continuations are handled here.
      if (armedDepth > 0 && !interceptors) {
        if (MODIFIER_KEYS.has(name)) return false;
        if (continueChord(ctx)) return true;
        // fall through: the keystroke starts fresh below
      }

      if (armedDepth === 0) {
        const stroke = modifiers(name, event);
        const starting = sequences.filter(
          s =>
            s.steps[0] === stroke &&
            ((s.handler as ChordBinding).canRun?.(ctx) ?? true)
        );
        // An existing single binding on the prefix key wins over the chord.
        // A repeat never arms: a prefix held past the timeout stays inert.
        if (starting.length && !map[stroke] && !event.repeat) {
          armed = starting;
          armedDepth = 1;
          lastStroke = stroke;
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

    // For non-standard keyboards, fallback to keyCode only when modifier keys
    // are pressed. Do NOT fallback when the key produces a non-ASCII character
    // (e.g. Cyrillic 'х' on a Russian layout), because the user intends to type
    // that character, not to trigger a shortcut bound to the physical key.
    // See: https://github.com/toeverything/AFFiNE/issues/14059
    const hasModifier =
      event.shiftKey || event.altKey || event.ctrlKey || event.metaKey;
    const baseName = base[event.keyCode];
    const isSingleAscii = name.length === 1 && name.charCodeAt(0) <= 0x7e;
    const isAltInputChar =
      event.altKey && !event.ctrlKey && !event.metaKey && !isSingleAscii;
    // Keep supporting existing Alt+digit shortcuts (e.g. Alt-0/1/2 in edgeless)
    // while preventing Alt-based locale input characters from triggering letter
    // shortcuts.
    const isDigitBaseKey =
      baseName != null && baseName.length === 1 && /[0-9]/.test(baseName);
    if (
      hasModifier &&
      baseName &&
      baseName !== name &&
      !(isAltInputChar && !isDigitBaseKey)
    ) {
      const fromCode = map[modifiers(baseName, event)];
      if (fromCode && fromCode(ctx)) {
        return true;
      }
    }

    return false;
  };

  return Object.assign(run, {
    dispose: () => {
      disarm();
      stopGuard();
    },
  });
}

/**
 * Native formatting input → the binding it stands for. Native controls such
 * as the iOS selection menu (B / I / U) send a `beforeinput` with one of these
 * input types and no key event at all (#743). Every entry is a `Mod-`
 * keystroke: {@link formatInputKeystroke} relies on it.
 */
const FORMAT_INPUT_TYPE_HOTKEYS: Readonly<Record<string, string>> =
  Object.assign(Object.create(null), {
    formatBold: 'Mod-b',
    formatItalic: 'Mod-i',
    formatUnderline: 'Mod-u',
  });

/**
 * The keystroke a native formatting input stands for, as the init of the key
 * event that runs it through a {@link bindKeymap} binding exactly like the
 * real keystroke; `null` for any other input type. Its modifier follows
 * `IS_MAC`, as `Mod` does when the keymap is bound, so the `Mod-` binding
 * matches on every platform (Ctrl on iOS, where `IS_MAC` is false).
 */
export function formatInputKeystroke(
  inputType: string
): KeyboardEventInit | null {
  const hotkey = FORMAT_INPUT_TYPE_HOTKEYS[inputType];
  if (hotkey === undefined) return null;
  return {
    key: hotkey.slice('Mod-'.length),
    ctrlKey: !IS_MAC,
    metaKey: IS_MAC,
    cancelable: true,
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
