// 프로젝트 = 모양들 + 블럭들 + 로봇(조립) + 코드 + 보드 정보
import { uid } from './util.js';

export function newProject(name = '새 프로젝트') {
  return {
    format: 'tinkersim', version: 1,
    id: uid('p'), name, icon: '🧩',
    board: 'uno', stage: 'grid',
    structures: [], meshes: {}, blocks: [], robots: [], instances: [],
    code: { mode: 'block', blockly: null, text: '' },
    created: Date.now(), updated: Date.now(),
  };
}

export const P = {
  struct: (p, id) => p.structures.find((x) => x.id === id),
  block: (p, id) => p.blocks.find((x) => x.id === id),
  robot: (p, id) => p.robots.find((x) => x.id === id),
  inst: (p, id) => p.instances.find((x) => x.id === id),
  instsOf: (p, robotId) => p.instances.filter((x) => x.robotId === robotId),
  children: (p, instId) => p.instances.filter((x) => x.parentId === instId),
  compOf: (p, inst) => (P.block(p, inst.blockId) || {}).component,
  instsByComp: (p, comps) => p.instances.filter((i) => comps.includes(P.compOf(p, i))),

  uniqueName(p, base, list) {
    const names = new Set((list || [...p.instances, ...p.robots, ...p.blocks, ...p.structures]).map((x) => x.name));
    if (!names.has(base)) return base;
    for (let i = 2; ; i++) if (!names.has(base + i)) return base + i;
  },
  nextInstName(p, base) {
    const names = new Set(p.instances.map((x) => x.name));
    for (let i = 1; ; i++) if (!names.has(base + i)) return base + i;
  },

  removeInst(p, id) {
    for (const c of P.children(p, id)) P.removeInst(p, c.id);
    p.instances = p.instances.filter((x) => x.id !== id);
  },
  removeRobot(p, id) {
    for (const i of P.instsOf(p, id).filter((x) => !x.parentId)) P.removeInst(p, i.id);
    p.robots = p.robots.filter((x) => x.id !== id);
  },
  removeBlock(p, id) {
    for (const i of p.instances.filter((x) => x.blockId === id)) P.removeInst(p, i.id);
    p.blocks = p.blocks.filter((x) => x.id !== id);
  },
  structUsage(p, id) {
    return [...p.blocks.filter((b) => b.partId === id).map((b) => '블럭 ' + b.name), ...p.robots.filter((r) => r.baseId === id).map((r) => '로봇 ' + r.name)];
  },
  // 쓰지 않는 STL 데이터 정리
  cleanMeshes(p) {
    const used = new Set();
    for (const s of p.structures) for (const sh of s.shapes) if (sh.type === 'stl') used.add(sh.mesh);
    for (const k of Object.keys(p.meshes || {})) if (!used.has(k)) delete p.meshes[k];
  },
};
