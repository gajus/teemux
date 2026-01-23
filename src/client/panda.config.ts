import { defineConfig } from '@pandacss/dev';

export default defineConfig({
  // Files to exclude
  exclude: [],

  // Global CSS
  globalCss: {
    '*': {
      boxSizing: 'border-box',
    },
    '.json-bool': {
      color: '#569cd6',
    },
    // JSON syntax highlighting classes (needed for dangerouslySetInnerHTML)
    '.json-key': {
      color: '#9cdcfe',
    },
    '.json-null': {
      color: '#569cd6',
    },
    '.json-number': {
      color: '#b5cea8',
    },
    '.json-string': {
      color: '#ce9178',
    },
    // Summary capsule classes (needed for dangerouslySetInnerHTML)
    '.summary-capsule': {
      background: 'rgba(255, 255, 255, 0.08)',
      border: '1px solid rgba(255, 255, 255, 0.1)',
      borderRadius: '3px',
      display: 'inline-block',
      fontSize: '11px',
      marginRight: '6px',
      padding: '0 5px',
    },
    '.summary-capsule-key': {
      color: '#888',
    },
    '.summary-capsule-value': {
      color: '#4fc1ff',
    },
    a: {
      '&:hover': {
        textDecoration: 'none',
      },
      color: '#4fc1ff',
      textDecoration: 'underline',
    },
    body: {
      background: '#1e1e1e',
      color: '#d4d4d4',
      display: 'flex',
      flexDirection: 'column',
      fontFamily: "'SF Mono', 'Monaco', 'Inconsolata', 'Fira Code', monospace",
      fontSize: '12px',
      lineHeight: '1.3',
    },
    'html, body': {
      height: '100%',
      margin: 0,
      overflow: 'hidden',
    },
    mark: {
      '&.filter': {
        background: '#264f00',
      },
      background: '#623800',
      borderRadius: '2px',
      color: 'inherit',
    },
  },

  // Where to look for CSS declarations
  include: ['./**/*.{ts,tsx}'],

  // Output directory for generated files
  outdir: 'styled-system',

  // Disable default preflight to use our own reset
  preflight: false,

  // Design tokens
  theme: {
    tokens: {
      colors: {
        'accent.blue': { value: '#007acc' },
        'accent.blueHover': { value: '#0098ff' },
        'bg.buttonActive': { value: '#264f78' },
        'bg.buttonHover': { value: '#3c3c3c' },
        'bg.capsule': { value: 'rgba(255, 255, 255, 0.08)' },
        'bg.hover': { value: 'rgba(255, 255, 255, 0.05)' },
        'bg.mark': { value: '#623800' },
        'bg.markFilter': { value: '#264f00' },
        'bg.pinned': { value: 'rgba(255, 204, 0, 0.1)' },
        'bg.primary': { value: '#1e1e1e' },
        'bg.secondary': { value: '#252526' },
        'border.accent': { value: '#007acc' },
        'border.capsule': { value: 'rgba(255, 255, 255, 0.1)' },
        'border.hover': { value: '#505050' },
        'border.primary': { value: '#3c3c3c' },
        'json.bool': { value: '#569cd6' },
        'json.key': { value: '#9cdcfe' },
        'json.number': { value: '#b5cea8' },
        'json.string': { value: '#ce9178' },
        'text.link': { value: '#4fc1ff' },
        'text.muted': { value: '#888' },
        'text.primary': { value: '#d4d4d4' },
        'text.white': { value: '#fff' },
        'text.yellow': { value: '#fc0' },
      },
      durations: {
        fast: { value: '0.15s' },
      },
      fonts: {
        mono: {
          value: "'SF Mono', 'Monaco', 'Inconsolata', 'Fira Code', monospace",
        },
      },
      fontSizes: {
        sm: { value: '12px' },
        xs: { value: '11px' },
      },
      lineHeights: {
        tight: { value: '1.3' },
      },
      radii: {
        lg: { value: '4px' },
        md: { value: '3px' },
        sm: { value: '2px' },
      },
      shadows: {
        active: { value: '0 0 0 2px rgba(0, 122, 204, 0.3)' },
        button: { value: '0 2px 8px rgba(0, 0, 0, 0.3)' },
      },
      spacing: {
        '1': { value: '4px' },
        '2': { value: '6px' },
        '3': { value: '8px' },
        '4': { value: '10px' },
        '5': { value: '12px' },
        '6': { value: '16px' },
        '7': { value: '20px' },
      },
    },
  },
});
