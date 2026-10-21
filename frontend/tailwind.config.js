/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{js,jsx}"],
  theme: {
    extend: {
      colors: {
        surface: "#0D1117",
        panel: "#161B22",
        border: "#30363D",
        muted: "#8B949E",
        subtle: "#21262D",
        accent: "#2F81F7",
        success: "#3FB950",
        warning: "#D29922",
        danger: "#F85149",
        // backward compat
        ink: "#0D1117",
        line: "#30363D",
        lineLight: "#484F58",
        signal: "#D29922",
        alert: "#F85149",
        go: "#3FB950",
        wash: "#161B22",
        card: "#161B22",
      },
      fontFamily: {
        display: ["Inter", "system-ui", "sans-serif"],
        body: ["Inter", "system-ui", "sans-serif"],
      },
    },
  },
  plugins: [],
}