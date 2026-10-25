/**
 * Info bar on the message (notificationMessages, Mailbox 1.3). One message per
 * item under a fixed key, replaced on every evaluation and not persistent.
 * Red verdicts use ErrorMessage (more prominent, no icon allowed); others use
 * InformationalMessage with the add-in icon.
 */
import type { Analysis } from '../parser/analyze';
import type { Verdict } from '../parser/verdict';
import { infobarText } from '../ui/view';
import type { ReadItem } from './mailbox';

export const NOTIFICATION_KEY = 'dmarc-shield';

export function notificationFor(v: Verdict, a: Analysis): Office.NotificationMessageDetails | null {
  if (v.state === 'unsupported') return null;
  const message = infobarText(v, a);
  if (v.state === 'unprotected') {
    return { type: Office.MailboxEnums.ItemNotificationMessageType.ErrorMessage, message };
  }
  return {
    type: Office.MailboxEnums.ItemNotificationMessageType.InformationalMessage,
    message,
    icon: 'Icon.16x16',
    persistent: false,
  };
}

export function notify(item: ReadItem, v: Verdict, a: Analysis): void {
  const details = notificationFor(v, a);
  const nm = item.notificationMessages;
  if (!nm) return;
  if (!details) {
    nm.removeAsync(NOTIFICATION_KEY);
    return;
  }
  // Failures are non-fatal: the task pane already shows the verdict.
  nm.replaceAsync(NOTIFICATION_KEY, details);
}
