import {
  type TableBlockPropsSerialized,
  TableBlockSchema,
  TableModelFlavour,
} from '@labre/affine-model';
import {
  BlockHtmlAdapterExtension,
  type BlockHtmlAdapterMatcher,
  HastUtils,
  type InlineHtmlAST,
} from '@labre/affine-shared/adapters';
import { nanoid } from '@labre/store';
import type { Element } from 'hast';

import { DefaultColumnWidth } from '../consts';
import { parseTableFromHtml, processTable } from './utils';

const TABLE_NODE_TYPES = new Set(['table', 'thead', 'tbody', 'th', 'tr']);

export const tableBlockHtmlAdapterMatcher: BlockHtmlAdapterMatcher = {
  flavour: TableBlockSchema.model.flavour,
  toMatch: o => {
    return HastUtils.isElement(o.node) && TABLE_NODE_TYPES.has(o.node.tagName);
  },
  fromMatch: o => o.node.flavour === TableBlockSchema.model.flavour,
  toBlockSnapshot: {
    enter: (o, context) => {
      if (!HastUtils.isElement(o.node)) {
        return;
      }
      const { walkerContext } = context;
      if (o.node.tagName === 'table') {
        const astToDelta = context.deltaConverter.astToDelta.bind(
          context.deltaConverter
        );
        const tableProps = parseTableFromHtml(o.node, astToDelta);
        walkerContext.openNode(
          {
            type: 'block',
            id: nanoid(),
            flavour: TableModelFlavour,
            props: tableProps as unknown as Record<string, unknown>,
            children: [],
          },
          'children'
        );
        walkerContext.skipAllChildren();
      }
    },
    leave: (o, context) => {
      if (!HastUtils.isElement(o.node)) {
        return;
      }
      const { walkerContext } = context;
      if (o.node.tagName === 'table') {
        walkerContext.closeNode();
      }
    },
  },
  fromBlockSnapshot: {
    enter: (o, context) => {
      const { walkerContext } = context;
      const { columns, rows, cells, headerRow, headerColumn } = o.node
        .props as unknown as TableBlockPropsSerialized;
      const table = processTable(columns, rows, cells);
      const createAstTableCell = (
        children: InlineHtmlAST[],
        header: boolean
      ): InlineHtmlAST => ({
        type: 'element',
        tagName: header ? 'th' : 'td',
        properties: Object.create(null),
        children: [
          {
            type: 'element',
            tagName: 'div',
            properties: {
              style: `min-height: 22px;min-width:${DefaultColumnWidth}px;padding: 8px 12px;`,
            },
            children,
          },
        ],
      });

      const createAstTableRow = (cells: InlineHtmlAST[]): Element => ({
        type: 'element',
        tagName: 'tr',
        properties: Object.create(null),
        children: cells,
      });

      const { deltaConverter } = context;

      // ADR 0043: the header row goes in a `thead`, header cells are `th`.
      const hasHeaderRow = headerRow === true && table.rows.length > 0;
      const hasHeaderColumn = headerColumn === true;
      const astRows = table.rows.map((v, rowIndex) => {
        return createAstTableRow(
          v.cells.map((cell, columnIndex) => {
            return createAstTableCell(
              typeof cell.value === 'string'
                ? [{ type: 'text', value: cell.value }]
                : deltaConverter.deltaToAST(cell.value.delta),
              (hasHeaderRow && rowIndex === 0) ||
                (hasHeaderColumn && columnIndex === 0)
            );
          })
        );
      });
      const section = (tagName: string, children: Element[]): Element => ({
        type: 'element',
        tagName,
        properties: Object.create(null),
        children,
      });
      const tableChildren: Element[] = hasHeaderRow
        ? [section('thead', astRows.slice(0, 1))]
        : [];
      const bodyRows = hasHeaderRow ? astRows.slice(1) : astRows;
      if (!hasHeaderRow || bodyRows.length > 0) {
        tableChildren.push(section('tbody', bodyRows));
      }

      walkerContext
        .openNode({
          type: 'element',
          tagName: 'table',
          properties: {
            border: true,
            style: 'border-collapse: collapse;border-spacing: 0;',
          },
          children: tableChildren,
        })
        .closeNode();

      walkerContext.skipAllChildren();
    },
  },
};

export const TableBlockHtmlAdapterExtension = BlockHtmlAdapterExtension(
  tableBlockHtmlAdapterMatcher
);
