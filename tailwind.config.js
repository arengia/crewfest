// Precompiled Tailwind config — replaces the inline `tailwind.config` object that
// used to ship with the Play CDN `<script>` tag on every page. Content/theme/colors
// are taken over 1:1 from that inline config (see git history for the original).

import forms from '@tailwindcss/forms'

/** @type {import('tailwindcss').Config} */
export default {
  darkMode: 'class',
  content: ['./src/**/*.ts'],
  theme: {
    extend: {
      colors: {
        primary: '#003345',
        'primary-container': '#004b63',
        'primary-fixed': '#bfe8ff',
        'primary-fixed-dim': '#96ceeb',
        'on-primary': '#ffffff',
        'on-primary-fixed': '#001f2b',
        'on-primary-fixed-variant': '#044d65',
        'on-primary-container': '#83bad6',
        secondary: '#4c616c',
        'secondary-container': '#cfe6f2',
        'secondary-fixed': '#cfe6f2',
        'secondary-fixed-dim': '#b4cad6',
        'on-secondary': '#ffffff',
        'on-secondary-container': '#526772',
        'on-secondary-fixed': '#071e27',
        'on-secondary-fixed-variant': '#354a53',
        tertiary: '#5d1300',
        'tertiary-container': '#841f00',
        'tertiary-fixed': '#ffdbd1',
        'tertiary-fixed-dim': '#ffb5a0',
        'on-tertiary': '#ffffff',
        'on-tertiary-container': '#ff9679',
        'on-tertiary-fixed': '#3b0900',
        'on-tertiary-fixed-variant': '#872000',
        error: '#ba1a1a',
        'error-container': '#ffdad6',
        'on-error': '#ffffff',
        'on-error-container': '#93000a',
        surface: '#f9f9fc',
        'surface-dim': '#dadadc',
        'surface-bright': '#f9f9fc',
        'surface-variant': '#e2e2e5',
        'surface-container-lowest': '#ffffff',
        'surface-container-low': '#f3f3f6',
        'surface-container': '#eeeef0',
        'surface-container-high': '#e8e8ea',
        'surface-container-highest': '#e2e2e5',
        'surface-tint': '#2a657e',
        'on-surface': '#1a1c1e',
        'on-surface-variant': '#40484c',
        'on-background': '#1a1c1e',
        background: '#f9f9fc',
        outline: '#71787d',
        'outline-variant': '#c0c7cd',
        'inverse-surface': '#2f3133',
        'inverse-on-surface': '#f0f0f3',
        'inverse-primary': '#96ceeb',
      },
      borderRadius: {
        DEFAULT: '0.125rem',
        lg: '0.25rem',
        xl: '0.5rem',
        full: '0.75rem',
      },
      // Inter/Manrope used to be loaded from Google Fonts. Both are plain sans-serif
      // text faces — nothing in the design depends on their specific letterforms —
      // so they were dropped for the native OS font stack instead of self-hosting
      // two more font files. Zero extra assets, zero runtime requests.
      fontFamily: {
        headline: ['system-ui', '-apple-system', 'BlinkMacSystemFont', '"Segoe UI"', 'Roboto', 'Helvetica', 'Arial', 'sans-serif'],
        display: ['system-ui', '-apple-system', 'BlinkMacSystemFont', '"Segoe UI"', 'Roboto', 'Helvetica', 'Arial', 'sans-serif'],
        body: ['system-ui', '-apple-system', 'BlinkMacSystemFont', '"Segoe UI"', 'Roboto', 'Helvetica', 'Arial', 'sans-serif'],
        label: ['system-ui', '-apple-system', 'BlinkMacSystemFont', '"Segoe UI"', 'Roboto', 'Helvetica', 'Arial', 'sans-serif'],
      },
    },
  },
  plugins: [forms],
}
