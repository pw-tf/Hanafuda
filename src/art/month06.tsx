/** June — Botan (Peony, 牡丹). Butterflies tane, blue ribbon, two chaff. */
import type { ReactNode } from 'react';
import { Leaf, PALETTE, Ribbon } from './primitives';

/** A layered peony bloom. */
function Peony({ x, y, scale = 1 }: { x: number; y: number; scale?: number }) {
  const outer = [0, 45, 90, 135, 180, 225, 270, 315];
  const inner = [22, 90, 158, 226, 294];
  return (
    <g transform={`translate(${x} ${y}) scale(${scale})`}>
      {outer.map((a) => {
        const rad = (a * Math.PI) / 180;
        return (
          <ellipse
            key={`o${a}`}
            cx={Math.cos(rad) * 11}
            cy={Math.sin(rad) * 11}
            rx="9"
            ry="7.5"
            transform={`rotate(${a} ${Math.cos(rad) * 11} ${Math.sin(rad) * 11})`}
            fill="#c2317a"
            stroke="#8e1f57"
            strokeWidth="0.8"
          />
        );
      })}
      {inner.map((a) => {
        const rad = (a * Math.PI) / 180;
        return (
          <ellipse
            key={`i${a}`}
            cx={Math.cos(rad) * 5.5}
            cy={Math.sin(rad) * 5.5}
            rx="6.5"
            ry="5.5"
            fill="#dd5a9a"
            stroke="#8e1f57"
            strokeWidth="0.7"
          />
        );
      })}
      <circle cx="0" cy="0" r="4.5" fill={PALETTE.gold} />
    </g>
  );
}

function PeonyPlant({ extra = false }: { extra?: boolean }) {
  return (
    <g>
      <path d="M40 182 C 46 154, 40 134, 52 116" stroke={PALETTE.deepGreen} strokeWidth="3.5" fill="none" strokeLinecap="round" />
      <path d="M86 182 C 82 156, 88 138, 78 120" stroke={PALETTE.deepGreen} strokeWidth="3" fill="none" strokeLinecap="round" />
      <Leaf x={44} y={150} rotate={-24} scale={0.9} />
      <Leaf x={70} y={162} rotate={16} scale={0.9} />
      <Leaf x={30} y={128} rotate={-52} scale={0.8} />
      {extra && (
        <>
          <Leaf x={82} y={140} rotate={34} scale={0.85} />
          <Leaf x={54} y={172} rotate={-8} scale={0.75} />
        </>
      )}
    </g>
  );
}

/** A butterfly with the gold-and-dark markings used on the June card. */
function Butterfly({ x, y, scale = 1, rotate = 0 }: { x: number; y: number; scale?: number; rotate?: number }) {
  return (
    <g transform={`translate(${x} ${y}) rotate(${rotate}) scale(${scale})`}>
      <path d="M0 0 C -16 -18, -30 -12, -26 2 C -22 14, -8 12, 0 0 Z" fill={PALETTE.gold} stroke={PALETTE.ink} strokeWidth="1.1" />
      <path d="M0 0 C 16 -18, 30 -12, 26 2 C 22 14, 8 12, 0 0 Z" fill={PALETTE.gold} stroke={PALETTE.ink} strokeWidth="1.1" />
      <path d="M-19 -6 a 4 4 0 1 0 0.1 0" fill={PALETTE.deepRed} />
      <path d="M19 -6 a 4 4 0 1 0 0.1 0" fill={PALETTE.deepRed} />
      <ellipse cx="0" cy="1" rx="2.6" ry="9" fill={PALETTE.ink} />
      <path d="M-1 -8 C -5 -16, -9 -18, -11 -17" stroke={PALETTE.ink} strokeWidth="1.2" fill="none" strokeLinecap="round" />
      <path d="M1 -8 C 5 -16, 9 -18, 11 -17" stroke={PALETTE.ink} strokeWidth="1.2" fill="none" strokeLinecap="round" />
    </g>
  );
}

export const month06: ReactNode[] = [
  // 0 — Butterflies (牡丹に蝶), tane. Part of Ino-Shika-Cho.
  <g key="m6-0">
    <PeonyPlant />
    <Peony x={40} y={128} scale={0.95} />
    <Peony x={84} y={152} scale={0.8} />
    <Butterfly x={44} y={52} scale={1.05} rotate={-10} />
    <Butterfly x={84} y={86} scale={0.9} rotate={18} />
  </g>,

  // 1 — Blue ribbon (牡丹に青短).
  <g key="m6-1">
    <PeonyPlant extra />
    <Peony x={30} y={70} scale={0.85} />
    <Peony x={96} y={128} scale={0.8} />
    <Ribbon color="blue" />
  </g>,

  // 2 — Chaff.
  <g key="m6-2">
    <PeonyPlant extra />
    <Peony x={58} y={72} scale={1.15} />
    <Peony x={88} y={126} scale={0.85} />
  </g>,

  // 3 — Chaff.
  <g key="m6-3">
    <PeonyPlant />
    <Peony x={62} y={104} scale={1.25} />
    <Peony x={34} y={62} scale={0.75} />
  </g>,
];
