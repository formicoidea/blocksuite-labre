import { afterEach, describe, expect, test } from 'vitest';

import { EdgelessTextBlockComponent } from '../edgeless-text-block.js';

/**
 * The block's own stylesheet, replayed in a plain document: a locked block
 * renders its content behind `pointer-events: none`, and only the
 * `locked-content` rule is supposed to let links back through.
 */
function renderContent(locked: boolean) {
  const style = document.createElement('style');
  style.textContent = ([] as { cssText: string }[])
    .concat(EdgelessTextBlockComponent.styles as never)
    .map(sheet => sheet.cssText)
    .join('\n');

  const container = document.createElement('div');
  container.className = 'edgeless-text-block-container';

  const content = document.createElement('div');
  if (locked) content.className = 'locked-content';
  content.style.pointerEvents = 'none';
  content.style.userSelect = 'none';

  const link = document.createElement('a');
  link.href = 'https://example.com';
  link.textContent = 'a link';

  content.append(link);
  container.append(content);
  document.body.append(style, container);

  return link;
}

describe('a locked edgeless text block', () => {
  afterEach(() => {
    document.body.innerHTML = '';
  });

  test('lets a hyperlink be clicked', () => {
    const link = renderContent(true);
    expect(getComputedStyle(link).pointerEvents).toBe('auto');
    expect(getComputedStyle(link).cursor).toBe('pointer');
  });

  test('leaves an unlocked, non-editing block inert as before', () => {
    const link = renderContent(false);
    expect(getComputedStyle(link).pointerEvents).toBe('none');
  });
});
