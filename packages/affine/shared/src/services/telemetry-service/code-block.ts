import type { TelemetryEvent } from './types.js';

export type CodeBlockEventType =
  | 'codeBlockLanguageSelect'
  | 'codeBlockToggleCollapse'
  | 'htmlBlockTogglePreview'
  | 'htmlBlockPreviewFailed';

export type CodeBlockEvents = Record<CodeBlockEventType, TelemetryEvent>;
