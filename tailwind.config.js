/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{vue,js,ts,jsx,tsx}'],
  theme: {
    extend: {
      colors: {
        carbon: {
          DEFAULT: '#0b0c0e',
          light: '#15171b',
          lighter: '#1e2128',
        },
        slate: {
          DEFAULT: '#19647e',
          light: '#1e7796',
          dark: '#145065',
        },
        teal: {
          DEFAULT: '#28afb0',
          light: '#31c8c9',
          dark: '#209090',
        },
        gold: {
          DEFAULT: '#f4d35e',
          light: '#f7dd82',
          dark: '#e8c33a',
        },
        sandy: {
          DEFAULT: '#ee964b',
          light: '#f2ab6d',
          dark: '#e8802b',
        },
      },
      fontFamily: {
        sans: ['Inter', 'system-ui', 'sans-serif'],
      },
    },
  },
  plugins: [],
}
