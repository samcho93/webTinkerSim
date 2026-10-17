// 브라우저 안(IndexedDB)에 프로젝트를 저장합니다. 설치가 필요 없어요.
const DB = 'tinkersim';
const STORE = 'kv';
let dbp = null;

function db() {
  if (!dbp) {
    dbp = new Promise((res, rej) => {
      const r = indexedDB.open(DB, 1);
      r.onupgradeneeded = () => r.result.createObjectStore(STORE);
      r.onsuccess = () => res(r.result);
      r.onerror = () => rej(r.error);
    });
  }
  return dbp;
}

function tx(mode, fn) {
  return db().then((d) => new Promise((res, rej) => {
    const t = d.transaction(STORE, mode);
    const s = t.objectStore(STORE);
    const r = fn(s);
    t.oncomplete = () => res(r && 'result' in r ? r.result : undefined);
    t.onerror = () => rej(t.error);
  }));
}

export const store = {
  get: (k) => tx('readonly', (s) => s.get(k)),
  set: (k, v) => tx('readwrite', (s) => s.put(v, k)),
  del: (k) => tx('readwrite', (s) => s.delete(k)),
};

// 프로젝트 목록
export async function listProjects() {
  return (await store.get('index')) || [];
}
export async function saveProject(p) {
  p.updated = Date.now();
  await store.set('project:' + p.id, JSON.stringify(p));
  const idx = (await listProjects()).filter((x) => x.id !== p.id);
  idx.unshift({ id: p.id, name: p.name, updated: p.updated, icon: p.icon || '🧩' });
  await store.set('index', idx);
}
export async function loadProject(id) {
  const s = await store.get('project:' + id);
  return s ? JSON.parse(s) : null;
}
export async function deleteProject(id) {
  await store.del('project:' + id);
  await store.set('index', (await listProjects()).filter((x) => x.id !== id));
}
