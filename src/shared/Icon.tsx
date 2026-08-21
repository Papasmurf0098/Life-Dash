import type { ReactNode } from 'react'

export type IconName =
  | 'orbit'
  | 'bulletin'
  | 'shifts'
  | 'wallet'
  | 'backup'
  | 'plus'
  | 'plate'
  | 'cocktail'
  | 'trend'
  | 'shield'

interface IconProps {
  name: IconName
  size?: number
  className?: string
}

export default function Icon({ name, size = 20, className = '' }: IconProps) {
  const common = {
    fill: 'none',
    stroke: 'currentColor',
    strokeLinecap: 'round' as const,
    strokeLinejoin: 'round' as const,
    strokeWidth: 1.8,
  }

  const paths: Record<IconName, ReactNode> = {
    orbit: (
      <>
        <circle cx="12" cy="12" r="3.2" {...common} />
        <path d="M4.1 15.5c-1.4-2.5 1-6.3 5.3-8.7s8.9-2.4 10.3.1-1 6.3-5.3 8.7-8.9 2.4-10.3-.1Z" {...common} />
        <circle cx="18.9" cy="7.1" r="1" fill="currentColor" stroke="none" />
      </>
    ),
    bulletin: (
      <>
        <path d="M7 4.5h10a2 2 0 0 1 2 2v11a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2v-11a2 2 0 0 1 2-2Z" {...common} />
        <path d="M9 2.8v3.4M15 2.8v3.4M8.5 10h7M8.5 14h4.5" {...common} />
        <path d="m16.5 13 .45 1.05 1.05.45-1.05.45-.45 1.05-.45-1.05-1.05-.45 1.05-.45.45-1.05Z" fill="currentColor" stroke="none" />
      </>
    ),
    shifts: (
      <>
        <path d="M4.5 17.5 9 13l3 2.7L19.5 8" {...common} />
        <path d="M15.5 8h4v4" {...common} />
        <path d="M5 6.5h5M5 10h2.5" {...common} opacity=".65" />
      </>
    ),
    wallet: (
      <>
        <path d="M5 6.5h12a2 2 0 0 1 2 2v9a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-11a2 2 0 0 1 2-2h10" {...common} />
        <path d="M15 11h5v4h-5a2 2 0 1 1 0-4Z" {...common} />
        <circle cx="15.5" cy="13" r=".7" fill="currentColor" stroke="none" />
      </>
    ),
    backup: (
      <>
        <path d="M12 3v11M8.5 10.5 12 14l3.5-3.5" {...common} />
        <path d="M5 15.5v2.2a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2v-2.2" {...common} />
      </>
    ),
    plus: <path d="M12 5v14M5 12h14" {...common} />,
    plate: (
      <>
        <circle cx="12" cy="12" r="7.5" {...common} />
        <circle cx="12" cy="12" r="3.8" {...common} opacity=".7" />
        <path d="M3 5v5M5 5v5M4 10v9M20 5c-1.3 1.8-1.5 4.2 0 5.8V19" {...common} />
      </>
    ),
    cocktail: (
      <>
        <path d="M4.5 5.5h15L12 14 4.5 5.5Z" {...common} />
        <path d="M12 14v5M8.5 19h7" {...common} />
        <path d="m14.5 8 3.2-4M16.2 4h3" {...common} />
      </>
    ),
    trend: (
      <>
        <path d="M4 18V6M4 18h16" {...common} opacity=".55" />
        <path d="m7 15 3.5-4 3 2 5-6" {...common} />
        <path d="M15.5 7h3v3" {...common} />
      </>
    ),
    shield: (
      <>
        <path d="M12 3.5 19 6v5.2c0 4.4-2.8 7.5-7 9.3-4.2-1.8-7-4.9-7-9.3V6l7-2.5Z" {...common} />
        <path d="m9 12 2 2 4-4" {...common} />
      </>
    ),
  }

  return (
    <svg
      aria-hidden="true"
      className={`ui-icon ${className}`.trim()}
      height={size}
      viewBox="0 0 24 24"
      width={size}
    >
      {paths[name]}
    </svg>
  )
}
