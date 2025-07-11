import playwright from 'playwright';

let browser: playwright.Browser;
let page: playwright.Page;

export async function getPage() {
  if (!browser) {
    console.log('[Playwright] No browser instance found. Launching new browser.');
    browser = await playwright.chromium.launch({ headless: true });
    console.log('[Playwright] Browser launched.');
  }
  if (!page || page.isClosed()) {
    console.log('[Playwright] No page instance found or page is closed. Creating new page.');
    page = await browser.newPage();
    console.log('[Playwright] New page created.');
  } else {
    console.log('[Playwright] Returning existing page instance.');
  }
  return page;
}