/**
 * April — Fuji (Wisteria, 藤). Cuckoo tane, plain red ribbon, two chaff.
 * Wisteria is drawn hanging downward from the top of the card, as on a real deck.
 */
import type { ReactNode } from 'react';
import { CARD_W, CloudBand, Leaf, PALETTE, Ribbon } from './primitives';

/** A hanging raceme of wisteria flowers. */
function WisteriaCluster({ x, y, length = 60, scale = 1 }: { x: number; y: number; length?: number; scale?: number }) {
  const beads = Math.round(length / 9);
  return (
    <g transform={`translate(${x} ${y}) scale(${scale})`}>
      <path d={`M0 0 Q 4 ${length / 2} -2 ${length}`} stroke={PALETTE.deepGreen} strokeWidth="1.6" fill="none" />
      {Array.from({ length: beads }, (_, i) => {
        const t = i / beads;
        const w = 9 * (1 - t * 0.55);
        return (
          <ellipse
            key={i}
            cx={t * -2 + (i % 2 === 0 ? -3 : 3)}
            cy={i * 9 + 4}
            rx={w}
            ry={w * 0.72}
            fill={i % 2 === 0 ? PALETTE.purple : '#9366b8'}
            stroke="#5f3a7d"
            strokeWidth="0.7"
          />
        );
      })}
    </g>
  );
}

function WisteriaVine({ extra = false }: { extra?: boolean }) {
  return (
    <g>
      {/* The vine runs along the top and the flowers hang from it. */}
      <path d="M8 24 C 40 14, 78 32, 112 20" stroke={PALETTE.brown} strokeWidth="4" fill="none" strokeLinecap="round" />
      <Leaf x={20} y={30} rotate={28} scale={0.7} />
      <Leaf x={74} y={32} rotate={-16} scale={0.7} />
      <WisteriaCluster x={30} y={26} length={72} />
      <WisteriaCluster x={92} y={22} length={58} scale={0.9} />
      {extra && (
        <>
          <WisteriaCluster x={60} y={30} length={86} scale={1.05} />
          <Leaf x={44} y={36} rotate={40} scale={0.6} />
        </>
      )}
    </g>
  );
}

export const month04: ReactNode[] = [
  // 0 — Cuckoo (藤に不如帰), tane. A dark cuckoo crossing a red night sky.
  <g key="m4-0">
    <CloudBand y={4} height={30} fill={PALETTE.red} flip />
    <WisteriaVine />
    <circle cx={30} cy={150} r={17} fill={PALETTE.red} opacity="0.9" />
    <g transform="translate(66 128) rotate(-12)">
      <ellipse cx="0" cy="0" rx="24" ry="13" fill="#3d4450" stroke={PALETTE.ink} strokeWidth="1.3" />
      <path d="M-8 2 C 2 9, 14 9, 20 2 C 12 7, 2 7, -8 2 Z" fill="#c9ccd4" />
      <circle cx="19" cy="-8" r="7" fill="#3d4450" stroke={PALETTE.ink} strokeWidth="1.2" />
      <circle cx="21" cy="-9" r="1.7" fill={PALETTE.white} />
      <path d="M26 -8 L 35 -6 L 26 -4 Z" fill={PALETTE.gold} />
      {/* Spread wing and long tail. */}
      <path d="M-2 -6 C 10 -22, 26 -18, 22 -4 C 14 -14, 6 -12, -2 -6 Z" fill="#2c323c" stroke={PALETTE.ink} strokeWidth="1" />
      <path d="M-22 -2 C -40 2, -46 10, -36 14 L -16 6 Z" fill="#2c323c" stroke={PALETTE.ink} strokeWidth="1" />
    </g>
  </g>,

  // 1 — Plain red ribbon (藤に短冊).
  <g key="m4-1">
    <WisteriaVine extra />
    <Ribbon color="red-plain" />
  </g>,

  // 2 — Chaff.
  <g key="m4-2">
    <WisteriaVine extra />
    <WisteriaCluster x={16} y={28} length={54} scale={0.85} />
  </g>,

  // 3 — Chaff.
  <g key="m4-3">
    <WisteriaVine />
    <WisteriaCluster x={CARD_W - 24} y={30} length={80} scale={0.95} />
    <Leaf x={54} y={150} rotate={12} scale={0.8} />
  </g>,
];
