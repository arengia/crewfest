import { html } from 'hono/html'
import type { HtmlEscapedString } from 'hono/utils/html'
import { EXPERIENCE_OPTIONS, experienceLabel } from '../domain/experience.js'
import { getBranding } from '../domain/branding.js'
import { t, langSwitcherHtml, type Lang } from '../i18n.js'

export function applyFormPage(lang: Lang = 'de', options?: { error?: string }): HtmlEscapedString {
  const branding = getBranding()
  const year = new Date().getFullYear()
  const experienceOptions = EXPERIENCE_OPTIONS.map(
    (o) => html`<option value="${o.key}">${experienceLabel(lang, o.key)}</option>`,
  )
  return html`<!DOCTYPE html>
<html lang="${lang}">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>${t(lang, 'apply.pageTitle')} — ${branding.event_name}</title>
  <link rel="stylesheet" href="/public/assets/tailwind.css">
</head>
<body class="bg-surface text-on-surface font-body antialiased min-h-screen flex flex-col">

  <!-- Header -->
  <header class="sticky top-0 bg-slate-50 text-cyan-900 py-4 px-6 flex justify-center items-center gap-2 z-50">
    <span class="material-symbols-outlined fill">clinical_notes</span>
    <span class="font-headline font-black text-cyan-950">${branding.event_name}${branding.org_name ? html` · ${branding.org_name}` : ''}</span>
  </header>

  <!-- Main -->
  <main class="flex-grow flex justify-center py-8 px-4 sm:px-6">
    <div class="w-full max-w-[600px] space-y-8">

      <div class="text-center mb-10">
        <h1 class="font-display font-extrabold text-3xl text-primary tracking-tight mb-2">${t(lang, 'apply.title')}</h1>
        <p class="font-body text-on-surface-variant">${t(lang, 'apply.subtitle', { event: branding.event_name })}</p>
      </div>

      <form method="POST" action="/apply" enctype="multipart/form-data" class="space-y-8">

        <!-- Section 1: Kontakt -->
        <section class="bg-surface-container-low p-6 sm:p-8 rounded-xl space-y-6 shadow-sm">
          <h2 class="font-headline font-bold text-xl text-on-surface flex items-center gap-2">
            <span class="material-symbols-outlined text-primary">person</span>
            ${t(lang, 'apply.section.contact')}
          </h2>

          <div class="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label class="block text-sm font-label text-on-surface-variant mb-1" for="first_name">${t(lang, 'apply.field.firstName')} <span class="text-error font-semibold">*</span></label>
              <input id="first_name" name="first_name" type="text" required autocomplete="given-name"
                class="w-full bg-surface-variant text-on-surface border-0 border-b-2 border-transparent focus:border-primary focus:ring-0 rounded-t-DEFAULT px-4 py-2.5 font-body text-sm transition-colors focus:bg-surface-container-highest">
            </div>
            <div>
              <label class="block text-sm font-label text-on-surface-variant mb-1" for="last_name">${t(lang, 'apply.field.lastName')} <span class="text-error font-semibold">*</span></label>
              <input id="last_name" name="last_name" type="text" required autocomplete="family-name"
                class="w-full bg-surface-variant text-on-surface border-0 border-b-2 border-transparent focus:border-primary focus:ring-0 rounded-t-DEFAULT px-4 py-2.5 font-body text-sm transition-colors focus:bg-surface-container-highest">
            </div>
          </div>

          <div>
            <label class="block text-sm font-label text-on-surface-variant mb-1" for="email">${t(lang, 'apply.field.email')} <span class="text-error font-semibold">*</span></label>
            <input id="email" name="email" type="email" required autocomplete="email"
              class="w-full bg-surface-variant text-on-surface border-0 border-b-2 border-transparent focus:border-primary focus:ring-0 rounded-t-DEFAULT px-4 py-2.5 font-body text-sm transition-colors focus:bg-surface-container-highest">
          </div>

          <div>
            <label class="block text-sm font-label text-on-surface-variant mb-1" for="phone">${t(lang, 'apply.field.phone')}</label>
            <input id="phone" name="phone" type="tel" autocomplete="tel"
              class="w-full bg-surface-variant text-on-surface border-0 border-b-2 border-transparent focus:border-primary focus:ring-0 rounded-t-DEFAULT px-4 py-2.5 font-body text-sm transition-colors focus:bg-surface-container-highest">
          </div>

          <div>
            <label class="block text-sm font-label text-on-surface-variant mb-1" for="nickname">${t(lang, 'apply.field.nickname')}</label>
            <input id="nickname" name="nickname" type="text"
              class="w-full bg-surface-variant text-on-surface border-0 border-b-2 border-transparent focus:border-primary focus:ring-0 rounded-t-DEFAULT px-4 py-2.5 font-body text-sm transition-colors focus:bg-surface-container-highest">
          </div>
        </section>

        <!-- Section 2: Erfahrung -->
        <section class="bg-surface-container-low p-6 sm:p-8 rounded-xl space-y-6 shadow-sm">
          <h2 class="font-headline font-bold text-xl text-on-surface flex items-center gap-2">
            <span class="material-symbols-outlined text-primary">work_history</span>
            ${t(lang, 'apply.section.experience')}
          </h2>

          <div>
            <label class="block text-sm font-label text-on-surface-variant mb-1" for="experience_text">${t(lang, 'apply.field.experience')} <span class="text-error font-semibold">*</span></label>
            <select id="experience_text" name="experience_text" required
              class="w-full appearance-none cursor-pointer bg-surface-variant text-on-surface border-0 border-b-2 border-transparent focus:border-primary focus:ring-0 rounded-t-DEFAULT px-4 py-2.5 font-body text-sm transition-colors focus:bg-surface-container-highest">
              <option value="" disabled selected>${t(lang, 'apply.field.pleaseSelect')}</option>
              ${experienceOptions}
            </select>
          </div>

          <div>
            <label class="block text-sm font-label text-on-surface-variant mb-1" for="experience_details">${t(lang, 'apply.field.experienceDetails')} <small class="text-on-surface-variant">${t(lang, 'common.optional')}</small></label>
            <textarea id="experience_details" name="experience_details" rows="3"
              class="w-full resize-y bg-surface-variant text-on-surface border-0 border-b-2 border-transparent focus:border-primary focus:ring-0 rounded-t-DEFAULT px-4 py-2.5 font-body text-sm transition-colors focus:bg-surface-container-highest"></textarea>
          </div>

          <fieldset class="space-y-2">
            <legend class="block text-sm font-label text-on-surface-variant mb-2">${t(lang, 'apply.field.previousWork')} <span class="text-error font-semibold">*</span></legend>
            <label class="flex items-center gap-2 cursor-pointer">
              <input type="radio" name="previous_work_yn" value="yes" required class="mr-2 w-4 h-4 text-primary focus:ring-primary border-outline">
              <span class="text-sm font-body text-on-surface">${t(lang, 'common.yes')}</span>
            </label>
            <label class="flex items-center gap-2 cursor-pointer">
              <input type="radio" name="previous_work_yn" value="no" class="mr-2 w-4 h-4 text-primary focus:ring-primary border-outline">
              <span class="text-sm font-body text-on-surface">${t(lang, 'common.no')}</span>
            </label>
            <label class="block text-sm font-label text-on-surface-variant mb-1 mt-2" for="previous_work_where">${t(lang, 'apply.field.previousWorkWhere')} <small class="text-on-surface-variant">${t(lang, 'common.optional')}</small></label>
            <input id="previous_work_where" name="previous_work_where" type="text"
              class="w-full bg-surface-variant text-on-surface border-0 border-b-2 border-transparent focus:border-primary focus:ring-0 rounded-t-DEFAULT px-4 py-2.5 font-body text-sm transition-colors focus:bg-surface-container-highest">
          </fieldset>

          <fieldset class="space-y-2">
            <legend class="block text-sm font-label text-on-surface-variant mb-2">${t(lang, 'apply.field.contactPerson')} <span class="text-error font-semibold">*</span></legend>
            <label class="flex items-center gap-2 cursor-pointer">
              <input type="radio" name="contact_person" value="Ja // Yes" required class="mr-2 w-4 h-4 text-primary focus:ring-primary border-outline">
              <span class="text-sm font-body text-on-surface">${t(lang, 'common.yes')}</span>
            </label>
            <label class="flex items-center gap-2 cursor-pointer">
              <input type="radio" name="contact_person" value="Nein // No" class="mr-2 w-4 h-4 text-primary focus:ring-primary border-outline">
              <span class="text-sm font-body text-on-surface">${t(lang, 'common.no')}</span>
            </label>
          </fieldset>
        </section>

        <!-- Section 3: Wunscharbeit -->
        <section class="bg-surface-container-low p-6 sm:p-8 rounded-xl space-y-6 shadow-sm">
          <h2 class="font-headline font-bold text-xl text-on-surface flex items-center gap-2">
            <span class="material-symbols-outlined text-primary">tune</span>
            ${t(lang, 'apply.section.preferredWork')}
          </h2>

          <div>
            <label class="block text-sm font-label text-on-surface-variant mb-1" for="preferred_work">${t(lang, 'apply.field.preferredWork')} <small class="text-on-surface-variant">${t(lang, 'apply.field.preferredWorkHint')}</small></label>
            <select id="preferred_work" name="preferred_work"
              class="w-full appearance-none cursor-pointer bg-surface-variant text-on-surface border-0 border-b-2 border-transparent focus:border-primary focus:ring-0 rounded-t-DEFAULT px-4 py-2.5 font-body text-sm transition-colors focus:bg-surface-container-highest">
              <option value="">${t(lang, 'apply.field.noPreference')}</option>
              <option value="Am Tresen arbeiten  // At the bar front">${t(lang, 'apply.preferredWork.barFront')}</option>
              <option value="In der Logistik // In the logistics">${t(lang, 'apply.preferredWork.logistics')}</option>
              <option value="Der Bar zuarbeiten (Runner, Spüler ect.) // Working to the bar (Runner, dishwasher ect)">${t(lang, 'apply.preferredWork.support')}</option>
            </select>
          </div>
        </section>

        <!-- Section 4: Gruppe -->
        <section class="bg-surface-container-low p-6 sm:p-8 rounded-xl space-y-6 shadow-sm">
          <h2 class="font-headline font-bold text-xl text-on-surface flex items-center gap-2">
            <span class="material-symbols-outlined text-primary">group</span>
            ${t(lang, 'apply.section.group')}
          </h2>

          <label class="flex items-center gap-2 cursor-pointer">
            <input type="checkbox" name="group_signup" value="1" id="group_signup_cb"
              class="mr-2 w-4 h-4 rounded text-primary focus:ring-primary border-outline">
            <span class="text-sm font-body text-on-surface">${t(lang, 'apply.field.groupSignup')}</span>
          </label>

          <div id="group_name_field">
            <label class="block text-sm font-label text-on-surface-variant mb-1" for="group_name">${t(lang, 'apply.field.groupName')}</label>
            <input id="group_name" name="group_name" type="text"
              class="w-full bg-surface-variant text-on-surface border-0 border-b-2 border-transparent focus:border-primary focus:ring-0 rounded-t-DEFAULT px-4 py-2.5 font-body text-sm transition-colors focus:bg-surface-container-highest">
          </div>
        </section>

        <!-- Section 5: Über dich -->
        <section class="bg-surface-container-low p-6 sm:p-8 rounded-xl space-y-6 shadow-sm">
          <h2 class="font-headline font-bold text-xl text-on-surface flex items-center gap-2">
            <span class="material-symbols-outlined text-primary">edit_note</span>
            ${t(lang, 'apply.section.aboutYou')}
          </h2>

          <div>
            <label class="block text-sm font-label text-on-surface-variant mb-1" for="nationality">${t(lang, 'apply.field.nationality')}</label>
            <input id="nationality" name="nationality" type="text" autocomplete="country-name"
              class="w-full bg-surface-variant text-on-surface border-0 border-b-2 border-transparent focus:border-primary focus:ring-0 rounded-t-DEFAULT px-4 py-2.5 font-body text-sm transition-colors focus:bg-surface-container-highest">
          </div>

          <div>
            <label class="block text-sm font-label text-on-surface-variant mb-1" for="festival_count">${t(lang, 'apply.field.festivalCount')} <small class="text-on-surface-variant">${t(lang, 'apply.field.festivalCountHint')}</small></label>
            <input id="festival_count" name="festival_count" type="number" min="0" max="99"
              class="w-full bg-surface-variant text-on-surface border-0 border-b-2 border-transparent focus:border-primary focus:ring-0 rounded-t-DEFAULT px-4 py-2.5 font-body text-sm transition-colors focus:bg-surface-container-highest">
          </div>

          <div>
            <label class="block text-sm font-label text-on-surface-variant mb-1" for="about_text">${t(lang, 'apply.field.aboutText')} <small class="text-on-surface-variant">${t(lang, 'common.optional')}</small></label>
            <textarea id="about_text" name="about_text" rows="4"
              class="w-full resize-y bg-surface-variant text-on-surface border-0 border-b-2 border-transparent focus:border-primary focus:ring-0 rounded-t-DEFAULT px-4 py-2.5 font-body text-sm transition-colors focus:bg-surface-container-highest"></textarea>
          </div>

          <div>
            <label class="block text-sm font-label text-on-surface-variant mb-1" for="note">${t(lang, 'apply.field.notes')} <small class="text-on-surface-variant">${t(lang, 'common.optional')}</small></label>
            <textarea id="note" name="note" rows="3"
              class="w-full resize-y bg-surface-variant text-on-surface border-0 border-b-2 border-transparent focus:border-primary focus:ring-0 rounded-t-DEFAULT px-4 py-2.5 font-body text-sm transition-colors focus:bg-surface-container-highest"></textarea>
          </div>

          <div>
            <label class="block text-sm font-label text-on-surface-variant mb-1" for="attachment">${t(lang, 'apply.field.image')} <small class="text-on-surface-variant">${t(lang, 'apply.field.imageHint')}</small></label>
            <input id="attachment" name="attachment" type="file" accept="image/jpeg,image/png,image/webp"
              class="w-full text-sm text-on-surface-variant file:mr-4 file:py-2 file:px-4 file:rounded-full file:border-0 file:text-sm file:font-semibold file:bg-surface-container file:text-on-surface hover:file:bg-surface-container-high">
          </div>
        </section>

        ${options?.error ? html`<div class="px-4 py-3 bg-error-container text-on-error-container rounded-xl text-sm">${options.error}</div>` : ''}

        <button type="submit" class="w-full bg-gradient-to-r from-primary to-primary-container text-on-primary font-headline font-bold text-lg py-4 px-6 rounded-full flex justify-center items-center gap-2 hover:opacity-90 transition-opacity min-h-[44px]">
          ${t(lang, 'apply.submit')} <span class="material-symbols-outlined">send</span>
        </button>

      </form>
    </div>
  </main>

  <!-- Footer -->
  <footer class="bg-slate-50 text-sm py-8 px-6 text-center text-slate-500 space-y-2">
    <div class="text-xs">${langSwitcherHtml(lang)}</div>
    <div>&copy; ${year} ${branding.event_name}${branding.org_name ? html` — ${branding.org_name}` : ''}</div>
  </footer>

  <script>
    (function() {
      var cb = document.getElementById('group_signup_cb');
      var field = document.getElementById('group_name_field');
      if (!cb || !field) return;
      field.style.display = cb.checked ? '' : 'none';
      cb.addEventListener('change', function() {
        field.style.display = cb.checked ? '' : 'none';
      });
    })();
  </script>

</body>
</html>` as HtmlEscapedString
}
