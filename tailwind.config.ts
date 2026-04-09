const config = {
  content: ["./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        "space-void": "#03040a",
        "nebula-purple": "#6c3fc5",
        "plasma-cyan": "#00d4ff",
        "stellar-gold": "#ffd166",
        "corona-orange": "#ff6b35",
        "void-gray": "#1a1d2e",
        "mist-gray": "#2d3154",
        "particle-white": "#e8eaf6",
      },
      fontFamily: {
        sans: ["var(--font-inter)"],
        mono: ["var(--font-jetbrains)"],
      },
      animation: {
        "particle-in": "particleIn 0.6s ease-out",
        "pulse-glow": "pulseGlow 2s ease-in-out infinite",
      },
      keyframes: {
        particleIn: {
          "0%": { opacity: "0", transform: "scale(0.8) translateY(8px)" },
          "100%": { opacity: "1", transform: "scale(1) translateY(0)" },
        },
        pulseGlow: {
          "0%, 100%": { boxShadow: "0 0 8px rgba(0,212,255,0.3)" },
          "50%": { boxShadow: "0 0 20px rgba(0,212,255,0.7)" },
        },
      },
    },
  },
  plugins: [],
};

export default config;
