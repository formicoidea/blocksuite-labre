// Polyfill for `showOpenFilePicker` API
// See https://github.com/DefinitelyTyped/DefinitelyTyped/blob/master/types/wicg-file-system-access/index.d.ts
// See also https://caniuse.com/?search=showOpenFilePicker
import { BlockSuiteError, ErrorCode } from '@labre/global/exceptions';

interface OpenFilePickerOptions {
  types?:
    | {
        description?: string | undefined;
        accept: Record<string, string | string[]>;
      }[]
    | undefined;
  excludeAcceptAllOption?: boolean | undefined;
  multiple?: boolean | undefined;
}

declare global {
  interface Window {
    // Window API: showOpenFilePicker
    showOpenFilePicker?: (
      options?: OpenFilePickerOptions
    ) => Promise<FileSystemFileHandle[]>;
  }
}

/**
 * One filter a file dialog offers: what to call it, and the MIME types it
 * accepts with the extensions that go with each.
 *
 * The table below is the CLOSED list of filters this library ships. It is not
 * the only source of one: an interchange format declares its own extensions and
 * mime (`docs/adr/0012`), and a picker built from a registry entry cannot be a
 * row in a hand-maintained table — the whole point of the registry is that a
 * framework adds a format without a second file agreeing to it. So the shape is
 * named and {@link openSingleFileWithSpec} takes it directly; `FileTypes` keeps
 * naming the filters that are the editor's own.
 */
export interface FilePickerSpec {
  description: string;
  accept: Record<string, string[]>;
}

// See [Common MIME types](https://developer.mozilla.org/en-US/docs/Web/HTTP/Basics_of_HTTP/MIME_types/Common_types)
const FileTypes: FilePickerSpec[] = [
  {
    description: 'Images',
    accept: {
      'image/*': [
        '.avif',
        '.gif',
        // '.ico',
        '.jpeg',
        '.jpg',
        '.png',
        '.tif',
        '.tiff',
        // '.svg',
        '.webp',
      ],
    },
  },
  {
    description: 'Videos',
    accept: {
      'video/*': [
        '.avi',
        '.mp4',
        '.mpeg',
        '.ogg',
        // '.ts',
        '.webm',
        '.3gp',
        '.3g2',
      ],
    },
  },
  {
    description: 'Audios',
    accept: {
      'audio/*': [
        '.aac',
        '.mid',
        '.midi',
        '.mp3',
        '.oga',
        '.opus',
        '.wav',
        '.weba',
        '.3gp',
        '.3g2',
      ],
    },
  },
  {
    description: 'Markdown',
    accept: {
      'text/markdown': ['.md', '.markdown'],
    },
  },
  {
    description: 'Html',
    accept: {
      'text/html': ['.html', '.htm'],
    },
  },
  {
    description: 'Zip',
    accept: {
      'application/zip': ['.zip'],
    },
  },
  {
    description: 'MindMap',
    accept: {
      'text/xml': ['.mm', '.opml', '.xml'],
    },
  },
  {
    // A BPMN 2.0 interchange document. `.xml` rides along with `.bpmn` because
    // half the tools in the wild write the same bytes under the generic
    // extension, and a picker that refused them would refuse a valid process
    // for the sake of a filename. What the file actually IS gets decided by the
    // reader, which throws on anything that is not a BPMN `<definitions>`.
    description: 'Bpmn',
    accept: {
      'application/xml': ['.bpmn', '.xml'],
    },
  },
];

/**
 * See https://web.dev/patterns/files/open-one-or-multiple-files/
 */
type AcceptTypes =
  | 'Any'
  | 'Images'
  | 'Videos'
  | 'Audios'
  | 'Markdown'
  | 'Html'
  | 'Zip'
  | 'MindMap'
  | 'Bpmn';

export async function openFilesWith(
  acceptType: AcceptTypes = 'Any',
  multiple: boolean = true
): Promise<File[] | null> {
  if (acceptType === 'Any') return openFilesWithSpec(undefined, multiple);

  const fileType = FileTypes.find(i => i.description === acceptType);
  if (!fileType) {
    // Unreachable through the closed `AcceptTypes` union, and reported rather
    // than thrown for the same reason it always was: the picker branch used to
    // throw this inside its own try/catch, log it and answer `null`. A caller
    // asking for a filter that does not exist gets no dialog, not an exception
    // it never had to handle.
    console.error(
      new BlockSuiteError(
        ErrorCode.DefaultRuntimeError,
        `Unexpected acceptType "${acceptType}"`
      )
    );
    return null;
  }
  return openFilesWithSpec(fileType, multiple);
}

/**
 * The picker itself, over a filter rather than over a name in the table.
 *
 * `undefined` is "Any": no filter at all, which is what the dialog shows when
 * nobody narrowed it.
 */
async function openFilesWithSpec(
  spec: FilePickerSpec | undefined,
  multiple: boolean
): Promise<File[] | null> {
  // Feature detection. The API needs to be supported
  // and the app not run in an iframe.
  const supportsFileSystemAccess =
    'showOpenFilePicker' in window &&
    (() => {
      try {
        return window.self === window.top;
      } catch {
        return false;
      }
    })();

  // If the File System Access API is supported…
  if (supportsFileSystemAccess && window.showOpenFilePicker) {
    try {
      const pickerOpts = {
        types: spec ? [spec] : undefined,
        multiple,
      } satisfies OpenFilePickerOptions;
      // Show the file picker, optionally allowing multiple files.
      const handles = await window.showOpenFilePicker(pickerOpts);

      return await Promise.all(handles.map(handle => handle.getFile()));
    } catch (err) {
      console.error(err);
      return null;
    }
  }

  // Fallback if the File System Access API is not supported.
  return new Promise(resolve => {
    // Append a new `<input type="file" multiple? />` and hide it.
    const input = document.createElement('input');
    input.classList.add('affine-upload-input');
    input.style.display = 'none';
    input.type = 'file';
    input.multiple = multiple;

    if (spec) {
      // For example, `accept="image/*,.png,.jpg"` or `accept="video/*,.mp4"`.
      //
      // The EXTENSIONS as well as the MIME types, and the extensions are the
      // half that matters for anything the OS has no type for: `.bpmn`, `.mm`
      // and `.opml` are registered nowhere, so a filter built from
      // `application/xml` alone greys them out in the native dialog and the
      // file cannot be picked at all. This is the branch every browser without
      // the File System Access API takes — Firefox and Safari — and
      // `showOpenFilePicker` above already reads both halves of the same
      // filter.
      const type = spec.accept;
      input.accept = [...Object.keys(type), ...Object.values(type).flat()].join(
        ','
      );
    }
    document.body.append(input);
    // The `change` event fires when the user interacts with the dialog.
    input.addEventListener('change', () => {
      // Remove the `<input type="file" multiple? />` again from the DOM.
      input.remove();

      resolve(input.files ? Array.from(input.files) : null);
    });
    // The `cancel` event fires when the user cancels the dialog.
    input.addEventListener('cancel', () => resolve(null));
    // Show the picker.
    if ('showPicker' in HTMLInputElement.prototype) {
      input.showPicker();
    } else {
      input.click();
    }
  });
}

export async function openSingleFileWith(
  acceptType?: AcceptTypes
): Promise<File | null> {
  const files = await openFilesWith(acceptType, false);
  return files?.at(0) ?? null;
}

/**
 * One file, filtered by a spec the caller built rather than by a name in
 * {@link FileTypes}.
 *
 * What {@link openSingleFileWith} is for the editor's own dialogs, this is for
 * anything whose filter is DECLARED somewhere else — today the interchange
 * registry, whose formats each carry their extensions and their mime and are
 * added by a framework, not by editing the table above.
 */
export async function openSingleFileWithSpec(
  spec: FilePickerSpec
): Promise<File | null> {
  const files = await openFilesWithSpec(spec, false);
  return files?.at(0) ?? null;
}

export async function getImageFilesFromLocal() {
  const files = await openFilesWith('Images');
  return files ?? [];
}

export function downloadBlob(blob: Blob, name: string) {
  const dataURL = URL.createObjectURL(blob);
  const tmpLink = document.createElement('a');
  const event = new MouseEvent('click');
  tmpLink.download = name;
  tmpLink.href = dataURL;
  tmpLink.dispatchEvent(event);

  tmpLink.remove();
  URL.revokeObjectURL(dataURL);
}

// Use lru strategy is a better choice, but it's just a temporary solution.
const MAX_TEMP_DATA_SIZE = 100;
/**
 * TODO @Saul-Mirone use some other way to store the temp data
 *
 * @deprecated Waiting for migration
 */
const tempAttachmentMap = new Map<
  string,
  {
    // name for the attachment
    name: string;
  }
>();
const tempImageMap = new Map<
  string,
  {
    // This information comes from pictures.
    // If the user switches between pictures and attachments,
    // this information should be retained.
    width: number | undefined;
    height: number | undefined;
  }
>();

/**
 * Because the image block and attachment block have different props.
 * We need to save some data temporarily when converting between them to ensure no data is lost.
 *
 * For example, before converting from an image block to an attachment block,
 * we need to save the image's width and height.
 *
 * Similarly, when converting from an attachment block to an image block,
 * we need to save the attachment's name.
 *
 * See also https://github.com/toeverything/blocksuite/pull/4583#pullrequestreview-1610662677
 *
 * @internal
 */
export function withTempBlobData() {
  const saveAttachmentData = (sourceId: string, data: { name: string }) => {
    if (tempAttachmentMap.size > MAX_TEMP_DATA_SIZE) {
      console.warn(
        'Clear the temp attachment data. It may cause filename loss when converting between image and attachment.'
      );
      tempAttachmentMap.clear();
    }

    tempAttachmentMap.set(sourceId, data);
  };
  const getAttachmentData = (blockId: string) => {
    const data = tempAttachmentMap.get(blockId);
    tempAttachmentMap.delete(blockId);
    return data;
  };

  const saveImageData = (
    sourceId: string,
    data: { width: number | undefined; height: number | undefined }
  ) => {
    if (tempImageMap.size > MAX_TEMP_DATA_SIZE) {
      console.warn(
        'Clear temp image data. It may cause image width and height loss when converting between image and attachment.'
      );
      tempImageMap.clear();
    }

    tempImageMap.set(sourceId, data);
  };
  const getImageData = (blockId: string) => {
    const data = tempImageMap.get(blockId);
    tempImageMap.delete(blockId);
    return data;
  };
  return {
    saveAttachmentData,
    getAttachmentData,
    saveImageData,
    getImageData,
  };
}
