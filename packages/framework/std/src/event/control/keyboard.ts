import { DisposableGroup } from '@labre/global/disposable';
import { IS_ANDROID, IS_MAC } from '@labre/global/env';

import {
  type UIEventHandler,
  UIEventState,
  UIEventStateContext,
} from '../base.js';
import type { EventOptions, UIEventDispatcher } from '../dispatcher.js';
import { androidBindKeymapPatch, bindKeymap } from '../keymap.js';
import { KeyboardEventState } from '../state/index.js';
import { EventScopeSourceType, EventSourceState } from '../state/source.js';

export class KeyboardControl {
  private readonly _down = (event: KeyboardEvent) => {
    if (!this._shouldTrigger(event)) {
      return;
    }
    const keyboardEventState = new KeyboardEventState({
      event,
      composing: this.composition,
    });
    this._dispatcher.run(
      'keyDown',
      this._createContext(event, keyboardEventState)
    );
  };

  private readonly _shouldTrigger = (event: KeyboardEvent) => {
    if (event.isComposing) {
      return false;
    }
    const mod = IS_MAC ? event.metaKey : event.ctrlKey;
    if (
      ['c', 'v', 'x'].includes(event.key) &&
      mod &&
      !event.shiftKey &&
      !event.altKey
    ) {
      return false;
    }
    return true;
  };

  private readonly _up = (event: KeyboardEvent) => {
    if (!this._shouldTrigger(event)) {
      return;
    }
    const keyboardEventState = new KeyboardEventState({
      event,
      composing: this.composition,
    });

    this._dispatcher.run(
      'keyUp',
      this._createContext(event, keyboardEventState)
    );
  };

  private composition = false;

  private readonly _press = (event: KeyboardEvent) => {
    if (!this._shouldTrigger(event)) {
      return;
    }
    const keyboardEventState = new KeyboardEventState({
      event,
      composing: this.composition,
    });

    this._dispatcher.run(
      'keyPress',
      this._createContext(event, keyboardEventState)
    );
  };

  constructor(private readonly _dispatcher: UIEventDispatcher) {}

  private _createContext(event: Event, keyboardState: KeyboardEventState) {
    return UIEventStateContext.from(
      new UIEventState(event),
      new EventSourceState({
        event,
        sourceType: EventScopeSourceType.Selection,
      }),
      keyboardState
    );
  }

  bindHotkey(keymap: Record<string, UIEventHandler>, options?: EventOptions) {
    const disposables = new DisposableGroup();
    if (IS_ANDROID) {
      const androidBinding = androidBindKeymapPatch(keymap);
      disposables.add(
        this._dispatcher.add(
          'beforeInput',
          ctx => {
            if (this.composition) return false;
            return androidBinding(ctx);
          },
          options
        )
      );
    }

    // Build the binding once: it holds the chord (multi-keystroke) pending
    // state, which must survive between keystrokes. The interceptor registry
    // lets an armed chord consume its continuation before earlier-registered
    // handlers (the dispatcher runs the most recently added handler first).
    const binding = bindKeymap(keymap, {
      register: handler =>
        this._dispatcher.add(
          'keyDown',
          ctx => {
            if (this.composition) return false;
            return handler(ctx);
          },
          options
        ),
    });
    disposables.add(
      this._dispatcher.add(
        'keyDown',
        ctx => {
          if (this.composition) return false;
          return binding(ctx);
        },
        options
      )
    );
    // Tear down any armed chord (pending timer + arm-time interceptor) with
    // the binding, so a chord can never outlive its keymap.
    disposables.add(() => binding.dispose());
    return () => disposables.dispose();
  }

  listen() {
    this._dispatcher.disposables.addFromEvent(document, 'keydown', this._down);
    this._dispatcher.disposables.addFromEvent(document, 'keyup', this._up);
    this._dispatcher.disposables.addFromEvent(
      document,
      'keypress',
      this._press
    );
    this._dispatcher.disposables.addFromEvent(
      document,
      'compositionstart',
      () => {
        this.composition = true;
      },
      {
        capture: true,
      }
    );
    this._dispatcher.disposables.addFromEvent(
      document,
      'compositionend',
      () => {
        this.composition = false;
      },
      {
        capture: true,
      }
    );
  }
}
