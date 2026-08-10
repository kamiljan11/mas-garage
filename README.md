# Mountain Car Garage — Reykjanesbær, Iceland

**Live:** [garage.masgroup.is](https://garage.masgroup.is) · **Status:** production · **Built & operated by** [Kamil Jan](https://kamiljan.com)

Landing page and installable web app for Mountain Car Garage — *fast, honest car help in
Reykjanesbær*. Trilingual (English / Polish / Icelandic), because the customers are split
between locals, the Polish community and visitors returning a rental car before a flight.

## What it is

One hand-written `index.html`, no framework and no build step, plus a service worker and a web
app manifest so it can be installed to a phone's home screen. For a page whose job is to load
instantly on airport wifi and produce a phone call, a bundler would be cost with no benefit.

- **Trilingual content switching** — every translatable node carries an `-en` / `-pl` / `-is`
  id and is toggled in place; `document.lang`, the ARIA radiogroup state and the install
  button's `aria-label` all follow the selection
- **Installable PWA** — manifest with a stable `id`, maskable icons, and an install button
  that appears only when the browser actually offers a prompt
- **Offline shell** via service worker: network-first for navigation, stale-while-revalidate
  for static assets, so an asset replaced in place still reaches returning visitors
- **Partner club** section with a sign-up form that submits over WhatsApp
- **Services, pricing, FAQ and directions**

## Running locally

```bash
npm install
npm start          # serves the folder on http://127.0.0.1:4173
```

A real `http://` origin is required — service workers and the manifest do not work from
`file://`.

```bash
npm run lint       # html-validate
npm run test:e2e   # Playwright
```

## Tests

`e2e/smoke.spec.ts` covers the parts that can actually break: language switching (including
that content in the other two languages is hidden rather than duplicated), the install
button's translated `aria-label`, the regression where the button stayed visible-but-dead
after a dismissed prompt, service worker registration, and manifest correctness.

The suite is checked by mutation: reintroducing the old install-button bug or removing `id`
from the manifest makes it fail. A test that cannot fail is decoration.

> Historical note: until the CI jobs got a `package.json` and a `playwright.config.ts`, every
> step in the quality gate was skipped by its `if: hashFiles(...)` guard, so the workflow
> reported success without running anything. Green CI is only evidence if something ran.

## How security is handled

There is no backend and no database here, so the surface is small — but the same gates apply
as everywhere else in this account: each push runs lint, the E2E suite, Semgrep static
analysis and a Gitleaks secret scan, and a pre-commit hook blocks credential-shaped strings.
No secrets and no customer data live in the repo.

## Related

- [mountaincar-is](https://github.com/kamiljan11/mountaincar-is) — the rental side of the business
- [mountaincar-landing](https://github.com/kamiljan11/mountaincar-landing) — shared entry page

## Licence

Proprietary. Published for reference, not for reuse.
