// STL 파일 불러오기 / 내보내기
import * as THREE from 'three';
import { STLLoader } from 'three/addons/loaders/STLLoader.js';
import { STLExporter } from 'three/addons/exporters/STLExporter.js';
import { f32ToB64, uid } from './util.js';
import { buildStructure, whenCsgReady } from './shapes.js';

// STL → 프로젝트에 넣을 모양 하나. 팅커캐드처럼 Z가 위쪽인 파일을 Y가 위쪽으로 바꿔요.
export function importStl(project, buffer, name) {
  const g = new STLLoader().parse(buffer);
  const geo = g.index ? g.toNonIndexed() : g;
  geo.rotateX(-Math.PI / 2);
  geo.computeBoundingBox();
  const size = geo.boundingBox.getSize(new THREE.Vector3());
  let note = '';
  let scale = 1;
  const maxd = Math.max(size.x, size.y, size.z);
  if (maxd > 400) { scale = 120 / maxd; note = '모양이 너무 커서 알맞게 줄였어요'; }
  else if (maxd < 3) { scale = 40 / maxd; note = '모양이 너무 작아서 알맞게 키웠어요'; }
  const pos = new Float32Array(geo.attributes.position.array);
  const meshId = uid('m');
  project.meshes[meshId] = { name, pos: f32ToB64(pos), tris: pos.length / 9 };
  const sz = [size.x * scale, size.y * scale, size.z * scale].map((v) => Math.round(v * 10) / 10);
  return {
    shape: { id: uid('s'), type: 'stl', mesh: meshId, pos: [0, sz[1] / 2, 0], size: sz, rot: [0, 0, 0], color: '#60a5fa', hole: false },
    note, tris: pos.length / 9,
  };
}

export async function exportStl(struct, project) {
  await whenCsgReady();
  const g = buildStructure(struct, project);
  g.rotation.x = Math.PI / 2; // 다시 Z가 위쪽으로
  const wrap = new THREE.Group();
  wrap.add(g);
  wrap.updateMatrixWorld(true);
  return new STLExporter().parse(wrap, { binary: true });
}
