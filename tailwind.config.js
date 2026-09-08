/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ["./app/**/*.{js,jsx,ts,tsx}", "./components/**/*.{js,jsx,ts,tsx}"],
  presets: [require("nativewind/preset")],
  theme: {
    extend: {
      colors: {
        primary: '#10B981', // More vibrant modern green (Tailwind emerald-500)
        primaryLight: '#34D399',
        primaryDark: '#059669',
        accent: '#F59E0B', // Amber accent for highlights
        background: '#F8FAFC', // Sleek off-white/gray for modern look
        card: '#FFFFFF',
        textMain: '#0F172A', // Deeper slate for text
        textSecondary: '#64748B',
        border: '#E2E8F0',
        error: '#EF4444',
        success: '#10B981',
      },
      boxShadow: {
        'soft': '0 4px 20px -2px rgba(0, 0, 0, 0.05)',
        'medium': '0 10px 25px -3px rgba(0, 0, 0, 0.1)',
      }
    },
  },
  plugins: [],
}
