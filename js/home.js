// 처음 화면: 새 프로젝트, 내 프로젝트, 예제
import { h, ask, toast, prompt } from './util.js';
import { listProjects, loadProject, deleteProject } from './store.js';
import { newProject } from './project.js';
import { EXAMPLES } from './examples.js';

export function createHome(app) {
  const el = h('section', { class: 'home' });
  const mine = h('div', { class: 'card-grid' });
  const steps = [
    ['🧱', '모양 만들기', '상자, 원기둥으로 모양을 만들거나 STL 파일을 불러와요', 'maker'],
    ['🔧', '블럭 만들기', '모양에 모터·LED·센서를 붙여 움직이는 블럭을 만들어요', 'blocks'],
    ['🚗', '조립하기', '바탕 모양 위에 블럭을 마우스로 끌어다 붙여요', 'assemble'],
    ['💻', '코딩·실행', '블록 코딩으로 명령을 주고 ▶ 실행해요', 'code'],
  ];
  el.append(
    h('div', { class: 'hero' },
      h('div', { class: 'hero-text' },
        h('h1', {}, '만들고, 붙이고, 코딩해서 움직여요!'),
        h('p', {}, '3D 모양에 모터와 센서를 붙이고 코딩으로 자동차와 로봇팔을 움직여 보세요. 설치 없이 바로 시작해요.'),
        h('div', { class: 'hero-btns' },
          h('button', { class: 'btn big primary', onclick: async () => {
            const n = await prompt('새 프로젝트', '어떤 작품을 만들까요?', '나의 작품');
            if (n === null) return;
            await app.open(newProject(n || '나의 작품'), { go: 'maker' });
            toast('✨ 새 프로젝트를 만들었어요. 먼저 모양을 만들어 볼까요?');
          } }, '✨ 새로 만들기'),
          h('button', { class: 'btn big', onclick: () => app.go('tutorial') }, '📖 따라하기로 배우기'),
          h('button', { class: 'btn big', onclick: () => el.querySelector('#exgrid').scrollIntoView({ behavior: 'smooth' }) }, '🚗 예제 둘러보기'),
        )),
      h('div', { class: 'hero-art' }, '🚗🦾💡')),
    h('div', { class: 'steps' }, steps.map(([i, t, d, go], k) => h('button', { class: 'step', onclick: () => app.go(go) },
      h('div', { class: 'step-num' }, k + 1), h('div', { class: 'step-icon' }, i), h('b', {}, t), h('span', {}, d)))),
    h('h2', { class: 'sec' }, '📁 내 프로젝트'),
    mine,
    h('h2', { class: 'sec', id: 'exgrid' }, '🌟 예제 프로젝트 ', h('small', {}, '눌러서 열고, 💻 코딩·실행에서 ▶ 를 눌러 보세요')),
    h('div', { class: 'card-grid' }, EXAMPLES.map((ex) => h('button', { class: 'ex-card', onclick: () => app.openExample(ex.id) },
      h('div', { class: 'ex-icon' }, ex.icon),
      h('b', {}, ex.name),
      h('span', {}, ex.desc),
      h('div', { class: 'ex-tags' }, h('em', {}, '⭐'.repeat(ex.level)), ...ex.parts.map((p) => h('i', {}, p))),
    ))),
  );

  async function refresh() {
    const list = await listProjects();
    const exIds = new Set(EXAMPLES.map((e) => e.name));
    mine.replaceChildren(...(list.length ? list : []).map((it) => h('div', { class: 'proj-card' + (app.project.id === it.id ? ' current' : '') },
      h('button', { class: 'proj-open', onclick: async () => { const p = await loadProject(it.id); if (p) app.open(p, { persist: false }); } },
        h('div', { class: 'ex-icon' }, it.icon || '🧩'),
        h('b', {}, it.name),
        h('span', {}, new Date(it.updated).toLocaleString('ko-KR'))),
      h('button', { class: 'icon-btn del', title: '지우기', onclick: async () => {
        if (await ask('프로젝트 지우기', `"${it.name}" 프로젝트를 지울까요? 되돌릴 수 없어요.`, '지우기', '취소')) { await deleteProject(it.id); refresh(); }
      } }, '🗑️'))));
    if (!list.length) mine.append(h('div', { class: 'empty' }, '아직 저장된 프로젝트가 없어요. ✨ 새로 만들기나 예제를 눌러 보세요!'));
    void exIds;
  }

  return { el, onShow: refresh };
}
