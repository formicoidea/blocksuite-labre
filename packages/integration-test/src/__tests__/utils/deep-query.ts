/** Every element matching `selector`, through every open shadow root. */
export function deepQueryAll(
  root: ParentNode,
  selector: string
): HTMLElement[] {
  const found = Array.from(root.querySelectorAll<HTMLElement>(selector));
  for (const element of root.querySelectorAll('*')) {
    if (element.shadowRoot)
      found.push(...deepQueryAll(element.shadowRoot, selector));
  }
  return found;
}
