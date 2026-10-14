/**
 * `page.export.markdown` and `page.export.html` — the page as a Markdown or an
 * HTML file, through the adapters the library already ships
 * (`MarkdownTransformer.docFile`, `HtmlTransformer.docFile`).
 *
 * View actions (ADR 0034, amendments of 2026-10-13 and 2026-10-14): on the
 * `'view-menu'` surface under the `'export'` category, so a host lists them
 * with every other export of the view it shows (`getViewExports`,
 * `@labre/affine/host-panels`), and on the palette. Given `params.deliver`
 * (`runViewAction`) the file goes to the host and nothing is downloaded;
 * without it (the palette, a bound chord) the command downloads it itself.
 *
 * `scope: 'global'`: the page's text is the same in both views — the notes of
 * a canvas are the page's paragraphs — so both views list them. A page whose
 * blocks reference images or attachments comes out as a zip, the file
 * (`index.md` / `index.html`) beside an `assets/` folder its links point at.
 *
 * `owner: 'core'` and no `telemetry` (it names no framework, like the canvas
 * exports); `runCommand` still records usage. It READS: no read-only guard.
 * Not `'agent'`: an agent turn would drop a file the user did not ask for.
 */
import { downloadBlob } from '@labre/affine-shared/utils';
import type {
  AnyCommandDescriptor,
  BlockStdScope,
  CommandFile,
  CommandFileParams,
} from '@labre/std';
import {
  HtmlTransformer,
  MarkdownTransformer,
} from '@labre/affine-widget-linked-doc';

async function exportPage(
  std: BlockStdScope,
  render: (std: BlockStdScope) => Promise<CommandFile | null>,
  params: unknown
): Promise<void> {
  const file = await render(std);
  if (!file) return;
  const deliver = (params as CommandFileParams | undefined)?.deliver;
  if (typeof deliver === 'function') deliver(file);
  else downloadBlob(file.blob, file.filename);
}

const exportMarkdown: AnyCommandDescriptor = {
  id: 'page.export.markdown',
  owner: 'core',
  kind: 'action',
  labelKey: 'com.labre.command.page.export.markdown',
  labelFallback: 'Export as Markdown',
  descriptionKey: 'com.labre.command.page.export.markdown.description',
  descriptionFallback:
    'Download the page as a Markdown file, in a zip with its images when it has any.',
  category: 'export',
  iconKey: 'page.export.markdown',
  keywords: ['markdown', 'md', 'export', 'download'],
  surfaces: ['view-menu', 'palette'],
  order: 15,
  scope: 'global',
  defaultKeys: { mac: [], other: [] },
  run: (std, _invocation, params) =>
    exportPage(std, ({ store }) => MarkdownTransformer.docFile(store), params),
};

const exportHtml: AnyCommandDescriptor = {
  id: 'page.export.html',
  owner: 'core',
  kind: 'action',
  labelKey: 'com.labre.command.page.export.html',
  labelFallback: 'Export as HTML',
  descriptionKey: 'com.labre.command.page.export.html.description',
  descriptionFallback:
    'Download the page as an HTML file, in a zip with its images when it has any.',
  category: 'export',
  iconKey: 'page.export.html',
  keywords: ['html', 'web', 'export', 'download'],
  surfaces: ['view-menu', 'palette'],
  order: 16,
  scope: 'global',
  defaultKeys: { mac: [], other: [] },
  run: (std, _invocation, params) =>
    exportPage(std, ({ store }) => HtmlTransformer.docFile(store), params),
};

export const pageExportCommands: AnyCommandDescriptor[] = [
  exportMarkdown,
  exportHtml,
];
