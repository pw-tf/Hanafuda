/** May — Ayame (Iris, 菖蒲). Eight-plank Bridge tane, plain red ribbon, two chaff. */
import type { ReactNode } from 'react';
import { CARD_H, PALETTE, Ribbon } from './primitives';

/** A single iris: three drooping falls, upright standards, yellow signal. */
function Iris({ x, y, scale = 1 }: { x: number; y: number; scale?: number }) {
  return (
    <g transform={`translate(${x} ${y}) scale(${scale})`}>
      <path d="M0 0 C -14 -4, -18 8, -8 14 C -2 10, 0 6, 0 0 Z" fill="#6a5bb0" stroke="#43377d" strokeWidth="0.8" />
      <path d="M0 0 C 14 -4, 18 8, 8 14 C 2 10, 0 6, 0 0 Z" fill="#6a5bb0" stroke="#43377d" strokeWidth="0.8" />
      <path d="M0 2 C -6 12, 0 20, 0 20 C 0 20, 6 12, 0 2 Z" fill="#5a4b9e" stroke="#43377d" strokeWidth="0.8" />
      <path d="M0 -2 C -7 -14, -2 -22, 0 -22 C 2 -22, 7 -14, 0 -2 Z" fill="#7d6ec4" stroke="#43377d" strokeWidth="0.8" />
      <path d="M-3 1 C -10 -6, -12 -14, -9 -16" stroke="#7d6ec4" strokeWidth="3" fill="none" strokeLinecap="round" />
      <path d="M3 1 C 10 -6, 12 -14, 9 -16" stroke="#7d6ec4" strokeWidth="3" fill="none" strokeLinecap="round" />
      <path d="M-3 4 L 3 4 L 1 10 L -1 10 Z" fill={PALETTE.gold} />
    </g>
  );
}

/** Sword-shaped iris leaves. */
function IrisLeaves({ dense = false }: { dense?: boolean }) {
  const blades: Array<[number, number, number]> = dense
    ? [
        [24, 178, 118],
        [40, 182, 96],
        [58, 180, 128],
        [76, 182, 104],
        [94, 178, 120],
        [66, 184, 70],
      ]
    : [
        [30, 180, 112],
        [50, 182, 92],
        [72, 180, 122],
        [92, 182, 98],
      ];
  return (
    <g>
      {blades.map(([x, base, h], i) => (
        <path
          key={i}
          d={`M ${x} ${base} Q ${x + (i % 2 === 0 ? -9 : 9)} ${base - h * 0.55} ${x + (i % 2 === 0 ? -3 : 5)} ${base - h}`}
          stroke={PALETTE.deepGreen}
          strokeWidth="4"
          fill="none"
          strokeLinecap="round"
        />
      ))}
    </g>
  );
}

export const month05: ReactNode[] = [
  // 0 — Eight-plank Bridge (菖蒲に八ツ橋), tane. The yatsuhashi zig-zags across water.
  <g key="m5-0">
    {/* Water. */}
    <rect x="4" y="96" width="112" height={CARD_H - 100} fill="#7fa8c9" opacity="0.55" />
    <path d="M8 118 H 112 M8 132 H 112 M8 146 H 112" stroke="#5b86a8" strokeWidth="1.2" opacity="0.7" />
    <IrisLeaves />
    <Iris x={34} y={70} scale={1} />
    <Iris x={88} y={62} scale={0.9} />
    {/* Eight planks laid in the characteristic zig-zag. */}
    <g stroke="#8a5b2c" strokeWidth="7" strokeLinecap="butt">
      <path d="M10 158 L 46 142" />
      <path d="M46 142 L 82 158" />
      <path d="M82 158 L 114 142" />
    </g>
    <g stroke="#5f3c18" strokeWidth="1.4">
      <path d="M10 158 L 46 142 L 82 158 L 114 142" fill="none" />
    </g>
    {/* Plank joins, giving the eight boards. */}
    <g stroke="#5f3c18" strokeWidth="1.2">
      {[22, 34, 58, 70, 94, 106].map((x, i) => {
        const y = i < 2 ? 158 - (x - 10) * 0.44 : i < 4 ? 142 + (x - 46) * 0.44 : 158 - (x - 82) * 0.5;
        return <path key={x} d={`M ${x} ${y - 4} l 2 8`} />;
      })}
    </g>
  </g>,

  // 1 — Plain red ribbon (菖蒲に短冊).
  <g key="m5-1">
    <IrisLeaves dense />
    <Iris x={26} y={64} scale={0.85} />
    <Iris x={98} y={78} scale={0.85} />
    <Ribbon color="red-plain" />
  </g>,

  // 2 — Chaff.
  <g key="m5-2">
    <IrisLeaves dense />
    <Iris x={44} y={62} />
    <Iris x={82} y={92} scale={0.85} />
  </g>,

  // 3 — Chaff.
  <g key="m5-3">
    <IrisLeaves />
    <Iris x={60} y={70} scale={1.1} />
    <Iris x={92} y={110} scale={0.8} />
  </g>,
];
