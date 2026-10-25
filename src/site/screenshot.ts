// Dev-only: fills the screenshot frame for scripts/screenshots.mjs. The task pane is
// captured separately and composited in, because Office.js refuses to run in an iframe
// outside Outlook.
const SHOTS: Record<string, { caption: string; subject: string; name: string; addr: string }> = {
  verified: {
    caption: 'Know instantly when a sender is genuine',
    subject: 'Your statement is ready',
    name: 'Example Bank',
    addr: 'service@example.com',
  },
  authenticated: {
    caption: 'See when a domain doesn’t fully block fakes',
    subject: 'Order confirmation',
    name: 'Example Shop',
    addr: 'orders@example.org',
  },
  arc: {
    caption: 'Forwarded and mailing-list mail, explained',
    subject: '[dev] Release notes',
    name: 'Alice',
    addr: 'alice@example.com',
  },
  unprotected: {
    caption: 'Spot spoofed senders before you click',
    subject: 'Verify your account now',
    name: 'Bank Security',
    addr: 'security@bank.example',
  },
  lookalike: {
    caption: 'Catch lookalike domains',
    subject: 'Your account is limited',
    name: 'PayPal',
    addr: 'service@pаypal.com',
  },
};
const params = new URLSearchParams(location.search);
const state = params.get('state') ?? 'verified';
const s = SHOTS[state] ?? (SHOTS.verified as (typeof SHOTS)[string]);
const set = (id: string, text: string) =>
  ((document.getElementById(id) as HTMLElement).textContent = text);
set('caption', s.caption);
set('subject', s.subject);
set('from-name', s.name);
set('from-addr', s.addr);
set('avatar', s.name.slice(0, 1));
