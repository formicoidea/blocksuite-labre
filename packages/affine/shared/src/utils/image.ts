import DOMPurify from 'dompurify';

export function readImageSize(file: File | Blob) {
  return new Promise<{ width: number; height: number }>(resolve => {
    const size = { width: 0, height: 0 };
    if (!file.type.startsWith('image/')) {
      resolve(size);
      return;
    }

    const img = new Image();

    img.onload = () => {
      size.width = img.width;
      size.height = img.height;
      URL.revokeObjectURL(img.src);
      resolve(size);
    };

    img.onerror = () => {
      URL.revokeObjectURL(img.src);
      resolve(size);
    };

    const sanitizedURL = DOMPurify.sanitize(URL.createObjectURL(file));
    img.src = sanitizedURL;
  });
}

/** Upstream's wait for a video's metadata (toeverything/AFFiNE a28cad2). */
const VIDEO_METADATA_TIMEOUT_MS = 3000;

/**
 * The natural size of a video, read from its metadata alone (issue #738,
 * upstream toeverything/AFFiNE a28cad2). `null` when the browser cannot tell
 * within `timeoutMs`: a codec it cannot decode may fire neither
 * `loadedmetadata` nor `error`, and a caller must never wait on it forever.
 */
export function readVideoSize(
  blob: Blob,
  timeoutMs = VIDEO_METADATA_TIMEOUT_MS
) {
  return new Promise<{ width: number; height: number } | null>(resolve => {
    const video = document.createElement('video');
    const url = URL.createObjectURL(blob);
    const done = (size: { width: number; height: number } | null) => {
      clearTimeout(timer);
      video.onloadedmetadata = video.onerror = null;
      video.removeAttribute('src');
      URL.revokeObjectURL(url);
      resolve(size);
    };
    const timer = setTimeout(() => done(null), timeoutMs);
    video.preload = 'metadata';
    video.onloadedmetadata = () => {
      const { videoWidth: width, videoHeight: height } = video;
      done(width && height ? { width, height } : null);
    };
    video.onerror = () => done(null);
    video.src = url;
  });
}

export function convertToPng(blob: Blob): Promise<Blob | null> {
  return new Promise(resolve => {
    const reader = new FileReader();

    reader.addEventListener('load', _ => {
      const img = new Image();

      img.onload = () => {
        const c = document.createElement('canvas');
        c.width = img.width;
        c.height = img.height;
        const ctx = c.getContext('2d');
        if (!ctx) {
          resolve(null);
          return;
        }
        ctx.drawImage(img, 0, 0);
        c.toBlob(resolve, 'image/png');
      };

      img.onerror = () => resolve(null);

      img.src = reader.result as string;
    });

    reader.addEventListener('error', () => resolve(null));

    reader.readAsDataURL(blob);
  });
}
