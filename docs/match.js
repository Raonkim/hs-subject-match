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
