import { AttachmentViewExtension } from '@labre/affine-block-attachment/view';
import { BookmarkViewExtension } from '@labre/affine-block-bookmark/view';
import { CalloutViewExtension } from '@labre/affine-block-callout/view';
import { CodeBlockViewExtension } from '@labre/affine-block-code/view';
import { DataViewViewExtension } from '@labre/affine-block-data-view/view';
import { DatabaseViewExtension } from '@labre/affine-block-database/view';
import { DividerViewExtension } from '@labre/affine-block-divider/view';
import { EdgelessTextViewExtension } from '@labre/affine-block-edgeless-text/view';
import { EmbedViewExtension } from '@labre/affine-block-embed/view';
import { EmbedDocViewExtension } from '@labre/affine-block-embed-doc/view';
import { FrameViewExtension } from '@labre/affine-block-frame/view';
import { ImageViewExtension } from '@labre/affine-block-image/view';
import { LatexViewExtension } from '@labre/affine-block-latex/view';
import { ListViewExtension } from '@labre/affine-block-list/view';
import { NoteViewExtension } from '@labre/affine-block-note/view';
import { ParagraphViewExtension } from '@labre/affine-block-paragraph/view';
import { RootViewExtension } from '@labre/affine-block-root/view';
import {
  AuditViewExtension,
  SurfaceViewExtension,
} from '@labre/affine-block-surface/view';
import { SurfaceRefViewExtension } from '@labre/affine-block-surface-ref/view';
import { TableViewExtension } from '@labre/affine-block-table/view';
import { FoundationViewExtension } from '@labre/affine-foundation/view';
import { AdapterPanelViewExtension } from '@labre/affine-fragment-adapter-panel/view';
import { DocTitleViewExtension } from '@labre/affine-fragment-doc-title/view';
import { FramePanelViewExtension } from '@labre/affine-fragment-frame-panel/view';
import { OutlineViewExtension } from '@labre/affine-fragment-outline/view';
import {
  BpmnRenderViewExtension,
  BpmnViewExtension,
} from '@labre/affine-gfx-bpmn/view';
import {
  BrushRenderViewExtension,
  BrushViewExtension,
} from '@labre/affine-gfx-brush/view';
import {
  C4RenderViewExtension,
  C4ViewExtension,
} from '@labre/affine-gfx-c4/view';
import { ConnectorViewExtension } from '@labre/affine-gfx-connector/view';
import {
  CynefinEstuarineRenderViewExtension,
  CynefinEstuarineViewExtension,
} from '@labre/affine-gfx-cynefin-estuarine/view';
import { DddTemplatesViewExtension } from '@labre/affine-gfx-ddd-aggregate/view';
import {
  DddContextMapRenderViewExtension,
  DddContextMapViewExtension,
} from '@labre/affine-gfx-ddd-context-map/view';
import {
  DddCoreDomainRenderViewExtension,
  DddCoreDomainViewExtension,
} from '@labre/affine-gfx-ddd-core-domain/view';
import {
  DddEventStormingRenderViewExtension,
  DddEventStormingViewExtension,
} from '@labre/affine-gfx-ddd-event-storming/view';
import {
  EdgyRenderViewExtension,
  EdgyViewExtension,
} from '@labre/affine-gfx-edgy/view';
import { GroupViewExtension } from '@labre/affine-gfx-group/view';
import { LinkViewExtension as GfxLinkViewExtension } from '@labre/affine-gfx-link/view';
import {
  MediaToolViewExtension,
  MindmapRenderViewExtension,
  MindmapToolViewExtension,
  TextToolViewExtension,
} from '@labre/affine-gfx-mindmap/view';
import { NoteViewExtension as GfxNoteViewExtension } from '@labre/affine-gfx-note/view';
import { PointerViewExtension } from '@labre/affine-gfx-pointer/view';
import { ShapeViewExtension } from '@labre/affine-gfx-shape/view';
import { TemplateViewExtension } from '@labre/affine-gfx-template/view';
import { TextViewExtension } from '@labre/affine-gfx-text/view';
import {
  WardleyRenderViewExtension,
  WardleyViewExtension,
} from '@labre/affine-gfx-wardley/view';
import { InlineCommentViewExtension } from '@labre/affine-inline-comment/view';
import { FootnoteViewExtension } from '@labre/affine-inline-footnote/view';
import { LatexViewExtension as InlineLatexViewExtension } from '@labre/affine-inline-latex/view';
import { LinkViewExtension } from '@labre/affine-inline-link/view';
import { MentionViewExtension } from '@labre/affine-inline-mention/view';
import { InlinePresetViewExtension } from '@labre/affine-inline-preset/view';
import { ReferenceViewExtension } from '@labre/affine-inline-reference/view';
import { DragHandleViewExtension } from '@labre/affine-widget-drag-handle/view';
import { EdgelessAutoConnectViewExtension } from '@labre/affine-widget-edgeless-auto-connect/view';
import { EdgelessDraggingAreaViewExtension } from '@labre/affine-widget-edgeless-dragging-area/view';
import { EdgelessSelectedRectViewExtension } from '@labre/affine-widget-edgeless-selected-rect/view';
import { EdgelessToolbarViewExtension } from '@labre/affine-widget-edgeless-toolbar/view';
import { EdgelessZoomToolbarViewExtension } from '@labre/affine-widget-edgeless-zoom-toolbar/view';
import { FrameTitleViewExtension } from '@labre/affine-widget-frame-title/view';
import { KeyboardToolbarViewExtension } from '@labre/affine-widget-keyboard-toolbar/view';
import { LinkedDocViewExtension } from '@labre/affine-widget-linked-doc/view';
import { NoteSlicerViewExtension } from '@labre/affine-widget-note-slicer/view';
import { PageDraggingAreaViewExtension } from '@labre/affine-widget-page-dragging-area/view';
import { RemoteSelectionViewExtension } from '@labre/affine-widget-remote-selection/view';
import { ScrollAnchoringViewExtension } from '@labre/affine-widget-scroll-anchoring/view';
import { SlashMenuViewExtension } from '@labre/affine-widget-slash-menu/view';
import { ToolbarViewExtension } from '@labre/affine-widget-toolbar/view';
import { ViewportOverlayViewExtension } from '@labre/affine-widget-viewport-overlay/view';

import {
  isBlockEnabled,
  isCapabilityEnabled,
  type LabreFlags,
  type OptionalBlock,
} from '../flags.js';
import { CommandTelemetryViewExtension } from './command-telemetry.js';
import { CommandUsageViewExtension } from './command-usage.js';

/**
 * View extensions.
 *
 * Rendering is registered UNCONDITIONALLY; a flag removes only the matching
 * TOOLING extension (senior button, its submenus and its creation shortcuts),
 * so a framework switched off disappears from the toolbar without any element
 * already drawn disappearing from the canvas. Omitted flags default to
 * enabled. See {@link BlockFlags} and `docs/adr/0009`.
 */
export function getInternalViewExtensions(flags?: LabreFlags) {
  const on = (block: OptionalBlock) => isBlockEnabled(flags, block);
  return [
    FoundationViewExtension,
    // The single command-telemetry emitter. Unconditional: a disabled
    // framework simply never invokes a command (docs/adr/0008).
    CommandTelemetryViewExtension,
    // The default (browser-local) recency/frequency measure. Unconditional for
    // the same reason, and independent of telemetry: it feeds an in-editor
    // ranking, not a dashboard (docs/adr/0008).
    CommandUsageViewExtension,

    // Gfx — each framework contributes an always-on `…Render…` extension
    // (element view + renderer + interaction + contextual toolbar) and a
    // flag-gated tooling extension (senior button + creation shortcuts).
    PointerViewExtension,
    GfxNoteViewExtension,
    BrushRenderViewExtension,
    ...(on('brush') ? [BrushViewExtension] : []),
    // Standalone text / add-file senior buttons, placed right after pen/eraser
    // (registration order = senior-row order for the default order group).
    ...(on('edgeless-text') ? [TextToolViewExtension] : []),
    ...(on('edgeless-media') ? [MediaToolViewExtension] : []),
    ShapeViewExtension,
    MindmapRenderViewExtension,
    ...(on('mindmap') ? [MindmapToolViewExtension] : []),
    ConnectorViewExtension,
    GroupViewExtension,
    TextViewExtension,
    ...(on('template') ? [TemplateViewExtension] : []),
    ...(on('link') ? [GfxLinkViewExtension] : []),
    WardleyRenderViewExtension,
    ...(on('wardley') ? [WardleyViewExtension] : []),
    EdgyRenderViewExtension,
    ...(on('edgy') ? [EdgyViewExtension] : []),
    CynefinEstuarineRenderViewExtension,
    ...(on('cynefin-estuarine') ? [CynefinEstuarineViewExtension] : []),
    BpmnRenderViewExtension,
    ...(on('bpmn') ? [BpmnViewExtension] : []),
    C4RenderViewExtension,
    ...(on('c4') ? [C4ViewExtension] : []),
    DddCoreDomainRenderViewExtension,
    DddContextMapRenderViewExtension,
    DddEventStormingRenderViewExtension,
    ...(on('ddd-event-storming') ? [DddEventStormingViewExtension] : []),
    ...(on('ddd-core-domain') ? [DddCoreDomainViewExtension] : []),
    ...(on('ddd-context-map') ? [DddContextMapViewExtension] : []),
    ...(on('ddd-templates') ? [DddTemplatesViewExtension] : []),

    // Block
    ...(on('attachment') ? [AttachmentViewExtension] : []),
    ...(on('bookmark') ? [BookmarkViewExtension] : []),
    ...(on('callout') ? [CalloutViewExtension] : []),
    ...(on('code') ? [CodeBlockViewExtension] : []),
    ...(on('data-view') ? [DataViewViewExtension] : []),
    ...(on('database') ? [DatabaseViewExtension] : []),
    ...(on('divider') ? [DividerViewExtension] : []),
    ...(on('edgeless-text') ? [EdgelessTextViewExtension] : []),
    ...(on('embed') ? [EmbedViewExtension] : []),
    ...(on('embed-doc') ? [EmbedDocViewExtension] : []),
    ...(on('frame') ? [FrameViewExtension] : []),
    ...(on('image') ? [ImageViewExtension] : []),
    ...(on('latex') ? [LatexViewExtension] : []),
    ...(on('list') ? [ListViewExtension] : []),
    NoteViewExtension,
    ParagraphViewExtension,
    ...(on('surface-ref') ? [SurfaceRefViewExtension] : []),
    ...(on('table') ? [TableViewExtension] : []),
    SurfaceViewExtension,
    // The AI audit seam (PF14.1). A CAPABILITY, not a block: `ai-audit` gates
    // the `map.audit` command and nothing else, and nothing it touches is
    // persisted, so switching it off cannot lose anything. See
    // `OPTIONAL_CAPABILITIES` for why it is not an `OPTIONAL_BLOCKS` entry.
    ...(isCapabilityEnabled(flags, 'ai-audit') ? [AuditViewExtension] : []),
    RootViewExtension,

    // Inline
    InlineCommentViewExtension,
    FootnoteViewExtension,
    LinkViewExtension,
    ReferenceViewExtension,
    ...(on('latex') ? [InlineLatexViewExtension] : []),
    MentionViewExtension,
    InlinePresetViewExtension,

    // Widget
    // order will affect the z-index of the widget
    DragHandleViewExtension,
    EdgelessAutoConnectViewExtension,
    FrameTitleViewExtension,
    KeyboardToolbarViewExtension,
    LinkedDocViewExtension,
    RemoteSelectionViewExtension,
    ScrollAnchoringViewExtension,
    SlashMenuViewExtension,
    ToolbarViewExtension,
    ViewportOverlayViewExtension,
    EdgelessZoomToolbarViewExtension,
    PageDraggingAreaViewExtension,
    EdgelessSelectedRectViewExtension,
    EdgelessDraggingAreaViewExtension,
    NoteSlicerViewExtension,
    EdgelessToolbarViewExtension,

    // Fragment
    DocTitleViewExtension,
    ...(on('frame') ? [FramePanelViewExtension] : []),
    OutlineViewExtension,
    AdapterPanelViewExtension,
  ];
}
