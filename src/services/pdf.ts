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
    await page.setContent(htmlContent, { waitUntil: 'networkidle0' })
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
