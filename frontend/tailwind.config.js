/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{js,jsx}"],
  theme: {
    extend: {
      colors: {
        ink: "#0F1115",
        paper: "#F7F6F2",
        accent: {
          DEFAULT: "#1F6F5C",
          light: "#2E8B73",
          dark: "#14493C",
        },
        gold: "#C9A24B",
        coral: "#D9694F",
      },
      fontFamily: {
        display: ["'Fraunces'", "serif"],
        body: ["'Inter'", "sans-serif"],
      },
      boxShadow: {
        soft: "0 1px 2px rgba(15,17,21,0.04), 0 8px 24px rgba(15,17,21,0.06)",
      },
      borderRadius: {
        xl2: "1.25rem",
      },
    },
  },
  plugins: [],
};
