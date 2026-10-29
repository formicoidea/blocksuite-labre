import {
  menu,
  type MenuConfig,
  popMenu,
  type PopupTarget,
} from '@labre/affine-components/context-menu';
import {
  TOOLBAR_DELETE,
  TOOLBAR_DUPLICATE,
} from '@labre/affine-shared/services';
import { DeleteIcon, DuplicateIcon, ViewIcon } from '@blocksuite/icons/lit';
import { autoPlacement, offset, shift } from '@floating-ui/dom';
import { html } from 'lit/static-html.js';

import {
  DATA_VIEW_PROPERTY_HIDE_IN_VIEW,
  DATA_VIEW_PROPERTY_NAME,
  DATA_VIEW_PROPERTY_TYPE,
  DATA_VIEW_PROPERTY_TYPE_ENTRY,
} from '../../translations.js';
import { renderUniLit } from '../utils/uni-component/index.js';
import { englishWording, type Wording } from '../utils/wording.js';
import type { Property } from '../view-manager/property.js';
import type { SingleView } from '../view-manager/single-view.js';

export const inputConfig = (
  property: Property,
  wording: Wording = englishWording
) => {
  return menu.input({
    prefix: html`
      <div class="affine-database-column-type-menu-icon">
        ${renderUniLit(property.icon)}
      </div>
    `,
    initialValue: property.name$.value,
    placeholder: wording(DATA_VIEW_PROPERTY_NAME),
    // Persist on blur so the typed name survives the menu being dismissed by
    // a click outside, which never fires the completion path.
    onBlur: text => {
      property.nameSet(text);
    },
  });
};
export const typeConfig = (
  property: Property,
  wording: Wording = englishWording
) => {
  return menu.group({
    items: [
      menu.subMenu({
        name: wording(DATA_VIEW_PROPERTY_TYPE_ENTRY),
        hide: () => !property.typeCanSet,
        postfix: html` <div
          class="affine-database-column-type-icon"
          style="color: var(--affine-text-secondary-color);gap:4px;font-size: 14px;"
        >
          ${renderUniLit(property.icon)}
          ${property.view.propertyMetas$.value.find(
            v => v.type === property.type$.value
          )?.config.name}
        </div>`,
        options: {
          title: {
            text: wording(DATA_VIEW_PROPERTY_TYPE),
          },
          items: [
            menu.group({
              items: property.view.propertyMetas$.value.map(config => {
                return menu.action({
                  isSelected: config.type === property.type$.value,
                  name: config.config.name,
                  prefix: renderUniLit(config.renderer.icon),
                  select: () => {
                    if (property.type$.value === config.type) {
                      return;
                    }
                    property.typeSet?.(config.type);
                  },
                });
              }),
            }),
          ],
        },
      }),
    ],
  });
};

/** What a property menu's opener adds around the shared entries. */
export type PropertyMenuSlots = {
  /** Right after the type (the table's "Number Format"). */
  afterType?: MenuConfig[];
  /** Between "Hide In View" and the duplicate/delete group. */
  beforeOperations?: MenuConfig[];
  /** The opener's words (`wordingOf(std)`); English without it. */
  wording?: Wording;
};

/**
 * The edit menu of one property: the very menu the table's column header
 * opens, rename and type first, duplicate and delete last. Every opener
 * reads it from here (the table header with its own filter, sort, insert
 * and move entries in `slots`; the properties list of every view as is), so
 * the title keeps the header's rules wherever it is edited: no type change,
 * no hide, no delete, because `typeCanSet`, `hideCanSet` and `canDelete` say
 * so. Rename, type, duplicate and delete write the data source, every view
 * at once; "Hide In View" writes this view only.
 *
 * The caller checks `readonly$` before opening it, as the header does.
 *
 * ponytail: "Number Format" stays a table slot (its bar is a table/pc
 * element, behind `enable_number_formatting`, off in Labre), so the
 * properties list does not offer it. Move the bar to core and the entry into
 * this list when the flag ships. The virtual table header still spells its
 * own copy of these entries; point it here in a dedicated pass.
 */
export const propertyMenuItems = (
  property: Property,
  slots: PropertyMenuSlots = {}
): MenuConfig[] => {
  const wording = slots.wording ?? englishWording;
  return [
    inputConfig(property, wording),
    typeConfig(property, wording),
    ...(slots.afterType ?? []),
    menu.group({
      items: [
        menu.action({
          name: wording(DATA_VIEW_PROPERTY_HIDE_IN_VIEW),
          prefix: ViewIcon(),
          hide: () => !property.hideCanSet,
          select: () => {
            property.hideSet(true);
          },
        }),
      ],
    }),
    ...(slots.beforeOperations ?? []),
    menu.group({
      items: [
        menu.action({
          name: wording(TOOLBAR_DUPLICATE),
          prefix: DuplicateIcon(),
          hide: () => !property.canDuplicate,
          select: () => {
            property.duplicate?.();
          },
        }),
        menu.action({
          name: wording(TOOLBAR_DELETE),
          prefix: DeleteIcon(),
          hide: () => !property.canDelete,
          select: () => {
            property.delete?.();
          },
          class: {
            'delete-item': true,
          },
        }),
      ],
    }),
  ];
};

/**
 * A property menu opened from a list of properties sits BESIDE the list, on
 * the side with more room, and stays inside the viewport: below the row it
 * covered the list, and in a host's narrow sidebar (labre, about 470px) it
 * hid the very rows it edits, its « Type » sub-menu half off screen (labre
 * recette of 1.1). The sub-menu then opens on the same side
 * (`nestedSubMenuPosition`).
 */
export const besideListMiddleware = () => [
  autoPlacement({ allowedPlacements: ['right-start', 'left-start'] }),
  offset(4),
  shift({ padding: 8, crossAxis: true }),
];

export const popPropertyMenu = (
  target: PopupTarget,
  property: Property,
  slots?: PropertyMenuSlots,
  placement: { beside?: boolean } = {}
) =>
  popMenu(target, {
    options: { items: propertyMenuItems(property, slots) },
    middleware: placement.beside ? besideListMiddleware() : undefined,
  });

/**
 * The type picker of a new property, as the virtual table header's "+" and
 * the record detail's "Add property" draw it: one entry per type the source
 * offers, named after the type. The property is added at the end of the
 * source (every view), under the type's own name, and `onAdd` gets its id
 * so the opener can open its menu for the rename.
 */
export const popNewPropertyMenu = (
  target: PopupTarget,
  view: SingleView,
  options: { title: string; onAdd: (id: string) => void }
) =>
  popMenu(target, {
    options: {
      title: { text: options.title },
      items: [
        menu.group({
          items: view.propertyMetas$.value.map(meta =>
            menu.action({
              name: meta.config.name,
              prefix: renderUniLit(meta.renderer.icon),
              select: () => {
                const id = view.propertyAdd('end', {
                  type: meta.type,
                  name: meta.config.name,
                });
                if (id) options.onAdd(id);
              },
            })
          ),
        }),
      ],
    },
  });
