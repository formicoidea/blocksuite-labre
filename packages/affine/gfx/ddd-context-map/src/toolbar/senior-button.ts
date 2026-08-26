import {
  contextMapToolbarIcon,
  DddSeniorButtonBase,
} from '@labre/affine-gfx-ddd-shared';

export class EdgelessDddContextMapSeniorButton extends DddSeniorButtonBase {
  protected override menuTag = 'edgeless-ddd-context-map-menu' as const;
  protected override label = 'Context Map';
  protected override labelKey = 'com.labre.framework.ddd-context-map';
  protected override icon = contextMapToolbarIcon;
}
