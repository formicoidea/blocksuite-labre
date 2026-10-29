import type { DataSource } from '../data-source/index.js';
import type { TypeInstance, ValueTypeOf } from '../logical/type.js';
import type { PropertyMetaConfig } from '../property/property-config.js';
import { type ChromeWording } from '@labre/affine-shared/services';
import { type Wording } from '../utils/wording.js';

export type StatisticsConfig<T extends TypeInstance = TypeInstance> = {
  group: string;
  /** {@link group}, {@link menuName}, {@link displayName} as keys (#572). */
  groupWording?: ChromeWording;
  type: string;
  dataType: T;
  menuName?: string;
  menuWording?: ChromeWording;
  displayName?: string;
  displayWording?: ChromeWording;
  impl?: (
    data: ReadonlyArray<ValueTypeOf<T> | undefined>,
    info: {
      meta: PropertyMetaConfig;
      dataSource: DataSource;
      /** The footer's words; absent, English. */
      wording?: Wording;
    }
  ) => string;
};
