import {
  NotificationProvider,
  translateKey,
} from '@labre/affine-shared/services';
import { type BlockStdScope } from '@labre/std';

import { toast } from '../toast/toast.js';
import {
  NOTIFY_CLEARED_ALIASES_MESSAGE,
  NOTIFY_CLEARED_ALIASES_TITLE,
  NOTIFY_SWITCHED_TO_CARD_MESSAGE,
  NOTIFY_SWITCHED_TO_CARD_TITLE,
  NOTIFY_SWITCHED_TO_EMBED_MESSAGE,
  NOTIFY_SWITCHED_TO_EMBED_TITLE,
} from '../translations.js';

function notify(std: BlockStdScope, title: string, message: string) {
  const notification = std.getOptional(NotificationProvider);
  const { host } = std;

  if (!notification) {
    toast(host, title);
    return;
  }

  notification.notifyWithUndoAction({
    title,
    message,
    accent: 'info',
    duration: 10 * 1000,
  });
}

export function notifyLinkedDocSwitchedToCard(std: BlockStdScope) {
  notify(
    std,
    translateKey(std, ...NOTIFY_SWITCHED_TO_CARD_TITLE),
    translateKey(std, ...NOTIFY_SWITCHED_TO_CARD_MESSAGE)
  );
}

export function notifyLinkedDocSwitchedToEmbed(std: BlockStdScope) {
  notify(
    std,
    translateKey(std, ...NOTIFY_SWITCHED_TO_EMBED_TITLE),
    translateKey(std, ...NOTIFY_SWITCHED_TO_EMBED_MESSAGE)
  );
}

export function notifyLinkedDocClearedAliases(std: BlockStdScope) {
  notify(
    std,
    translateKey(std, ...NOTIFY_CLEARED_ALIASES_TITLE),
    translateKey(std, ...NOTIFY_CLEARED_ALIASES_MESSAGE)
  );
}
