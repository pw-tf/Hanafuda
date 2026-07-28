/**
 * December — Kiri (Paulownia, 桐). The other irregular month:
 * the Phoenix bright and three chaff, with no tane or tanzaku.
 */
import type { ReactNode } from 'react';
import { CARD_H, CARD_W, PALETTE } from './primitives';

/** Paulownia leaf — broad and heart-shaped. */
function PaulowniaLeaf({
  x,
  y,
  scale = 1,
  rotate = 0,
  fill = '#3f7d4a',
}: {
  x: number;
  y: number;
  scale?: number;
  rotate?: number;
  fill?: string;
}) {
  return (
    <g transform={`translate(${x} ${y}) rotate(${rotate}) scale(${scale})`}>
      <path
        d="M0 20 C -18 12, -22 -6, -12 -16 C -6 -22, 6 -22, 12 -16 C 22 -6, 18 12, 0 20 Z"
        fill={fill}
        stroke={PALETTE.deepGreen}
        strokeWidth="1"
      />
      <path d="M0 20 V -18 M0 2 L -12 -8 M0 2 L 12 -8 M0 10 L -9 3 M0 10 L 9 3" stroke={PALETTE.deepGreen} strokeWidth="0.8" fill="none" />
    </g>
  );
}

/** Upright spray of paulownia blossoms. */
function PaulowniaFlowers({ x, y, scale = 1 }: { x: number; y: number; scale?: number }) {
  return (
    <g transform={`translate(${x} ${y}) scale(${scale})`}>
      {[
        [0, 0, 1],
        [-10, 10, 0.85],
        [10, 12, 0.85],
        [-4, 22, 0.7],
      ].map(([bx, by, s], i) => (
        <g key={i} transform={`translate(${bx} ${by}) scale(${s})`}>
          <ellipse cx="0" cy="0" rx="5" ry="8" fill="#8f79c4" stroke="#5f4d8f" strokeWidth="0.7" />
          <ellipse cx="-4" cy="3" rx="3.4" ry="5.5" fill="#a993d6" stroke="#5f4d8f" strokeWidth="0.6" />
          <ellipse cx="4" cy="3" rx="3.4" ry="5.5" fill="#a993d6" stroke="#5f4d8f" strokeWidth="0.6" />
        </g>
      ))}
    </g>
  );
}

const paulowniaBush = (variant: number): ReactNode => (
  <g>
    <path d="M60 184 C 62 160, 58 142, 62 122" stroke={PALETTE.brown} strokeWidth="4" fill="none" strokeLinecap="round" />
    <PaulowniaLeaf x={34} y={128} scale={1.15} rotate={-22} />
    <PaulowniaLeaf x={86} y={134} scale={1.05} rotate={20} />
    <PaulowniaLeaf x={60} y={158} scale={0.95} rotate={variant % 2 === 0 ? -6 : 8} />
    {variant >= 1 && <PaulowniaLeaf x={26} y={168} scale={0.8} rotate={-40} fill="#4d8f56" />}
    {variant >= 2 && <PaulowniaLeaf x={96} y={170} scale={0.75} rotate={34} fill="#4d8f56" />}
    <PaulowniaFlowers x={44} y={72} scale={1} />
    <PaulowniaFlowers x={82} y={84} scale={0.85} />
  </g>
);

export const month12: ReactNode[] = [
  // 0 — Chinese Phoenix (桐に鳳凰), bright.
  <g key="m12-0">
    <rect x="4" y="4" width={CARD_W - 8} height={CARD_H - 8} rx="8" fill="#e0c56b" />
    <PaulowniaLeaf x={22} y={168} scale={1} rotate={-28} />
    <PaulowniaLeaf x={100} y={172} scale={0.9} rotate={30} />
    {/*
      The phoenix stands in profile facing right. The long tail plumes sweep
      back and to the left and then curl upward — drawing them downward makes
      the bird read as a chicken.
    */}
    <g transform="translate(74 106) scale(0.8)">
      {/* Tail: three long plumes trailing behind and curling up. */}
      <g fill="none" strokeLinecap="round">
        {[
          { d: 'M-14 -2 C -40 4, -56 -14, -50 -44', w: 3.2, c: PALETTE.deepRed },
          { d: 'M-14 4 C -44 14, -58 4, -58 -22', w: 2.8, c: PALETTE.red },
          { d: 'M-13 10 C -38 26, -56 24, -60 2', w: 2.6, c: PALETTE.darkGold },
        ].map((t, i) => (
          <path key={i} d={t.d} stroke={t.c} strokeWidth={t.w} />
        ))}
      </g>
      {/* Plume tips: the eye-spots that mark a phoenix tail. */}
      {[
        { x: -50, y: -44, r: -28, fill: PALETTE.red },
        { x: -58, y: -22, r: -8, fill: PALETTE.gold },
        { x: -60, y: 2, r: 8, fill: PALETTE.red },
      ].map((t, i) => (
        <g key={i} transform={`translate(${t.x} ${t.y}) rotate(${t.r})`}>
          <ellipse cx="-4" cy="0" rx="10" ry="6" fill={t.fill} stroke={PALETTE.ink} strokeWidth="1" />
          <ellipse cx="-5" cy="0" rx="4.5" ry="2.8" fill={PALETTE.white} />
        </g>
      ))}

      {/* Body. */}
      <path
        d="M-14 4 C -18 -12, -6 -24, 8 -22 C 22 -20, 28 -6, 24 8 C 20 22, 2 26, -8 18 C -13 14, -13 9, -14 4 Z"
        fill={PALETTE.white}
        stroke={PALETTE.ink}
        strokeWidth="1.4"
      />
      {/* Folded wing, layered over the body. */}
      <path
        d="M-8 -6 C 4 -16, 20 -12, 24 0 C 18 6, 4 10, -6 4 C -9 1, -9 -3, -8 -6 Z"
        fill={PALETTE.gold}
        stroke={PALETTE.ink}
        strokeWidth="1.2"
      />
      <path d="M-4 -2 C 6 -4, 14 -3, 20 0 M-3 3 C 5 2, 13 3, 19 5" stroke={PALETTE.darkGold} strokeWidth="1" fill="none" />

      {/* Neck and head. */}
      <path d="M8 -20 C 14 -30, 12 -38, 6 -42 C 2 -44, -2 -40, 0 -34 C 2 -28, 2 -24, 0 -20 Z" fill={PALETTE.white} stroke={PALETTE.ink} strokeWidth="1.3" />
      <circle cx="3" cy="-42" r="7" fill={PALETTE.white} stroke={PALETTE.ink} strokeWidth="1.3" />
      <circle cx="5" cy="-43.5" r="1.6" fill={PALETTE.ink} />
      <path d="M9.5 -42 L 19 -40 L 9.5 -38 Z" fill={PALETTE.gold} stroke={PALETTE.ink} strokeWidth="0.8" />
      {/* Crest. */}
      <path d="M-1 -47 C -4 -56, 2 -60, 6 -56" stroke={PALETTE.red} strokeWidth="2.6" fill="none" strokeLinecap="round" />
      <path d="M4 -48 C 4 -58, 12 -60, 13 -54" stroke={PALETTE.red} strokeWidth="2.3" fill="none" strokeLinecap="round" />
      {/* Wattle. */}
      <path d="M2 -36 C -1 -32, 2 -29, 5 -31 Z" fill={PALETTE.red} />

      {/* Legs. */}
      <g stroke={PALETTE.darkGold} strokeWidth="2.4" strokeLinecap="round" fill="none">
        <path d="M2 24 V 36" />
        <path d="M14 22 V 34" />
        <path d="M-3 36 H 7 M9 34 H 19" />
      </g>
    </g>
  </g>,

  // 1 — Chaff.
  <g key="m12-1">{paulowniaBush(0)}</g>,

  // 2 — Chaff.
  <g key="m12-2">{paulowniaBush(1)}</g>,

  // 3 — Chaff (the yellow paulownia).
  <g key="m12-3">
    <rect x="4" y="4" width={CARD_W - 8} height={CARD_H - 8} rx="8" fill="#e0c56b" />
    <g>
      <path d="M60 184 C 62 160, 58 142, 62 122" stroke={PALETTE.brown} strokeWidth="4" fill="none" strokeLinecap="round" />
      <PaulowniaLeaf x={34} y={128} scale={1.15} rotate={-22} fill="#4d8f56" />
      <PaulowniaLeaf x={86} y={134} scale={1.05} rotate={20} fill="#4d8f56" />
      <PaulowniaLeaf x={60} y={158} scale={0.95} rotate={4} fill="#3f7d4a" />
      <PaulowniaFlowers x={44} y={72} scale={1} />
      <PaulowniaFlowers x={82} y={84} scale={0.85} />
    </g>
  </g>,
];
