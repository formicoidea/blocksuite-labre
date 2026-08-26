/**
 * The payload a picker emits. Mirrors the shape upstream settled on for its
 * `IconPickerService` seam, minus the `blob` variant: this picker has no
 * upload panel, so it never produces one.
 */
export enum IconType {
  AffineIcon = 'affine-icon',
  Emoji = 'emoji',
}

export type IconData =
  | {
      type: IconType.Emoji;
      unicode: string;
    }
  | {
      type: IconType.AffineIcon;
      name: string;
      color: string;
    };

/**
 * `null` means "the user asked to remove the current icon".
 */
export type IconPickerSelectDetail = IconData | null;

export type IconPickerTab = 'emoji' | 'icons';
