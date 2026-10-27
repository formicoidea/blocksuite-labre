import { z } from 'zod';

import type { DatabaseInitialViewService } from '../service/initial-view.js';

const currentViewListSchema = z.array(
  z.object({
    blockId: z.string(),
    viewId: z.string(),
  })
);
const maxLength = 20;
const currentViewListKey = 'blocksuite:databaseBlock:view:currentViewList';
const storage = globalThis.sessionStorage;
const createCurrentViewStorage = () => {
  const getList = () => {
    const string = storage?.getItem(currentViewListKey);
    if (!string) {
      return;
    }
    try {
      const result = currentViewListSchema.safeParse(JSON.parse(string));
      if (result.success) {
        return result.data;
      }
    } catch {
      // do nothing
    }
    return;
  };
  const saveList = () => {
    storage.setItem(currentViewListKey, JSON.stringify(list));
  };

  const list = getList() ?? [];

  return {
    getCurrentView: (blockId: string) => {
      return list.find(item => item.blockId === blockId)?.viewId;
    },
    setCurrentView: (blockId: string, viewId: string) => {
      const configIndex = list.findIndex(item => item.blockId === blockId);
      if (configIndex >= 0) {
        list.splice(configIndex, 1);
      }
      if (list.length >= maxLength) {
        list.pop();
      }
      list.unshift({ blockId, viewId });
      saveList();
    },
  };
};

export const currentViewStorage = createCurrentViewStorage();

/**
 * The view a database opens on: the host's choice when the block has it
 * (`DatabaseInitialViewProvider`), else the one this tab last showed, else
 * `undefined` (the view manager's first view). Reads only.
 */
export function initialViewId(
  blockId: string,
  exists: (viewId: string) => boolean,
  host?: DatabaseInitialViewService | null
): string | undefined {
  const asked = host?.initialView({ blockId });
  if (asked && exists(asked)) return asked;
  const stored = currentViewStorage.getCurrentView(blockId);
  if (stored && exists(stored)) return stored;
  return undefined;
}
