/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        primary: '#2ea1ff',
        success: '#10b981',
        warning: '#f59e0b',
        danger: '#ef4444',
        neutral: '#64748b',
        blueBg: '#f4f6fc'
      }
    },
  },
  plugins: [],
}
