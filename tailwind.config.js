module.exports = {
  darkMode: 'class',
  content: [
    './**/_drafts/**/*.html',
    './**/_includes/**/*.html',
    './**/_layouts/**/*.html',
    './**/_posts/**/*.md',
    './*.md',
    './*.html',
    '_config.yml',
  ],
  theme: {
    extend: {
      colors: {
        clink: '#1e6bb8',
        ghaze: {
          50: '#f0fdf6',
          100: '#dcfceb',
          200: '#bbf7d8',
          300: '#86efba',
          400: '#4ade93',
          500: '#22c573',
          600: '#159957',
          700: '#15804b',
          800: '#16653e',
          900: '#145335',
          950: '#052e1b'
        }
      },
      fontFamily: {
        sans: ['"Noto Sans Variable"', '"Noto Sans"', 'sans-serif'],
        serif: ['"Roboto Slab Variable"', '"Roboto Slab"', 'serif'],
      },
      typography: {
        DEFAULT: {
          css: {
            '--tw-prose-headings': '#159957',
            '--tw-prose-links': '#1e6bb8',
            '--tw-prose-pre-code': '#567482',
            '--tw-prose-pre-bg': '#f3f6fa',
            'a': {
              textDecoration: null,
            },
            'a:hover': {
              textDecoration: 'underline',
            },
            'h1': {
              fontFamily: '"Roboto Slab Variable", "Roboto Slab", serif',
            },
            'h2': {
              fontFamily: '"Roboto Slab Variable", "Roboto Slab", serif',
            },
            'h3': {
              fontFamily: '"Roboto Slab Variable", "Roboto Slab", serif',
            },
            'h4': {
              fontFamily: '"Roboto Slab Variable", "Roboto Slab", serif',
            },
            'h5': {
              fontFamily: '"Roboto Slab Variable", "Roboto Slab", serif',
            },
            'h6': {
              fontFamily: '"Roboto Slab Variable", "Roboto Slab", serif',
            },
            'pre': {
              lineHeight: '131%'
            },
            'code::before': {
              content: '""',
            },
            'code::after': {
              content: '""'
            },
            'blockquote p:first-of-type::before': {
              content: '""'
            },
            'blockquote p:first-of-type::after': {
              content: '""'
            },
          }
        },
      }
    },
  },
  plugins: [
    require('@tailwindcss/typography'),
  ]
}
