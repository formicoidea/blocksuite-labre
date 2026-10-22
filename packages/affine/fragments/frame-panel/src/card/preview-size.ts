/**
 * A portrait frame previewed at the panel's full width would be taller than
 * the sidebar is wide many times over and push every other card off screen:
 * past a square, the box stops growing and the frame is contained in it.
 */
const MAX_HEIGHT_PER_WIDTH = 1;

/**
 * The box of a fluid frame preview (recette 1, P0-1.2): the container's width,
 * the frame's proportions, never taller than it is wide. A frame without an
 * area gets a square box; a container not laid out yet gets no box at all.
 */
export function fluidPreviewSize(
  containerWidth: number,
  frameWidth: number,
  frameHeight: number
): { width: number; height: number } {
  const width = Math.max(0, Math.floor(containerWidth));
  if (width === 0) return { width: 0, height: 0 };
  const ratio =
    frameWidth > 0 && frameHeight > 0
      ? Math.min(frameHeight / frameWidth, MAX_HEIGHT_PER_WIDTH)
      : MAX_HEIGHT_PER_WIDTH;
  return { width, height: Math.round(width * ratio) };
}
