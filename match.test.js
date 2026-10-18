import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import {
  stripBlockTag, cleanName, makeNormalizer, evaluateRule, evaluateMajor, schoolStatus, unknownSubjects,
} from './docs/match.js';

const subjects = JSON.parse(readFileSync(new URL('./data/subjects.json', import.meta.url), 'utf8'));
const normalize = makeNormalizer(subjects);

test('NEIS 블록 꼬리표만 지우고 정식 과목명 숫자는 남긴다', () => {
  assert.equal(stripBlockTag('주제 탐구 독서D1'), '주제 탐구 독서');
  assert.equal(stripBlockTag('윤리와 사상A3'), '윤리와 사상');
  assert.equal(stripBlockTag('자율활동_G1'), '자율활동');
  assert.equal(stripBlockTag('미적분ⅡB2'), '미적분Ⅱ');
  assert.equal(stripBlockTag('공통수학2'), '공통수학2');
  assert.equal(stripBlockTag('스포츠 생활1'), '스포츠 생활1');
});

test('로마숫자·공백 변형을 사전 과목명으로 맞춘다', () => {
  assert.equal(cleanName('미적분 II'), '미적분Ⅱ');
  assert.equal(normalize('미적분II'), '미적분Ⅱ');
  assert.equal(normalize('미적분ⅡC1'), '미적분Ⅱ');
  assert.equal(normalize('확률과통계'), '확률과 통계');
  assert.equal(normalize('주제 탐구 독서D1'), '주제 탐구 독서');
  assert.equal(normalize('자율활동_G1'), null);
});

test('사전 과목은 151개(고시 표5) 이상이고 이름이 겹치지 않는다', () => {
  assert.ok(subjects.length >= 151);
  assert.equal(new Set(subjects.map((s) => s.name)).size, subjects.length);
});

test('모든 대학 규칙의 과목이 사전에 있다', () => {
  const dir = new URL('./data/universities/', import.meta.url);
  for (const f of readdirSync(dir)) {
    const u = JSON.parse(readFileSync(new URL(f, dir), 'utf8'));
    assert.deepEqual(unknownSubjects(u, subjects), [], f);
    for (const m of u.majors) {
      for (const r of [...m.core, ...m.recommended]) {
        assert.ok(r.all || (Number.isInteger(r.choose) && r.choose >= 1 && r.choose <= r.of.length), `${f} ${m.name}`);
      }
    }
  }
});

test('규칙 판정', () => {
  const taken = new Set(['기하', '물리학']);
  assert.equal(evaluateRule({ all: ['기하', '미적분Ⅱ'] }, taken).ok, false);
  assert.equal(evaluateRule({ all: ['기하'] }, taken).ok, true);
  const c = evaluateRule({ choose: 1, of: ['물리학', '화학'] }, taken);
  assert.deepEqual([c.ok, c.have, c.need], [true, 1, 1]);
  const m = evaluateMajor({ core: [{ all: ['기하'] }], recommended: [{ choose: 2, of: ['물리학', '화학'] }] }, taken);
  assert.equal(m.ok, false);
});

test('학교 운영 상태', () => {
  const school = { subjects: { 기하: { grades: [2], sems: [1] } } };
  assert.equal(schoolStatus('기하', school), 'offered');
  assert.equal(schoolStatus('미적분Ⅱ', school), 'unseen');
  assert.equal(schoolStatus('기하', null), 'no-school');
  assert.equal(schoolStatus('toString', school), 'unseen');
});

test('학교 파일 최신 판정은 파일 안 수집 날짜로 한다', async () => {
  const { isFresh } = await import('./tools/schools-lib.mjs');
  const W = [{ sem: '1', from: '20260413', to: '20260424' }, { sem: '2', from: '20260914', to: '20260925' }];
  const f = (collected, extra = {}) => ({ ay: '2026', collected, ...extra });
  assert.equal(isFresh(f('2026-10-01', { keyless: true }), '2026', W, '2026-10-02', 30), false); // 키 없는 표본
  assert.equal(isFresh(f('2026-05-01'), '2026', W, '2026-10-01', 400), false); // 2학기 표본 뒤 다시 받기
  assert.equal(isFresh(f('2026-10-01'), '2026', W, '2026-10-05', 30), true);
  assert.equal(isFresh(f('2026-05-01'), '2026', W, '2026-05-10', 30), true);
  assert.equal(isFresh(f('2026-04-20'), '2026', W, '2026-05-01', 30), false); // 1학기 표본 기간 중 수집
  assert.equal(isFresh(f('2025-10-01'), '2026', W, '2026-05-01', 400), false); // 지난 학년도
});

test('2015 개정 학년은 운영 확인에서 뺀다', async () => {
  const { is2022Cohort } = await import('./tools/schools-lib.mjs');
  assert.deepEqual([1, 2, 3].map((g) => is2022Cohort('2026', g)), [true, true, false]);
  assert.deepEqual([1, 2, 3].map((g) => is2022Cohort('2027', g)), [true, true, true]);
  assert.equal(is2022Cohort('2025', 2), false);
});

test('대학 출처 링크는 https만', () => {
  const dir = new URL('./data/universities/', import.meta.url);
  for (const f of readdirSync(dir)) {
    const u = JSON.parse(readFileSync(new URL(f, dir), 'utf8'));
    assert.match(u.source.url, /^https:\/\//, f);
  }
});

test('기본 학년도와 빈 결과 덮어쓰기 방지', async () => {
  const { defaultAcademicYear, shouldWrite } = await import('./tools/schools-lib.mjs');
  assert.equal(defaultAcademicYear('2027-02-10'), '2026');
  assert.equal(defaultAcademicYear('2027-04-24'), '2026');
  assert.equal(defaultAcademicYear('2027-04-25'), '2027');
  assert.equal(defaultAcademicYear('2026-10-14'), '2026');
  assert.equal(shouldWrite({}, { subjects: { 기하: {} } }), false);
  assert.equal(shouldWrite({}, null), true);
  assert.equal(shouldWrite({ 기하: {} }, { subjects: { 대수: {} } }), true);
});

test('부족한 과목 문장과 대학 비교 검색', async () => {
  const { shortfall, majorSummary, searchMajors, ruleSubjects, evaluateRule } = await import('./docs/match.js');
  const meta = new Map(subjects.map((s) => [s.name, s]));
  const sci = subjects.filter((s) => s.area === '과학' && s.type === '진로선택').map((s) => s.name);
  const taken = new Set(['기하', sci[0]]);
  assert.equal(shortfall(evaluateRule({ all: ['기하', '미적분Ⅱ'] }, taken), taken, meta), '미적분Ⅱ');
  assert.equal(shortfall(evaluateRule({ choose: 1, of: ['물리학', '화학'] }, taken), taken, meta), '물리학·화학 중 1과목 더');
  assert.equal(shortfall(evaluateRule({ choose: 3, of: sci }, taken), taken, meta), '과학 진로선택 중 2과목 더');
  assert.equal(shortfall(evaluateRule({ all: ['기하'] }, taken), taken, meta), null);
  const mixed = ['물리학', '화학', '역학과 에너지', '전자기와 양자', '물질과 에너지', '화학 반응의 세계'];
  // taken에 '역학과 에너지'(sci[0])가 있어 1과목 충족, 남은 5과목을 나열한다
  assert.equal(shortfall(evaluateRule({ choose: 2, of: mixed }, taken), taken, meta), `${mixed.filter((x) => !taken.has(x)).join('·')} 중 1과목 더`);
  const s = majorSummary({ core: [], recommended: [{ all: ['기하', '미적분Ⅱ'] }], note: '해석 확인 필요' }, taken, meta);
  assert.deepEqual([s.total, s.ok, s.short, s.caution], [1, 0, ['미적분Ⅱ'], true]);
  const dir = new URL('./data/universities/', import.meta.url);
  const univs = readdirSync(dir).map((f) => JSON.parse(readFileSync(new URL(f, dir), 'utf8')));
  const hits = searchMajors(univs, '컴퓨터');
  assert.ok(hits.length >= 5 && new Set(hits.map((h) => h.univ.key)).size >= 4);
  // 공통 기준 대학(한양대)은 검색어와 상관없이 결과 끝에 들어간다
  assert.equal(hits[hits.length - 1].univ.key, 'hanyang');
  assert.equal(hits[hits.length - 1].common, true);
  assert.ok(searchMajors(univs, '없는학과이름').every((h) => h.common));
  assert.ok(searchMajors(univs, '컴퓨터', 'yonsei').every((h) => h.univ.key === 'yonsei'));
  assert.equal(searchMajors(univs, '의 예').length, searchMajors(univs, '의예').length);
  const used = ruleSubjects(univs, subjects).map((x) => x.name);
  assert.ok(used.includes('기하') && used.includes('미적분Ⅱ') && !used.includes('공통국어1'));
});
