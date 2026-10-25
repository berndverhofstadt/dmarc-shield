/** Thin adapter around Office.js for the parts DMARC Shield uses. */
import type { AnalysisContext } from '../parser/analyze';

export type ReadItem = Office.MessageRead;

export function currentItem(): ReadItem | null {
  const item = Office.context.mailbox?.item as ReadItem | null | undefined;
  return item && item.itemType === Office.MailboxEnums.ItemType.Message ? item : null;
}

/** Mailbox 1.8 + the method actually present (mobile and on-prem lack it). */
export function canReadHeaders(item: ReadItem): boolean {
  return (
    Office.context.requirements.isSetSupported('Mailbox', '1.8') &&
    typeof item.getAllInternetHeadersAsync === 'function'
  );
}

export function readHeaders(item: ReadItem): Promise<string> {
  return new Promise((resolve, reject) => {
    item.getAllInternetHeadersAsync((r) => {
      if (r.status === Office.AsyncResultStatus.Succeeded) resolve(r.value ?? '');
      else reject(new Error(r.error?.message ?? 'getAllInternetHeadersAsync failed'));
    });
  });
}

export function analysisContext(item: ReadItem): AnalysisContext {
  const ctx: AnalysisContext = {};
  const from = item.from?.emailAddress;
  if (from) ctx.fromAddress = from;
  const user = Office.context.mailbox?.userProfile?.emailAddress;
  if (user) ctx.userEmail = user;
  return ctx;
}

/** A stable identity for the current item, to drop results that arrive after the user moved on. */
export function itemKey(item: ReadItem): string {
  return (
    item.itemId ||
    item.internetMessageId ||
    `${item.dateTimeCreated?.getTime() ?? ''}|${item.subject}`
  );
}

export function onItemChanged(handler: () => void): void {
  Office.context.mailbox?.addHandlerAsync?.(Office.EventType.ItemChanged, handler);
}
