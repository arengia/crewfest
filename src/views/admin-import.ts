import { html } from 'hono/html'
import type { HtmlEscapedString } from 'hono/utils/html'
import { layout } from './layout.js'
import type { ImportResult } from '../services/import.js'
import { t, type Lang } from '../i18n.js'

// ─── importPage — upload form + result report ─────────────────────────────────

interface ImportPageOptions {
  error?: 'no_file' | 'parse_error' | 'zero_rows' | 'file_too_large' | 'missing_required'
  result?: ImportResult
  lang?: Lang
}

export function importPage(options?: ImportPageOptions): HtmlEscapedString {
  const error = options?.error
  const result = options?.result
  const lang: Lang = options?.lang ?? 'de'

  const content = html`
    <section class="bg-surface-container-lowest rounded-xl p-6 mb-6">
      <h2 class="font-headline text-2xl font-bold text-on-surface mb-2">${t(lang, 'adminImport.pageTitle')}</h2>
      <p class="text-on-surface-variant text-sm mb-4">
        ${t(lang, 'adminImport.intro')}
      </p>

      <details class="mb-6 border border-outline-variant rounded-xl overflow-hidden">
        <summary class="cursor-pointer px-4 py-3 bg-surface-container font-headline font-semibold text-on-surface select-none">
          ${t(lang, 'adminImport.howto.summary')}
        </summary>
        <div class="px-4 py-4 text-sm text-on-surface-variant space-y-4">
          <div>
            <p class="font-semibold text-on-surface mb-1">${t(lang, 'adminImport.howto.introLabel')}</p>
            <ol class="list-decimal pl-5 space-y-1">
              <li>${t(lang, 'adminImport.howto.step1')}</li>
              <li>${t(lang, 'adminImport.howto.step2')}</li>
              <li>${t(lang, 'adminImport.howto.step3')}</li>
              <li>${t(lang, 'adminImport.howto.step4')}</li>
            </ol>
          </div>
          <div class="bg-surface-container rounded-lg p-3">
            <p class="font-semibold text-on-surface mb-1">${t(lang, 'adminImport.howto.whatLabel')}</p>
            <ul class="list-disc pl-5 space-y-0.5">
              <li>${t(lang, 'adminImport.howto.item1')}</li>
              <li>${t(lang, 'adminImport.howto.item2')}</li>
              <li>${t(lang, 'adminImport.howto.item3')}</li>
              <li>${t(lang, 'adminImport.howto.item4')}</li>
              <li>${t(lang, 'adminImport.howto.item5')}</li>
              <li>${t(lang, 'adminImport.howto.item6')}</li>
            </ul>
            <p class="mt-2 text-xs">${t(lang, 'adminImport.howto.note')}</p>
          </div>
          <div>
            <a href="/public/beispiel-import.csv" download class="inline-flex items-center gap-2 px-4 py-2 rounded-full border border-outline text-on-surface hover:bg-surface-container text-sm font-medium">
              <svg xmlns="http://www.w3.org/2000/svg" class="w-4 h-4" viewBox="0 0 20 20" fill="currentColor">
                <path fill-rule="evenodd" d="M3 17a1 1 0 011-1h12a1 1 0 110 2H4a1 1 0 01-1-1zm3.293-7.707a1 1 0 011.414 0L9 10.586V3a1 1 0 112 0v7.586l1.293-1.293a1 1 0 111.414 1.414l-3 3a1 1 0 01-1.414 0l-3-3a1 1 0 010-1.414z" clip-rule="evenodd" />
              </svg>
              ${t(lang, 'adminImport.downloadSample')}
            </a>
            <p class="mt-1 text-xs">${t(lang, 'adminImport.downloadSampleHint')}</p>
          </div>
        </div>
      </details>

      <form method="POST" action="/admin/import" enctype="multipart/form-data">
        <label for="csv_file" class="block text-sm font-medium text-on-surface mb-2">${t(lang, 'adminImport.fileLabel')}</label>
        <input id="csv_file" name="csv_file" type="file" accept=".csv" required class="block w-full text-sm border border-outline-variant rounded-xl px-3 py-2 file:mr-3 file:py-1 file:px-3 file:rounded file:border-0 file:bg-primary-container file:text-on-primary-container">

        ${error === 'no_file' ? html`<p role="alert" class="text-error text-sm mt-2">${t(lang, 'adminImport.error.noFile')}</p>` : ''}
        ${error === 'parse_error' ? html`<p role="alert" class="text-error text-sm mt-2">${t(lang, 'adminImport.error.parseError')}</p>` : ''}
        ${error === 'zero_rows' ? html`<p role="alert" class="text-error text-sm mt-2">${t(lang, 'adminImport.error.zeroRows')}</p>` : ''}
        ${error === 'file_too_large' ? html`<p role="alert" class="text-error text-sm mt-2">${t(lang, 'adminImport.error.fileTooLarge')}</p>` : ''}
        ${error === 'missing_required' ? html`<p role="alert" class="text-error text-sm mt-2">${t(lang, 'adminImport.error.missingRequired')}</p>` : ''}

        <button type="submit" class="mt-4 bg-gradient-to-r from-primary to-primary-container text-on-primary font-headline px-6 py-2 rounded-full hover:opacity-90">${t(lang, 'adminImport.continueToPreview')}</button>
      </form>

      ${result != null ? renderImportReport(result, lang) : ''}
    </section>
  ` as HtmlEscapedString

  return layout(t(lang, 'adminImport.pageTitle'), content, { nav: true, lang, activePage: 'import' })
}

// ─── importPreviewPage — header mapping preview before confirm ────────────────

interface PreviewRow {
  csvHeader: string
  dbField: string | null
  status: 'mapped' | 'unknown'
}

interface ImportPreviewOptions {
  rows: PreviewRow[]
  missingRequired: string[]        // empty array = OK to confirm
  csvRowCount: number
  lang?: Lang
}

export function importPreviewPage(options: ImportPreviewOptions): HtmlEscapedString {
  const { rows, missingRequired, csvRowCount } = options
  const lang: Lang = options.lang ?? 'de'
  const canConfirm = missingRequired.length === 0

  const mappedCount = rows.filter(r => r.status === 'mapped').length
  const unknownCount = rows.filter(r => r.status === 'unknown').length

  const content = html`
    <section class="bg-surface-container-lowest rounded-xl p-6 mb-6">
      <h2 class="font-headline text-2xl font-bold text-on-surface mb-2">${t(lang, 'adminImport.preview.pageTitle')}</h2>

      <p role="status" class="text-sm text-on-surface-variant mb-4">
        <strong>${csvRowCount}</strong> ${t(lang, 'adminImport.preview.rowsDetectedSuffix')}
        <strong>${mappedCount}</strong> ${t(lang, 'adminImport.preview.columnsMappedSuffix')}
        <strong>${unknownCount}</strong> ${t(lang, 'adminImport.preview.unknownColumnsSuffix')}
      </p>

      ${missingRequired.length > 0 ? html`
        <div role="alert" class="bg-error-container text-on-error-container rounded-xl p-4 mb-4">
          <strong class="font-bold">${t(lang, 'adminImport.preview.missingRequiredLabel')}</strong> ${missingRequired.join(', ')}<br>
          ${t(lang, 'adminImport.preview.missingRequiredHint')}
        </div>
      ` : ''}

      <div class="overflow-x-auto">
        <table class="w-full text-sm border-collapse">
          <thead>
            <tr class="bg-surface-container text-on-surface-variant text-left">
              <th class="px-3 py-2 font-headline font-semibold">${t(lang, 'adminImport.preview.colCsvHeader')}</th>
              <th class="px-3 py-2 font-headline font-semibold">${t(lang, 'common.status')}</th>
              <th class="px-3 py-2 font-headline font-semibold">${t(lang, 'adminImport.preview.colDbField')}</th>
            </tr>
          </thead>
          <tbody>
            ${rows.map(row => {
              const rowClass = row.status === 'mapped'
                ? 'bg-primary-fixed-dim/30'
                : 'bg-tertiary-fixed-dim/30'
              const statusText = row.status === 'mapped' ? t(lang, 'adminImport.preview.statusMapped') : t(lang, 'adminImport.preview.statusUnknown')
              return html`
                <tr class="${rowClass}">
                  <td class="px-3 py-2 border-b border-outline-variant"><code>${row.csvHeader}</code></td>
                  <td class="px-3 py-2 border-b border-outline-variant">${statusText}</td>
                  <td class="px-3 py-2 border-b border-outline-variant">${row.dbField ? html`<code>${row.dbField}</code>` : '—'}</td>
                </tr>
              `
            })}
          </tbody>
        </table>
      </div>

      ${canConfirm ? html`
        <form method="POST" action="/admin/import/confirm" enctype="multipart/form-data" class="mt-8">
          <p class="text-sm text-on-surface-variant mb-3">
            ${t(lang, 'adminImport.preview.confirmHintBefore')} <strong>${t(lang, 'adminImport.preview.confirmButton')}</strong>.
          </p>
          <label for="csv_file" class="block text-sm font-medium text-on-surface mb-2">${t(lang, 'adminImport.preview.reuploadLabel')}</label>
          <input id="csv_file" name="csv_file" type="file" accept=".csv" required class="block w-full text-sm border border-outline-variant rounded-xl px-3 py-2 file:mr-3 file:py-1 file:px-3 file:rounded file:border-0 file:bg-primary-container file:text-on-primary-container">
          <div class="mt-4 flex items-center">
            <button type="submit" class="bg-gradient-to-r from-primary to-primary-container text-on-primary font-headline px-6 py-2 rounded-full hover:opacity-90">${t(lang, 'adminImport.preview.confirmButton')}</button>
            <a href="/admin/import" class="ml-3 text-on-surface-variant hover:text-on-surface text-sm">${t(lang, 'common.cancel')}</a>
          </div>
        </form>
      ` : html`
        <p class="mt-8">
          <a href="/admin/import" class="inline-block px-4 py-2 rounded-full border border-outline text-on-surface hover:bg-surface-container">${t(lang, 'adminImport.preview.backToUpload')}</a>
        </p>
      `}
    </section>
  ` as HtmlEscapedString

  return layout(t(lang, 'adminImport.preview.pageTitle'), content, { nav: true, lang, activePage: 'import' })
}

// ─── Internal: 4-counter import report ────────────────────────────────────────

function renderImportReport(result: ImportResult, lang: Lang): HtmlEscapedString {
  return html`
    <section class="mt-8">
      <h3 class="font-headline text-xl font-bold mb-3">${t(lang, 'adminImport.report.title')}</h3>

      <div class="grid grid-cols-2 md:grid-cols-4 gap-3 mb-6">
        <article class="bg-surface-container-low rounded-xl p-4 text-center bg-primary-fixed-dim">
          <div class="text-3xl font-bold font-headline">${result.inserted}</div>
          <div>${t(lang, 'adminImport.report.inserted')}</div>
        </article>
        <article class="bg-surface-container-low rounded-xl p-4 text-center bg-tertiary-fixed-dim">
          <div class="text-3xl font-bold font-headline">${result.updated}</div>
          <div>${t(lang, 'adminImport.report.updated')}</div>
        </article>
        <article class="bg-surface-container-low rounded-xl p-4 text-center">
          <div class="text-3xl font-bold font-headline">${result.skipped}</div>
          <div>${t(lang, 'adminImport.report.skipped')}</div>
        </article>
        <article class="${result.errors > 0 ? 'bg-error text-on-error' : 'bg-surface-container-low'} rounded-xl p-4 text-center">
          <div class="text-3xl font-bold font-headline">${result.errors}</div>
          <div>${t(lang, 'adminImport.report.errors')}</div>
        </article>
      </div>

      ${result.unknownExperiences.length > 0 ? html`
        <details class="mb-4">
          <summary class="cursor-pointer font-semibold">${t(lang, 'adminImport.report.unknownExperiences', { count: result.unknownExperiences.length })}</summary>
          <p class="mt-2 text-sm text-on-surface-variant">${t(lang, 'adminImport.report.unknownExperiencesHint')}</p>
          <ul class="list-disc pl-6 mt-2 text-sm">
            ${result.unknownExperiences.map(text => html`<li><code>${text}</code></li>`)}
          </ul>
        </details>
      ` : ''}

      ${result.rowErrors.length > 0 ? html`
        <details open class="mb-4">
          <summary class="cursor-pointer font-semibold text-error">${t(lang, 'adminImport.report.rowErrors', { count: result.rowErrors.length })}</summary>
          <ul class="list-disc pl-6 mt-2 text-sm">
            ${result.rowErrors.map(e => html`<li><strong>${t(lang, 'adminImport.report.rowLabel', { row: e.row })}</strong> ${e.message}</li>`)}
          </ul>
        </details>
      ` : ''}
    </section>
  ` as HtmlEscapedString
}
