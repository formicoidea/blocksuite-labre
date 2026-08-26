import { createIdentifier } from '@labre/global/di';

import type { DataSource } from '../data-source/base.js';
import { Matcher_ } from '../logical/matcher.js';
import { groupByMatchers } from './define.js';
import type { GroupByConfig } from './types.js';

export const createGroupByMatcher = (list: GroupByConfig[]) => {
  return new Matcher_(list, v => v.matchType);
};

/**
 * Resolve a group-by config by the name a stored `groupBy` carries. A property
 * type can offer several configs — a date reads as relative, by day, by week,
 * by month or by year — and only the stored name says which one the reader
 * chose; matching on the type alone would silently snap back to the default.
 */
export const findGroupByConfigByName = (
  dataSource: DataSource,
  name: string
): GroupByConfig | undefined => {
  const service = getGroupByService(dataSource);
  return [
    ...(service?.allExternalGroupByConfig() ?? []),
    ...groupByMatchers,
  ].find(config => config.name === name);
};

export class GroupByService {
  constructor(private readonly dataSource: DataSource) {}

  allExternalGroupByConfig(): GroupByConfig[] {
    return Array.from(
      this.dataSource.provider.getAll(ExternalGroupByConfigProvider).values()
    );
  }

  get matcher() {
    return createGroupByMatcher([
      ...this.allExternalGroupByConfig(),
      ...groupByMatchers,
    ]);
  }
}

export const GroupByProvider =
  createIdentifier<GroupByService>('group-by-service');

export const getGroupByService = (dataSource: DataSource) => {
  return dataSource.serviceGetOrCreate(
    GroupByProvider,
    () => new GroupByService(dataSource)
  );
};

export const ExternalGroupByConfigProvider = createIdentifier<GroupByConfig>(
  'external-group-by-config'
);
