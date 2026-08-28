import type { C4BoardLevel } from '@labre/affine-model';

/**
 * The LEVEL a board declares, as the picker offers it — DATA, like everything
 * else this framework contributes.
 *
 * A C4 diagram is drawn at one level: the context of a system, the containers
 * inside it, the components inside one of those. Which one a sheet is showing
 * used to live nowhere the tool could read — the title is free text, and a board
 * called "Payments" says nothing about which of the three it is. So the board
 * carries an optional `level` (`C4BoardElementModel`), this table is the words
 * for it, and `rules.ts` is what judges the sheet against it.
 *
 * ## The title stays the author's
 *
 * Choosing a level RENAMES NOTHING. The level is a declared fact sitting beside
 * the title, not a replacement for it: a context diagram of the payments
 * platform is still called whatever its author called it, and the picker writes
 * one prop and touches no other.
 *
 * ## Why "Free sketch" is an option and not the absence of one
 *
 * The default is no level at all, and it has to be REACHABLE: a user who set a
 * level and then decided the sheet is a working surface after all must be able
 * to say so, and the way back cannot be "delete the board and draw another".
 * Picking it CLEARS the field rather than writing a fourth value — the same call
 * the validation profile picker makes for its default level of requirement — so
 * a board on Free sketch is byte-identical to every C4 board drawn before this
 * existed.
 *
 * ## All four C's are offered, `code` included
 *
 * C4 is named after Context, Containers, Components and Code, and the picker
 * says all four. The fourth is the one C4's own author tells you to skip unless
 * the picture is generated from the source, and this editor draws no code-level
 * artefact — but that is a fact about the TOOLING, not about what a sheet may
 * declare. An architect keeping a board for the class diagram they paste in from
 * elsewhere is entitled to say what it is, and a picker that refused would be
 * presenting our limitation as the notation's.
 *
 * Two of the four are judged by no rule at all — `component` and `code` — and
 * `rules.ts` says why: a component diagram legitimately shows everything C4
 * names, and nothing in the pack knows what a code diagram admits. Both are
 * declarations the tool records and does not check, which is a perfectly honest
 * thing for a declaration to be.
 */
export interface C4BoardLevelOption {
  /**
   * What gets written on the board — or `undefined`, which CLEARS the field and
   * puts the sheet back to a free sketch.
   */
  level: C4BoardLevel | undefined;
  /** i18n key of the entry's words; resolved by the host. */
  labelKey: string;
  /** The framework's own wording, for a host that ships no catalogue. */
  labelFallback: string;
}

/** i18n key stem: `context` → `com.labre.c4.level.context`. */
const levelKey = (name: string) => `com.labre.c4.level.${name}`;

/**
 * The picker, whole: its own heading and its five entries, in the order a
 * reader zooms — no level, then the four C's from out to in.
 *
 * One object rather than a loose array plus a stray heading constant, because
 * the manifest walks DECLARATIONS: `c4TranslationEntries` hands this value to
 * `collectTranslationKeys` and every key below reaches a host's catalogue with
 * nothing restated anywhere.
 */
export const C4_BOARD_LEVEL_MENU: {
  labelKey: string;
  labelFallback: string;
  options: readonly C4BoardLevelOption[];
} = {
  labelKey: levelKey('section'),
  labelFallback: 'Level',
  options: [
    {
      // The default, and the only entry that writes nothing.
      level: undefined,
      labelKey: levelKey('none'),
      labelFallback: 'Free sketch',
    },
    {
      level: 'context',
      labelKey: levelKey('context'),
      labelFallback: 'Context',
    },
    {
      level: 'container',
      labelKey: levelKey('container'),
      labelFallback: 'Container',
    },
    {
      level: 'component',
      labelKey: levelKey('component'),
      labelFallback: 'Component',
    },
    {
      // The fourth C. Recorded, exported and readable; judged by no rule — see
      // the header, and `rules.ts` on why an empty forbidden list is data that
      // can never fire.
      level: 'code',
      labelKey: levelKey('code'),
      labelFallback: 'Code',
    },
  ],
};
