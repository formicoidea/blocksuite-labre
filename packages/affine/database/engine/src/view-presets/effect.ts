import { calendarEffects } from './calendar/effect.js';
import { galleryEffects } from './gallery/effect.js';
import { kanbanEffects } from './kanban/effect.js';
import { listEffects } from './list/effect.js';
import { tableEffects } from './table/effect.js';

export function viewPresetsEffects() {
  calendarEffects();
  galleryEffects();
  kanbanEffects();
  listEffects();
  tableEffects();
}
