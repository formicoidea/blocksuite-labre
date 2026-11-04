export type SliderRange = {
  /**
   * a series of points in slider
   */
  points: number[];
  /**
   * whether the points are uniformly distributed
   * @default true
   */
  uniform?: boolean;
};

/**
 * A continuous slider: any value between `min` and `max`, snapped to `step`
 * (a hundredth of the span when absent). The handle sits where the value
 * is; dragging and the arrow keys emit `select` as the value moves.
 */
export type SliderContinuousRange = {
  min: number;
  max: number;
  step?: number;
};

export type SliderStyle = {
  width: string;
  itemSize: number;
  itemIconSize: number;
  dragHandleSize: number;
};

export type SliderSelectEvent = CustomEvent<{
  value: number;
}>;
