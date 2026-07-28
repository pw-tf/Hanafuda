/** October — Momiji (Maple, 紅葉). Deer tane, blue ribbon, two chaff. */
import type { ReactNode } from 'react';
import { GroundMound, PALETTE, Ribbon } from './primitives';

/** A seven-lobed maple leaf in autumn red. */
function MapleLeaf({
  x,
  y,
  scale = 1,
  rotate = 0,
  fill = '#c9432c',
  edge = '#8f2a19',
}: {
  x: number;
  y: number;
  scale?: number;
  rotate?: number;
  fill?: string;
  edge?: string;
}) {
  return (
    <g transform={`translate(${x} ${y}) rotate(${rotate}) scale(${scale})`}>
      <path
        d="M0 10 L -3 4 L -12 7 L -8 0 L -16 -4 L -8 -6 L -12 -14 L -3 -11 L 0 -20
           L 3 -11 L 12 -14 L 8 -6 L 16 -4 L 8 0 L 12 7 L 3 4 Z"
        fill={fill}
        stroke={edge}
        strokeWidth="0.9"
        strokeLinejoin="round"
      />
      <path d="M0 10 V -16 M0 -2 L -9 -5 M0 -2 L 9 -5 M0 4 L -7 6 M0 4 L 7 6" stroke={edge} strokeWidth="0.7" fill="none" />
      <path d="M0 10 L 0 16" stroke={PALETTE.brown} strokeWidth="1.4" strokeLinecap="round" />
    </g>
  );
}

function MapleBranch({ dense = false }: { dense?: boolean }) {
  return (
    <g>
      <path d="M18 176 C 28 148, 22 126, 38 106 C 52 88, 48 74, 62 58" stroke={PALETTE.brown} strokeWidth="4.5" fill="none" strokeLinecap="round" />
      <path d="M40 108 C 60 102, 76 108, 94 96" stroke={PALETTE.brown} strokeWidth="3" fill="none" strokeLinecap="round" />
      <MapleLeaf x={62} y={50} scale={1} rotate={-14} />
      <MapleLeaf x={96} y={90} scale={0.9} rotate={22} />
      <MapleLeaf x={30} y={124} scale={0.85} rotate={-34} fill="#d96a2c" edge="#a4441a" />
      {dense && (
        <>
          <MapleLeaf x={46} y={82} scale={0.9} rotate={8} fill="#d96a2c" edge="#a4441a" />
          <MapleLeaf x={78} y={128} scale={0.95} rotate={-24} />
          <MapleLeaf x={24} y={92} scale={0.7} rotate={40} />
        </>
      )}
    </g>
  );
}

export const month10: ReactNode[] = [
  // 0 — Deer (紅葉に鹿), tane. Part of Ino-Shika-Cho. The deer famously looks
  // away from the maple, which is the origin of the phrase "shika to" (to ignore).
  <g key="m10-0">
    <MapleBranch />
    <GroundMound fill="#6f7a4e" y={162} />
    <g transform="translate(58 146)">
      <ellipse cx="0" cy="0" rx="30" ry="17" fill="#a9743f" stroke={PALETTE.ink} strokeWidth="1.3" />
      {/* Dappled coat. */}
      <g fill="#e8d3a8">
        <circle cx="-14" cy="-5" r="2.6" />
        <circle cx="-4" cy="-8" r="2.4" />
        <circle cx="6" cy="-5" r="2.6" />
        <circle cx="-9" cy="3" r="2.2" />
        <circle cx="2" cy="4" r="2.2" />
        <circle cx="14" cy="-2" r="2.4" />
      </g>
      {/* Neck and head, turned back over the shoulder. */}
      <path d="M-24 -8 C -34 -20, -36 -34, -30 -40 C -24 -44, -18 -38, -18 -28 C -18 -18, -20 -12, -18 -8 Z" fill="#a9743f" stroke={PALETTE.ink} strokeWidth="1.2" />
      <path d="M-31 -38 C -40 -44, -44 -42, -44 -38 C -44 -34, -38 -32, -31 -33 Z" fill="#9a672f" stroke={PALETTE.ink} strokeWidth="1.1" />
      <circle cx="-35" cy="-39" r="1.6" fill={PALETTE.ink} />
      {/* Antlers. */}
      <g stroke="#6d4a22" strokeWidth="2.4" fill="none" strokeLinecap="round">
        <path d="M-28 -42 C -30 -52, -26 -58, -22 -60" />
        <path d="M-28 -50 L -35 -55" />
        <path d="M-24 -44 C -20 -52, -16 -55, -12 -55" />
        <path d="M-20 -50 L -14 -58" />
      </g>
      {/* Ear. */}
      <path d="M-22 -40 C -26 -48, -32 -48, -31 -41 Z" fill="#9a672f" stroke={PALETTE.ink} strokeWidth="1" />
      {/* Legs and tail. */}
      <path d="M-16 14 l -3 16 M -4 16 l -1 14 M 10 16 l 2 14 M 22 12 l 4 16" stroke="#8e5f2f" strokeWidth="4" strokeLinecap="round" />
      <path d="M29 -8 C 36 -14, 40 -8, 35 -3" stroke="#8e5f2f" strokeWidth="3" fill="none" strokeLinecap="round" />
    </g>
  </g>,

  // 1 — Blue ribbon (紅葉に青短).
  <g key="m10-1">
    <MapleBranch dense />
    <Ribbon color="blue" />
  </g>,

  // 2 — Chaff.
  <g key="m10-2">
    <MapleBranch dense />
    <MapleLeaf x={62} y={158} scale={0.9} rotate={16} />
  </g>,

  // 3 — Chaff.
  <g key="m10-3">
    <MapleBranch />
    <MapleLeaf x={54} y={150} scale={1.05} rotate={-8} fill="#d96a2c" edge="#a4441a" />
    <MapleLeaf x={92} y={140} scale={0.85} rotate={30} />
    <MapleLeaf x={34} y={68} scale={0.75} rotate={-40} />
  </g>,
];
