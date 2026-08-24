/** @type {import('tailwindcss').Config} */
module.exports = {
  prefix: 'tw-',
  darkMode: 'class',
  content: ['./src/**/*.{html,ts}', './public/**/*.html'],
  theme: {
    extend: {
      colors: {
        primary: 'var(--color-primary)',
        'primary-foreground': 'var(--color-primary-foreground)',
        secondary: 'var(--color-secondary)',
        'secondary-foreground': 'var(--color-secondary-foreground)',
        accent: 'var(--color-accent)',
        'accent-foreground': 'var(--color-accent-foreground)',
        muted: 'var(--color-muted)',
        'muted-foreground': 'var(--color-muted-foreground)',
        destructive: 'var(--color-destructive)',
        'destructive-foreground': 'var(--color-destructive-foreground)',
        background: 'var(--color-background)',
        foreground: 'var(--color-foreground)',
        'card-bg': 'var(--color-card-bg)',
        'card-fg': 'var(--color-card-fg)',
        border: 'var(--color-border)',
        input: 'var(--color-input)',
      },
    },
  },
  plugins: [],
};
