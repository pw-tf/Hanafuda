/** September — Kiku (Chrysanthemum, 菊). Sake Cup tane, blue ribbon, two chaff. */
import type { ReactNode } from 'react';
import { Leaf, PALETTE, Ribbon } from './primitives';

/** A many-petalled chrysanthemum. */
function Mum({
  x,
  y,
  scale = 1,
  petal = PALETTE.yellow,
  edge = PALETTE.darkGold,
}: {
  x: number;
  y: number;
  scale?: number;
  petal?: string;
  edge?: string;
}) {
  const ring = (count: number, r: number, len: number) =>
    Array.from({ length: count }, (_, i) => {
      const a = (i / count) * 360;
      const rad = (a * Math.PI) / 180;
      return (
        <ellipse
          key={`${r}-${i}`}
          cx={Math.cos(rad) * r}
          cy={Math.sin(rad) * r}
          rx={len}
          ry={len * 0.42}
          transform={`rotate(${a} ${Math.cos(rad) * r} ${Math.sin(rad) * r})`}
          fill={petal}
          stroke={edge}
          strokeWidth="0.6"
        />
      );
    });

  return (
    <g transform={`translate(${x} ${y}) scale(${scale})`}>
      {ring(12, 12, 6.5)}
      {ring(9, 6.5, 5)}
      <circle cx="0" cy="0" r="3.6" fill={edge} />
    </g>
  );
}

function MumPlant({ extra = false }: { extra?: boolean }) {
  return (
    <g>
      <path d="M44 182 C 50 156, 44 136, 56 118" stroke={PALETTE.deepGreen} strokeWidth="3.2" fill="none" strokeLinecap="round" />
      <path d="M82 182 C 78 158, 84 142, 76 126" stroke={PALETTE.deepGreen} strokeWidth="2.8" fill="none" strokeLinecap="round" />
      <Leaf x={46} y={152} rotate={-26} scale={0.8} />
      <Leaf x={72} y={164} rotate={18} scale={0.8} />
      {extra && (
        <>
          <Leaf x={34} y={134} rotate={-50} scale={0.7} />
          <Leaf x={86} y={146} rotate={38} scale={0.75} />
        </>
      )}
    </g>
  );
}

export const month09: ReactNode[] = [
  // 0 — Sake Cup (菊に盃), tane. Half of both Hanami-zake and Tsukimi-zake.
  // The cup carries the character 寿 (long life) as on a traditional deck.
  <g key="m9-0">
    <MumPlant />
    <Mum x={34} y={140} scale={0.85} />
    <Mum x={90} y={158} scale={0.7} petal={PALETTE.white} edge={PALETTE.grey} />
    <g transform="translate(60 74)">
      {/* Shallow lacquer cup seen at a slight angle. */}
      <ellipse cx="0" cy="-14" rx="34" ry="12" fill={PALETTE.gold} stroke={PALETTE.deepRed} strokeWidth="2" />
      <ellipse cx="0" cy="-14" rx="27" ry="8.5" fill={PALETTE.deepRed} />
      <path d="M-34 -14 C -32 8, -18 20, 0 20 C 18 20, 32 8, 34 -14 Z" fill={PALETTE.red} stroke={PALETTE.deepRed} strokeWidth="2" />
      {/* Foot. */}
      <path d="M-11 20 L -13 30 L 13 30 L 11 20 Z" fill={PALETTE.deepRed} />
      <ellipse cx="0" cy="30" rx="16" ry="4.5" fill={PALETTE.gold} stroke={PALETTE.deepRed} strokeWidth="1.4" />
      {/* 寿 rendered as brush strokes. */}
      <g stroke={PALETTE.gold} strokeWidth="2.2" strokeLinecap="round" fill="none">
        <path d="M-11 -4 H 11" />
        <path d="M-8 2 H 8" />
        <path d="M-11 8 H 11" />
        <path d="M0 -7 V 14" />
        <path d="M6 8 C 9 12, 7 15, 3 15" />
      </g>
    </g>
  </g>,

  // 1 — Blue ribbon (菊に青短).
  <g key="m9-1">
    <MumPlant extra />
    <Mum x={28} y={64} scale={0.8} />
    <Mum x={98} y={136} scale={0.75} petal={PALETTE.white} edge={PALETTE.grey} />
    <Ribbon color="blue" />
  </g>,

  // 2 — Chaff.
  <g key="m9-2">
    <MumPlant extra />
    <Mum x={58} y={80} scale={1.2} />
    <Mum x={90} y={128} scale={0.8} petal={PALETTE.white} edge={PALETTE.grey} />
  </g>,

  // 3 — Chaff.
  <g key="m9-3">
    <MumPlant />
    <Mum x={60} y={100} scale={1.3} petal={PALETTE.white} edge={PALETTE.grey} />
    <Mum x={32} y={62} scale={0.75} />
  </g>,
];
