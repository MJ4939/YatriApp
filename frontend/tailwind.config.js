/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{js,jsx}"],
  theme: {
    extend: {
      colors: {
        ink: "#080E1A",
        panel: "#0F172A",
        card: "#131E35",
        line: "#1E293B",
        lineLight: "#334155",
        signal: "#F59E0B",
        alert: "#EF4444",
        go: "#10B981",
        wash: "#0B132B",
        yatri: {
          50: "#F0F9FF",
          100: "#E0F2FE",
          300: "#7DD3FC",
          400: "#38BDF8",
          500: "#0EA5E9",
          600: "#0284C7",
          700: "#0369A1",
        },
      },
      fontFamily: {
        display: ["'JetBrains Mono'", "'IBM Plex Mono'", "monospace"],
        body: ["'Plus Jakarta Sans'", "'Inter'", "system-ui", "sans-serif"],
      },
    },
  },
  plugins: [],
}
