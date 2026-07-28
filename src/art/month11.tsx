/**
 * November — Yanagi (Willow, 柳). The irregular month: one card of each kind.
 * Rain Man bright, Swallow tane, plain ribbon, and the Lightning chaff.
 */
import type { ReactNode } from 'react';
import { CARD_H, CARD_W, PALETTE, Ribbon } from './primitives';

/** Trailing willow withes. */
function WillowBranches({ from = 20, count = 5 }: { from?: number; count?: number }) {
  return (
    <g>
      <path d={`M8 ${from} C 40 ${from - 8}, 80 ${from + 6}, 112 ${from - 4}`} stroke={PALETTE.brown} strokeWidth="3.5" fill="none" strokeLinecap="round" />
      {Array.from({ length: count }, (_, i) => {
        const x = 16 + i * ((CARD_W - 32) / (count - 1));
        const len = 70 + ((i * 37) % 40);
        return (
          <g key={i}>
            <path
              d={`M ${x} ${from} Q ${x + 8} ${from + len * 0.5} ${x + 2} ${from + len}`}
              stroke="#5f7d43"
              strokeWidth="1.6"
              fill="none"
            />
            {Array.from({ length: 5 }, (_, j) => {
              const t = (j + 1) / 6;
              return (
                <ellipse
                  key={j}
                  cx={x + 8 * t * (1 - t) * 2 + 2}
                  cy={from + len * t}
                  rx="2.6"
                  ry="5"
                  transform={`rotate(${18 - t * 30} ${x + 2} ${from + len * t})`}
                  fill="#6f9150"
                />
              );
            })}
          </g>
        );
      })}
    </g>
  );
}

/** Diagonal rain streaks. */
function Rain({ opacity = 0.75 }: { opacity?: number }) {
  return (
    <g stroke={PALETTE.ink} strokeWidth="1.2" opacity={opacity} strokeLinecap="round">
      {Array.from({ length: 14 }, (_, i) => {
        const x = 6 + i * 8.5;
        return <path key={i} d={`M ${x} 12 l -7 26`} />;
      })}
      {Array.from({ length: 12 }, (_, i) => {
        const x = 14 + i * 9;
        return <path key={`b${i}`} d={`M ${x} 56 l -7 26`} />;
      })}
    </g>
  );
}

export const month11: ReactNode[] = [
  // 0 — Rain Man / Ono no Michikaze (柳に小野道風), bright.
  // The scholar shelters under an umbrella by the willow, watching the frog
  // that famously taught him perseverance.
  <g key="m11-0">
    <rect x="4" y="4" width={CARD_W - 8} height={CARD_H - 8} rx="8" fill="#e0c56b" />
    <Rain opacity={0.5} />
    <WillowBranches from={18} count={4} />
    {/* Umbrella. */}
    <g transform="translate(74 74)">
      <path d="M-32 0 C -30 -22, -12 -32, 0 -32 C 12 -32, 30 -22, 32 0 Z" fill={PALETTE.ink} />
      <path d="M-32 0 a 8 8 0 0 0 16 0 a 8 8 0 0 0 16 0 a 8 8 0 0 0 16 0" fill={PALETTE.ink} />
      <path d="M0 -32 V 34" stroke="#6d4a22" strokeWidth="2.4" />
    </g>
    {/* Figure in a dark robe. */}
    <g transform="translate(58 132)">
      <path d="M0 0 C -14 2, -18 22, -16 42 L 18 42 C 20 22, 14 2, 0 0 Z" fill="#3a3f52" stroke={PALETTE.ink} strokeWidth="1.2" />
      <circle cx="1" cy="-8" r="9" fill="#e8cba6" stroke={PALETTE.ink} strokeWidth="1.2" />
      <path d="M-8 -12 C -6 -20, 8 -20, 10 -12 Z" fill={PALETTE.ink} />
      <path d="M14 12 C 24 8, 26 2, 24 -2" stroke="#3a3f52" strokeWidth="5" fill="none" strokeLinecap="round" />
    </g>
    {/* Frog on the bank. */}
    <g transform="translate(28 168)">
      <ellipse cx="0" cy="0" rx="11" ry="8" fill="#4f7a3f" stroke={PALETTE.ink} strokeWidth="1.1" />
      <circle cx="-5" cy="-6" r="3.4" fill="#5f8f4c" stroke={PALETTE.ink} strokeWidth="1" />
      <circle cx="4" cy="-7" r="3.4" fill="#5f8f4c" stroke={PALETTE.ink} strokeWidth="1" />
      <circle cx="-5" cy="-6.5" r="1.2" fill={PALETTE.ink} />
      <circle cx="4" cy="-7.5" r="1.2" fill={PALETTE.ink} />
      <path d="M-10 5 l -5 4 M 10 5 l 5 4" stroke="#3f6332" strokeWidth="2.4" strokeLinecap="round" />
    </g>
    {/* Stream at the foot of the card. */}
    <path d={`M4 ${CARD_H - 4} L4 182 C 40 176, 80 188, ${CARD_W - 4} 180 L ${CARD_W - 4} ${CARD_H - 4} Z`} fill="#6f93b5" />
  </g>,

  // 1 — Swallow (柳に燕), tane.
  <g key="m11-1">
    <rect x="4" y="4" width={CARD_W - 8} height={CARD_H - 8} rx="8" fill="#c94f3d" />
    <WillowBranches from={18} count={4} />
    <g transform="translate(60 128) rotate(-8)">
      <ellipse cx="0" cy="0" rx="22" ry="11" fill="#22242c" stroke={PALETTE.ink} strokeWidth="1.1" />
      <path d="M-4 3 C 4 9, 13 9, 18 3 C 12 6, 4 6, -4 3 Z" fill={PALETTE.white} />
      <circle cx="18" cy="-6" r="6.5" fill="#22242c" />
      <circle cx="20" cy="-7" r="1.5" fill={PALETTE.white} />
      {/* Red throat patch, the swallow's identifying mark. */}
      <path d="M13 -1 C 18 2, 22 1, 23 -2 C 20 -4, 16 -4, 13 -1 Z" fill={PALETTE.red} />
      <path d="M24 -6 L 31 -4.5 L 24 -3 Z" fill={PALETTE.gold} />
      <path d="M-2 -5 C 8 -22, 24 -20, 20 -5 C 14 -14, 5 -12, -2 -5 Z" fill="#15161c" stroke={PALETTE.ink} strokeWidth="0.9" />
      {/* Forked tail. */}
      <path d="M-20 -2 L -44 -12 L -30 0 L -44 10 L -20 3 Z" fill="#15161c" stroke={PALETTE.ink} strokeWidth="0.9" />
    </g>
  </g>,

  // 2 — Plain ribbon (柳に短冊).
  <g key="m11-2">
    <WillowBranches from={18} count={5} />
    <Ribbon color="red-plain" />
  </g>,

  // 3 — Lightning (柳のカス), chaff. The abstract storm card: a lightning bolt
  // over the dark drum-like cloud.
  <g key="m11-3">
    <rect x="4" y="4" width={CARD_W - 8} height={CARD_H - 8} rx="8" fill="#c94f3d" />
    <path
      d={`M4 ${CARD_H - 4} L4 92 C 36 74, 84 74, ${CARD_W - 4} 92 L ${CARD_W - 4} ${CARD_H - 4} Z`}
      fill="#2c2f3a"
    />
    <path d="M70 22 L 40 96 L 62 96 L 44 168 L 92 84 L 68 84 L 88 22 Z" fill={PALETTE.gold} stroke={PALETTE.ink} strokeWidth="1.6" strokeLinejoin="round" />
    <path d="M18 40 C 26 34, 34 38, 34 46" stroke={PALETTE.ink} strokeWidth="2" fill="none" strokeLinecap="round" />
    <path d="M14 58 C 24 50, 36 56, 34 64" stroke={PALETTE.ink} strokeWidth="2" fill="none" strokeLinecap="round" />
  </g>,
];
