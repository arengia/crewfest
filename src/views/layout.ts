import { html, raw } from 'hono/html'
import type { HtmlEscapedString } from 'hono/utils/html'
import { getBranding } from '../domain/branding.js'
import { t, langSwitcherHtml, type Lang } from '../i18n.js'

export function layout(
  title: string,
  content: HtmlEscapedString,
  options?: { nav?: boolean; lang?: Lang; activePage?: 'crew' | 'shifts' | 'import'; fullWidth?: boolean }
): HtmlEscapedString {
  const activePage = options?.activePage
  const lang: Lang = options?.lang ?? 'de'
  const branding = getBranding()

  const activeClasses = 'bg-white dark:bg-slate-800 text-cyan-700 dark:text-cyan-400 font-bold rounded-l-xl ml-4 pl-4 py-3 flex items-center gap-3'
  const inactiveClasses = 'text-slate-500 dark:text-slate-400 hover:text-cyan-600 dark:hover:text-cyan-300 ml-4 pl-4 py-3 flex items-center gap-3 hover:bg-slate-200/50 transition-colors rounded-l-xl'

  const navLink = (page: 'crew' | 'shifts' | 'import', icon: string, label: string, href: string) => {
    const isActive = activePage === page
    // A plain interpolated string here gets HTML-escaped by html`` like any other
    // value (it's not treated as markup just because it looks like an attribute),
    // so 'aria-current="page"' rendered as literal, broken text next to the tag
    // instead of becoming a real attribute. raw() opts it in deliberately, only
    // for this fixed, non-user-controlled string.
    return html`<a href="${href}" class="${isActive ? activeClasses : inactiveClasses}" ${isActive ? raw('aria-current="page"') : ''}>
      <span class="material-symbols-outlined text-[20px]">${icon}</span>
      <span class="font-headline text-sm tracking-tight">${label}</span>
    </a>`
  }

  return html`<!DOCTYPE html>
<html lang="${lang}">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>${title} — ${branding.event_name}</title>
  <link rel="stylesheet" href="/public/assets/tailwind.css">
</head>
<body class="bg-surface text-on-surface font-body min-h-screen flex">
  ${options?.nav ? html`
  <nav class="w-64 h-screen fixed left-0 top-0 bg-slate-100 flex flex-col py-6 z-50">
    <div class="px-6 mb-8 flex items-center gap-3">
      <div class="w-10 h-10 rounded-full bg-primary flex items-center justify-center">
        <span class="material-symbols-outlined text-on-primary text-[20px]">local_bar</span>
      </div>
      <div>
        <h1 class="text-xl font-black text-cyan-900 font-headline tracking-tight">Crewfest</h1>
        <p class="text-xs text-slate-500 font-medium">${branding.event_name}${branding.org_name ? html` &middot; ${branding.org_name}` : ''}</p>
      </div>
    </div>
    <div class="flex-1 flex flex-col gap-2">
      ${navLink('crew', 'group', t(lang, 'nav.crew'), '/admin')}
      ${navLink('shifts', 'calendar_today', t(lang, 'nav.shifts'), '/admin/shifts')}
      ${navLink('import', 'upload_file', t(lang, 'nav.import'), '/admin/import')}
    </div>
    <div class="mt-auto flex flex-col gap-3">
      <div class="ml-4 pl-4 text-xs">${langSwitcherHtml(lang)}</div>
      <a href="/admin/logout" class="${inactiveClasses}">
        <span class="material-symbols-outlined text-[20px]">logout</span>
        <span class="font-headline text-sm tracking-tight">${t(lang, 'nav.logout')}</span>
      </a>
    </div>
  </nav>
  <main class="ml-64 flex-1 min-h-screen p-8">${content}</main>
  ` : options?.fullWidth ? html`
  <main class="w-full flex-1 min-h-screen">${content}</main>
  ` : html`
  <main class="w-full max-w-2xl mx-auto my-auto px-4">${content}</main>
  `}
</body>
</html>` as HtmlEscapedString
}
