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
      typography: {
        DEFAULT: {
          css: {
            color:'#606c71',
            a: {
              color: '#1e6bb8',
            },
            'code::before': {
              content: '""',
            },
            'code::after': {
              content: '""'
            }
          }
        }
      }
    },
  },
  plugins: [
    require('@tailwindcss/typography'),
  ]
}
