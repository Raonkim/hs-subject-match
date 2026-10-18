import { evaluateMajor, schoolStatus, majorSummary, ruleSubjects, searchMajors } from './match.js';

const $ = (id) => document.getElementById(id);
function el(tag, text, cls) {
  const n = document.createElement(tag);
  if (text !== undefined && text !== null) n.textContent = text;
  if (cls) n.className = cls;
  return n;
}
async function getJson(path) {
  const res = await fetch(path);
  if (!res.ok) throw new Error(String(res.status));
  return res.json();
}

const PAGE = 30;
const STATUS_LABEL = { offered: '학교 운영 확인', unseen: '시간표에서 확인 안 됨', 'no-school': '' };
const state = {
  univs: [], meta: new Map(), taken: new Set(), school: null, schools: [],
  selected: null, // { univ, major }
  shown: PAGE,
};

// ---------- 1. 과목 체크 ----------
function renderPicker(list) {
  const box = $('picker');
  box.replaceChildren();
  const groups = new Map();
  for (const s of list) {
    const key = `${s.area} ${s.type}`;
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key).push(s.name);
  }
  for (const [key, names] of groups) {
    const fs = el('fieldset', null, 'group');
    fs.append(el('legend', key));
    for (const name of names) {
      const label = el('label', null, 'chip');
      const cb = el('input');
      cb.type = 'checkbox';
      cb.value = name;
      cb.addEventListener('change', () => toggle(name, cb.checked));
      label.append(cb, el('span', name));
      fs.append(label);
    }
    box.append(fs);
  }
}

function toggle(name, on) {
  // 상세 화면은 다시 그려지므로, 체크하던 칸의 위치를 기억했다가 포커스를 돌려준다(키보드·스크린리더 사용자)
  const active = document.activeElement;
  const inRules = active && active.closest && active.closest('#rules') && active.type === 'checkbox';
  if (on) state.taken.add(name); else state.taken.delete(name);
  // 맨 위 체크리스트와 상세 화면의 체크 상태를 맞춘다
  for (const cb of document.querySelectorAll(`#picker input[type=checkbox]`)) cb.checked = state.taken.has(cb.value);
  $('picked-count').textContent = String(state.taken.size);
  renderResults();
  renderDetail();
  if (inRules) {
    const again = [...document.querySelectorAll('#rules input[type=checkbox]')].find((cb) => cb.dataset.subject === name);
    if (again) again.focus();
  }
}

// ---------- 2. 학과 검색과 대학 비교 ----------
function renderResults() {
  const q = $('major-q').value.trim();
  const univKey = $('univ').value;
  const list = $('results');
  list.replaceChildren();
  $('more').hidden = true;
  if (!q && !univKey) { $('result-count').textContent = '학과 이름을 넣거나 대학을 고르세요.'; return; }
  const hits = searchMajors(state.univs, q, univKey);
  const named = hits.filter((h) => !h.common).length;
  $('result-count').textContent = named
    ? `${named}개 모집단위${hits.length > named ? ' + 공통 기준 대학' : ''}`
    : `학과 이름이 맞는 곳이 없습니다. 더 짧게 넣어 보세요(예: "컴퓨터").${hits.length ? ' 아래는 모든 학과에 같은 기준을 쓰는 대학입니다.' : ''}`;
  for (const h of hits.slice(0, state.shown)) list.append(resultItem(h));
  $('more').hidden = hits.length <= state.shown;
}

function resultItem({ univ, major, common }) {
  const s = majorSummary(major, state.taken, state.meta);
  const li = el('li');
  const btn = el('button', null, `result ${s.total && s.ok === s.total ? 'ok' : ''}`);
  btn.type = 'button';
  btn.append(el('span', common ? `${univ.university} · 자연계열 공통 기준` : `${univ.university} · ${major.name}`, 'r-name'));
  let line;
  if (s.total === 0) line = '정리된 규칙 없음 · 원문 확인';
  else if (s.ok === s.total) line = `충족 (${s.ok}/${s.total})`;
  else line = `${s.ok}/${s.total} 충족 · 부족: ${s.short.join(', ')}`;
  btn.append(el('span', line, 'r-line'));
  if (s.caution) btn.append(el('span', '원문 확인 필요', 'tag unseen'));
  btn.addEventListener('click', () => {
    state.selected = { univ, major };
    renderDetail();
    $('result').scrollIntoView({ behavior: 'smooth', block: 'start' });
  });
  li.append(btn);
  return li;
}

// ---------- 3. 상세 ----------
function ruleTitle(r, isCore) {
  const head = isCore ? '핵심' : '권장';
  return r.kind === 'all' ? `${head} · 모두 이수 (${r.have}/${r.need})` : `${head} · ${r.subjects.length}과목 중 ${r.need}과목 이상 (${r.have}/${r.need})`;
}

function renderDetail() {
  const sel = state.selected;
  if (!sel) { $('result').hidden = true; return; }
  const { univ, major: m } = sel;
  $('detail-title').textContent = `${univ.university} ${m.name}`;
  const ev = evaluateMajor(m, state.taken);
  const all = [...ev.core.map((r) => [r, true]), ...ev.recommended.map((r) => [r, false])];
  const box = $('rules');
  box.replaceChildren();
  if (all.length === 0) box.append(el('p', '이 모집단위는 정리된 규칙이 없습니다. 아래 원문 문구를 확인하세요.', 'note'));
  for (const [r, isCore] of all) {
    const card = el('div', null, `rule ${r.ok ? 'ok' : ''}`);
    card.append(el('h3', `${r.ok ? '충족 · ' : ''}${ruleTitle(r, isCore)}`));
    const list = el('ul', null, 'subjects');
    for (const s of r.subjects) {
      const li = el('li');
      const label = el('label');
      const cb = el('input');
      cb.type = 'checkbox';
      cb.checked = state.taken.has(s);
      cb.dataset.subject = s;
      cb.addEventListener('change', () => toggle(s, cb.checked));
      label.append(cb, el('span', s));
      li.append(label);
      const st = schoolStatus(s, state.school);
      if (st !== 'no-school') li.append(el('span', STATUS_LABEL[st], `tag ${st}`));
      list.append(li);
    }
    card.append(list);
    box.append(card);
  }
  const s = majorSummary(m, state.taken, state.meta);
  $('summary').textContent = !s.total ? '정리된 규칙이 없습니다.'
    : s.ok === s.total ? `규칙 ${s.total}개를 모두 채웠습니다.`
      : `규칙 ${s.total}개 중 ${s.ok}개 충족. 부족: ${s.short.join(', ')}`;
  // 해석이 애매한 모집단위는 요약 바로 아래에 경고한다(접힌 메모 안에만 두면 '다 충족'으로 오해할 수 있음).
  const caution = $('caution');
  caution.hidden = !s.caution;
  caution.textContent = s.caution ? '이 학과는 원문 일부를 규칙으로 옮기지 못했습니다. 위 결과만 믿지 말고 아래 원문 문구를 꼭 확인하세요.' : '';
  $('raw').textContent = `원문: ${m.raw || '-'}`;
  $('note').textContent = m.note ? `해석 메모: ${m.note}` : '';
  const src = univ.source;
  const p = $('source');
  p.replaceChildren(`출처: ${src.title} (기준 ${src.basis_date}, 조회 ${src.retrieved}) `);
  const a = el('a', '원문 보기');
  a.href = src.url;
  a.rel = 'noopener noreferrer';
  p.append(a);
  $('result').hidden = false;
}

// ---------- 우리 학교(데이터가 있을 때만 보인다) ----------
// 목록 항목과 정확히 같거나, 이름 일부로 한 곳만 걸리면 그 학교로 본다(datalist가 약한 브라우저 대비).
function findSchool(text) {
  const q = text.trim();
  if (!q) return { school: null, count: 0 };
  const exact = state.schools.find((x) => `${x.name} (${x.sido})` === q);
  if (exact) return { school: exact, count: 1 };
  const hits = state.schools.filter((x) => x.name.includes(q));
  return { school: hits.length === 1 ? hits[0] : null, count: hits.length };
}

async function chooseSchool(text) {
  const { school: s, count } = findSchool(text);
  const info = $('school-info');
  if (!s) {
    state.school = null;
    info.textContent = !text.trim() ? '학교를 고르면 올해 시간표에 나온 과목을 표시합니다.'
      : count > 1 ? `'${text.trim()}'(이)가 들어간 학교가 ${count}곳입니다. 목록에서 고르거나 이름을 더 입력하세요.`
        : '그 이름의 학교를 찾지 못했습니다.';
    renderDetail();
    return;
  }
  try {
    state.school = await getJson(`data/schools/${encodeURIComponent(s.region)}/${encodeURIComponent(s.code)}.json`);
    const n = Object.keys(state.school.subjects).length;
    info.textContent = `${state.school.name}: ${state.school.ay}학년도 표본 시간표에서 과목 ${n}개 확인 (수집 ${state.school.collected}).`;
  } catch {
    state.school = null;
    info.textContent = '이 학교의 시간표 데이터를 아직 모으지 못했습니다.';
  }
  renderDetail();
}

async function init() {
  const [index, subjects] = await Promise.all([getJson('data/universities.json'), getJson('data/subjects.json')]);
  state.univs = await Promise.all(index.map((u) => getJson(`data/universities/${encodeURIComponent(u.key)}.json`)));
  state.meta = new Map(subjects.map((s) => [s.name, s]));
  renderPicker(ruleSubjects(state.univs, subjects));

  const sel = $('univ');
  for (const u of state.univs) {
    const o = el('option', u.majors.length === 1 ? `${u.university} (자연계열 공통 기준)` : `${u.university} (${u.majors.length}개 모집단위)`);
    o.value = u.key;
    sel.append(o);
  }
  const reset = () => { state.shown = PAGE; renderResults(); };
  sel.addEventListener('change', reset);
  $('major-q').addEventListener('input', reset);
  $('more').addEventListener('click', () => { state.shown += PAGE; renderResults(); });

  // 학교 시간표 데이터가 생길 때까지 '우리 학교' 기능은 숨긴다(빈 기능은 신뢰를 깎는다).
  try { state.schools = await getJson('data/schools/index.json'); } catch { state.schools = []; }
  if (state.schools.length > 0) {
    $('school-section').hidden = false;
    const dl = $('school-list');
    for (const s of state.schools) {
      const o = el('option');
      o.value = `${s.name} (${s.sido})`;
      dl.append(o);
    }
    $('school-q').addEventListener('change', (e) => chooseSchool(e.target.value));
  }
}

init().catch(() => { $('result-count').textContent = '데이터를 불러오지 못했습니다. 새로고침해 주세요.'; });
