import type {
  Template,
  TemplateCategory,
} from '../../toolbar/template-type.js';
import { TEMPLATE_PANEL_CATEGORY_SLIDES } from '../../translations.js';
import { numberSlide, slidePreview, slideSnapshot } from './build.js';
import { SLIDE_MASKS, type SlideMask } from './masks.js';

function slideTemplate(mask: SlideMask): Template {
  const [nameKey, name] = mask.name;
  return {
    name,
    nameKey,
    keywords: mask.keywords,
    type: 'template',
    preview: slidePreview(mask),
    content: slideSnapshot(mask),
    localize: std => slideSnapshot(mask, std),
    afterInsert: numberSlide,
  };
}

/**
 * The built-in "Slides" category: one 16:9 frame per mask, ready to fill.
 * Built in and ungated like "Other": a frame, shapes, texts and connectors
 * are core, so no flag can take the masks away (ADR 0009 gates a framework's
 * tooling, and a slide belongs to no framework).
 */
export const slidesTemplateCategory: TemplateCategory = {
  name: TEMPLATE_PANEL_CATEGORY_SLIDES[1],
  nameKey: TEMPLATE_PANEL_CATEGORY_SLIDES[0],
  templates: SLIDE_MASKS.map(slideTemplate),
};
