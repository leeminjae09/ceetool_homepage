const defaultTheme = require("tailwindcss/defaultTheme");

module.exports = {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        blue: {
          450: '#4ea9f5', // custom lighter blue
        },
        kakao: '#f1d900', // official kakaotalk color
      },
      fontFamily: {
        sans: [...defaultTheme.fontFamily.sans],
      },
    },
  },
  plugins: [
    require("@tailwindcss/forms"),
  ],
};
