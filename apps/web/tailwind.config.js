/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ["./app/**/*.{js,ts,jsx,tsx}", "./components/**/*.{js,ts,jsx,tsx}"],
  theme: {
    extend: {
      colors: {
        brand: {
          50: "#f0fdf4",
          100: "#dcfce7",
          200: "#bbf7d0",
          300: "#86efac",
          400: "#4ade80",
          500: "#0EA5E9", // 仮：サイトごとの site-config で変わる前提
          600: "#16a34a", // hover
          700: "#15803d",
          800: "#166534",
          900: "#14532d",
        },
        surface: {
          base: "#F7F3ED", // 全体のベース背景イメージ
          soft: "#F0E8DE", // サムネ背景など
          featured: "#FFFFFF", // FeaturedCard の背景
        },
      },
      borderRadius: {
        card: "1.25rem", // 20px
      },
      boxShadow: {
        soft: "0 6px 24px rgba(10,120,60,0.06)",
        softHover: "0 10px 28px rgba(10,120,60,0.10)",
      },
    },
  },
  plugins: [],
};
