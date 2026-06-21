import {
  coreDomainToolbarIcon,
  DddSeniorButtonBase,
} from '@labre/affine-gfx-ddd-shared';

export class EdgelessDddCoreDomainSeniorButton extends DddSeniorButtonBase {
  protected override menuTag = 'edgeless-ddd-core-domain-menu' as const;
  protected override label = 'Core Domain Chart';
  protected override icon = coreDomainToolbarIcon;
}
