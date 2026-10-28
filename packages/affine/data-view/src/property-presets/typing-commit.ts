/**
 * How long an in-place cell editor (text, number) waits after the last
 * keystroke before it commits what is typed. Short enough that a value
 * typed and left by any path (a click outside the editor, a closed tab) is
 * already written; long enough that a host writing to a server does not
 * write once per keystroke (recette 3, P3-5).
 */
export const TYPING_COMMIT_MS = 400;

/** The one commit waiting for the typing to pause. */
export class TypingCommit {
  private _timer: ReturnType<typeof setTimeout> | undefined;

  constructor(private readonly _commit: () => void) {}

  schedule() {
    this.cancel();
    this._timer = setTimeout(() => {
      this._timer = undefined;
      this._commit();
    }, TYPING_COMMIT_MS);
  }

  cancel() {
    if (this._timer === undefined) return;
    clearTimeout(this._timer);
    this._timer = undefined;
  }
}
