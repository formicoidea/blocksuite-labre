import {
  type AnyCommandDescriptor,
  type BlockStdScope,
  type CommandOwner,
  CommandUsageIdentifier,
  getCommandsForSurface,
  selectSeniorMenuCommands,
} from '@labre/std';

/**
 * The row one framework's senior sub-menu shows, and whether the owner outgrew
 * its slots — `selectSeniorMenuCommands` fed from the registry and the user's
 * own usage measure.
 *
 * It lives beside the menu rather than inside it because the ROW is now read by
 * two things: the popover that draws it, and the placement tool that cycles
 * along it on Shift+S. One reading, so the ghost can never step onto a button
 * the menu does not show.
 */
export function seniorMenuSelection(
  std: BlockStdScope,
  owner: CommandOwner
): { commands: AnyCommandDescriptor[]; overflow: boolean } {
  const usage = std.getOptional(CommandUsageIdentifier);
  return selectSeniorMenuCommands(
    getCommandsForSurface(std, owner, 'senior-menu'),
    getCommandsForSurface(std, owner, 'catalogue'),
    id => usage?.statsOf(id)
  );
}
