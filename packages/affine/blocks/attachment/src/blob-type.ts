export const NEUTRAL_BLOB_TYPE = 'application/octet-stream';

const INERT_BLOB_TYPE =
  // What a browser can only show, never run. `application/pdf` opens the plugin;
  // `video/*` and `audio/*` refuse a `+` because a browser treats every `+xml`
  // subtype as an XML document. Matches 'video/mp4', rejects 'video/x+xml'.
  // https://regex101.com/?flavor=ecmascript&regex=%5E(%3F%3Aapplication%5C%2Fpdf%7Cimage%5C%2F(%3F%3Aavif%7Cbmp%7Cgif%7Cheic%7Cheif%7Cjpeg%7Cpng%7Ctiff%7Cvnd%5C.microsoft%5C.icon%7Cwebp%7Cx-icon)%7C(%3F%3Aaudio%7Cvideo)%5C%2F%5Ba-z0-9%5D%5Ba-z0-9.-%5D*)%24&testString=video%2Fmp4%0Avideo%2Fx%2Bxml
  /^(?:application\/pdf|image\/(?:avif|bmp|gif|heic|heif|jpeg|png|tiff|vnd\.microsoft\.icon|webp|x-icon)|(?:audio|video)\/[a-z0-9][a-z0-9.-]*)$/;

/**
 * The type an attachment's `blob:` url may carry. A `blob:` url has the origin
 * of the page that made it, so a document it holds runs with that page's
 * tokens, and `type` is a prop any collaborator can write. A list of what is
 * inert, not a list of what is dangerous: `image/svg+xml`, `text/html` and
 * whatever comes next all end up neutral.
 *
 * A url also outlives the prop it was made from: the pdf frame loads a url made
 * before the type became `application/pdf`. So the rule holds at creation, not
 * at the place that reads the url.
 */
export function attachmentBlobType(declared: string | null | undefined) {
  const type = declared?.split(';', 1)[0]?.trim().toLowerCase() ?? '';
  return INERT_BLOB_TYPE.test(type) ? type : NEUTRAL_BLOB_TYPE;
}
