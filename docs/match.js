// 과목명 정규화와 권장과목 충족 판정. 브라우저·Node(빌드·테스트)가 같이 쓴다.

const ROMAN = { I: 'Ⅰ', II: 'Ⅱ', III: 'Ⅲ' };

// NEIS 시간표 과목명 끝의 블록 꼬리표(예: "주제 탐구 독서D1", "자율활동_G1")를 지운다.
// "공통수학2", "스포츠 생활1"처럼 숫자로 끝나는 정식 과목명은 건드리지 않는다.
export function stripBlockTag(name) {
  return String(name).replace(/_[A-Z]\d+$/, '').replace(/(?<=[가-힣Ⅰ-Ⅲ)\s])[A-Z]\d+$/, '').trim();
}

export function cleanName(name) {
  return stripBlockTag(String(name).normalize('NFC'))
    .replace(/\s+/g, ' ')
    .replace(/(?<=[가-힣])\s?(III|II|I)$/, (m) => ROMAN[m.trim()])
    .replace(/\s?([ⅠⅡⅢ])$/, '$1')
    .trim();
}

// 과목 사전(subjects.json)으로 정규화 함수를 만든다. 사전에 없으면 null.
export function makeNormalizer(subjects) {
  const map = new Map();
  const squash = (s) => cleanName(s).replace(/[\s·・ㆍ]/g, '');
  for (const s of subjects) {
    map.set(squash(s.name), s.name);
    for (const a of s.aliases || []) map.set(squash(a), s.name);
  }
  return (raw) => map.get(squash(raw)) ?? null;
}

// 규칙 하나의 충족 여부. all: 모두, choose N of: N과목 이상.
export function evaluateRule(rule, taken) {
  if (rule.all) {
    const have = rule.all.filter((s) => taken.has(s));
    return { kind: 'all', need: rule.all.length, have: have.length, ok: have.length === rule.all.length, subjects: rule.all };
  }
  if (rule.choose !== undefined) {
    const have = rule.of.filter((s) => taken.has(s));
    return { kind: 'choose', need: rule.choose, have: have.length, ok: have.length >= rule.choose, subjects: rule.of };
  }
  throw new Error('알 수 없는 규칙 형식');
}

export function evaluateMajor(major, taken) {
  const core = (major.core || []).map((r) => evaluateRule(r, taken));
  const recommended = (major.recommended || []).map((r) => evaluateRule(r, taken));
  return { core, recommended, ok: [...core, ...recommended].every((r) => r.ok) };
}

// 학교에서 운영이 확인된 과목인지: 'offered' | 'unseen' | 'no-school'
export function schoolStatus(subject, school) {
  if (!school) return 'no-school';
  return school.subjects && Object.hasOwn(school.subjects, subject) ? 'offered' : 'unseen';
}

// 규칙에 쓰인 과목이 모두 사전에 있는지(빌드 검증용)
export function unknownSubjects(university, subjects) {
  const names = new Set(subjects.map((s) => s.name));
  const bad = new Set();
  for (const m of university.majors) {
    for (const r of [...(m.core || []), ...(m.recommended || [])]) {
      for (const s of r.all || r.of || []) if (!names.has(s)) bad.add(s);
    }
  }
  return [...bad];
}

// 여러 과목이 같은 교과·유형이면 그 묶음 이름(예: "과학 진로선택")을 돌려준다.
export function groupName(list, meta) {
  const first = meta.get(list[0]);
  if (!first) return null;
  return list.every((s) => meta.get(s)?.area === first.area && meta.get(s)?.type === first.type) ? `${first.area} ${first.type}` : null;
}

// 충족하지 못한 규칙을 한 줄로. 예: "기하", "물리학·화학 중 1과목 더", "과학 진로선택 중 2과목 더"
export function shortfall(ev, taken, meta = new Map()) {
  if (ev.ok) return null;
  const left = ev.subjects.filter((s) => !taken.has(s));
  if (ev.kind === 'all') return left.join('·');
  const more = ev.need - ev.have;
  const g = groupName(ev.subjects, meta);
  // 묶음 이름(예: 과학 진로선택)이 없으면 무엇을 들어야 하는지 알 수 있게 과목명을 나열한다
  if (left.length <= 4 || (!g && left.length <= 8)) return `${left.join('·')} 중 ${more}과목 더`;
  return `${g ?? `${ev.subjects.length}과목`} 중 ${more}과목 더`;
}

// 모집단위 하나의 요약: 규칙 수, 충족 수, 부족 목록, 해석 확인 필요 여부
export function majorSummary(major, taken, meta = new Map()) {
  const ev = evaluateMajor(major, taken);
  const rules = [...ev.core, ...ev.recommended];
  return {
    total: rules.length,
    ok: rules.filter((r) => r.ok).length,
    short: rules.map((r) => shortfall(r, taken, meta)).filter(Boolean),
    caution: Boolean(major.note && major.note.includes('확인 필요')),
  };
}

// 모든 대학 규칙에 나오는 과목을 사전 순서(교과·유형)대로. 맨 위 체크리스트용.
export function ruleSubjects(universities, subjects) {
  const used = new Set();
  for (const u of universities) for (const m of u.majors) for (const r of [...(m.core || []), ...(m.recommended || [])]) {
    for (const s of r.all || r.of || []) used.add(s);
  }
  return subjects.filter((s) => used.has(s.name));
}

// 모집단위 구분 없이 계열 전체에 한 규칙을 쓰는 대학(예: 한양대 '자연계열 전 모집단위')
export function isCommonStandard(university) {
  return university.majors.length === 1 && university.majors[0].name.includes('전 모집단위');
}

// 학과 이름으로 모든 대학을 찾는다. 공백은 무시한다.
// 공통 기준 대학은 학과 이름이 없으므로, 검색어와 상관없이 결과 끝에 넣는다(common: true).
export function searchMajors(universities, query, univKey = '') {
  const q = String(query).replace(/\s+/g, '');
  const out = [];
  const common = [];
  for (const u of universities) {
    if (univKey && u.key !== univKey) continue;
    if (isCommonStandard(u)) { common.push({ univ: u, major: u.majors[0], index: 0, common: true }); continue; }
    u.majors.forEach((m, i) => {
      if (!q || m.name.replace(/\s+/g, '').includes(q)) out.push({ univ: u, major: m, index: i });
    });
  }
  return [...out, ...common];
}
