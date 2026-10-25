import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { notificationFor, notify, NOTIFICATION_KEY } from '../src/office/notify';
import {
  analysisContext,
  canReadHeaders,
  currentItem,
  itemKey,
  readHeaders,
} from '../src/office/mailbox';
import { themeFor } from '../src/ui/theme';
import { unsupportedVerdict } from '../src/parser/verdict';
import { verdictFor } from './helpers';

const OfficeStub = {
  AsyncResultStatus: { Succeeded: 'succeeded', Failed: 'failed' },
  MailboxEnums: {
    ItemType: { Message: 'message', Appointment: 'appointment' },
    ItemNotificationMessageType: { InformationalMessage: 'info', ErrorMessage: 'error' },
  },
  context: {
    requirements: { isSetSupported: vi.fn(() => true) },
    mailbox: { item: null as unknown, userProfile: { emailAddress: 'me@contoso.example' } },
  },
};

describe('Office adapter', () => {
  beforeEach(() => vi.stubGlobal('Office', OfficeStub));
  afterEach(() => vi.unstubAllGlobals());

  it('builds info-bar payloads', () => {
    const ok = verdictFor('gmail-pass-reject.txt');
    expect(notificationFor(ok.v, ok.a)).toEqual({
      type: 'info',
      message: 'DMARC Shield: verified sender (example.com).',
      icon: 'Icon.16x16',
      persistent: false,
    });
    const bad = verdictFor('exo-fail-oreject.txt');
    expect(notificationFor(bad.v, bad.a)?.type).toBe('error');
    expect(notificationFor(unsupportedVerdict(), bad.a)).toBeNull();
  });

  it('replaces or removes the notification', () => {
    const nm = { replaceAsync: vi.fn(), removeAsync: vi.fn() };
    const item = { notificationMessages: nm } as unknown as Office.MessageRead;
    const ok = verdictFor('gmail-pass-reject.txt');
    notify(item, ok.v, ok.a);
    expect(nm.replaceAsync).toHaveBeenCalledWith(
      NOTIFICATION_KEY,
      expect.objectContaining({ type: 'info' }),
    );
    notify(item, unsupportedVerdict(), ok.a);
    expect(nm.removeAsync).toHaveBeenCalledWith(NOTIFICATION_KEY);
    notify({} as Office.MessageRead, ok.v, ok.a);
  });

  it('reads headers and context from the item', async () => {
    const item = {
      itemType: 'message',
      itemId: 'AAMk1',
      from: { emailAddress: 'a@example.com' },
      getAllInternetHeadersAsync: (cb: (r: unknown) => void) =>
        cb({ status: 'succeeded', value: 'X: y' }),
    };
    OfficeStub.context.mailbox.item = item;
    expect(currentItem()).toBe(item);
    expect(canReadHeaders(item as unknown as Office.MessageRead)).toBe(true);
    await expect(readHeaders(item as unknown as Office.MessageRead)).resolves.toBe('X: y');
    expect(analysisContext(item as unknown as Office.MessageRead)).toEqual({
      fromAddress: 'a@example.com',
      userEmail: 'me@contoso.example',
    });
    expect(itemKey(item as unknown as Office.MessageRead)).toBe('AAMk1');
  });

  it('handles failures, missing APIs and non-message items', async () => {
    const failing = {
      getAllInternetHeadersAsync: (cb: (r: unknown) => void) =>
        cb({ status: 'failed', error: { message: 'denied' } }),
    } as unknown as Office.MessageRead;
    await expect(readHeaders(failing)).rejects.toThrow('denied');
    expect(canReadHeaders({} as Office.MessageRead)).toBe(false);
    OfficeStub.context.mailbox.item = { itemType: 'appointment' };
    expect(currentItem()).toBeNull();
    expect(itemKey({ subject: 's' } as unknown as Office.MessageRead)).toBe('|s');
  });

  it('derives the theme from the Office background colour', () => {
    expect(themeFor('#1f1f1f')).toBe('dark');
    expect(themeFor('#FFFFFF')).toBe('light');
    expect(themeFor('blue')).toBeNull();
    expect(themeFor(undefined)).toBeNull();
  });
});
