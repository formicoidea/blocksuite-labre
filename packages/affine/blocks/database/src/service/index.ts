import type { DatabaseBlockModel } from '@labre/affine-model';
import type { DataSourceBase, PropertyMetaConfig } from '@labre/data-view';
import { createIdentifier } from '@labre/global/di';

export interface DatabaseBlockConfigService {
  propertiesPresets: PropertyMetaConfig[];
}

export const DatabaseBlockConfigService =
  createIdentifier<DatabaseBlockConfigService>(
    'AffineDatabaseBlockConfigService'
  );

/**
 * Injection seam: a host app may register this provider to back an
 * `affine:database` block with its own data source (e.g. an external
 * collection). Only used when the block carries an `externalSourceId`; with no
 * provider registered the block falls back to the inline blob source.
 */
export interface DatabaseDataSourceProvider {
  createDataSource(
    model: DatabaseBlockModel,
    init?: (ds: DataSourceBase) => void
  ): DataSourceBase;
}

export const DatabaseDataSourceProvider =
  createIdentifier<DatabaseDataSourceProvider>(
    'affine:database-data-source-provider'
  );
