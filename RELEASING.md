# Releasing DMARC Shield

## Versioning

[Semantic versioning](https://semver.org/). `package.json` is the single
source. `scripts/build-manifest.mjs` turns `1.4.2` into the manifest's
`1.4.2.0`.

- **Patch:** fixes and parser improvements; no manifest change.
- **Minor:** new features, new strings or locales; may change the manifest.
- **Major:** changes to permissions, requirement sets or supported clients.

The hosted files *are* the add-in for every installed user: whatever is on
GitHub Pages runs in everyone's Outlook. Pages is therefore only deployed by
the release workflow on a version tag, never on every push.

## Steps

1. **Update** `CHANGELOG.md` (move *Unreleased* to the new version) and bump
   `"version"` in `package.json` (`npm version <patch|minor|major> --no-git-tag-version`).
2. **Check locally**
   ```sh
   npm ci && npm run lint && npm run typecheck && npm run test:coverage
   npm run build && npm run validate
   ```
3. **Test in real clients** with the dev build (`npm run dev` + `manifest.dev.xml`).
   Use the matrix below. Keep the browser console open on the task pane iframe and
   look for CSP violations.
4. **Screenshots:** if the UI changed, run `node scripts/screenshots.mjs` (dev
   server running) and commit the PNGs.
5. **Commit, tag, push**
   ```sh
   git commit -am "Release vX.Y.Z"
   git tag vX.Y.Z
   git push origin main vX.Y.Z
   ```
   `.github/workflows/release.yml` verifies the tag matches `package.json`, runs
   the checks, validates the manifest, deploys `dist/` to GitHub Pages and
   creates a GitHub release with `manifest.xml` and `dmarc-shield-dist.zip`.
6. **Verify production:** open
   `https://berndverhofstadt.github.io/dmarc-shield/taskpane.html?demo=verified`
   and the add-in in Outlook on the web.
7. **Distribute** (below).

### Test matrix

| Client | Check |
| --- | --- |
| Outlook on the web, Microsoft 365 | verdicts, info bar, pinning, settings persist, DNS lookup, dark mode |
| Outlook on the web, Outlook.com | verdicts, info bar (no pinning) |
| New Outlook for Windows | verdicts, pinning |
| Classic Outlook for Windows (M365) | verdicts, high-contrast theme |
| Outlook for Mac (new UI) | verdicts, pinning |
| Firefox and Safari (OWA) | renders, keyboard navigation |

Useful messages: internal colleague mail (green), mail from a `p=reject` domain
such as google.com (green, or blue on EXO until *Look up policy*), a gmail.com
address (blue, `p=none`), a mailing list (ARC), the junk folder (red).

## First-time setup (once)

1. GitHub repository → *Settings → Pages → Source: GitHub Actions*.
2. *Settings → Security → Private vulnerability reporting: enable* (SECURITY.md
   relies on it).
3. Protect `main`; require the CI workflow.

## Distribution channels

### 1. GitHub release (sideloading)

Automatic: each release has `manifest.xml` attached. Users sideload it via
<https://aka.ms/olksideload> → *My add-ins → Custom add-ins → Add from file*.

### 2. Organisation-wide: Microsoft 365 admin center

Admins: *Microsoft 365 admin center → Settings → Integrated apps → Upload custom
apps → App type: Office Add-in*, then either:

- **Manifest URL** `https://berndverhofstadt.github.io/dmarc-shield/manifest.xml`
  (recommended: Microsoft 365 usually picks up manifest updates without a re-upload), or
- **Upload** `manifest.xml` from the release (re-upload after manifest changes).

Assign it to users or groups, and choose *Fixed* (can't be removed) or
*Available*. Rollout can take up to 24 hours (sometimes 72). This also works
for Exchange Online mailboxes in new Outlook, Mac and web. Code updates (task
pane) need no admin action. Manifest changes that raise permissions require
admin re-consent.

### 3. Microsoft Marketplace (AppSource)

Follow `publishing/CHECKLIST.md`. In short:

1. Partner Center → *Marketplace offers* → *+ New offer* → *Office add-in*
   (first time). For updates: open the offer → *Packages* → upload the new
   `dist/manifest.xml`.
2. Listing text and assets from `publishing/LISTING.md`, logo
   `brand/store/logo-300.png`, screenshots `public/assets/screenshots/`.
3. Paste `publishing/TEST_NOTES.md` into *Notes for certification*.
4. *Review and publish*. Validation usually takes 3–5 business days. Fix any
   report items, bump the patch version, and resubmit.
5. After the first approval, record the asset ID here: `WA__________`.

**What needs resubmission?** Any change to `manifest.xml` (version, URLs,
permissions, strings, icons) needs a new package in Partner Center.
Changes to hosted code go live with the Pages deploy, but must stay within what
the approved listing describes.

## Hosting elsewhere (Azure Static Web Apps)

```sh
ADDIN_BASE_URL=https://<name>.azurestaticapps.net/ npm run build
```

Deploy `dist/` (it contains `staticwebapp.config.json`, which sends the CSP and
other security headers as real HTTP headers). This changes every manifest URL,
so for the Marketplace it counts as a manifest change.
