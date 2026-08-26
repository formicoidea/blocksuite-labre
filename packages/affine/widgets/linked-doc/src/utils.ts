import { Signal } from '@preact/signals-core';

export function resolveSignal<T>(data: T | Signal<T>): T {
  return data instanceof Signal ? data.value : data;
}

/**
 * The keydown interceptor of the linked-doc popover.
 *
 * The shared keydown observer treats "a modifier plus any other key" as a
 * reason to abort, so every key the popover wants to survive has to be caught
 * here first — which is why changing the OS keyboard LAYOUT used to close the
 * popover: on Windows and Linux, Alt+Shift arrives as a keydown whose `key` is
 * `GroupNext` or `GroupPrevious`, and that reads as modifier + key.
 *
 * @param close - what `Escape` does; the popover's own `close`.
 */
export function createLinkedDocKeydownInterceptor(close: () => void) {
  return (event: KeyboardEvent, next: () => void) => {
    if (event.key === 'GroupNext' || event.key === 'GroupPrevious') {
      // The user switched keyboard layout, not documents. Swallow it and leave
      // the query, the selection and the popover exactly as they were.
      event.stopPropagation();
      return;
    }
    if (event.key === 'ArrowRight' || event.key === 'ArrowLeft') {
      event.preventDefault();
      event.stopPropagation();
      return;
    }
    if (event.key === 'Escape') {
      close();
      event.preventDefault();
      event.stopPropagation();
      return;
    }
    next();
  };
}
