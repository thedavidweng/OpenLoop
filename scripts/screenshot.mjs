import { chromium } from 'playwright';

const browser = await chromium.launch({ headless: true });
const context = await browser.newContext({
  viewport: { width: 1440, height: 920 },
  deviceScaleFactor: 2,
});
const page = await context.newPage();

await page.goto('http://localhost:1420', { waitUntil: 'networkidle', timeout: 15000 });
await page.waitForTimeout(2000);

await page.screenshot({ path: 'docs/screenshots/01-initial.png', fullPage: false });
console.log('Screenshot 1: initial page');

const title = await page.title();
console.log('Page title:', title);

const bodyText = await page.textContent('body');
console.log('Body text (first 800 chars):', bodyText?.substring(0, 800));

const buttons = await page.$$('button');
console.log('Button count:', buttons.length);
for (const btn of buttons.slice(0, 15)) {
  const text = await btn.textContent();
  const visible = await btn.isVisible();
  if (visible && text?.trim()) console.log('  Button:', text.trim());
}

const inputs = await page.$$('input, textarea');
console.log('Input count:', inputs.length);
for (const inp of inputs.slice(0, 10)) {
  const placeholder = await inp.getAttribute('placeholder');
  const visible = await inp.isVisible();
  if (visible) console.log('  Input placeholder:', placeholder);
}

await browser.close();
