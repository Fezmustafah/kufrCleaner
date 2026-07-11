
import { siteConfig, getFontFamily } from './src/config.ts';

/** @type {import('tailwindcss').Config} */
export default {
  content: ['./src/**/*.{astro,html,js,jsx,md,mdx,svelte,ts,tsx,vue}'],
  darkMode: 'class',
  theme: {
    extend: {
      fontFamily: {
        'sans': getFontFamily(siteConfig.fonts.families.body).split(', '),
        'heading': getFontFamily(siteConfig.fonts.families.heading).split(', '),
        'prose': getFontFamily(siteConfig.fonts.families.body).split(', ')
      },
      colors: {
        // Dynamic theme colors using CSS custom properties
        primary: {
          50: 'rgb(var(--color-primary-50) / <alpha-value>)',
          100: 'rgb(var(--color-primary-100) / <alpha-value>)',
          200: 'rgb(var(--color-primary-200) / <alpha-value>)',
          300: 'rgb(var(--color-primary-300) / <alpha-value>)',
          400: 'rgb(var(--color-primary-400) / <alpha-value>)',
          500: 'rgb(var(--color-primary-500) / <alpha-value>)',
          600: 'rgb(var(--color-primary-600) / <alpha-value>)',
          700: 'rgb(var(--color-primary-700) / <alpha-value>)',
          800: 'rgb(var(--color-primary-800) / <alpha-value>)',
          900: 'rgb(var(--color-primary-900) / <alpha-value>)',
          950: 'rgb(var(--color-primary-950) / <alpha-value>)',
        },
        highlight: {
          50: 'rgb(var(--color-highlight-50) / <alpha-value>)',
          100: 'rgb(var(--color-highlight-100) / <alpha-value>)',
          200: 'rgb(var(--color-highlight-200) / <alpha-value>)',
          300: 'rgb(var(--color-highlight-300) / <alpha-value>)',
          400: 'rgb(var(--color-highlight-400) / <alpha-value>)',
          500: 'rgb(var(--color-highlight-500) / <alpha-value>)',
          600: 'rgb(var(--color-highlight-600) / <alpha-value>)',
          700: 'rgb(var(--color-highlight-700) / <alpha-value>)',
          800: 'rgb(var(--color-highlight-800) / <alpha-value>)',
          900: 'rgb(var(--color-highlight-900) / <alpha-value>)',
          950: 'rgb(var(--color-highlight-950) / <alpha-value>)',
        },
        // Zellige — Moorish turquoise (cool accent for tags, info states, dark-mode relief)
        secondary: {
          50:  'rgb(var(--color-secondary-50)  / <alpha-value>)',
          100: 'rgb(var(--color-secondary-100) / <alpha-value>)',
          200: 'rgb(var(--color-secondary-200) / <alpha-value>)',
          300: 'rgb(var(--color-secondary-300) / <alpha-value>)',
          400: 'rgb(var(--color-secondary-400) / <alpha-value>)',
          500: 'rgb(var(--color-secondary-500) / <alpha-value>)',
          600: 'rgb(var(--color-secondary-600) / <alpha-value>)',
          700: 'rgb(var(--color-secondary-700) / <alpha-value>)',
          800: 'rgb(var(--color-secondary-800) / <alpha-value>)',
          900: 'rgb(var(--color-secondary-900) / <alpha-value>)',
          950: 'rgb(var(--color-secondary-950) / <alpha-value>)',
        }
      },
      typography: {
        DEFAULT: {
          css: {
            maxWidth: 'none',
            color: 'inherit',
            fontSize: '1.0625rem',
            lineHeight: '1.75',
            p: {
              marginTop: '0.85em',
              marginBottom: '0.85em',
            },
            'h2 + *': { marginTop: '0.6em' },
            'h3 + *': { marginTop: '0.5em' },
            h2: {
              fontSize: '1.5em',
              marginTop: '1.75em',
              marginBottom: '0.6em',
              paddingBottom: '0.3em',
              borderBottom: '1px solid rgb(var(--color-highlight-400) / 0.25)',
            },
            h3: {
              fontSize: '1.2em',
              marginTop: '1.5em',
              marginBottom: '0.5em',
            },
            'h1, h2, h3, h4, h5, h6': {
              fontFamily: getFontFamily(siteConfig.fonts.families.heading),
              fontWeight: '600',
              scrollMarginTop: '2rem',
            },
            a: {
              color: 'rgb(var(--color-highlight-600))',
              textDecoration: 'none',
              fontWeight: '500',
              borderBottom: '1px dotted rgb(var(--color-highlight-500) / 0.5)',
              '&:hover': {
                color: 'rgb(var(--color-highlight-700))',
                borderBottomStyle: 'solid',
                textDecoration: 'none',
              }
            },
            code: {
              color: 'inherit',
              backgroundColor: 'rgb(248 250 252 / 0.8)',
              borderRadius: '0.375rem',
              padding: '0.125rem 0.375rem',
              fontSize: '1em',
              fontWeight: '400',
            },
            'code::before': {
              content: '""',
            },
            'code::after': {
              content: '""',
            },
            pre: {
              backgroundColor: '#1A1208',
              borderRadius: '0.25rem',
              padding: '1rem',
              overflow: 'auto',
              fontSize: '1em',
              lineHeight: '1.7142857',
            },
            'pre code': {
              backgroundColor: 'transparent',
              borderWidth: '0',
              borderRadius: '0',
              padding: '0',
              fontWeight: 'inherit',
              color: 'inherit',
              fontSize: 'inherit',
              fontFamily: 'inherit',
              lineHeight: 'inherit',
            },
            blockquote: {
              fontWeight: '400',
              fontStyle: 'italic',
              color: 'inherit',
              borderLeftWidth: '3px',
              borderLeftColor: 'rgb(var(--color-highlight-500))',
              backgroundColor: 'rgb(var(--color-highlight-500) / 0.04)',
              borderRadius: '0 0.25rem 0.25rem 0',
              quotes: '"\\201C""\\201D""\\2018""\\2019"',
              marginTop: '1.6em',
              marginBottom: '1.6em',
              paddingLeft: '1.25em',
              paddingTop: '0.25em',
              paddingBottom: '0.25em',
            },
            h2: {},
            hr: {
              borderColor: 'transparent',
              marginTop: '2.5em',
              marginBottom: '2.5em',
            },
            table: {
              borderTopWidth: '2px',
              borderTopColor: 'rgb(var(--color-highlight-500) / 0.35)',
              borderBottomWidth: '2px',
              borderBottomColor: 'rgb(var(--color-highlight-500) / 0.35)',
            },
            thead: {
              backgroundColor: 'rgb(var(--color-highlight-500) / 0.06)',
              borderBottomWidth: '1px',
              borderBottomColor: 'rgb(var(--color-highlight-500) / 0.25)',
            },
            'thead th': {
              letterSpacing: '0.04em',
              fontWeight: '600',
            },
            'tbody tr': {
              borderBottomColor: 'rgb(var(--color-highlight-500) / 0.12)',
            },
            'blockquote p:first-of-type::before': {
              content: '""',
            },
            'blockquote p:last-of-type::after': {
              content: '""',
            },
          }
        },
        dark: {
          css: {
            color: 'rgb(var(--color-primary-200))',
            code: {
              backgroundColor: 'rgb(42 28 12 / 0.8)',
            },
            blockquote: {
              borderLeftColor: 'rgb(var(--color-highlight-500))',
              backgroundColor: 'rgb(var(--color-highlight-500) / 0.06)',
              color: 'inherit',
            },
            a: {
              color: 'rgb(var(--color-highlight-400))',
              '&:hover': {
                color: 'rgb(var(--color-highlight-300))',
              }
            },
          }
        }
      },
      animation: {
        'fade-in': 'fadeIn 0.2s ease-in-out',
        'slide-up': 'slideUp 0.3s ease-out',
        'scale-in': 'scaleIn 0.2s ease-out',
      },
      keyframes: {
        fadeIn: {
          '0%': { opacity: '0' },
          '100%': { opacity: '1' }
        },
        slideUp: {
          '0%': { transform: 'translateY(10px)', opacity: '0' },
          '100%': { transform: 'translateY(0)', opacity: '1' }
        },
        scaleIn: {
          '0%': { transform: 'scale(0.95)', opacity: '0' },
          '100%': { transform: 'scale(1)', opacity: '1' }
        }
      }
    },
  },
  plugins: [
    require('@tailwindcss/typography'),
    function({ addUtilities }) {
      addUtilities({
        '.scrollbar-hide': {
          '-ms-overflow-style': 'none',
          'scrollbar-width': 'none',
          '&::-webkit-scrollbar': {
            display: 'none'
          }
        },
        '.text-selection-highlight': {
          '::selection': {
            backgroundColor: 'rgb(var(--color-highlight-500))',
            color: 'rgb(var(--color-primary-50))'
          },
          '::-moz-selection': {
            backgroundColor: 'rgb(var(--color-highlight-500))',
            color: 'rgb(var(--color-primary-50))'
          }
        }
      })
    }
  ],
}
