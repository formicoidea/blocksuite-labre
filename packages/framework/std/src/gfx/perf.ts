let opMeasureSeq = 0;

/**
 * Measure the cost of an operation through the Performance API when the host
 * provides one, and just run it when it does not.
 *
 * This is a devtools aid, not telemetry: nothing is sent anywhere, and the
 * editor's telemetry bus stays the single reporting seam. The marks are
 * cleared, while the measure entries are kept on purpose so the operation
 * shows up in a browser performance profile.
 */
export const measureOperation = <T>(name: string, fn: () => T): T => {
  if (
    typeof performance === 'undefined' ||
    typeof performance.mark !== 'function' ||
    typeof performance.measure !== 'function'
  ) {
    return fn();
  }

  const operationId = opMeasureSeq++;
  const startMark = `${name}:${operationId}:start`;
  const endMark = `${name}:${operationId}:end`;
  performance.mark(startMark);

  try {
    return fn();
  } finally {
    performance.mark(endMark);
    performance.measure(name, startMark, endMark);
    performance.clearMarks(startMark);
    performance.clearMarks(endMark);
  }
};
