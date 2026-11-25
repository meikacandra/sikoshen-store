import type { Config } from 'tailwindcss'

const v = (name: string) => `rgb(var(--${name}) / <alpha-value>)`

const status = (key: string) => ({
  fg: v(`${key}-fg`),
  bg: v(`${key}-bg`),
  border: v(`${key}-border`),
})

export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    screens: {
      sm: '640px',
      md: '768px',
      lg: '1024px',
      xl: '1440px',
    },
    extend: {
      colors: {
        white: v('white'),
        surface: v('surface'),
        charcoal: v('charcoal'),
        denim: {
          DEFAULT: v('denim'),
          50: v('denim-50'),
          200: v('denim-200'),
          700: v('denim-700'),
        },
        muted: v('muted'),
        border: {
          DEFAULT: v('border'),
          strong: v('border-strong'),
        },
        danger: status('danger'),
        warning: status('warning'),
        success: status('success'),
        stack: status('stack'),
        neutral: status('neutral'),
        slow: status('slow'),
        fast: status('fast'),
      },
      fontFamily: {
        sans: ['"Plus Jakarta Sans"', 'system-ui', '-apple-system', 'Segoe UI', 'sans-serif'],
      },
      fontSize: {
        'page-title': ['28px', { lineHeight: '36px', fontWeight: '700' }],
        'section-title': ['18px', { lineHeight: '26px', fontWeight: '700' }],
        body: ['14px', { lineHeight: '22px' }],
        'body-lg': ['15px', { lineHeight: '22px' }],
        caption: ['12px', { lineHeight: '18px' }],
        'caption-lg': ['13px', { lineHeight: '18px' }],
        kpi: ['30px', { lineHeight: '36px', fontWeight: '700' }],
      },
      borderRadius: {
        control: 'var(--radius-control)',
        card: 'var(--radius-card)',
        modal: 'var(--radius-modal)',
      },
      boxShadow: {
        card: 'var(--shadow-card)',
        pop: 'var(--shadow-pop)',
      },
      maxWidth: {
        content: '1200px',
      },
      keyframes: {
        shimmer: { '100%': { transform: 'translateX(100%)' } },
      },
      animation: {
        shimmer: 'shimmer 1.4s infinite',
      },
    },
  },
  plugins: [],
} satisfies Config
