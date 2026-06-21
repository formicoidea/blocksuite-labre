import type { TemplateCategory } from '@labre/affine-gfx-template';

import { CD_TEMPLATES, CM_TEMPLATES, ES_TEMPLATES } from './components.js';

/**
 * One Templates-panel section per senior button. These are gated by
 * `ddd-templates` only — never by a senior-button flag — so the catalogue stays
 * available even when a senior button is hidden. They live in the shared
 * package so the aggregate package can register all DDD categories under the
 * single `ddd-templates` flag.
 */

export const eventStormingTemplateCategory: TemplateCategory = {
  name: 'Event Storming',
  templates: ES_TEMPLATES,
};

export const coreDomainTemplateCategory: TemplateCategory = {
  name: 'Core Domain Chart',
  templates: CD_TEMPLATES,
};

export const contextMapTemplateCategory: TemplateCategory = {
  name: 'Context Map',
  templates: CM_TEMPLATES,
};
