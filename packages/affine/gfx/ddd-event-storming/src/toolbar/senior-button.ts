import {
  DddSeniorButtonBase,
  eventStormingToolbarIcon,
} from '@labre/affine-gfx-ddd-shared';

export class EdgelessDddEventStormingSeniorButton extends DddSeniorButtonBase {
  protected override menuTag = 'edgeless-ddd-event-storming-menu' as const;
  protected override label = 'Event Storming';
  protected override labelKey = 'com.labre.framework.ddd-event-storming';
  protected override icon = eventStormingToolbarIcon;
}
