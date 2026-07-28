/** July — Hagi (Bush clover, 萩). Boar tane, plain red ribbon, two chaff. */
import type { ReactNode } from 'react';
import { GroundMound, PALETTE, Ribbon } from './primitives';

/** An arching bush-clover stem hung with small magenta flowers. */
function CloverStem({
  x,
  y,
  bend = 40,
  height = 90,
  flip = false,
}: {
  x: number;
  y: number;
  bend?: number;
  height?: number;
  flip?: boolean;
}) {
  const dir = flip ? -1 : 1;
  const tipX = x + dir * bend;
  const tipY = y - height;
  const flowers = Array.from({ length: 6 }, (_, i) => {
    const t = (i + 1) / 7;
    return {
      fx: x + dir * bend * t * t,
      fy: y - height * t,
    };
  });

  return (
    <g>
      <path
        d={`M ${x} ${y} Q ${x + dir * bend * 0.15} ${y - height * 0.6} ${tipX} ${tipY}`}
        stroke={PALETTE.deepGreen}
        strokeWidth="2.4"
        fill="none"
        strokeLinecap="round"
      />
      {flowers.map((f, i) => (
        <g key={i}>
          <ellipse cx={f.fx + dir * 5} cy={f.fy} rx="4.6" ry="3.4" fill="#c2317a" stroke="#8e1f57" strokeWidth="0.6" />
          <ellipse cx={f.fx - dir * 4} cy={f.fy + 6} rx="4" ry="3" fill="#dd5a9a" stroke="#8e1f57" strokeWidth="0.6" />
          <ellipse cx={f.fx + dir * 2} cy={f.fy - 6} rx="3.4" ry="2.6" fill="#3f7d4a" stroke={PALETTE.deepGreen} strokeWidth="0.5" />
        </g>
      ))}
    </g>
  );
}

function CloverBush({ dense = false }: { dense?: boolean }) {
  return (
    <g>
      <CloverStem x={40} y={176} bend={34} height={96} flip />
      <CloverStem x={62} y={180} bend={44} height={110} />
      <CloverStem x={86} y={176} bend={26} height={82} />
      {dense && (
        <>
          <CloverStem x={24} y={180} bend={22} height={70} flip />
          <CloverStem x={102} y={178} bend={30} height={92} />
          <CloverStem x={72} y={182} bend={16} height={62} flip />
        </>
      )}
    </g>
  );
}

export const month07: ReactNode[] = [
  // 0 — Boar (萩に猪), tane. Part of Ino-Shika-Cho.
  <g key="m7-0">
    <CloverBush />
    <GroundMound fill="#6f7a4e" y={158} />
    <g transform="translate(60 148)">
      {/* Body. */}
      <ellipse cx="0" cy="0" rx="34" ry="20" fill="#5b4a3f" stroke={PALETTE.ink} strokeWidth="1.4" />
      {/* Bristled back. */}
      <path
        d="M-30 -12 l 5 -8 l 4 7 l 5 -9 l 4 8 l 5 -9 l 4 8 l 5 -8 l 4 7 l 5 -7"
        fill="none"
        stroke="#3b2f27"
        strokeWidth="2.2"
        strokeLinejoin="round"
      />
      {/* Head and snout. */}
      <path d="M26 -8 C 40 -8, 48 0, 44 8 C 40 15, 28 16, 22 10 Z" fill="#4a3c33" stroke={PALETTE.ink} strokeWidth="1.3" />
      <ellipse cx="45" cy="5" rx="5" ry="4" fill="#3b2f27" />
      <circle cx="47" cy="4" r="1" fill={PALETTE.ink} />
      <circle cx="43" cy="6" r="1" fill={PALETTE.ink} />
      <circle cx="32" cy="-3" r="2" fill={PALETTE.ink} />
      {/* Tusk. */}
      <path d="M42 10 C 46 12, 48 9, 47 6" stroke={PALETTE.white} strokeWidth="2.2" fill="none" strokeLinecap="round" />
      {/* Ear. */}
      <path d="M24 -10 C 26 -20, 34 -20, 33 -11 Z" fill="#3b2f27" stroke={PALETTE.ink} strokeWidth="1" />
      {/* Legs. */}
      <path d="M-18 16 l -3 14 M -6 19 l -1 12 M 10 19 l 2 12 M 22 15 l 4 13" stroke="#3b2f27" strokeWidth="4.5" strokeLinecap="round" />
      {/* Tail. */}
      <path d="M-33 -6 C -42 -10, -44 -2, -38 2" stroke="#3b2f27" strokeWidth="2.4" fill="none" strokeLinecap="round" />
    </g>
  </g>,

  // 1 — Plain red ribbon (萩に短冊).
  <g key="m7-1">
    <CloverBush dense />
    <Ribbon color="red-plain" />
  </g>,

  // 2 — Chaff.
  <g key="m7-2">
    <CloverBush dense />
    <GroundMound fill="#6f7a4e" y={176} />
  </g>,

  // 3 — Chaff.
  <g key="m7-3">
    <CloverBush />
    <CloverStem x={30} y={150} bend={28} height={74} flip />
    <CloverStem x={98} y={156} bend={24} height={68} />
    <GroundMound fill="#6f7a4e" y={176} />
  </g>,
];
