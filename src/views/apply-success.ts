import { html } from 'hono/html'
import type { HtmlEscapedString } from 'hono/utils/html'
import { layout } from './layout.js'
import { t, langSwitcherHtml, type Lang } from '../i18n.js'

/**
 * Phase 7 FORM-02 / D-18 — Success page shown after POST /apply redirects here.
 *
 * @param lang - Aufgelöste Sprache (i18n-Phase, siehe src/i18n.ts resolveLang()).
 * @param firstName - The bewerber's first name, for personalized greeting. URL-decoded
 *                    by the route handler before being passed in.
 * @param uploadWarning - true when the form submission succeeded (crew row inserted)
 *                        but the attached image could not be saved (wrong type, too
 *                        big, magic-byte mismatch, or disk error). The route handler
 *                        derives this from `?upload_warning=1` query parameter.
 *                        Defaults to false.
 *
 * D-18 guarantee: we NEVER tell the user their application was lost — only that the
 * image failed. The crew row is always persisted before this page renders.
 */
export function applySuccessPage(lang: Lang, firstName: string, uploadWarning: boolean = false): HtmlEscapedString {
  const content = html`
    <article>
      <hgroup>
        <h1>${t(lang, 'apply.success.title', { name: firstName })}</h1>
        <p>${t(lang, 'apply.success.body')}</p>
      </hgroup>
      ${uploadWarning ? html`
        <div class="upload-warning" role="alert">
          ${t(lang, 'apply.success.uploadWarning')}
        </div>
      ` : ''}
      <footer class="mt-6 text-xs">${langSwitcherHtml(lang)}</footer>
    </article>
  ` as HtmlEscapedString

  return layout(t(lang, 'apply.success.pageTitle'), content, { lang })
}
