type CosmicGlyphVariant = 'overview' | 'bulletin' | 'earnings' | 'budget'

interface CosmicGlyphProps {
  variant: CosmicGlyphVariant
}

export default function CosmicGlyph({ variant }: CosmicGlyphProps) {
  return (
    <div className={`cosmic-glyph cosmic-glyph--${variant}`} aria-hidden="true">
      <svg viewBox="0 0 240 240" focusable="false">
        <g className="cosmic-glyph__axes">
          <path d="M120 16V224M16 120H224" />
          <path d="M46.5 46.5L193.5 193.5M193.5 46.5L46.5 193.5" />
        </g>

        <g className="cosmic-glyph__orbit cosmic-glyph__orbit--outer">
          <circle cx="120" cy="120" r="94" />
          <circle className="cosmic-glyph__node" cx="120" cy="26" r="3.5" />
          <circle className="cosmic-glyph__node" cx="214" cy="120" r="3.5" />
          <circle className="cosmic-glyph__node" cx="120" cy="214" r="3.5" />
          <circle className="cosmic-glyph__node" cx="26" cy="120" r="3.5" />
        </g>

        <g className="cosmic-glyph__orbit cosmic-glyph__orbit--inner">
          <circle cx="120" cy="120" r="72" />
          <path d="M120 48L182.4 84V156L120 192L57.6 156V84Z" />
          <circle className="cosmic-glyph__node cosmic-glyph__node--secondary" cx="182.4" cy="84" r="3" />
          <circle className="cosmic-glyph__node cosmic-glyph__node--secondary" cx="57.6" cy="156" r="3" />
        </g>

        <g className="cosmic-glyph__trace">
          <circle cx="120" cy="120" r="83" />
        </g>

        <g className="cosmic-glyph__core">
          <circle cx="120" cy="120" r="43" />
          {variant === 'overview' ? (
            <>
              <path d="M120 82L153 101V139L120 158L87 139V101Z" />
              <path d="M120 99L138 109.5V130.5L120 141L102 130.5V109.5Z" />
              <path d="M120 82V99M153 101L138 109.5M153 139L138 130.5M120 158V141M87 139L102 130.5M87 101L102 109.5" />
            </>
          ) : null}
          {variant === 'bulletin' ? (
            <>
              <path d="M120 82L158 120L120 158L82 120Z" />
              <path d="M120 100L140 120L120 140L100 120Z" />
              <circle cx="120" cy="120" r="5" />
            </>
          ) : null}
          {variant === 'earnings' ? (
            <>
              <path d="M84 145L108 117L128 130L156 92" />
              <path d="M144 92H156V104" />
              <path d="M88 154H156" />
              <circle cx="108" cy="117" r="3" />
              <circle cx="128" cy="130" r="3" />
            </>
          ) : null}
          {variant === 'budget' ? (
            <>
              <path d="M88 94H152V146H88Z" />
              <path d="M100 107H140M100 120H132M100 133H138" />
              <circle cx="150" cy="145" r="13" />
              <path d="M150 138V152M145 141H152.5C157 141 157 147 152.5 147H147.5C143 147 143 153 147.5 153H155" />
            </>
          ) : null}
        </g>
      </svg>
    </div>
  )
}
