import puppeteer, { type Browser } from 'puppeteer'

let browser: Browser | null = null

async function getBrowser(): Promise<Browser> {
  if (!browser || !browser.connected) {
    browser = await puppeteer.launch({
      headless: true,
      ...(process.env.CHROMIUM_PATH ? { executablePath: process.env.CHROMIUM_PATH } : {}),
      args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage'],
    })
  }
  return browser
}

export async function generatePdf(
  htmlContent: string,
  options?: { landscape?: boolean }
): Promise<Buffer> {
  const b = await getBrowser()
  const page = await b.newPage()
  try {
    // 'load' rather than the old 'networkidle0': Puppeteer dropped the
    // networkidle values from setContent's waitUntil union. Nothing is lost
    // here, because every PDF template in src/views/pdf-*.ts renders from a
    // self-contained HTML string with inline styles and no external images,
    // stylesheets or fonts. There is no network activity to idle on.
    await page.setContent(htmlContent, { waitUntil: 'load' })
    const pdf = await page.pdf({
      format: 'A4',
      landscape: options?.landscape ?? false,
      printBackground: true,
      margin: { top: '15mm', bottom: '15mm', left: '10mm', right: '10mm' },
    })
    return Buffer.from(pdf)
  } finally {
    await page.close()
  }
}
