import { isSafeLinkUrl, normalizeUrl } from '@labre/affine-shared/utils';
import { type BlockStdScope, TextSelection } from '@labre/std';

import { AffineLink } from './affine-link.js';

/**
 * The URL a paste carries when its plain text is ONE http(s) URL and nothing
 * else, or `null`. A sentence holding a URL, two URLs, a `mailto:` or any
 * scheme `isSafeLinkUrl` refuses is not a lone URL: it pastes as text, as it
 * always did.
 */
export function lonePastedUrl(text: string | null | undefined): string | null {
  const candidate = text?.trim();
  if (!candidate || /\s/.test(candidate)) return null;
  if (!isSafeLinkUrl(candidate)) return null;
  if (!URL.canParse(candidate)) return null;
  const { protocol } = new URL(candidate);
  return protocol === 'http:' || protocol === 'https:' ? candidate : null;
}

/**
 * After a lone URL was pasted in a page (labre REQ-IM-1), open the link's own
 * toolbar on the link the paste wrote, so its view switcher offers "Card view"
 * and "Embed view" next to the current "Inline view". Nothing is written: the
 * paste already stored a plain link, which stays the default when the viewer
 * picks nothing. The conversions are the toolbar's, with their own gates (a
 * registered bookmark or embed view, an embed provider for the URL).
 *
 * Returns whether a toolbar was opened. Nothing opens when the paste did not
 * leave a link at the caret (a URL the host recognised as one of its own
 * documents became a reference), on a read-only document, or inside a table
 * or a database cell, where the toolbar offers no conversion.
 */
export async function proposeLinkViews(
  std: BlockStdScope,
  url: string
): Promise<boolean> {
  if (std.store.readonly) return false;

  await std.host.updateComplete;
  const caret = std.selection.find(TextSelection);
  if (!caret) return false;

  const block = std.view.getBlock(caret.from.blockId);
  if (!block) return false;
  await block.updateComplete;
  if (block.closest('affine-database, affine-table')) return false;

  const href = normalizeUrl(url);
  const links = Array.from(block.querySelectorAll('affine-link')).filter(
    (node): node is AffineLink =>
      node instanceof AffineLink && node.link === href
  );
  // The caret ends the pasted run; an equal link written earlier in the same
  // paragraph must not be the one the toolbar points at.
  const pasted =
    links.find(link => {
      const range = link.selfInlineRange;
      return !!range && range.index + range.length === caret.from.index;
    }) ?? links.at(-1);
  if (!pasted) return false;

  pasted.proposeViews();
  return true;
}
