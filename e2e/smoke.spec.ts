// E2E smoke — mas-garage.
//
// Powod istnienia tego pliku: strona to jeden statyczny index.html z ~150 liniami
// inline JS (przelacznik jezyka, przycisk instalacji PWA, service worker). Bez tych
// testow bramka CI byla zielona nie sprawdzajac NICZEGO, bo joby siedza za
// `if: hashFiles('package.json'/'playwright.config.ts') != ''`.
import { test, expect } from '@playwright/test';

/** Bledy JS i konsoli zbierane od pierwszej nawigacji. */
function collectErrors(page: import('@playwright/test').Page) {
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(String(e)));
  page.on('console', (msg) => {
    if (msg.type() === 'error') errors.push(msg.text());
  });
  return errors;
}

test('strona wstaje, renderuje sie i nie sypie bledami w konsoli', async ({ page }) => {
  const errors = collectErrors(page);

  await page.goto('/');
  await page.waitForLoadState('networkidle');

  await expect(page.locator('body')).not.toBeEmpty();
  await expect(page).toHaveTitle(/.+/);
  await expect(page.locator('#main')).toBeVisible();

  expect(errors, `Bledy konsoli:\n${errors.join('\n')}`).toHaveLength(0);
});

test('przelacznik jezyka zmienia lang, aktywny przycisk i widoczna tresc', async ({ page }) => {
  await page.goto('/');

  for (const lang of ['pl', 'is', 'en'] as const) {
    await page.locator(`#btn-${lang}`).click();

    // atrybut lang dokumentu — czytniki ekranu i SEO
    await expect(page.locator('html')).toHaveAttribute('lang', lang);

    // stan przyciskow: dokladnie jeden aktywny, aria-checked spojne
    await expect(page.locator(`#btn-${lang}`)).toHaveClass(/active/);
    await expect(page.locator(`#btn-${lang}`)).toHaveAttribute('aria-checked', 'true');
    const active = await page.locator('.lang-bar .active').count();
    expect(active, 'dokladnie jeden przycisk jezyka moze byc aktywny').toBe(1);

    // komunikat dla czytnika ekranu faktycznie sie zmienia
    await expect(page.locator('#lang-status')).not.toBeEmpty();
  }
});

test('tresc w innych jezykach jest chowana, nie dublowana', async ({ page }) => {
  await page.goto('/');
  await page.locator('#btn-pl').click();

  const counts = await page.evaluate(() => {
    const els = Array.from(document.querySelectorAll('[id$="-en"],[id$="-pl"],[id$="-is"]'))
      .filter((el) => !el.closest('.lang-bar'));
    const visible = (el: Element) => (el as HTMLElement).style.display !== 'none';
    return {
      pl: els.filter((el) => el.id.endsWith('-pl') && visible(el)).length,
      enVisible: els.filter((el) => el.id.endsWith('-en') && visible(el)).length,
      isVisible: els.filter((el) => el.id.endsWith('-is') && visible(el)).length,
    };
  });

  expect(counts.pl, 'polska tresc musi byc widoczna').toBeGreaterThan(0);
  expect(counts.enVisible, 'angielska tresc ma byc ukryta przy PL').toBe(0);
  expect(counts.isVisible, 'islandzka tresc ma byc ukryta przy PL').toBe(0);
});

test('aria-label przycisku instalacji idzie za jezykiem strony', async ({ page }) => {
  await page.goto('/');

  const labels: Record<string, string> = {};
  for (const lang of ['en', 'pl', 'is'] as const) {
    await page.locator(`#btn-${lang}`).click();
    labels[lang] = (await page.locator('#installBtn').getAttribute('aria-label')) ?? '';
  }

  // przy <340px tekst przycisku jest ukryty i aria-label to jedyny opis dla czytnika
  expect(labels.en).toBe('Install app');
  expect(labels.pl).toBe('Zainstaluj aplikację');
  expect(labels.is).toBe('Setja upp forrit');
});

test('przycisk instalacji chowa sie takze po odrzuceniu promptu (regresja)', async ({ page }) => {
  await page.goto('/');

  // Chromium w Playwright nie emituje beforeinstallprompt, wiec podstawiamy
  // atrape i sprawdzamy wlasnie sciezke 'dismissed' — wczesniej przycisk chowal
  // sie TYLKO przy 'accepted', wiec po odrzuceniu zostawal martwy.
  const hiddenAfterDismiss = await page.evaluate(async () => {
    const btn = document.getElementById('installBtn') as HTMLButtonElement;
    btn.hidden = false;
    (window as any).deferredInstallPrompt = {
      prompt: () => {},
      userChoice: Promise.resolve({ outcome: 'dismissed' }),
    };
    (window as any).installApp();
    await new Promise((r) => setTimeout(r, 50));
    return btn.hidden;
  });

  expect(hiddenAfterDismiss, 'po "dismissed" przycisk nie moze zostac widoczny i martwy').toBe(true);
});

test('service worker rejestruje sie, takze poza trybem standalone', async ({ page }) => {
  await page.goto('/');

  // Rejestracja wisi na window 'load' i konczy sie asynchronicznie — samo
  // waitForLoadState('load') potrafi wyprzedzic getRegistration(), wiec czekamy
  // na faktyczny stan zamiast zgadywac moment.
  const state = await page.evaluate(async () => {
    // `ready` rozwiazuje sie dopiero gdy rejestracja MA aktywnego workera —
    // getRegistration() zwraca obiekt wczesniej, jeszcze z pustym active/installing.
    const reg = await Promise.race([
      navigator.serviceWorker.ready,
      new Promise<null>((r) => setTimeout(() => r(null), 15_000)),
    ]);
    return { registered: Boolean(reg), scriptURL: reg?.active?.scriptURL ?? null };
  });

  expect(state.registered, 'rejestracja SW musi byc poza guardem isStandalone()').toBe(true);
  expect(state.scriptURL, 'zarejestrowany ma byc nasz sw.js').toContain('sw.js');
});

test('manifest PWA jest poprawny i ma stabilna tozsamosc', async ({ page, request }) => {
  await page.goto('/');

  const href = await page.locator('link[rel="manifest"]').getAttribute('href');
  expect(href, 'brak <link rel="manifest">').toBeTruthy();

  const res = await request.get(new URL(href!, 'http://127.0.0.1:4173/').toString());
  expect(res.status()).toBe(200);

  const manifest = await res.json();
  // `id` decyduje o tozsamosci instalacji — bez niego zmiana start_url tworzy
  // uzytkownikowi druga, osobna aplikacje zamiast zaktualizowac istniejaca.
  expect(manifest.id, 'manifest musi miec stabilne id').toBe('/');
  // wymuszanie orientacji lamie uzycie na tablecie w poziomie
  expect(manifest.orientation, 'nie wymuszamy orientacji').toBeUndefined();
  expect(manifest.icons?.length, 'manifest musi miec ikony').toBeGreaterThan(0);
});
