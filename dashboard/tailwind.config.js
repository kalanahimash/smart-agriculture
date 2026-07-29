/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{js,ts,jsx,tsx}"],
  theme: {
    extend: {
      colors: {
        theme: {
          sidebar: "#2b2b2b",
          bg: "#f4f9f0",
          primary: "#d1f08b",
          cardLight: "#ffffff",
          cardBlue: "#f0f8fa",
          cardGreen: "#e8f6ea",
          textMain: "#1e1e1e",
          textMuted: "#a0a0a0",
        },
        soil: {
          950: "#1a1410",
          900: "#241c15",
          800: "#332921",
          700: "#453830",
        },
        canopy: {
          400: "#7fb069",
          500: "#5a9146",
          600: "#437033",
        },
        signal: {
          amber: "#e8a33d",
          sky: "#4f9dc9",
          clay: "#c1633a",
        },
      },
      fontFamily: {
        display: ["'Space Grotesk'", "sans-serif"],
        body: ["'Inter'", "sans-serif"],
        mono: ["'JetBrains Mono'", "monospace"],
      },
    },
  },
  plugins: [],
};
