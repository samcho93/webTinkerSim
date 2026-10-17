// 공통 도우미 함수
export const $ = (s, r = document) => r.querySelector(s);
export const $$ = (s, r = document) => [...r.querySelectorAll(s)];

export function h(tag, props = {}, ...kids) {
  const el = document.createElement(tag);
  for (const [k, v] of Object.entries(props || {})) {
    if (v === undefined || v === null || v === false) continue;
    if (k === 'class') el.className = v;
    else if (k === 'style' && typeof v === 'object') Object.assign(el.style, v);
    else if (k.startsWith('on') && typeof v === 'function') el.addEventListener(k.slice(2).toLowerCase(), v);
    else if (k === 'html') el.innerHTML = v;
    else if (k in el && typeof v !== 'string') el[k] = v;
    else el.setAttribute(k, v === true ? '' : v);
  }
  for (const kid of kids.flat(Infinity)) {
    if (kid === null || kid === undefined || kid === false) continue;
    el.append(kid instanceof Node ? kid : document.createTextNode(String(kid)));
  }
  return el;
}

export const uid = (p = '') => p + Date.now().toString(36).slice(-4) + Math.random().toString(36).slice(2, 7);
export const clone = (o) => JSON.parse(JSON.stringify(o));
export const clamp = (v, a, b) => Math.min(b, Math.max(a, v));

export function debounce(fn, ms) {
  let t;
  return (...a) => { clearTimeout(t); t = setTimeout(() => fn(...a), ms); };
}

export function toast(msg, ms = 2600) {
  let box = $('#toasts');
  if (!box) { box = h('div', { id: 'toasts' }); document.body.append(box); }
  const t = h('div', { class: 'toast' }, msg);
  box.append(t);
  setTimeout(() => t.classList.add('hide'), ms);
  setTimeout(() => t.remove(), ms + 400);
}

// 간단한 대화상자
export function modal({ title, body, buttons = [{ label: '닫기' }], wide = false, onClose }) {
  const back = h('div', { class: 'modal-back' });
  const content = h('div', { class: 'modal-body' });
  if (typeof body === 'string') content.innerHTML = body;
  else if (body instanceof Node) content.append(body);
  else if (typeof body === 'function') body(content);
  const close = () => { back.remove(); onClose && onClose(); };
  const foot = h('div', { class: 'modal-foot' },
    buttons.map((b) => h('button', {
      class: 'btn' + (b.primary ? ' primary' : '') + (b.danger ? ' danger' : ''),
      onclick: async () => { if (b.onClick) { const r = await b.onClick(content); if (r === false) return; } close(); },
    }, b.label)));
  const box = h('div', { class: 'modal' + (wide ? ' wide' : '') },
    h('div', { class: 'modal-head' }, h('h2', {}, title), h('button', { class: 'icon-btn', title: '닫기', onclick: close }, '✕')),
    content, foot);
  back.append(box);
  back.addEventListener('pointerdown', (e) => { if (e.target === back) close(); });
  document.body.append(back);
  return { close, content };
}

export function ask(title, message, okLabel = '예', cancelLabel = '아니요') {
  return new Promise((res) => {
    modal({
      title, body: h('p', {}, message),
      buttons: [{ label: cancelLabel, onClick: () => res(false) }, { label: okLabel, primary: true, onClick: () => res(true) }],
      onClose: () => res(false),
    });
  });
}

export function prompt(title, message, value = '') {
  return new Promise((res) => {
    const input = h('input', { class: 'input', value });
    let done = false;
    const m = modal({
      title, body: h('div', {}, h('p', {}, message), input),
      buttons: [{ label: '취소', onClick: () => { done = true; res(null); } },
        { label: '확인', primary: true, onClick: () => { done = true; res(input.value.trim()); } }],
      onClose: () => { if (!done) res(null); },
    });
    setTimeout(() => { input.focus(); input.select(); }, 30);
    input.addEventListener('keydown', (e) => { if (e.key === 'Enter') { done = true; res(input.value.trim()); m.close(); } });
  });
}

export function downloadFile(name, data, type = 'application/octet-stream') {
  const blob = data instanceof Blob ? data : new Blob([data], { type });
  const a = h('a', { href: URL.createObjectURL(blob), download: name });
  document.body.append(a);
  a.click();
  setTimeout(() => { URL.revokeObjectURL(a.href); a.remove(); }, 1000);
}

export function pickFile(accept) {
  return new Promise((res) => {
    const inp = h('input', { type: 'file', accept, style: 'display:none' });
    inp.addEventListener('change', () => { res(inp.files[0] || null); inp.remove(); });
    document.body.append(inp);
    inp.click();
  });
}

export function f32ToB64(arr) {
  const bytes = new Uint8Array(arr.buffer, arr.byteOffset, arr.byteLength);
  let s = '';
  for (let i = 0; i < bytes.length; i += 0x8000) s += String.fromCharCode.apply(null, bytes.subarray(i, i + 0x8000));
  return btoa(s);
}
export function b64ToF32(b64) {
  const s = atob(b64);
  const bytes = new Uint8Array(s.length);
  for (let i = 0; i < s.length; i++) bytes[i] = s.charCodeAt(i);
  return new Float32Array(bytes.buffer);
}

export class Emitter {
  constructor() { this._h = {}; }
  on(ev, fn) { (this._h[ev] ||= []).push(fn); return () => this.off(ev, fn); }
  off(ev, fn) { this._h[ev] = (this._h[ev] || []).filter((f) => f !== fn); }
  emit(ev, ...a) { (this._h[ev] || []).slice().forEach((f) => f(...a)); }
}

export const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
