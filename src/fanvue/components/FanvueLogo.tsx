interface Props { size?: number; animate?: boolean }

export default function FanvueLogo({ size = 64, animate = false }: Props) {
  return (
    <svg
      width={size} height={size} viewBox="0 0 100 100" fill="none"
      xmlns="http://www.w3.org/2000/svg"
      style={animate ? { animation: 'pulse-logo 2s ease-in-out infinite' } : undefined}
    >
      {/* Fanvue F-mark — organic bold F, traced from brand assets */}
      <path
        fill="#E8365D"
        d="M22 62 C14 66 10 58 14 48 C17 40 22 34 22 24
           C22 16 18 10 24 6 C30 2 44 4 56 10 C66 16 72 26 66 36
           C61 44 50 44 44 46 C52 50 60 58 56 68 C52 78 40 82 32 78
           C26 74 24 66 28 60 C32 54 40 52 38 44 C36 36 28 36 24 42
           C20 48 20 58 22 62 Z"
      />
    </svg>
  )
}
