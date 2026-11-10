import isEqual from 'lodash-es/isEqual';

import type { MindmapNode } from './mindmap.js';
import type { NodeStyle } from './style.js';

// Apart from `style.ts` so the style getters load no lodash: they join
// `@labre/affine-model/headless`, where a server's graph allows `zod` only
// (ADR 0045, amendment of 2026-11-10).
export const applyNodeStyle = (node: MindmapNode, nodeStyle: NodeStyle) => {
  Object.entries(nodeStyle).forEach(([key, value]) => {
    const element = node.element as unknown as Record<string, unknown>;
    if (!isEqual(element[key], value)) {
      element[key] = value;
    }
  });
};
