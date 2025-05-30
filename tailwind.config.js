// tailwind.config.js
module.exports = {
  content: [
    "./App.{js,jsx,ts,tsx}",
    "./screens/**/*.{js,jsx,ts,tsx}",
    "./components/**/*.{js,jsx,ts,tsx}",
  ],
  presets: [require("nativewind/preset")],
  theme: {
    extend: {
      colors: {
        'custom-primary': '#8DEEED',
        'custom-secondary': '#7037E4',
        'custom-tertiary': '#030318',
        'custom-quaternary': '#FAFAFA',
        'custom-quinary': '#FFFFFF',
        'brand-bg': '#030318',
        'brand-text-primary': '#FAFAFA',
        'brand-text-secondary': '#7037E4',
        'brand-accent-1': '#8DEEED',
        'brand-accent-2': '#7037E4',
      }
    },
  },
  plugins: [],
}
