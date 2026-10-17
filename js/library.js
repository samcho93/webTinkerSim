// 미리 만들어 둔 모양들 (블럭 만들기와 예제에서 사용해요)
import { uid } from './util.js';

export function S(type, pos, size, color = '#3b82f6', rot = [0, 0, 0], hole = false) {
  return { id: uid('s'), type, pos, size, rot, color, hole };
}

export const LIB = [
  {
    id: 'wheel', name: '바퀴', icon: '🛞',
    make: () => [
      S('cylinder', [0, 10, 0], [60, 20, 60], '#1f2937'),
      S('cylinder', [0, 10.5, 0], [30, 21, 30], '#d1d5db'),
      S('cylinder', [0, 11, 0], [10, 22, 10], '#ef4444'),
    ],
  },
  {
    id: 'bigwheel', name: '큰 바퀴', icon: '⚫',
    make: () => [
      S('cylinder', [0, 12, 0], [84, 24, 84], '#111827'),
      S('cylinder', [0, 12.5, 0], [44, 25, 44], '#facc15'),
    ],
  },
  {
    id: 'arm', name: '긴 팔', icon: '🦴',
    make: () => [
      S('box', [0, 40, 0], [20, 68, 12], '#f97316'),
      S('cylinder', [0, 6, 0], [12, 20, 12], '#f97316', [0, 0, 90]),
      S('cylinder', [0, 74, 0], [12, 20, 12], '#f97316', [0, 0, 90]),
    ],
  },
  {
    id: 'shortarm', name: '짧은 팔', icon: '🦵',
    make: () => [
      S('box', [0, 25, 0], [18, 38, 12], '#22c55e'),
      S('cylinder', [0, 6, 0], [12, 18, 12], '#22c55e', [0, 0, 90]),
      S('cylinder', [0, 44, 0], [12, 18, 12], '#22c55e', [0, 0, 90]),
    ],
  },
  {
    id: 'gripper', name: '집게 손', icon: '🤏',
    make: () => [
      S('box', [0, 4, 0], [40, 8, 14], '#8b5cf6'),
      S('box', [-15, 20, 0], [8, 26, 12], '#8b5cf6'),
      S('box', [15, 20, 0], [8, 26, 12], '#8b5cf6'),
    ],
  },
  { id: 'plate', name: '네모 판', icon: '🟫', make: () => [S('box', [0, 3, 0], [60, 6, 60], '#06b6d4')] },
  { id: 'disc', name: '동그란 판', icon: '💿', make: () => [S('cylinder', [0, 3, 0], [110, 6, 110], '#ec4899')] },
  {
    id: 'propeller', name: '프로펠러', icon: '🌀',
    make: () => [
      S('cylinder', [0, 5, 0], [14, 10, 14], '#334155'),
      S('box', [0, 5, 0], [80, 2, 14], '#38bdf8', [10, 0, 0]),
      S('box', [0, 5, 0], [80, 2, 14], '#38bdf8', [10, 60, 0]),
      S('box', [0, 5, 0], [80, 2, 14], '#38bdf8', [10, 120, 0]),
    ],
  },
  {
    id: 'bar', name: '차단봉', icon: '🚧',
    make: () => {
      const a = [];
      for (let i = 0; i < 6; i++) a.push(S('box', [0, 12.5 + i * 25, 0], [10, 25, 10], i % 2 ? '#ffffff' : '#ef4444'));
      return a;
    },
  },
  {
    id: 'cabin', name: '엘리베이터 칸', icon: '🛗',
    make: () => [
      S('box', [0, 22, 0], [50, 44, 50], '#facc15'),
      S('box', [0, 24, 14], [40, 36, 30], '#ffffff', [0, 0, 0], true),
    ],
  },
  {
    id: 'horse', name: '목마', icon: '🐴',
    make: () => [
      S('cylinder', [0, 25, 0], [4, 50, 4], '#facc15'),
      S('box', [0, 26, 0], [26, 11, 10], '#ffffff'),
      S('box', [14, 34, 0], [8, 14, 7], '#ffffff', [0, 0, -20]),
      S('box', [-2, 33, 0], [10, 3, 11], '#ef4444'),
    ],
  },
  {
    id: 'hand', name: '손바닥', icon: '✋',
    make: () => [
      S('sphere', [0, 12, 0], [26, 24, 12], '#fbbf24'),
      S('box', [0, 3, 0], [10, 8, 8], '#fbbf24'),
    ],
  },
];

export function libStructure(id, name) {
  const l = LIB.find((x) => x.id === id);
  return { id: uid('st'), name: name || l.name, icon: l.icon, shapes: l.make() };
}
