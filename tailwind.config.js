let fontsSans = '"Noto Sans", Optima, Candara, source-sans-pro, sans-serif';
let fontsSerif = '"Roboto Slab", Rockwell, "Rockwell Nova", '
    + '"Nimbus Mono PS", "Courier New", "Roboto Slab Variable", serif';

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
        tcolor: '#374151',
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
        sans: fontsSans,
        serif: fontsSerif,
      },
      typography: {
        DEFAULT: {
          css: {
            '--tw-prose-headings': '#159957',
            '--tw-prose-links': '#1e6bb8',
            '--tw-prose-pre-code': '#567482',
            '--tw-prose-pre-bg': '#f3f6fa',
            'a:visited': {
              color: 'revert',
            },
            'h1': {
              fontFamily: fontsSerif,
            },
            'h2': {
              fontFamily: fontsSerif,
            },
            'h3': {
              fontFamily: fontsSerif,
            },
            'h4': {
              fontFamily: fontsSerif,
            },
            'h5': {
              fontFamily: fontsSerif,
            },
            'h6': {
              fontFamily: fontsSerif,
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
    require('@tailwindcss/typography')({ target: "legacy" }),
  ]
}
