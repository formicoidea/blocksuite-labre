/**
 * The controls of a toolbar menu the keyboard walks (#679, ADR 0054), read
 * from what the menu draws, so that every menu built from the shared pieces
 * — `edgeless-tool-icon-button`, a native button, the colour grid, the width
 * slider — gets the same model with nothing to declare.
 *
 * A menu is a row of GROUPS in reading order. The arrows walk the controls of
 * a group; Tab and Shift+Tab move between groups. A group starts at a divider
 * (`menu-divider`, or a class naming one), or where the controls change
 * component (another shadow root). A widget with its own keys — the colour
 * grid (`radiogroup`), the slider — is a group of its own whose keys stay its
 * own (`own`): the menu enters it at its own tab stop and leaves it with Tab.
 */
export interface MenuGroup {
  controls: HTMLElement[];
  own: boolean;
}

/**
 * The separators the menus draw: `menu-divider`, or an EMPTY element whose
 * class ends in `divider` (`.divider`, `.thin-divider`, `.submenu-divider`)
 * — a container named so is still walked.
 */
const isDivider = (element: Element) =>
  element.localName === 'menu-divider' ||
  (element.childElementCount === 0 &&
    [...element.classList].some(name => name.endsWith('divider')));

/** Drawn, visible and not inert: what `focus()` can reach. */
const isShown = (element: Element) =>
  element.getClientRects().length > 0 &&
  element.checkVisibility({ visibilityProperty: true }) &&
  element.closest('[inert]') === null;

const isControl = (element: Element): element is HTMLElement =>
  element instanceof HTMLElement &&
  (element.localName === 'button' ||
    element.getAttribute('role') === 'button') &&
  !element.hasAttribute('disabled') &&
  (element as { disabled?: boolean }).disabled !== true &&
  isShown(element);

export function menuGroups(menu: Element): MenuGroup[] {
  const groups: MenuGroup[] = [];
  let run: HTMLElement[] = [];
  const close = () => {
    if (run.length > 0) groups.push({ controls: run, own: false });
    run = [];
  };
  const visit = (element: Element) => {
    if (isDivider(element)) {
      close();
      return;
    }
    const role = element.getAttribute('role');
    if (role === 'radiogroup' || role === 'slider') {
      close();
      const controls =
        role === 'slider'
          ? [element as HTMLElement]
          : // The colour grid draws its swatches in its own shadow root.
            [
              ...(element.shadowRoot?.querySelectorAll<HTMLElement>(
                '[role="radio"]'
              ) ?? []),
            ];
      // A disabled slider takes itself out of the tab order (`tabindex -1`).
      const shown = controls.filter(
        control =>
          isShown(control) &&
          (role !== 'slider' || control.getAttribute('tabindex') === '0')
      );
      if (shown.length > 0) groups.push({ controls: shown, own: true });
      return;
    }
    if (isControl(element)) {
      if (run.length > 0 && run[0].getRootNode() !== element.getRootNode()) {
        close();
      }
      run.push(element);
      return;
    }
    // The shadow tree first: a slide menu draws its arrows there and slots
    // the items, which are its light children.
    [...(element.shadowRoot?.children ?? []), ...element.children].forEach(
      visit
    );
  };
  [...(menu.shadowRoot?.children ?? []), ...menu.children].forEach(visit);
  close();
  return groups;
}

/** Where the keyboard enters a group: a widget's own tab stop, else its first control. */
export function groupEntry(group: MenuGroup): HTMLElement {
  const { controls } = group;
  if (!group.own) return controls[0];
  return (
    controls.find(control => control.getAttribute('tabindex') === '0') ??
    controls[0]
  );
}
