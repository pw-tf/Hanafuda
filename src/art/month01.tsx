/** January — Matsu (Pine, 松). Crane & Sun bright, poetry ribbon, two chaff. */
import type { ReactNode } from 'react';
import { Blossom, CARD_H, CARD_W, CloudBand, GroundMound, PALETTE, PineSprig, Ribbon } from './primitives';

/** The pine trunk and needle clusters shared by all four January cards. */
function PineTree({ dense = false }: { dense?: boolean }) {
  return (
    <g>
      <path
        d="M34 176 C 40 150, 34 128, 44 108 C 52 92, 46 78, 56 64"
        stroke={PALETTE.brown}
        strokeWidth="5"
        fill="none"
        strokeLinecap="round"
      />
      <path d="M44 112 C 58 106, 70 112, 80 104" stroke={PALETTE.brown} strokeWidth="3.5" fill="none" strokeLinecap="round" />
      <PineSprig x={56} y={62} scale={1.15} />
      <PineSprig x={80} y={102} scale={0.95} rotate={28} />
      <PineSprig x={40} y={122} scale={0.85} rotate={-32} />
      {dense && (
        <>
          <PineSprig x={86} y={66} scale={0.9} rotate={16} />
          <PineSprig x={30} y={92} scale={0.8} rotate={-20} />
        </>
      )}
    </g>
  );
}

export const month01: ReactNode[] = [
  // 0 — Crane and Sun (松に鶴), bright.
  <g key="m1-0">
    <CloudBand y={4} height={30} fill={PALETTE.gold} flip />
    <GroundMound fill={PALETTE.deepGreen} y={172} />
    {/* The red sun disc. */}
    <circle cx={82} cy={46} r={22} fill={PALETTE.red} />
    <PineTree />
    {/* Crane: white body, black flight feathers and neck, red crown. */}
    <g>
      <ellipse cx={62} cy={132} rx={26} ry={17} fill={PALETTE.white} stroke={PALETTE.ink} strokeWidth="1.4" />
      <path d="M74 126 C 84 118, 86 102, 80 92" stroke={PALETTE.ink} strokeWidth="4.5" fill="none" strokeLinecap="round" />
      <circle cx={79} cy={89} r={5.5} fill={PALETTE.white} stroke={PALETTE.ink} strokeWidth="1.4" />
      <path d="M77 85 a 4 4 0 0 1 5 0" fill={PALETTE.red} />
      <path d="M84 89 L 93 91 L 84 93 Z" fill={PALETTE.gold} />
      <path d="M40 128 C 26 132, 22 142, 30 148 L 46 140 Z" fill={PALETTE.ink} />
      <path d="M52 148 L 50 164 M 68 148 L 70 164" stroke={PALETTE.ink} strokeWidth="2.2" strokeLinecap="round" />
    </g>
  </g>,

  // 1 — Poetry ribbon (松に赤短).
  <g key="m1-1">
    <PineTree dense />
    <Ribbon color="red-poetry" />
  </g>,

  // 2 — Chaff.
  <g key="m1-2">
    <PineTree dense />
    <GroundMound fill={PALETTE.deepGreen} y={178} />
  </g>,

  // 3 — Chaff.
  <g key="m1-3">
    <PineTree />
    <Blossom x={88} y={140} r={8} petal={PALETTE.white} stroke={PALETTE.grey} />
    <Blossom x={30} y={150} r={7} petal={PALETTE.white} stroke={PALETTE.grey} />
    <GroundMound fill={PALETTE.deepGreen} y={178} />
    <rect x={CARD_W - 30} y={CARD_H - 14} width={0} height={0} fill="none" />
  </g>,
];
