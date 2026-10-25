/**
 * Task pane controller: reads headers, analyses them locally, renders the
 * verdict, and (only when asked) looks up the DMARC policy over DoH and checks
 * BIMI.
 */
import { bimiEligibility } from '../bimi/eligibility';
import { type BimiOutcome, bimiFromReceiver, lookupBimi } from '../bimi/lookup';
import { type ResolverId, RESOLVERS, lookupDmarcPolicy } from '../dns/lookup';
import { LOCALE_NAMES, type Locale, type MessageKey, resolveLocale, setLocale, t } from '../i18n';
import { notify } from '../office/notify';
import {
  analysisContext,
  canReadHeaders,
  currentItem,
  itemKey,
  onItemChanged,
  readHeaders,
} from '../office/mailbox';
import { type Analysis, type AnalysisContext, analyze } from '../parser/analyze';
import type { PolicyInfo } from '../parser/policy';
import { toUnicode } from '../parser/punycode';
import { type Verdict, decide } from '../parser/verdict';
import { type Settings, type SettingsStore, memoryStore, roamingStore } from '../settings';
import { clear, h, shield } from '../ui/dom';
import { type BimiState, bimiView, svgDataUrl } from '../ui/bimiview';
import { applyOfficeTheme } from '../ui/theme';
import {
  SHIELD,
  type VerdictView,
  detailRows,
  findingText,
  simpleView,
  verdictView,
} from '../ui/view';
import { DEMOS, type DemoSample } from './demo';

declare const __APP_VERSION__: string;

type Lookup = (domain: string, resolver: ResolverId) => Promise<PolicyInfo | null>;

interface Env {
  store: SettingsStore;
  displayLanguage?: string;
  lookup: Lookup;
  bimi: (domain: string, resolver: ResolverId) => Promise<BimiOutcome>;
  /** Office mode only: show the info bar for the current item. */
  notify?: (v: Verdict, a: Analysis) => void;
}

interface Current {
  a: Analysis;
  v: Verdict;
}

const $ = <T extends HTMLElement>(id: string) => document.getElementById(id) as T;

let env: Env;
let settings: Settings;
let current: Current | null = null;
/** Incremented on every evaluation so late async results for a previous item are dropped. */
let generation = 0;

// ---------------------------------------------------------------- rendering

function applyStaticText(): void {
  document.documentElement.lang =
    settings.language === 'auto'
      ? resolveLocale(undefined, env.displayLanguage)
      : settings.language;
  for (const el of document.querySelectorAll<HTMLElement>('[data-i18n]')) {
    el.textContent = t(el.dataset.i18n as MessageKey);
  }
  $('version').textContent = t('footer.version', { version: __APP_VERSION__ });
  renderHelp();
  renderSettingsForm();
}

function renderVerdict(view: VerdictView): void {
  const section = $('verdict');
  const look = SHIELD[view.state];
  section.dataset.tone = look.tone;
  section.dataset.state = view.state;
  $('shield').replaceChildren(shield(look.glyph));
  $('verdict-title').textContent = view.title;
  $('verdict-summary').textContent = view.summary;
  const via = $('verdict-via');
  via.hidden = !view.via;
  via.textContent = view.via ?? '';
}

function hideResultSections(): void {
  for (const id of ['dns', 'bimi', 'findings', 'details', 'raw']) $(id).hidden = true;
}

function renderFindings(a: Analysis): void {
  const list = $('findings-list');
  clear(list);
  // Forgery first, then notices.
  const sorted = [...a.findings].sort((x, y) =>
    x.severity === y.severity ? 0 : x.severity === 'forgery' ? -1 : 1,
  );
  for (const f of sorted) {
    list.append(
      h(
        'li',
        { class: 'finding', 'data-severity': f.severity },
        h('span', { class: 'icon', 'aria-hidden': 'true' }, f.severity === 'forgery' ? '✕' : '!'),
        h('span', {}, findingText(f)),
      ),
    );
  }
  $('findings').hidden = sorted.length === 0;
}

function renderDetails(a: Analysis, v: Verdict): void {
  const dl = $('details-list');
  clear(dl);
  for (const r of detailRows(a, v)) {
    dl.append(
      h(
        'div',
        { class: 'row' },
        h('dt', {}, r.label),
        h(
          'dd',
          {},
          r.badge ? h('span', { class: 'badge', 'data-tone': r.tone }, r.badge) : null,
          ...r.info.map((i) =>
            h('span', { class: 'info' }, i.label ? `${i.label}: ${i.value}` : i.value),
          ),
        ),
      ),
    );
  }
  $('details').hidden = false;
}

function renderRaw(a: Analysis): void {
  const body = $('raw-body');
  clear(body);
  const block = (titleKey: MessageKey, lines: string[]) => {
    if (lines.length === 0) return;
    body.append(
      h('h3', {}, t(titleKey)),
      h('pre', { class: 'mono', tabindex: '0' }, lines.join('\n\n')),
    );
  };
  block('raw.trusted', a.topAr ? [`Authentication-Results: ${a.topAr.raw}`] : []);
  block(
    'raw.other',
    a.otherArs.map((r) => `Authentication-Results: ${r.raw}`),
  );
  block(
    'raw.secondary',
    a.secondary.map((s) => `${s.name}: ${s.value}`),
  );
  $('raw').hidden = body.childElementCount === 0;
}

type DnsState =
  | { kind: 'hidden' }
  | { kind: 'offer'; domain: string }
  | { kind: 'checking'; domain: string }
  | { kind: 'failed'; message: string }
  | { kind: 'norecord'; domain: string };

function renderDns(state: DnsState): void {
  const box = $('dns');
  clear(box);
  box.hidden = state.kind === 'hidden';
  const resolver = RESOLVERS[settings.resolver].name;
  switch (state.kind) {
    case 'offer': {
      const lookupBtn = h('button', { type: 'button', class: 'button' }, t('dns.button'));
      lookupBtn.addEventListener('click', () => void runLookup(generation));
      const alwaysBtn = h('button', { type: 'button', class: 'button secondary' }, t('dns.always'));
      alwaysBtn.addEventListener('click', () => {
        const panel = $<HTMLDetailsElement>('settings');
        panel.open = true;
        $('set-dns').focus();
      });
      box.append(
        h('p', {}, t('dns.offer', { domain: toUnicode(state.domain), resolver })),
        h('div', { class: 'actions' }, lookupBtn, alwaysBtn),
      );
      break;
    }
    case 'checking':
      box.append(h('p', {}, t('dns.checking', { domain: toUnicode(state.domain) })));
      break;
    case 'failed':
      box.append(h('p', {}, t('dns.failed', { message: state.message })));
      break;
    case 'norecord':
      box.append(h('p', {}, t('dns.norecord', { domain: toUnicode(state.domain) })));
      break;
    case 'hidden':
      break;
  }
}

function renderHelp(): void {
  const body = $('help-body');
  clear(body);
  body.append(
    h('h3', {}, t('help.states')),
    h('p', {}, t('help.verified')),
    h('p', {}, t('help.authenticated')),
    h('p', {}, t('help.unprotected')),
    h('h3', {}, t('help.terms')),
    h('p', {}, t('help.dmarc')),
    h('p', {}, t('help.spf')),
    h('p', {}, t('help.dkim')),
    h('p', {}, t('help.arc')),
    h('p', {}, t('help.policy')),
    h('p', {}, t('help.bimi')),
    h('p', {}, t('help.limits')),
    h('p', {}, t('help.privacy')),
  );
}

function renderSettingsForm(): void {
  $<HTMLInputElement>('set-infobar').checked = settings.showInfoBar;
  $<HTMLInputElement>('set-dns').checked = settings.dnsLookup;
  $<HTMLInputElement>('set-bimi').checked = settings.bimiLookup;
  const resolver = $<HTMLSelectElement>('set-resolver');
  resolver.replaceChildren(
    ...Object.entries(RESOLVERS).map(([id, r]) =>
      h(
        'option',
        { value: id, selected: id === settings.resolver },
        `${r.name} (${new URL(r.url).host})`,
      ),
    ),
  );
  const lang = $<HTMLSelectElement>('set-language');
  lang.replaceChildren(
    h(
      'option',
      { value: 'auto', selected: settings.language === 'auto' },
      t('settings.language.auto'),
    ),
    ...Object.entries(LOCALE_NAMES).map(([id, name]) =>
      h('option', { value: id, selected: id === settings.language, lang: id }, name),
    ),
  );
}

function renderBimi(state: BimiState | null): void {
  const box = $('bimi');
  box.hidden = state === null;
  if (!state) return;
  const view = bimiView(state);
  box.dataset.tone = view.tone;
  box.classList.toggle('warn', view.warn === true);
  $('bimi-logo').replaceChildren(
    view.logoSvg
      ? h('img', {
          src: svgDataUrl(view.logoSvg),
          alt: view.logoAlt ?? '',
          width: '56',
          height: '56',
        })
      : h('span', { class: 'bimi-placeholder', 'aria-hidden': 'true' }, 'B'),
  );
  const badge = $('bimi-badge');
  badge.textContent = view.badge;
  badge.dataset.tone = view.tone;
  $('bimi-text').replaceChildren(...view.text.map((line) => h('p', {}, line)));
  const actions = $('bimi-actions');
  clear(actions);
  if (view.offer) {
    const check = h('button', { type: 'button', class: 'button' }, t('bimi.button'));
    check.addEventListener('click', () => void updateBimi(generation, true));
    const always = h('button', { type: 'button', class: 'button secondary' }, t('bimi.always'));
    always.addEventListener('click', () => {
      $<HTMLDetailsElement>('settings').open = true;
      $('set-bimi').focus();
    });
    actions.append(check, always);
  }
}

function present(): void {
  if (!current) return;
  const { a, v } = current;
  renderVerdict(verdictView(v, a));
  renderFindings(a);
  renderDetails(a, v);
  renderRaw(a);
  if (settings.showInfoBar) env.notify?.(v, a);
}

// ---------------------------------------------------------------- flow

async function runLookup(gen: number): Promise<void> {
  if (!current?.v.needsPolicy || !current.v.policyDomain) return;
  const domain = current.v.policyDomain;
  renderDns({ kind: 'checking', domain });
  try {
    const policy = await env.lookup(domain, settings.resolver);
    if (gen !== generation || !current) return;
    if (policy) {
      current.v = decide(current.a, policy);
      present();
      renderDns({ kind: 'hidden' });
      void updateBimi(gen, false);
    } else {
      renderDns({ kind: 'norecord', domain });
    }
  } catch (e) {
    if (gen !== generation) return;
    renderDns({ kind: 'failed', message: e instanceof Error ? e.message : String(e) });
  }
}

function bimiDomain(c: Current): string | undefined {
  return c.v.policyDomain ?? c.a.dmarc?.headerFrom ?? c.a.from?.domain;
}

/**
 * BIMI is evaluated only for mail that passed DMARC under an enforcing policy.
 * A result recorded by a BIMI-aware receiver is used as-is (no network);
 * otherwise we check ourselves, but only when the user asked (`requested`) or
 * enabled automatic checks.
 */
async function updateBimi(gen: number, requested: boolean): Promise<void> {
  if (!current) return;
  const domain = bimiDomain(current);
  const receiver = domain ? bimiFromReceiver(current.a, domain) : null;
  let eligibility = bimiEligibility(current.v);
  if (receiver && eligibility !== 'not-authenticated') {
    return renderBimi({ kind: 'outcome', outcome: receiver });
  }
  if (eligibility === 'not-authenticated' || eligibility === 'weak-policy' || !domain) {
    return renderBimi({
      kind: 'ineligible',
      reason: eligibility === 'weak-policy' ? 'weak-policy' : 'not-authenticated',
    });
  }
  if (!requested && !settings.bimiLookup) return renderBimi({ kind: 'off', domain });

  renderBimi({ kind: 'checking', domain });
  try {
    if (eligibility === 'needs-policy') {
      // BIMI depends on the DMARC policy; look it up first (same resolver).
      const policy = await env.lookup(domain, settings.resolver);
      if (gen !== generation || !current) return;
      if (policy) {
        current.v = decide(current.a, policy);
        present();
        renderDns({ kind: 'hidden' });
      }
      eligibility = bimiEligibility(current.v);
      if (eligibility !== 'eligible') {
        return renderBimi({
          kind: 'ineligible',
          reason: eligibility === 'not-authenticated' ? 'not-authenticated' : 'weak-policy',
        });
      }
    }
    const outcome = await env.bimi(domain, settings.resolver);
    if (gen !== generation) return;
    renderBimi({ kind: 'outcome', outcome });
  } catch (e) {
    if (gen !== generation) return;
    renderBimi({ kind: 'error', message: e instanceof Error ? e.message : String(e) });
  }
}

async function show(headers: string, ctx: AnalysisContext, gen: number): Promise<void> {
  const a = analyze(headers, ctx);
  current = { a, v: decide(a) };
  present();
  const { v } = current;
  if (v.needsPolicy && v.policyDomain) {
    if (settings.dnsLookup) await runLookup(gen);
    else renderDns({ kind: 'offer', domain: v.policyDomain });
  } else {
    renderDns({ kind: 'hidden' });
  }
  await updateBimi(gen, false);
}

async function evaluateOfficeItem(): Promise<void> {
  const gen = ++generation;
  current = null;
  hideResultSections();
  const item = currentItem();
  if (!item) return renderVerdict(simpleView('noitem'));
  if (!canReadHeaders(item)) return renderVerdict(simpleView('unsupported'));
  renderVerdict(simpleView('loading'));
  const key = itemKey(item);
  try {
    const headers = await readHeaders(item);
    // The user may have switched messages (pinned pane) while we were waiting.
    const now = currentItem();
    if (gen !== generation || now === null || itemKey(now) !== key) return;
    await show(headers, analysisContext(item), gen);
  } catch (e) {
    if (gen === generation)
      renderVerdict(simpleView('error', e instanceof Error ? e.message : String(e)));
  }
}

function wireSettings(onChange: (before: Settings) => void): void {
  $<HTMLFormElement>('settings-form').addEventListener('submit', (ev) => {
    ev.preventDefault();
    const before = settings;
    const next: Settings = {
      showInfoBar: $<HTMLInputElement>('set-infobar').checked,
      dnsLookup: $<HTMLInputElement>('set-dns').checked,
      bimiLookup: $<HTMLInputElement>('set-bimi').checked,
      resolver: $<HTMLSelectElement>('set-resolver').value as ResolverId,
      language: $<HTMLSelectElement>('set-language').value as Settings['language'],
    };
    const status = $('settings-status');
    env.store
      .save(next)
      .then(() => {
        settings = env.store.load();
        setLocale(
          resolveLocale(
            settings.language === 'auto' ? undefined : settings.language,
            env.displayLanguage,
          ),
        );
        applyStaticText();
        $('settings-status').textContent = t('settings.saved');
        onChange(before);
      })
      .catch((e: unknown) => {
        status.textContent = t('settings.saveFailed', {
          message: e instanceof Error ? e.message : String(e),
        });
      });
  });
}

function init(e: Env): void {
  env = e;
  settings = env.store.load();
  setLocale(
    resolveLocale(
      settings.language === 'auto' ? undefined : settings.language,
      env.displayLanguage,
    ),
  );
  applyStaticText();
}

function rerender(before: Settings): void {
  if (!current) return;
  if (settings.bimiLookup && !before.bimiLookup) void updateBimi(generation, false);
  if (current.v.needsPolicy && current.v.policyDomain) {
    present();
    if (settings.dnsLookup && !before.dnsLookup) void runLookup(generation);
    else if (!settings.dnsLookup) renderDns({ kind: 'offer', domain: current.v.policyDomain });
  } else {
    present();
  }
}

// ---------------------------------------------------------------- entry points

function startOffice(): void {
  init({
    store: roamingStore(Office.context.roamingSettings),
    displayLanguage: Office.context.displayLanguage,
    lookup: async (domain, resolver) => (await lookupDmarcPolicy(domain, resolver)).policy ?? null,
    bimi: (domain, resolver) => lookupBimi(domain, resolver),
    notify: (v, a) => {
      const item = currentItem();
      if (item) notify(item, v, a);
    },
  });
  applyOfficeTheme();
  // Pinning is the only way to check messages without opening the pane each time.
  $('pin-tip').hidden = false;
  wireSettings(rerender);
  onItemChanged(() => void evaluateOfficeItem());
  void evaluateOfficeItem();
}

function startDemo(sample: DemoSample, lang: string | null, banner: boolean): void {
  init({
    // Demo lookups are fake (no network), so BIMI can be on by default here.
    store: memoryStore({ bimiLookup: true, ...(lang ? { language: lang as Locale } : {}) }),
    displayLanguage: navigator.language,
    lookup: async () => sample.dnsPolicy ?? null,
    bimi: async (domain) => sample.bimi ?? { kind: 'none', domain },
  });
  $('demo-banner').hidden = !banner;
  wireSettings(rerender);
  void show(sample.headers, sample.ctx ?? {}, ++generation);
}

function startOutside(): void {
  init({
    store: memoryStore(),
    displayLanguage: navigator.language,
    lookup: async () => null,
    bimi: async (domain) => ({ kind: 'none', domain }),
  });
  wireSettings(() => renderVerdict({ ...simpleView('unsupported'), summary: t('reason.outside') }));
  renderVerdict({ ...simpleView('unsupported'), summary: t('reason.outside') });
}

function boot(): void {
  const params = new URLSearchParams(location.search);
  const demoName = params.get('demo');
  const sample = demoName !== null ? DEMOS[demoName] : undefined;
  // `clean=1` hides the demo banner, for Store screenshots only.
  if (sample) return startDemo(sample, params.get('lang'), params.get('clean') !== '1');
  if (typeof Office === 'undefined') return startOutside();
  Office.onReady((info) =>
    info.host === Office.HostType.Outlook ? startOffice() : startOutside(),
  );
}

boot();
