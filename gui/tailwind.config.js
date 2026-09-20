/** @type {import('tailwindcss').Config} */
export default {
  darkMode: ['class'],
  content: ['./src/renderer/index.html', './src/renderer/src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        border: 'hsl(var(--border))',
        input: 'hsl(var(--input))',
        ring: 'hsl(var(--ring))',
        background: 'hsl(var(--background))',
        foreground: 'hsl(var(--foreground))',
        primary: {
          DEFAULT: 'hsl(var(--primary))',
          foreground: 'hsl(var(--primary-foreground))'
        },
        secondary: {
          DEFAULT: 'hsl(var(--secondary))',
          foreground: 'hsl(var(--secondary-foreground))'
        },
        muted: {
          DEFAULT: 'hsl(var(--muted))',
          foreground: 'hsl(var(--muted-foreground))'
        },
        accent: {
          DEFAULT: 'hsl(var(--accent))',
          foreground: 'hsl(var(--accent-foreground))'
        },
        destructive: {
          DEFAULT: 'hsl(var(--destructive))',
          foreground: 'hsl(var(--destructive-foreground))',
          strong: 'hsl(var(--destructive-strong))'
        },
        success: {
          DEFAULT: 'hsl(var(--success))',
          foreground: 'hsl(var(--success-foreground))',
          strong: 'hsl(var(--success-strong))'
        },
        warning: {
          DEFAULT: 'hsl(var(--warning))',
          foreground: 'hsl(var(--warning-foreground))',
          /** Para texto sobre superficies teñidas (bg-warning/10), donde el ámbar puro no llega a AA. */
          strong: 'hsl(var(--warning-strong))'
        },
        card: {
          DEFAULT: 'hsl(var(--card))',
          foreground: 'hsl(var(--card-foreground))'
        },
        popover: {
          DEFAULT: 'hsl(var(--popover))',
          foreground: 'hsl(var(--popover-foreground))'
        },
        sidebar: {
          DEFAULT: 'hsl(var(--sidebar))',
          foreground: 'hsl(var(--sidebar-foreground))'
        },
        console: {
          DEFAULT: 'hsl(var(--console))',
          foreground: 'hsl(var(--console-foreground))'
        }
      },
      /**
       * Escalón propio del marcador, encima de la escala de Tailwind. Existe
       * para que ningún componente vuelva a escribir `text-[1.0625rem]`: la
       * pantalla se proyecta y los tamaños de la cifra, del nombre y del rótulo
       * son decisiones del sistema, no de cada archivo.
       */
      fontSize: {
        glyph: ['0.625rem', { lineHeight: '1' }],
        micro: ['0.6875rem', { lineHeight: '1.35' }],
        dense: ['0.8125rem', { lineHeight: '1.45' }],
        ui: ['0.9375rem', { lineHeight: '1.4' }],
        name: ['1.0625rem', { lineHeight: '1.2' }],
        figure: ['1.75rem', { lineHeight: '1' }],
        marker: ['2.25rem', { lineHeight: '1' }],
        'marker-lg': ['2.75rem', { lineHeight: '1' }]
      },
      fontFamily: {
        sans: ['Inter', 'system-ui', 'sans-serif'],
        mono: ['"JetBrains Mono"', 'ui-monospace', 'monospace']
      },
      borderRadius: {
        lg: 'var(--radius)',
        md: 'calc(var(--radius) - 2px)',
        sm: 'calc(var(--radius) - 4px)',
        xl: 'calc(var(--radius) + 2px)'
      },
      keyframes: {
        /* Solo opacidad: una vista entera que se desliza en cada navegación es
           coreografía, no información. */
        'fade-in': {
          from: { opacity: '0' },
          to: { opacity: '1' }
        }
      },
      animation: {
        'fade-in': 'fade-in 0.12s ease-out'
      }
    }
  },
  plugins: []
}
