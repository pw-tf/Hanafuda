/** March — Sakura (Cherry blossom, 桜). Camp Curtain bright, poetry ribbon, two chaff. */
import type { ReactNode } from 'react';
import { Blossom, Branch, CARD_W, PALETTE, Ribbon } from './primitives';

function CherryBranch({ extra = false }: { extra?: boolean }) {
  return (
    <g>
      <Branch d="M22 180 C 34 154, 28 134, 44 116 C 58 100, 54 86, 68 72" width={5} />
      <Branch d="M46 118 C 66 112, 80 118, 96 108" width={3} />
      <Blossom x={68} y={68} r={11} variant="cherry" />
      <Blossom x={98} y={104} r={10} variant="cherry" />
      <Blossom x={40} y={140} r={9} variant="cherry" />
      {extra && (
        <>
          <Blossom x={52} y={96} r={10} variant="cherry" />
          <Blossom x={84} y={140} r={10} variant="cherry" />
          <Blossom x={26} y={112} r={8} variant="cherry" />
        </>
      )}
    </g>
  );
}

export const month03: ReactNode[] = [
  // 0 — Camp Curtain (桜に幕), bright. The 幕 is a striped field curtain with
  // a scalloped valance, hung on a pole above the blossoming cherry.
  <g key="m3-0">
    <CherryBranch />
    <g>
      {/* Suspension cords, then the pole the curtain hangs from. */}
      <path d="M26 12 V 26 M60 10 V 26 M94 12 V 26" stroke={PALETTE.ink} strokeWidth="1.4" />
      <rect x="6" y="26" width={CARD_W - 12} height="5" rx="2.5" fill={PALETTE.brown} />

      {/* Curtain body: alternating vertical bands of deep red and gold.
          Inset from the card edge so the rolled ends stay inside the border. */}
      {(() => {
        const left = 16;
        const width = CARD_W - 32;
        const band = width / 7;
        const scallops = 7;
        return (
          <g>
            <rect x={left} y="31" width={width} height="56" fill={PALETTE.deepRed} />
            {[0, 1, 2, 3].map((i) => (
              <rect key={i} x={left + band * (2 * i + 1)} y="31" width={band} height="56" fill={PALETTE.gold} />
            ))}
            {/* Scalloped hem, tinted to continue each band's colour. */}
            {Array.from({ length: scallops }, (_, i) => (
              <path
                key={i}
                d={`M ${left + i * band} 87 a ${band / 2} ${band / 2} 0 0 0 ${band} 0 Z`}
                fill={i % 2 === 1 ? PALETTE.gold : PALETTE.deepRed}
              />
            ))}
            {/* Outline on three sides only — a bottom edge would cut straight
                across the scallops and flatten them into dots. */}
            <path
              d={`M${left} 87 L${left} 31 H${left + width} V87`}
              fill="none"
              stroke={PALETTE.ink}
              strokeWidth="1.2"
            />
          </g>
        );
      })()}

      {/* Rolled ends, tucked under the pole so the curtain reads as a field
          curtain (幕) rather than a hanging banner. */}
      <path d="M20 32 C 11 39, 13 50, 22 50" fill="none" stroke={PALETTE.deepRed} strokeWidth="8" strokeLinecap="round" />
      <path
        d={`M${CARD_W - 20} 32 C ${CARD_W - 11} 39, ${CARD_W - 13} 50, ${CARD_W - 22} 50`}
        fill="none"
        stroke={PALETTE.deepRed}
        strokeWidth="8"
        strokeLinecap="round"
      />
    </g>
  </g>,

  // 1 — Poetry ribbon (桜に赤短).
  <g key="m3-1">
    <CherryBranch extra />
    <Ribbon color="red-poetry" />
  </g>,

  // 2 — Chaff.
  <g key="m3-2">
    <CherryBranch extra />
  </g>,

  // 3 — Chaff.
  <g key="m3-3">
    <CherryBranch />
    <Blossom x={62} y={158} r={10} variant="cherry" />
    <Blossom x={94} y={148} r={9} variant="cherry" />
    <Blossom x={30} y={80} r={9} variant="cherry" />
  </g>,
];
