import { createViewConvert } from '../core/view/convert.js';
import { calendarViewModel } from './calendar/index.js';
import { kanbanViewModel } from './kanban/index.js';
import { tableViewModel } from './table/index.js';

const headerToCalendarCard = (header?: { titleColumn?: string }) => ({
  titleColumnId: header?.titleColumn,
  visiblePropertyIds: [],
});

const calendarCardToHeader = (card?: { titleColumnId?: string }) => ({
  titleColumn: card?.titleColumnId,
});

export const viewConverts = [
  createViewConvert(tableViewModel, kanbanViewModel, data => {
    if (data.groupBy) {
      return {
        filter: data.filter,
        groupBy: data.groupBy,
      };
    }
    return {
      filter: data.filter,
    };
  }),
  createViewConvert(kanbanViewModel, tableViewModel, data => ({
    filter: data.filter,
    groupBy: data.groupBy,
  })),
  createViewConvert(tableViewModel, calendarViewModel, data => ({
    filter: data.filter,
    sort: data.sort,
    card: headerToCalendarCard(data.header),
  })),
  createViewConvert(kanbanViewModel, calendarViewModel, data => ({
    filter: data.filter,
    sort: data.sort,
    card: headerToCalendarCard(data.header),
  })),
  createViewConvert(calendarViewModel, tableViewModel, data => ({
    filter: data.filter,
    sort: data.sort,
    header: calendarCardToHeader(data.card),
  })),
  createViewConvert(calendarViewModel, kanbanViewModel, data => ({
    filter: data.filter,
    sort: data.sort,
    header: calendarCardToHeader(data.card),
  })),
];
