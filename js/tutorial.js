// 📖 따라하기: 그림을 보면서 한 단계씩 배워요
import { h } from './util.js';

export const LESSONS = [
  {
    id: 'tour', icon: '👀', title: '팅커심 둘러보기',
    goal: '화면의 생김새와 순서를 알아봐요',
    steps: [
      { img: 'home.png', title: '처음 화면', text: '팅커심은 ① 모양 만들기 → ② 블럭 만들기 → ③ 조립하기 → ④ 코딩·실행 순서로 작품을 만들어요. 위쪽 메뉴를 눌러 언제든 옮겨 다닐 수 있어요.' },
      { img: 'home-examples.png', title: '예제 열어 보기', text: '처음 화면 아래의 예제 카드를 누르면 완성된 작품이 열려요. 자동차, 로봇팔, 신호등 등 13가지가 있어요.' },
      { img: 'run-car.png', title: '실행해 보기', text: '💻 코딩·실행 화면에서 초록색 ▶ 실행 버튼을 누르면 왼쪽 코드대로 오른쪽 작품이 움직여요. ■ 멈춤, ↺ 처음으로 버튼도 있어요.' },
      { img: 'save.png', title: '저장하기', text: '작품은 자동으로 브라우저에 저장돼요 (위쪽 "✔ 저장됨"). 💾 파일로 저장을 누르면 내 컴퓨터에 .tsim 파일로 저장해서 친구와 나눌 수 있어요.' },
    ],
  },
  {
    id: 'shape', icon: '🧱', title: '모양 만들기',
    goal: '모양을 넣고, 여러 개 골라 합치고 붙여서 구조물을 만들어요',
    steps: [
      { img: 'maker-1.png', title: '모양 넣기', text: '🧱 모양 만들기 화면 왼쪽에서 "상자"를 누르면 가운데에 상자가 생겨요.' },
      { img: 'maker-2.png', title: '크기 바꾸기', text: '상자를 누른 뒤 오른쪽 "크기"에 가로 150, 세로 70, 높이 30 을 적어요. 위쪽 ↔️ 크기 버튼을 누르고 손잡이를 끌어도 돼요.' },
      { img: 'maker-3.png', title: '옮기고 쌓기', text: '모양을 마우스로 끌면 바닥 위에서 움직이고, 다른 모양 위로 끌면 그 위에 올라가요. 높이를 바꾸려면 ✋ 옮기기의 초록 화살표(위쪽)를 끌어요. 상자를 하나 더 넣어 지붕을 만들어 보세요.' },
      { img: 'maker-multi.png', title: '여러 개 함께 고르기', text: 'Shift 키를 누른 채 모양을 클릭하면 여러 개를 함께 고를 수 있어요. Shift를 누르고 빈 곳을 끌면 네모 안의 모양이 모두 골라져요. 고른 모양들은 함께 옮기고, 돌리고, 크기를 바꾸고, 색이나 모양 종류를 한 번에 바꿀 수 있어요.' },
      { img: 'maker-hole.png', title: '구멍 뚫기', text: '모양을 고르고 "🕳️ 구멍"을 누르면 투명한 구멍 모양이 돼요. 구멍과 다른 모양을 함께 골라 🧩 합치기를 누르면 구멍이 뻥 뚫려요. 왼쪽의 "상자 구멍", "원기둥 구멍"을 바로 넣어도 돼요.' },
      { img: 'maker-group.png', title: '🧩 합치기 (그룹)', text: '여러 모양을 골라 🧩 합치기(Ctrl+G)를 누르면 녹아서 하나의 모양이 돼요. 색도 하나로 바뀌고, 안쪽 경계와 구멍이 깔끔하게 정리돼요. 🔓 합치기 풀기(Ctrl+Shift+G)로 다시 나눌 수 있어요.' },
      { img: 'maker-link.png', title: '📎 붙이기', text: '📎 붙이기(Ctrl+B)는 조각의 색과 모양은 그대로 두고 함께 움직이도록 붙여요. 붙인 묶음을 두 번 클릭하면 안쪽 조각을 하나씩 고칠 수 있고, ✂ 떼어내기로 다시 떼요. 합치기는 "하나의 모양", 붙이기는 "여러 조각을 붙여 쓰기"예요.' },
      { img: 'maker-copy.png', title: '복사·붙여넣기', text: '📋 복사(Ctrl+C) 후 📥 붙여넣기(Ctrl+V)를 누르면 똑같은 모양이 옆에 생겨요. 다른 모양(구조물)으로 가서 붙여넣을 수도 있어요. 📄 복제(Ctrl+D), ✂️ 잘라내기(Ctrl+X), 되돌리기(Ctrl+Z)도 있어요.' },
      { img: 'maker-align.png', title: '정렬·뒤집기', text: '2개 이상 고르고 오른쪽 "📐 정렬"에서 왼쪽·가운데·오른쪽, 바닥·위를 맞출 수 있어요. 뒤집기(좌우·앞뒤·위아래)와 90° 돌리기도 있어요. 모양을 끌면 다른 모양 위에 자동으로 올라가요(🧲 표면에 놓기).' },
      { img: 'maker-stl.png', title: 'STL 파일 불러오기', text: '팅커캐드에서 만든 모양은 "내보내기 → .STL"로 저장한 뒤 📥 STL 파일 불러오기로 가져올 수 있어요. 크기가 너무 크거나 작으면 자동으로 맞춰 줘요.' },
    ],
  },
  {
    id: 'block', icon: '🔧', title: '바퀴 블럭 만들기',
    goal: '바퀴 모양에 DC 모터를 붙여 "바퀴 블럭"을 만들어요',
    steps: [
      { img: 'blocks-1.png', title: '새 블럭 만들기', text: '🔧 블럭 만들기 화면에서 ➕ 새 블럭 만들기를 눌러요. 오른쪽에 1~5단계가 나와요.' },
      { img: 'blocks-wheel.png', title: '부품과 모양 고르기', text: '② 부품에서 ⚙️ DC 모터, ④ 모양에서 🛞 바퀴를 골라요. 바퀴가 모터의 축에 자동으로 착 맞춰지고, 가운데 화면에서 빙글빙글 도는 모습을 볼 수 있어요.' },
      { img: 'blocks-servo.png', title: '서보 모터 블럭', text: '서보 모터는 0~180도로 움직여요. "팔처럼 꺾기"는 팔꿈치처럼, "돌림판처럼 돌기"는 돌림판처럼 움직여요. 아래 "움직여 보기" 막대를 끌어 확인해요.' },
    ],
  },
  {
    id: 'car', icon: '🚗', title: '자동차 조립하기',
    goal: '자동차 몸통을 바탕으로 정하고 바퀴 블럭 4개를 붙여요',
    steps: [
      { img: 'assemble-1.png', title: '바탕 모양 고르기', text: '🚗 조립하기 화면에서 ➕ 새 로봇 만들기를 누르고 "자동차 몸통"을 골라요. 이 모양이 로봇의 바탕이 되어, 붙인 블럭들이 함께 움직여요.' },
      { img: 'assemble-ghost.png', title: '바퀴 붙이기', text: '왼쪽 "바퀴 블럭"을 끌어서 몸통 옆면에 놓아요. 파란 그림자가 붙을 자리를 보여 주고, 면에 맞춰 자동으로 방향이 정해져요. 4번 반복해요!' },
      { img: 'assemble-car.png', title: '이름과 방향', text: '붙인 바퀴를 누르면 오른쪽에서 이름(코딩할 때 부르는 이름)·방향·크기를 바꿀 수 있어요. 주황 화살표가 자동차의 앞쪽이에요. 바닥에 닿은 바퀴는 자동으로 찾아서, 모터가 돌면 자동차가 굴러가요.' },
    ],
  },
  {
    id: 'code', icon: '💻', title: '코딩하고 실행하기',
    goal: '자동차가 앞으로 가다가 도는 코드를 만들어요',
    steps: [
      { img: 'code-car.png', title: '블록 코딩', text: '💻 코딩·실행 화면 왼쪽이 코딩, 오른쪽이 시뮬레이션이에요. "움직이기"에서 ⚙️ 모터 블록을 꺼내 ▶ 시작하면 아래에 붙이고, 바퀴 이름을 골라요.' },
      { img: 'run-car.png', title: '실행!', text: '▶ 실행을 누르면 지금 실행 중인 블록이 반짝이고 자동차가 움직여요. 속도를 + 로 주면 앞으로, - 로 주면 뒤로 가요. 왼쪽과 오른쪽 바퀴 속도를 다르게 주면 방향이 바뀌어요.' },
      { img: 'code-text.png', title: '글 코딩', text: '⌨️ 글 코딩을 누르면 자바스크립트로 코딩할 수 있어요. "🧩 블록을 글로 바꾸기"를 누르면 지금 블록이 글 코드로 바뀌어요.' },
    ],
  },
  {
    id: 'arm', icon: '🦾', title: '로봇팔 만들기',
    goal: '서보 모터 블럭 3개를 이어 붙여 로봇팔을 움직여요',
    steps: [
      { img: 'arm-assemble.png', title: '블럭 위에 블럭 붙이기', text: '받침대를 바탕으로 정하고, 돌림판 블럭 → 어깨 블럭 → 팔꿈치 블럭 순서로 앞 블럭의 모양 위에 붙여요. 블럭 만들기에서 "다른 블럭을 붙일 수 있어요"가 켜져 있어야 해요.' },
      { img: 'arm-run.png', title: '각도로 움직이기', text: '🦾 서보 블록으로 각도(0~180)를 정해요. 앞의 블럭이 움직이면 위에 붙은 블럭들도 같이 움직여요.' },
    ],
  },
  {
    id: 'sensor', icon: '📏', title: '센서 쓰기',
    goal: '거리 센서로 벽을 피하는 자동차를 만들어요',
    steps: [
      { img: 'avoid-run.png', title: '거리 센서', text: '거리 센서 블럭을 자동차 앞면에 붙이면 앞에 있는 물건까지 거리(cm)를 알 수 있어요. "만약 거리 < 15 이면 뒤로 가기" 처럼 조건 블록과 함께 써요.' },
      { img: 'line-run.png', title: '라인 센서', text: '라인 센서를 몸통 아래에 붙이면 바닥의 검은 선을 찾을 수 있어요. 무대를 "라인 트랙"으로 바꾸고 선을 따라가게 해 봐요.' },
      { img: 'button.png', title: '버튼 누르기', text: '버튼 블럭은 실행 중에 3D 화면의 버튼을 마우스로 누르거나, 아래 "부품 상태"의 "꾹 누르기"를 눌러서 누를 수 있어요.' },
    ],
  },
  {
    id: 'board', icon: '🔌', title: '보드 코드 만들기',
    goal: '블록 코드를 아두이노·마이크로비트 코드로 바꿔 봐요',
    steps: [
      { img: 'board-select.png', title: '보드 고르기', text: '코딩·실행 화면 위쪽에서 아두이노 우노, ESP32, 마이크로비트, 라즈베리파이 피코 중 하나를 골라요. 부품마다 꽂을 핀이 자동으로 정해져요.' },
      { img: 'codeview.png', title: '보드 코드 보기', text: '📄 보드 코드 보기를 누르면 블록이 아두이노(C/C++)나 마이크로파이썬 코드로 바뀌어요. 📋 연결표에서 어떤 핀에 꽂을지 확인해요.' },
    ],
  },
];

export function createTutorial(app) {
  const el = h('section', { class: 'tutorial' });
  const nav = h('aside', { class: 'side left' });
  const main = h('div', { class: 'tut-main' });
  el.append(nav, main);
  let cur = LESSONS[0];
  let idx = 0;

  function renderNav() {
    nav.replaceChildren(h('h3', {}, '📖 따라하기'), ...LESSONS.map((l, i) => h('button', {
      class: 'lesson' + (l === cur ? ' on' : ''), onclick: () => { cur = l; idx = 0; render(); },
    }, h('span', { class: 'ln' }, i + 1), h('span', {}, h('b', {}, l.icon + ' ' + l.title), h('small', {}, l.goal)))));
  }

  function render() {
    renderNav();
    const s = cur.steps[idx];
    const li = LESSONS.indexOf(cur);
    main.replaceChildren(
      h('div', { class: 'tut-head' }, h('h2', {}, `${cur.icon} ${li + 1}. ${cur.title}`), h('p', {}, '🎯 ' + cur.goal)),
      h('div', { class: 'tut-dots' }, cur.steps.map((_, i) => h('button', { class: 'dot' + (i === idx ? ' on' : ''), onclick: () => { idx = i; render(); } }, i + 1))),
      h('div', { class: 'tut-card' },
        h('div', { class: 'tut-img' }, h('img', { src: 'tutorial/img/' + s.img, alt: s.title, loading: 'lazy', onerror: (e) => { e.target.replaceWith(h('div', { class: 'noimg' }, '🖼️')); } })),
        h('div', { class: 'tut-text' },
          h('div', { class: 'tut-step' }, `${idx + 1} / ${cur.steps.length}`),
          h('h3', {}, s.title),
          h('p', {}, s.text))),
      h('div', { class: 'tut-foot' },
        h('button', { class: 'btn', disabled: idx === 0 && li === 0, onclick: prev }, '◀ 이전'),
        h('span', { class: 'grow' }),
        tryButton(),
        h('button', { class: 'btn primary', onclick: next }, idx < cur.steps.length - 1 ? '다음 ▶' : li < LESSONS.length - 1 ? '다음 배우기 ▶' : '처음으로 🏠')));
  }

  function tryButton() {
    const map = { tour: ['car', '🚗 자동차 예제 열기'], shape: [null, '🧱 모양 만들러 가기', 'maker'], block: [null, '🔧 블럭 만들러 가기', 'blocks'], car: ['car', '🚗 완성된 자동차 열기'], code: ['car', '💻 자동차 코드 열기', 'code'], arm: ['arm', '🦾 로봇팔 예제 열기'], sensor: ['avoid', '🤖 장애물 피하기 열기'], board: [null, '💻 코딩·실행으로 가기', 'code'] };
    const [ex, label, go] = map[cur.id];
    return h('button', { class: 'btn', onclick: async () => { if (ex) await app.openExample(ex); if (go) app.go(go); } }, label);
  }

  function next() {
    if (idx < cur.steps.length - 1) idx++;
    else {
      const li = LESSONS.indexOf(cur);
      if (li < LESSONS.length - 1) { cur = LESSONS[li + 1]; idx = 0; } else { app.go('home'); return; }
    }
    render();
    main.scrollTop = 0;
  }
  function prev() {
    if (idx > 0) idx--;
    else { const li = LESSONS.indexOf(cur); if (li > 0) { cur = LESSONS[li - 1]; idx = cur.steps.length - 1; } }
    render();
  }

  return { el, onShow: render };
}
