// 팅커심 앱 시작점
import { h, $, toast, prompt, debounce, downloadFile, pickFile, Emitter, modal } from './util.js';
import { newProject, P } from './project.js';
import { saveProject, loadProject } from './store.js';
import { World } from './world.js';
import { Runner } from './runner.js';
import { Hardware } from './hardware.js';
import { setProjectGetter, defineBlocks } from './codegen.js';
import { whenCsgReady } from './shapes.js';
import { createHome } from './home.js';
import { createMaker } from './maker.js';
import { createBlockMaker } from './blockmaker.js';
import { createAssemble } from './assemble.js';
import { createCoding } from './coding.js';
import { createTutorial } from './tutorial.js';
import { EXAMPLES } from './examples.js';

class App extends Emitter {
  constructor() {
    super();
    this.project = newProject();
    this.world = new World();
    this.runner = new Runner(this.world);
    this.hw = new Hardware(this.world);
    this.runner.on('tone', (io, f, sec) => this.hw.tone(io, f, sec));
    this.screens = {};
    this.current = null;
    this.dirty = false;
    this._autosave = debounce(() => this.save(), 900);
  }

  async open(p, { go = 'assemble', persist = true } = {}) {
    this.runner.stop(true);
    this.world.resetSim?.();
    if (!p.meshes) p.meshes = {};
    this.project = p;
    this.world.stageType = null;
    this.world.setSelected(null);
    this.world.setProject(p);
    $('#pname').textContent = (p.icon || '🧩') + ' ' + p.name;
    try { localStorage.setItem('tsim.last', p.id); } catch (e) { /**/ }
    this.emit('project', p);
    if (persist) await this.save();
    if (go) this.go(go);
  }

  changed(kind = 'any', { rebuild = true } = {}) {
    if (rebuild && kind !== 'code') {
      if (this.current === 'assemble' || this.current === 'code') this.world.rebuild();
      else this.world.needsRebuild = true;
    }
    this.dirty = true;
    $('#saved').textContent = '저장 중…';
    this._autosave();
    this.emit('changed', kind);
  }

  async save() {
    try {
      P.cleanMeshes(this.project);
      await saveProject(this.project);
      this.dirty = false;
      $('#saved').textContent = '✔ 저장됨';
    } catch (e) {
      console.error(e);
      $('#saved').textContent = '⚠ 저장 실패';
    }
  }

  go(id) {
    if (this.current === id) { this.screens[id].onShow?.(); return; }
    if (this.current && this.screens[this.current]) {
      this.screens[this.current].el.classList.remove('active');
      this.screens[this.current].onHide?.();
    }
    this.current = id;
    const s = this.screens[id];
    s.el.classList.add('active');
    for (const b of document.querySelectorAll('#tabs button')) b.classList.toggle('active', b.dataset.id === id);
    s.onShow?.();
    try { history.replaceState(null, '', '#' + id); } catch (e) { /**/ }
  }

  async openFile() {
    const f = await pickFile('.tsim,.json,application/json');
    if (!f) return;
    try {
      const p = JSON.parse(await f.text());
      if (p.format !== 'tinkersim') throw new Error('팅커심 파일이 아니에요');
      await this.open(p);
      toast('📂 "' + p.name + '" 프로젝트를 열었어요');
    } catch (e) { toast('파일을 열 수 없어요: ' + e.message); }
  }

  saveFile() {
    P.cleanMeshes(this.project);
    downloadFile((this.project.name || 'project') + '.tsim', JSON.stringify(this.project), 'application/json');
    toast('💾 파일로 저장했어요');
  }

  async openExample(id) {
    const ex = EXAMPLES.find((e) => e.id === id);
    if (!ex) return;
    const p = ex.build();
    await this.open(p, { go: 'assemble' });
    toast(`${ex.icon} "${ex.name}" 예제를 열었어요. 💻 코딩·실행에서 ▶ 를 눌러 보세요!`, 4000);
  }
}

async function boot() {
  defineBlocks();
  const app = new App();
  window.app = app;
  setProjectGetter(() => app.project);

  const defs = [
    ['home', '🏠', '처음', createHome],
    ['maker', '🧱', '모양 만들기', createMaker],
    ['blocks', '🔧', '블럭 만들기', createBlockMaker],
    ['assemble', '🚗', '조립하기', createAssemble],
    ['code', '💻', '코딩·실행', createCoding],
    ['tutorial', '📖', '따라하기', createTutorial],
  ];
  const tabs = $('#tabs');
  defs.forEach(([id, icon, label, make], i) => {
    const s = make(app);
    s.el.classList.add('screen');
    s.el.id = 'scr-' + id;
    $('#screens').append(s.el);
    app.screens[id] = s;
    tabs.append(h('button', { 'data-id': id, onclick: () => app.go(id) },
      h('span', { class: 'ticon' }, icon), h('span', { class: 'tlabel' }, (i > 0 && i < 5 ? i + '. ' : '') + label)));
  });

  $('#pname').addEventListener('click', async () => {
    const n = await prompt('프로젝트 이름', '새 이름을 적어 주세요', app.project.name);
    if (n) { app.project.name = n; $('#pname').textContent = (app.project.icon || '🧩') + ' ' + n; app.changed('meta', { rebuild: false }); }
  });
  $('#btnSave').addEventListener('click', () => app.saveFile());
  $('#btnOpen').addEventListener('click', () => app.openFile());

  // 마지막 프로젝트 불러오기
  const params = new URLSearchParams(location.search);
  let opened = false;
  const exId = params.get('example');
  if (exId) { const ex = EXAMPLES.find((e) => e.id === exId); if (ex) { await app.open(ex.build(), { go: null, persist: false }); opened = true; } }
  if (!opened) {
    try {
      const last = localStorage.getItem('tsim.last');
      const p = last && await loadProject(last);
      if (p) { await app.open(p, { go: null, persist: false }); opened = true; }
    } catch (e) { console.warn(e); }
  }
  if (!opened) await app.open(newProject('나의 첫 작품'), { go: null, persist: false });

  whenCsgReady().then(() => app.world.rebuild());
  const hash = location.hash.slice(1);
  app.go(params.get('screen') || (app.screens[hash] ? hash : 'home'));
  $('#loading').remove();
  if (params.get('shot')) import('./shots.js').then((m) => m.runShot(app, params.get('shot'))).catch((e) => console.error(e));

  window.addEventListener('beforeunload', () => { if (app.dirty) app.save(); });
}

boot().catch((e) => {
  console.error(e);
  const l = $('#loading');
  if (l) l.textContent = '앗! 시작하는 중에 문제가 생겼어요. 인터넷 연결을 확인하고 새로고침 해 주세요. (' + e.message + ')';
});

export { modal };
