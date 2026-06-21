import {
  DddSeniorButtonBase,
  eventStormingToolbarIcon,
} from '@labre/affine-gfx-ddd-shared';

export class EdgelessDddEventStormingSeniorButton extends DddSeniorButtonBase {
  protected override menuTag = 'edgeless-ddd-event-storming-menu' as const;
  protected override label = 'Event Storming';
  protected override icon = eventStormingToolbarIcon;
}
