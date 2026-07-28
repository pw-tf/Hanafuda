/** February — Ume (Plum blossom, 梅). Bush warbler tane, poetry ribbon, two chaff. */
import type { ReactNode } from 'react';
import { Blossom, Branch, CloudBand, PALETTE, Ribbon } from './primitives';

function PlumBranch({ extra = false }: { extra?: boolean }) {
  return (
    <g>
      <Branch d="M28 178 C 36 148, 30 126, 44 104 C 56 86, 50 70, 64 54" width={5} />
      <Branch d="M44 106 C 62 100, 74 106, 88 96" width={3} />
      <Branch d="M38 138 C 24 132, 20 120, 26 110" width={2.6} />
      <Blossom x={64} y={50} r={10} />
      <Blossom x={90} y={92} r={9} />
      <Blossom x={26} y={106} r={8} />
      {extra && (
        <>
          <Blossom x={46} y={78} r={8.5} />
          <Blossom x={78} y={122} r={9} />
          <Blossom x={36} y={152} r={7.5} />
        </>
      )}
    </g>
  );
}

export const month02: ReactNode[] = [
  // 0 — Bush Warbler (梅に鶯), tane.
  <g key="m2-0">
    <CloudBand y={4} height={28} fill={PALETTE.red} flip />
    <PlumBranch />
    {/* Warbler: olive-green body, pale belly, dark eye stripe. */}
    <g transform="translate(58 132)">
      <ellipse cx="0" cy="0" rx="22" ry="15" fill="#7f8f4a" stroke={PALETTE.ink} strokeWidth="1.3" />
      <path d="M-6 4 C 2 12, 14 12, 20 4 C 12 10, 2 10, -6 4 Z" fill="#cfd6a8" />
      <circle cx="16" cy="-7" r="7.5" fill="#7f8f4a" stroke={PALETTE.ink} strokeWidth="1.3" />
      <circle cx="18" cy="-8" r="1.8" fill={PALETTE.ink} />
      <path d="M23 -7 L 32 -5 L 23 -3 Z" fill={PALETTE.gold} />
      <path d="M-20 -2 C -34 2, -38 10, -30 14 L -14 6 Z" fill="#5f6d35" stroke={PALETTE.ink} strokeWidth="1" />
      <path d="M-4 -6 C 6 -14, 16 -10, 14 -2 C 8 -8, 2 -8, -4 -6 Z" fill="#5f6d35" />
    </g>
  </g>,

  // 1 — Poetry ribbon (梅に赤短).
  <g key="m2-1">
    <PlumBranch extra />
    <Ribbon color="red-poetry" />
  </g>,

  // 2 — Chaff.
  <g key="m2-2">
    <PlumBranch extra />
  </g>,

  // 3 — Chaff.
  <g key="m2-3">
    <PlumBranch />
    <Blossom x={58} y={158} r={9} />
    <Blossom x={92} y={140} r={8} />
  </g>,
];
