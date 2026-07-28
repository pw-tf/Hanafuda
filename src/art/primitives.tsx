/**
 * Shared drawing primitives for the 48 card faces.
 *
 * All card art is authored here as SVG rather than shipped as images: it stays
 * crisp at any size, costs no network requests, and carries no licensing
 * question. Every card draws into the same `VIEWBOX`, so all 48 are
 * dimensionally identical and can be laid out on a uniform grid.
 *
 * The palette follows a traditional Nintendo-style deck: a cream ground, heavy
 * ink outlines, deep red, and gold.
 */

import type { ReactNode } from 'react';

/** Card art coordinate space. Real hanafuda are roughly 3:5. */
export const CARD_W = 120;
export const CARD_H = 200;
export const VIEWBOX = `0 0 ${CARD_W} ${CARD_H}`;

export const PALETTE = {
  ground: '#f4ead6',
  groundEdge: '#e6d8ba',
  ink: '#1a1a1a',
  red: '#d93b30',
  deepRed: '#a8261d',
  gold: '#e8b423',
  darkGold: '#c08a10',
  blue: '#4a5cae',
  deepBlue: '#33408a',
  purple: '#7b4fa0',
  green: '#3f7d4a',
  deepGreen: '#2c5a35',
  white: '#fbf7ee',
  grey: '#8d8878',
  brown: '#7a5230',
  black: '#232323',
  pink: '#f0a6b8',
  deepPink: '#d4718c',
  yellow: '#f2cf52',
} as const;

/**
 * The card body: cream ground with the characteristic black border.
 * Every card face renders `<CardBase>` first, then its motif on top.
 */
export function CardBase({ children }: { children: ReactNode }) {
  return (
    <>
      <rect x="0" y="0" width={CARD_W} height={CARD_H} rx="10" fill={PALETTE.ink} />
      <rect
        x="3"
        y="3"
        width={CARD_W - 6}
        height={CARD_H - 6}
        rx="8"
        fill={PALETTE.ground}
        stroke={PALETTE.groundEdge}
        strokeWidth="1"
      />
      {children}
    </>
  );
}

/**
 * The red "cloud" band found at the top and bottom of many traditional cards.
 * Drawn as a scalloped edge rather than a plain rectangle.
 */
export function CloudBand({
  y,
  height = 34,
  fill = PALETTE.red,
  flip = false,
}: {
  y: number;
  height?: number;
  fill?: string;
  flip?: boolean;
}) {
  const scallopR = 9;
  const edgeY = flip ? y : y + height;
  const bodyY = flip ? y + scallopR : y;
  const bodyH = height - scallopR;

  const bumps: string[] = [];
  for (let x = 6; x < CARD_W - 6; x += scallopR * 2) {
    bumps.push(
      `M ${x} ${edgeY} a ${scallopR} ${scallopR} 0 0 ${flip ? 1 : 0} ${scallopR * 2} 0 Z`,
    );
  }

  return (
    <g>
      <rect x="4" y={bodyY} width={CARD_W - 8} height={bodyH} fill={fill} />
      {bumps.map((d, i) => (
        <path key={i} d={d} fill={fill} />
      ))}
    </g>
  );
}

/**
 * A ribbon (tanzaku). Poetry ribbons carry brush strokes standing in for the
 * written characters — that mark is what distinguishes them from the plain red
 * ribbons, and it is load-bearing for the Akatan yaku, so it is always drawn.
 */
export function Ribbon({ color }: { color: 'red-poetry' | 'red-plain' | 'blue' }) {
  const fill = color === 'blue' ? PALETTE.blue : PALETTE.red;
  const edge = color === 'blue' ? PALETTE.deepBlue : PALETTE.deepRed;

  return (
    <g>
      {/* Ribbon body, tilted the way it sits on a real card. */}
      <g transform={`rotate(-8 ${CARD_W / 2} ${CARD_H / 2})`}>
        <rect x="42" y="34" width="34" height="132" rx="4" fill={fill} stroke={edge} strokeWidth="2" />
        <rect x="46" y="38" width="26" height="124" rx="3" fill="none" stroke={edge} strokeWidth="0.8" opacity="0.5" />
        {color === 'red-poetry' && (
          // Brush-stroke marks for the written characters (みよしの / あかよろし).
          <g stroke={PALETTE.ink} strokeWidth="2.4" strokeLinecap="round" opacity="0.85">
            <path d="M52 52 H66" />
            <path d="M59 48 V62" />
            <path d="M53 74 H65" />
            <path d="M55 82 H63" />
            <path d="M52 98 H66" />
            <path d="M59 94 V108" />
            <path d="M54 122 H64" />
            <path d="M59 116 V132" />
            <path d="M53 146 H65" />
          </g>
        )}
      </g>
    </g>
  );
}

/**
 * Five-petal blossom.
 *
 * The two variants matter: plum (February) has rounded petals in a deep pink,
 * cherry (March) has paler petals with the notched tip that distinguishes
 * sakura at a glance. Drawing both the same way would make two different
 * suits look identical on the board.
 */
export function Blossom({
  x,
  y,
  r = 9,
  variant = 'plum',
  petal,
  center = PALETTE.gold,
  stroke,
}: {
  x: number;
  y: number;
  r?: number;
  variant?: 'plum' | 'cherry';
  petal?: string;
  center?: string;
  stroke?: string;
}) {
  const isCherry = variant === 'cherry';
  const fill = petal ?? (isCherry ? '#f7c3d2' : PALETTE.pink);
  const edge = stroke ?? (isCherry ? '#dd8fa8' : PALETTE.deepPink);
  const angles = [0, 72, 144, 216, 288];

  return (
    <g transform={`translate(${x} ${y})`}>
      {angles.map((a) =>
        isCherry ? (
          // Notched petal, drawn pointing up then rotated into place.
          <path
            key={a}
            transform={`rotate(${a}) scale(${r / 9})`}
            d="M0 -1 C -4.2 -2.4, -5 -7, -2.6 -8.8 L 0 -6.6 L 2.6 -8.8 C 5 -7, 4.2 -2.4, 0 -1 Z"
            fill={fill}
            stroke={edge}
            strokeWidth="0.7"
          />
        ) : (
          <circle
            key={a}
            cx={Math.cos((a * Math.PI) / 180) * r * 0.62}
            cy={Math.sin((a * Math.PI) / 180) * r * 0.62}
            r={r * 0.46}
            fill={fill}
            stroke={edge}
            strokeWidth="0.7"
          />
        ),
      )}
      <circle cx="0" cy="0" r={r * 0.26} fill={center} />
    </g>
  );
}

/** Pine needle spray. */
export function PineSprig({ x, y, scale = 1, rotate = 0 }: { x: number; y: number; scale?: number; rotate?: number }) {
  const needles = [-52, -30, -10, 10, 30, 52];
  return (
    <g transform={`translate(${x} ${y}) rotate(${rotate}) scale(${scale})`}>
      {needles.map((a) => {
        const rad = (a * Math.PI) / 180;
        return (
          <line
            key={a}
            x1="0"
            y1="0"
            x2={Math.sin(rad) * 15}
            y2={-Math.cos(rad) * 15}
            stroke={PALETTE.deepGreen}
            strokeWidth="1.8"
            strokeLinecap="round"
          />
        );
      })}
    </g>
  );
}

/** Branch stroke shared by several suits. */
export function Branch({ d, width = 4 }: { d: string; width?: number }) {
  return <path d={d} stroke={PALETTE.brown} strokeWidth={width} fill="none" strokeLinecap="round" />;
}

/** Generic leaf shape. */
export function Leaf({
  x,
  y,
  rotate = 0,
  scale = 1,
  fill = PALETTE.green,
}: {
  x: number;
  y: number;
  rotate?: number;
  scale?: number;
  fill?: string;
}) {
  return (
    <path
      transform={`translate(${x} ${y}) rotate(${rotate}) scale(${scale})`}
      d="M0 0 C 10 -8, 22 -6, 26 0 C 22 6, 10 8, 0 0 Z"
      fill={fill}
      stroke={PALETTE.deepGreen}
      strokeWidth="0.8"
    />
  );
}

/** Pampas / bush-clover style grass blades. */
export function Grass({
  x,
  y,
  count = 5,
  height = 46,
  color = PALETTE.deepGreen,
}: {
  x: number;
  y: number;
  count?: number;
  height?: number;
  color?: string;
}) {
  return (
    <g>
      {Array.from({ length: count }, (_, i) => {
        const spread = (i - (count - 1) / 2) * 9;
        return (
          <path
            key={i}
            d={`M ${x + spread * 0.3} ${y} Q ${x + spread} ${y - height * 0.6} ${x + spread * 1.9} ${y - height}`}
            stroke={color}
            strokeWidth="2"
            fill="none"
            strokeLinecap="round"
          />
        );
      })}
    </g>
  );
}

/** Reusable dark hill/ground mound at the base of a card. */
export function GroundMound({ fill = PALETTE.deepGreen, y = 168 }: { fill?: string; y?: number }) {
  return <path d={`M4 ${CARD_H - 4} L4 ${y} Q ${CARD_W / 2} ${y - 18} ${CARD_W - 4} ${y} L ${CARD_W - 4} ${CARD_H - 4} Z`} fill={fill} />;
}
