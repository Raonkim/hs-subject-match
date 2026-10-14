import { evaluateMajor, schoolStatus } from './match.js';

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

const STATUS_LABEL = { offered: '학교 운영 확인', unseen: '시간표에서 확인 안 됨', 'no-school': '' };
const state = { univ: null, major: null, school: null, schools: [], taken: new Set() };

function fillMajors() {
  const q = $('major-q').value.trim();
  const sel = $('major');
  sel.replaceChildren();
  if (!state.univ) return;
  state.univ.majors.forEach((m, i) => {
    if (q && !m.name.includes(q)) return;
    const o = el('option', `${m.name} (${m.field})`);
    o.value = String(i);
    sel.append(o);
  });
}

function ruleTitle(r, isCore) {
  const head = isCore ? '핵심' : '권장';
  return r.kind === 'all' ? `${head} · 모두 이수 (${r.have}/${r.need})` : `${head} · ${r.subjects.length}과목 중 ${r.need}과목 이상 (${r.have}/${r.need})`;
}

function renderRules() {
  const m = state.major;
  if (!m) { $('result').hidden = true; return; }
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
      cb.addEventListener('change', () => {
        if (cb.checked) state.taken.add(s); else state.taken.delete(s);
        renderRules();
      });
      label.append(cb, el('span', s));
      li.append(label);
      const st = schoolStatus(s, state.school);
      if (st !== 'no-school') li.append(el('span', STATUS_LABEL[st], `tag ${st}`));
      list.append(li);
    }
    card.append(list);
    box.append(card);
  }
  const okCount = all.filter(([r]) => r.ok).length;
  $('summary').textContent = all.length
    ? `규칙 ${all.length}개 중 ${okCount}개 충족. 체크는 내가 들었거나 들을 과목입니다.`
    : '정리된 규칙이 없습니다.';
  // 해석이 애매한 모집단위는 요약 옆에 바로 경고한다(접힌 메모 안에만 두면 '다 충족'으로 오해할 수 있음).
  const caution = $('caution');
  caution.hidden = !(m.note && m.note.includes('확인 필요'));
  caution.textContent = caution.hidden ? '' : '이 학과는 원문 일부를 규칙으로 옮기지 못했습니다. 위 충족 여부만 믿지 말고 아래 원문 문구를 꼭 확인하세요.';
  $('raw').textContent = `원문: ${m.raw || '-'}`;
  $('note').textContent = m.note ? `해석 메모: ${m.note}` : '';
  const src = state.univ.source;
  const p = $('source');
  p.replaceChildren(`출처: ${src.title} (기준 ${src.basis_date}, 조회 ${src.retrieved}) `);
  const a = el('a', '원문 보기');
  a.href = src.url;
  a.rel = 'noopener noreferrer';
  p.append(a);
  $('result').hidden = false;
}

async function chooseUniv(key) {
  state.univ = key ? await getJson(`data/universities/${encodeURIComponent(key)}.json`) : null;
  state.major = null;
  fillMajors();
  renderRules();
}

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
    info.textContent = state.schools.length === 0 ? '학교 시간표 데이터를 준비 중입니다. 과목 체크는 바로 쓸 수 있습니다.'
      : !text.trim() ? '학교를 고르면 올해 시간표에 나온 과목을 표시합니다.'
      : count > 1 ? `'${text.trim()}'(이)가 들어간 학교가 ${count}곳입니다. 목록에서 고르거나 이름을 더 입력하세요.`
        : '그 이름의 학교를 찾지 못했습니다.';
    renderRules();
    return;
  }
  try {
    state.school = await getJson(`data/schools/${encodeURIComponent(s.region)}/${encodeURIComponent(s.code)}.json`);
    const n = Object.keys(state.school.subjects).length;
    info.textContent = `${state.school.name}: ${state.school.ay}학년도 표본 시간표에서 과목 ${n}개 확인 (수집 ${state.school.collected}).`
      + (state.school.keyless ? ' 시험용 표본이라 일부만 담겨 있습니다.' : '');
  } catch {
    state.school = null;
    info.textContent = '이 학교의 시간표 데이터를 아직 모으지 못했습니다.';
  }
  renderRules();
}

async function init() {
  const univs = await getJson('data/universities.json');
  const sel = $('univ');
  sel.replaceChildren(el('option', '대학을 고르세요'));
  sel.firstChild.value = '';
  for (const u of univs) {
    const o = el('option', `${u.university} (${u.majors}개 모집단위)`);
    o.value = u.key;
    sel.append(o);
  }
  sel.addEventListener('change', () => chooseUniv(sel.value));
  $('major-q').addEventListener('input', fillMajors);
  $('major').addEventListener('change', () => {
    state.major = state.univ?.majors[Number($('major').value)] ?? null;
    renderRules();
  });

  try { state.schools = await getJson('data/schools/index.json'); } catch { state.schools = []; }
  const dl = $('school-list');
  for (const s of state.schools) {
    const o = el('option');
    o.value = `${s.name} (${s.sido})`;
    dl.append(o);
  }
  if (state.schools.length === 0) $('school-info').textContent = '학교 시간표 데이터를 준비 중입니다. 과목 체크는 바로 쓸 수 있습니다.';
  $('school-q').addEventListener('change', (e) => chooseSchool(e.target.value));
}

init().catch(() => { $('univ').replaceChildren(el('option', '데이터를 불러오지 못했습니다')); });
