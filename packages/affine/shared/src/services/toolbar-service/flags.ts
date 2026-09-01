import { batch, signal } from '@preact/signals-core';

export enum Flag {
  None = 0b0,
  Surface = 0b1,
  Block = 0b10,
  Text = 0b100,
  Native = 0b1000,
  // Hovering something, e.g. inline links
  Hovering = 0b10000,
  // Dragging something or opening modal, e.g. drag handle, drag resources from outside, bookmark rename modal
  Hiding = 0b100000,
  // When the editor is inactive and the toolbar is hidden, we still want to accept the message
  Accepting = 0b1000000,
}

export class Flags {
  value$ = signal(Flag.None);

  /**
   * Bumped on every {@link Flags.refresh} call.
   *
   * `refresh` intentionally leaves `value$` unchanged, so it cannot be used as
   * a repaint channel on its own: since `@preact/signals-core` 1.14 a `batch`
   * that ends on its initial value notifies nobody. Subscribers that must
   * re-run on a forced refresh have to read this revision counter as well.
   */
  #revision$ = signal(0);

  get revision() {
    return this.#revision$.peek();
  }

  get revision$() {
    return this.#revision$;
  }

  get value() {
    return this.value$.peek();
  }

  toggle(flag: Flag, activated: boolean) {
    if (activated) {
      this.value$.value |= flag;
      return;
    }
    this.value$.value &= ~flag;
  }

  check(flag: Flag, value = this.value) {
    return (flag & value) === flag;
  }

  contains(flag: number, value = this.value) {
    return (flag & value) !== Flag.None;
  }

  /**
   * Forces subscribers to re-run while keeping `flag` activated.
   *
   * The revision bump is what actually notifies; the batch keeps both writes
   * in a single notification so the toolbar never sees a transient
   * {@link Flag.None} frame.
   */
  refresh(flag: Flag) {
    batch(() => {
      this.toggle(flag, true);
      this.#revision$.value++;
    });
  }

  reset() {
    this.value$.value = Flag.None;
  }

  hide() {
    batch(() => {
      this.toggle(Flag.Accepting, true);
      this.toggle(Flag.Hiding, true);
    });
  }

  show() {
    batch(() => {
      this.toggle(Flag.Hiding, false);
      this.toggle(Flag.Accepting, false);
    });
  }

  isSurface() {
    return this.check(Flag.Surface);
  }

  isText() {
    return this.check(Flag.Text);
  }

  isBlock() {
    return this.check(Flag.Block);
  }

  isNative() {
    return this.check(Flag.Native);
  }

  isHovering() {
    return this.check(Flag.Hovering);
  }

  accept() {
    return this.check(Flag.Accepting);
  }
}
