import type { Disposable } from '@labre/global/disposable';
import type { ZodType } from 'zod';

import type { DataSource } from '../data-source/base.js';
import type { TypeInstance } from '../logical/type.js';
import { type ChromeWording } from '@labre/affine-shared/services';

export type WithCommonPropertyConfig<T = {}> = T & {
  dataSource: DataSource;
};
export type GetPropertyDataFromConfig<T> =
  T extends PropertyConfig<infer R, any, any> ? R : never;
export type GetRawValueFromConfig<T> =
  T extends PropertyConfig<any, infer R, any> ? R : never;
export type GetJsonValueFromConfig<T> =
  T extends PropertyConfig<any, any, infer R> ? R : never;
export type PropertyConfig<Data, RawValue = unknown, JsonValue = unknown> = {
  name: string;
  /**
   * {@link name} as a key with its English fallback (#572): the type's name
   * in the host's language, in every type menu and as the name a new
   * property is given (written resolved, at the gesture).
   */
  nameWording?: ChromeWording;
  hide?: boolean;
  propertyData: {
    schema: ZodType<Data>;
    default: () => Data;
  };
  rawValue: {
    schema: ZodType<RawValue>;
    default: () => RawValue;
    toString: (config: { value: RawValue; data: Data }) => string;
    fromString: (
      config: WithCommonPropertyConfig<{
        value: string;
        data: Data;
      }>
    ) => {
      value: unknown;
      data?: Record<string, unknown>;
    };
    toJson: (
      config: WithCommonPropertyConfig<{
        value: RawValue;
        data: Data;
      }>
    ) => JsonValue;
    fromJson?: (
      config: WithCommonPropertyConfig<{
        value: JsonValue;
        data: Data;
      }>
    ) => RawValue | undefined;
    setValue?: (
      config: WithCommonPropertyConfig<{
        data: Data;
        value: RawValue;
        newValue: RawValue;
        setValue: (value: RawValue) => void;
      }>
    ) => void;
    onUpdate?: (
      config: WithCommonPropertyConfig<{
        value: RawValue;
        data: Data;
        callback: () => void;
      }>
    ) => Disposable;
  };
  jsonValue: {
    schema: ZodType<JsonValue>;
    type: (
      config: WithCommonPropertyConfig<{
        data: Data;
      }>
    ) => TypeInstance;
    isEmpty: (
      config: WithCommonPropertyConfig<{
        value: JsonValue;
      }>
    ) => boolean;
  };
  fixed?: {
    defaultData: Data;
    defaultOrder?: 'start' | 'end';
    defaultShow?: boolean;
  };
  minWidth?: number;
  addGroup?: (
    config: WithCommonPropertyConfig<{
      text: string;
      oldData: Data;
    }>
  ) => Data;
};

export type DVJSON =
  | null
  | number
  | string
  | boolean
  | DVJSON[]
  | {
      [k: string]: DVJSON;
    };
