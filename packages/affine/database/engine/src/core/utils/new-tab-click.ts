/** A click that asks for a new tab: Ctrl on Windows and Linux, Cmd on macOS. */
export function isNewTabClick(event: Pick<MouseEvent, 'ctrlKey' | 'metaKey'>) {
  return event.ctrlKey || event.metaKey;
}
