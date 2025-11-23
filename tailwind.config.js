/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    "./app/**/*.{js,ts,jsx,tsx}",
    "./components/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      fontSize: {
        base: "1.05rem",
        lg: "1.15rem",
        xl: "1.3rem",
        "2xl": "1.6rem",
        "3xl": "2rem",
      },
    },
  },
  plugins: [],
};
