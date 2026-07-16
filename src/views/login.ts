import { html } from 'hono/html'
import type { HtmlEscapedString } from 'hono/utils/html'
import { getBranding } from '../domain/branding.js'
import { t, langSwitcherHtml, type Lang } from '../i18n.js'

export function loginPage(lang: Lang = 'de', options?: { error?: string; flash?: string }): HtmlEscapedString {
  const branding = getBranding()
  return html`<!DOCTYPE html>
<html lang="${lang}">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>${branding.event_name} — ${t(lang, 'login.pageTitle')}</title>
  <link rel="stylesheet" href="/public/assets/tailwind.css">
</head>
<body class="bg-surface text-on-surface font-body h-screen w-full flex flex-col justify-center items-center px-4 sm:px-6">
  <main class="w-full max-w-md">
    <div class="text-center mb-8">
      <h1 class="font-headline font-black text-4xl text-primary tracking-tighter mb-1">${branding.event_name}</h1>
      ${branding.org_name ? html`<p class="font-body text-sm font-medium text-on-surface-variant uppercase tracking-wider">${branding.org_name}</p>` : ''}
    </div>

    <div class="bg-surface-container-lowest rounded-xl p-8 mb-6 shadow-[0_12px_32px_rgba(26,28,30,0.08)]">
      <h2 class="font-headline font-bold text-xl text-on-surface mb-1">${t(lang, 'login.heading')}</h2>
      <p class="font-body text-sm text-on-surface-variant mb-6">${t(lang, 'login.subheading')}</p>

      <form method="POST" action="/admin/login" class="space-y-6">
        <div>
          <label class="block font-body text-sm font-medium text-on-surface mb-2" for="username">${t(lang, 'common.username')}</label>
          <input class="block w-full bg-surface-variant text-on-surface border-0 rounded-t-DEFAULT px-4 py-3 focus:ring-0 focus:bg-surface-container-highest transition-colors border-b-2 border-transparent focus:border-primary placeholder-outline" id="username" name="username" type="text" required autocomplete="username" autofocus placeholder="${t(lang, 'login.usernamePlaceholder')}"/>
        </div>
        <div>
          <label class="block font-body text-sm font-medium text-on-surface mb-2" for="password">${t(lang, 'common.password')}</label>
          <input class="block w-full bg-surface-variant text-on-surface border-0 rounded-t-DEFAULT px-4 py-3 focus:ring-0 focus:bg-surface-container-highest transition-colors border-b-2 border-transparent focus:border-primary placeholder-outline" id="password" name="password" type="password" required autocomplete="current-password" placeholder="${t(lang, 'login.passwordPlaceholder')}"/>
        </div>

        ${options?.error ? html`<p class="text-sm text-error mt-2">${options.error}</p>` : ''}
        ${options?.flash ? html`<p class="text-sm text-secondary mt-2">${options.flash}</p>` : ''}

        <button type="submit" class="w-full bg-gradient-to-r from-primary to-primary-container text-on-primary font-body font-medium text-base py-3.5 px-4 rounded-xl hover:opacity-90 transition-all">${t(lang, 'login.submit')}</button>
      </form>
    </div>

    <div class="text-center">
      <a href="/" class="font-body text-sm font-medium text-on-surface-variant hover:text-primary transition-colors flex items-center justify-center gap-1 group">
        ${t(lang, 'login.backToApply')} <span class="material-symbols-outlined text-[18px] group-hover:translate-x-1 transition-transform">arrow_forward</span>
      </a>
    </div>

    <div class="text-center text-xs mt-4">${langSwitcherHtml(lang)}</div>
  </main>
</body>
</html>` as HtmlEscapedString
}
