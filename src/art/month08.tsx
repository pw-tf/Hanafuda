/**
 * August — Susuki (Pampas grass, 芒). Full Moon bright, Geese tane, two chaff.
 * The whole suit shares the dark silhouetted hill covered in pampas plumes.
 */
import type { ReactNode } from 'react';
import { CARD_H, CARD_W, PALETTE } from './primitives';

const HILL = '#4a4438';

/** The dark hill that fills the lower two-thirds of every August card. */
function PampasHill({ plumes = true }: { plumes?: boolean }) {
  return (
    <g>
      <path
        d={`M4 ${CARD_H - 4} L4 128 C 30 96, 62 92, ${CARD_W / 2} 100 C 88 108, 104 118, ${CARD_W - 4} 118 L ${CARD_W - 4} ${CARD_H - 4} Z`}
        fill={HILL}
      />
      {plumes && (
        <g>
          {[
            [18, 130, -18],
            [34, 122, -8],
            [50, 116, 4],
            [66, 116, -6],
            [82, 122, 10],
            [98, 128, 16],
            [26, 152, -12],
            [58, 150, 2],
            [90, 152, 12],
          ].map(([x, y, tilt], i) => (
            <g key={i} transform={`translate(${x} ${y}) rotate(${tilt})`}>
              <path d="M0 0 C 1 -12, 0 -20, -1 -26" stroke="#6b6252" strokeWidth="1.6" fill="none" />
              {/* Feathery plume head. */}
              <path d="M-1 -26 C -6 -32, -4 -38, -1 -40 C 2 -38, 4 -32, -1 -26 Z" fill="#b9ae90" />
              <path d="M-1 -30 l -5 -4 M -1 -34 l -4 -4 M -1 -30 l 5 -4 M -1 -34 l 4 -4" stroke="#b9ae90" strokeWidth="1.1" />
            </g>
          ))}
        </g>
      )}
    </g>
  );
}

export const month08: ReactNode[] = [
  // 0 — Full Moon (芒に月), bright. Half of Tsukimi-zake.
  <g key="m8-0">
    <circle cx={CARD_W / 2} cy={58} r={30} fill={PALETTE.red} />
    <circle cx={CARD_W / 2} cy={58} r={30} fill="none" stroke={PALETTE.deepRed} strokeWidth="1.4" />
    <PampasHill />
  </g>,

  // 1 — Geese (芒に雁), tane. Three geese crossing a pale sky.
  <g key="m8-1">
    <PampasHill plumes={false} />
    {[
      { x: 40, y: 46, s: 1 },
      { x: 74, y: 34, s: 0.9 },
      { x: 66, y: 66, s: 0.85 },
    ].map((g, i) => (
      <g key={i} transform={`translate(${g.x} ${g.y}) scale(${g.s})`}>
        <ellipse cx="0" cy="0" rx="15" ry="8" fill="#5d5a4e" stroke={PALETTE.ink} strokeWidth="1.1" />
        <path d="M-4 2 C 2 7, 9 7, 13 2 C 8 5, 2 5, -4 2 Z" fill="#d8d2be" />
        <circle cx="13" cy="-5" r="5" fill="#5d5a4e" stroke={PALETTE.ink} strokeWidth="1" />
        <circle cx="14.5" cy="-6" r="1.3" fill={PALETTE.white} />
        <path d="M18 -5 L 25 -3.5 L 18 -2 Z" fill={PALETTE.gold} />
        {/* Raised wings. */}
        <path d="M-2 -4 C 4 -18, 18 -16, 15 -4 C 10 -12, 3 -10, -2 -4 Z" fill="#43413a" stroke={PALETTE.ink} strokeWidth="0.9" />
        <path d="M-4 -3 C -12 -16, -24 -12, -20 -2 C -16 -9, -9 -8, -4 -3 Z" fill="#43413a" stroke={PALETTE.ink} strokeWidth="0.9" />
        <path d="M-14 1 C -24 3, -27 8, -20 9 L -8 4 Z" fill="#43413a" stroke={PALETTE.ink} strokeWidth="0.8" />
      </g>
    ))}
  </g>,

  // 2 — Chaff.
  <g key="m8-2">
    <PampasHill />
  </g>,

  // 3 — Chaff.
  <g key="m8-3">
    <path
      d={`M4 ${CARD_H - 4} L4 116 C 34 92, 70 90, ${CARD_W - 4} 106 L ${CARD_W - 4} ${CARD_H - 4} Z`}
      fill={HILL}
    />
    <g>
      {[
        [24, 120, -20],
        [44, 108, -6],
        [64, 104, 6],
        [84, 108, 14],
        [102, 118, 22],
        [40, 146, -10],
        [76, 148, 8],
      ].map(([x, y, tilt], i) => (
        <g key={i} transform={`translate(${x} ${y}) rotate(${tilt})`}>
          <path d="M0 0 C 1 -12, 0 -20, -1 -26" stroke="#6b6252" strokeWidth="1.6" fill="none" />
          <path d="M-1 -26 C -6 -32, -4 -38, -1 -40 C 2 -38, 4 -32, -1 -26 Z" fill="#b9ae90" />
          <path d="M-1 -30 l -5 -4 M -1 -34 l -4 -4 M -1 -30 l 5 -4 M -1 -34 l 4 -4" stroke="#b9ae90" strokeWidth="1.1" />
        </g>
      ))}
    </g>
  </g>,
];
