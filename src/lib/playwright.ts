import playwright from 'playwright';

let browser: playwright.Browser;
let page: playwright.Page;

export async function getPage() {
  if (!browser) {
    browser = await playwright.chromium.launch({ headless: true });
  }
  if (!page || page.isClosed()) {
    page = await browser.newPage();
  }
  return page;
}