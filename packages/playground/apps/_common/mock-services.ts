import type { PivotRecordPicker } from '@labre/affine/blocks/surface';
import { toast } from '@labre/affine/components/toast';
import {
  ColorScheme,
  type DocMode,
  type ReferenceParams,
} from '@labre/affine/model';
import {
  type CommentId,
  type CommentProvider,
  type DocModeProvider,
  type EditorSetting,
  GeneralSettingSchema,
  type GenerateDocUrlService,
  type NotificationService,
  type ParseDocUrlService,
  type ThemeExtension,
} from '@labre/affine/shared/services';
import type { BlockStdScope } from '@labre/affine/std';
import type { BaseSelection, Workspace } from '@labre/affine/store';
import type { TestAffineEditorContainer } from '@labre/integration-test';
import { Signal, signal } from '@preact/signals-core';
import { Subject } from 'rxjs';

function getModeFromStorage() {
  const mapJson = localStorage.getItem('playground:docMode');
  const mapArray = mapJson ? JSON.parse(mapJson) : [];
  return new Map<string, DocMode>(mapArray);
}

function saveModeToStorage(map: Map<string, DocMode>) {
  const mapArray = Array.from(map);
  const mapJson = JSON.stringify(mapArray);
  localStorage.setItem('playground:docMode', mapJson);
}

export function removeModeFromStorage(docId: string) {
  const modeMap = getModeFromStorage();
  modeMap.delete(docId);
  saveModeToStorage(modeMap);
}

const DEFAULT_MODE: DocMode = 'page';
const slotMap = new Map<string, Subject<DocMode>>();

export function mockDocModeService(editor: TestAffineEditorContainer) {
  const getEditorModeCallback: () => DocMode = () => editor.mode;
  const setEditorModeCallback: (mode: DocMode) => void = mode =>
    editor.switchEditor(mode);
  const docModeService: DocModeProvider = {
    getPrimaryMode: (docId: string) => {
      try {
        const modeMap = getModeFromStorage();
        return modeMap.get(docId) ?? DEFAULT_MODE;
      } catch {
        return DEFAULT_MODE;
      }
    },
    onPrimaryModeChange: (handler: (mode: DocMode) => void, docId: string) => {
      if (!slotMap.get(docId)) {
        slotMap.set(docId, new Subject());
      }
      return slotMap.get(docId)!.subscribe(handler);
    },
    getEditorMode: () => {
      return getEditorModeCallback();
    },
    setEditorMode: (mode: DocMode) => {
      setEditorModeCallback(mode);
    },
    setPrimaryMode: (mode: DocMode, docId: string) => {
      const modeMap = getModeFromStorage();
      modeMap.set(docId, mode);
      saveModeToStorage(modeMap);
      slotMap.get(docId)?.next(mode);
    },
    togglePrimaryMode: (docId: string) => {
      const mode =
        docModeService.getPrimaryMode(docId) === 'page' ? 'edgeless' : 'page';
      docModeService.setPrimaryMode(mode, docId);
      return mode;
    },
  };
  return docModeService;
}

export function mockNotificationService(editor: TestAffineEditorContainer) {
  const notificationService: NotificationService = {
    toast: (message, options) => {
      toast(editor.host!, message, options?.duration);
    },
    confirm: notification => {
      return Promise.resolve(confirm(notification.title.toString()));
    },
    prompt: notification => {
      return Promise.resolve(
        prompt(notification.title.toString(), notification.autofill?.toString())
      );
    },
    notify: notification => {
      // todo: implement in playground
      console.log(notification);
    },
    notifyWithUndoAction: notification => {
      // todo: implement in playground
      console.log(notification);
    },
  };
  return notificationService;
}

export function mockParseDocUrlService(collection: Workspace) {
  const parseDocUrlService: ParseDocUrlService = {
    parseDocUrl: (url: string) => {
      if (url && URL.canParse(url)) {
        const path = decodeURIComponent(new URL(url).hash.slice(1));
        const item =
          path.length > 0
            ? Array.from(collection.docs.values()).find(doc => doc.id === path)
            : null;
        if (item) {
          return {
            docId: item.id,
          };
        }
      }
      return;
    },
  };
  return parseDocUrlService;
}

export class MockEdgelessTheme {
  theme$ = signal(ColorScheme.Light);

  setTheme(theme: ColorScheme) {
    this.theme$.value = theme;
  }

  toggleTheme() {
    const theme =
      this.theme$.value === ColorScheme.Dark
        ? ColorScheme.Light
        : ColorScheme.Dark;
    this.theme$.value = theme;
  }
}

export const mockEdgelessTheme = new MockEdgelessTheme();

export const themeExtension: ThemeExtension = {
  getEdgelessTheme() {
    return mockEdgelessTheme.theme$;
  },
};

export function mockGenerateDocUrlService(collection: Workspace) {
  const generateDocUrlService: GenerateDocUrlService = {
    generateDocUrl: (docId: string, params?: ReferenceParams) => {
      const doc = collection.getDoc(docId);
      if (!doc) return;

      const url = new URL(location.pathname, location.origin);
      url.search = location.search;
      if (params) {
        const search = url.searchParams;
        for (const [key, value] of Object.entries(params)) {
          search.set(key, Array.isArray(value) ? value.join(',') : value);
        }
      }
      url.hash = encodeURIComponent(docId);

      return url.toString();
    },
  };
  return generateDocUrlService;
}

/**
 * **A recette mock-up, not a product.** The playground's stand-in for the pivot
 * record picker the SaaS host provides.
 *
 * The library deliberately ships NO picker: `PivotRecordPickerProvider` has no
 * default implementation, so with nothing registered the reading panel's "Link
 * to a record" action is hidden rather than disabled (see
 * `reading.ts`). That is correct in production — the library does not know what
 * a pivot record is — but it left the playground with no way to exercise
 * `pivot.bind` at all, which is what this fills.
 *
 * It is a bare floating list over the collection's own documents: crude on
 * purpose, so nobody mistakes it for the real picker. (`window.prompt` would
 * be cruder still, but embedded browsers disable it.) The real host opens its
 * record browser; this one lists what the playground happens to have. Do not
 * grow it — if a recette needs more, the answer is to run the SaaS host, not
 * to build a second picker here.
 */
export function mockPivotRecordPicker(): PivotRecordPicker {
  return {
    // The contract says a picker MUST NOT throw and resolves to `null` on a
    // cancel — clicking outside the list or pressing Escape cancels.
    pick: async (std: BlockStdScope) => {
      const docs = [...std.store.workspace.docs.values()];
      if (docs.length === 0) return null;

      return new Promise<string | null>(resolve => {
        const overlay = document.createElement('div');
        overlay.style.cssText =
          'position:fixed;inset:0;z-index:2147483647;background:rgba(0,0,0,.3);' +
          'display:flex;align-items:center;justify-content:center;';
        const box = document.createElement('div');
        box.style.cssText =
          'background:#fff;color:#111;border-radius:8px;padding:12px 16px;' +
          'min-width:280px;max-height:60vh;overflow:auto;font:14px sans-serif;' +
          'box-shadow:0 8px 30px rgba(0,0,0,.3);';
        box.innerHTML =
          '<div style="font-weight:600;margin-bottom:8px">' +
          '[playground mock-up] Link to which record?</div>';
        const done = (id: string | null) => {
          overlay.remove();
          window.removeEventListener('keydown', onKey, true);
          resolve(id);
        };
        const onKey = (e: KeyboardEvent) => {
          if (e.key === 'Escape') done(null);
        };
        window.addEventListener('keydown', onKey, true);
        overlay.addEventListener('click', e => {
          if (e.target === overlay) done(null);
        });
        for (const doc of docs) {
          const row = document.createElement('button');
          row.textContent = doc.meta?.title || 'Untitled';
          row.style.cssText =
            'display:block;width:100%;text-align:left;padding:6px 8px;' +
            'margin:2px 0;border:0;border-radius:4px;background:#f4f4f5;' +
            'cursor:pointer;font:inherit;';
          row.onclick = () => done(doc.id);
          box.append(row);
        }
        overlay.append(box);
        document.body.append(overlay);
      });
    },
  };
}

export function mockEditorSetting() {
  if (window.editorSetting$) return window.editorSetting$;

  const initialVal = Object.entries(GeneralSettingSchema.shape).reduce(
    (pre: EditorSetting, [key, schema]) => {
      // @ts-expect-error key is EditorSetting field
      pre[key as keyof EditorSetting] = schema.parse(undefined);
      return pre;
    },
    {} as EditorSetting
  );

  const signal = new Signal<EditorSetting>(initialVal);

  window.editorSetting$ = signal;

  return signal;
}

export function mockCommentProvider() {
  class MockCommentProvider implements CommentProvider {
    commentId = 0;

    comments = new Map<
      CommentId,
      {
        selections: BaseSelection[];
        resolved: boolean;
      }
    >();

    commentAddSubject = new Subject<{
      id: CommentId;
      selections: BaseSelection[];
    }>();

    commentResolveSubject = new Subject<CommentId>();

    commentHighlightSubject = new Subject<CommentId | null>();

    commentDeleteSubject = new Subject<CommentId>();

    addComment(selections: BaseSelection[]) {
      const id: CommentId = `${this.commentId++}`;
      this.comments.set(id, {
        selections,
        resolved: false,
      });
      this.commentAddSubject.next({
        id,
        selections,
      });
    }

    resolveComment(id: CommentId) {
      const comment = this.comments.get(id);
      if (!comment) return;
      comment.resolved = true;
      this.commentResolveSubject.next(id);
    }

    deleteComment(id: CommentId) {
      this.comments.delete(id);
      this.commentDeleteSubject.next(id);
    }

    highlightComment(id: CommentId | null) {
      this.commentHighlightSubject.next(id);
    }

    getComments(type: 'resolved' | 'unresolved' | 'all' = 'all') {
      return Array.from(this.comments.entries())
        .filter(([_, comment]) => {
          if (type === 'all') return true;
          if (type === 'resolved') return comment.resolved;
          return !comment.resolved;
        })
        .map(([id]) => id);
    }

    onCommentAdded(
      callback: (id: CommentId, selections: BaseSelection[]) => void
    ) {
      return this.commentAddSubject.subscribe(({ id, selections }) => {
        callback(id, selections);
      });
    }

    onCommentResolved(callback: (id: CommentId) => void) {
      return this.commentResolveSubject.subscribe(callback);
    }

    onCommentDeleted(callback: (id: CommentId) => void) {
      return this.commentDeleteSubject.subscribe(callback);
    }

    onCommentHighlighted(callback: (id: CommentId | null) => void) {
      return this.commentHighlightSubject.subscribe(callback);
    }
  }

  const provider = new MockCommentProvider();
  return provider;
}

declare global {
  interface Window {
    editorSetting$: Signal<EditorSetting>;
  }
}
