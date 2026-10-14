#!/usr/bin/env node
// NEIS 고등학교 시간표에서 학교별 "운영이 확인된 과목"을 모은다.
//
//   NEIS_API_KEY=... node tools/build_schools.mjs --ay 2026 [--region B10] [--limit 20] [--max-age-days 30]
//   node tools/build_schools.mjs --ay 2026 --region B10 --school 7010057 --keyless   (키 없이 5행만, 파싱 점검용)
//
// 결과: docs/data/schools/index.json, docs/data/schools/<교육청코드>/<학교코드>.json
// 인증키는 환경변수로만 받고, 로그·오류 메시지·결과 파일에 URL을 남기지 않는다(NEIS 약관 제7조: 키 공개 금지).
import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { makeNormalizer, cleanName } from '../docs/match.js';
import { isFresh, is2022Cohort, defaultAcademicYear, shouldWrite } from './schools-lib.mjs';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const OUT = join(root, 'docs', 'data', 'schools');
const BASE = 'https://open.neis.go.kr/hub/';
const GAP_MS = 120;

const args = process.argv.slice(2);
const arg = (n, d) => { const i = args.indexOf(`--${n}`); return i >= 0 ? args[i + 1] : d; };
const flag = (n) => args.includes(`--${n}`);

const AY = arg('ay', defaultAcademicYear(new Date().toISOString().slice(0, 10)));
const REGION = arg('region');
const ONLY = arg('school');
const LIMIT = Number(arg('limit', '0'));
const MAX_AGE_DAYS = Number(arg('max-age-days', '30'));
const KEYLESS = flag('keyless');
const KEY = process.env.NEIS_API_KEY || '';
if (!KEYLESS && !KEY) { console.error('NEIS_API_KEY 환경변수가 필요합니다(또는 --keyless).'); process.exit(2); }
if (!/^\d{4}$/.test(AY)) { console.error('--ay 는 네 자리 연도'); process.exit(2); }
if (REGION && !/^[A-Z]\d{2}$/.test(REGION)) { console.error('--region 은 교육청 코드(예: B10)'); process.exit(2); }
if (ONLY && !/^\d{7}$/.test(ONLY)) { console.error('--school 은 7자리 학교 코드'); process.exit(2); }
if (!Number.isInteger(LIMIT) || LIMIT < 0) { console.error('--limit 은 0 이상의 정수'); process.exit(2); }

// 학기마다 2주씩 표본으로 본다. 시험·행사 주간을 피하려고 4월·9월 중순을 쓴다.
const WINDOWS = [
  { sem: '1', from: `${AY}0413`, to: `${AY}0424` },
  { sem: '2', from: `${AY}0914`, to: `${AY}0925` },
];

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function neis(service, params) {
  const q = new URLSearchParams({ Type: 'json', pIndex: '1', pSize: KEYLESS ? '5' : '1000', ...params });
  if (!KEYLESS) q.set('KEY', KEY);
  const rows = [];
  for (let page = 1; ; page++) {
    q.set('pIndex', String(page));
    await sleep(GAP_MS);
    let json;
    try {
      const res = await fetch(BASE + service + '?' + q, { signal: AbortSignal.timeout(30000) });
      json = await res.json();
    } catch (e) {
      throw new Error(`${service} 호출 실패 (${e?.name || 'Error'})`); // URL(키 포함)은 남기지 않는다
    }
    const body = json[service];
    if (!body) {
      const code = json?.RESULT?.CODE;
      if (code === 'INFO-200') return rows; // 해당 데이터 없음
      throw new Error(`${service} 응답 오류 ${code || '알 수 없음'}`);
    }
    const total = body[0].head[0].list_total_count;
    rows.push(...(body[1]?.row || []));
    if (KEYLESS || rows.length >= total) return rows;
  }
}

async function readExisting(path) {
  try { return JSON.parse(await readFile(path, 'utf8')); } catch { return null; }
}

async function fresh(path) {
  try {
    const file = JSON.parse(await readFile(path, 'utf8'));
    return isFresh(file, AY, WINDOWS, new Date().toISOString().slice(0, 10), MAX_AGE_DAYS);
  } catch { return false; }
}

async function main() {
  const normalize = makeNormalizer(JSON.parse(await readFile(join(root, 'data', 'subjects.json'), 'utf8')));
  const params = { SCHUL_KND_SC_NM: '고등학교' };
  if (REGION) params.ATPT_OFCDC_SC_CODE = REGION;
  if (ONLY) params.SD_SCHUL_CODE = ONLY;
  let schools = (await neis('schoolInfo', params))
    .filter((s) => s.SD_SCHUL_CODE?.trim())
    .map((s) => ({ region: s.ATPT_OFCDC_SC_CODE, code: s.SD_SCHUL_CODE.trim(), name: s.SCHUL_NM, sido: s.LCTN_SC_NM, kind: s.HS_SC_NM || '' }));
  if (LIMIT) schools = schools.slice(0, LIMIT);

  await mkdir(OUT, { recursive: true });
  const indexPath = join(OUT, 'index.json');
  let index = [];
  try { index = JSON.parse(await readFile(indexPath, 'utf8')); } catch { /* 처음 */ }
  const byCode = new Map(index.map((s) => [`${s.region}-${s.code}`, s]));

  let done = 0, skipped = 0, failed = 0;
  for (const s of schools) {
    const file = join(OUT, s.region, `${s.code}.json`);
    if (!KEYLESS && await fresh(file)) { skipped++; byCode.set(`${s.region}-${s.code}`, s); continue; }
    try {
      const subjects = {};
      const other = new Set();
      for (const w of WINDOWS) {
        const rows = await neis('hisTimetable', {
          ATPT_OFCDC_SC_CODE: s.region, SD_SCHUL_CODE: s.code, AY, SEM: w.sem, TI_FROM_YMD: w.from, TI_TO_YMD: w.to,
        });
        for (const r of rows) {
          if (!is2022Cohort(AY, r.GRADE)) continue;
          const name = normalize(r.ITRT_CNTNT);
          if (!name) { if (r.ITRT_CNTNT) other.add(cleanName(r.ITRT_CNTNT)); continue; }
          const e = (subjects[name] ||= { grades: [], sems: [] });
          if (!e.grades.includes(Number(r.GRADE))) e.grades.push(Number(r.GRADE));
          if (!e.sems.includes(Number(w.sem))) e.sems.push(Number(w.sem));
        }
      }
      for (const e of Object.values(subjects)) { e.grades.sort(); e.sems.sort(); }
      if (!shouldWrite(subjects, await readExisting(file))) {
        skipped++;
        byCode.set(`${s.region}-${s.code}`, s);
        continue;
      }
      await mkdir(join(OUT, s.region), { recursive: true });
      await writeFile(file, JSON.stringify({
        name: s.name, region: s.region, code: s.code, ay: AY,
        collected: new Date().toISOString().slice(0, 10),
        windows: WINDOWS, keyless: KEYLESS || undefined,
        subjects, other: [...other].sort().slice(0, 200),
      }) + '\n');
      byCode.set(`${s.region}-${s.code}`, s);
      done++;
    } catch (e) {
      failed++;
      console.error(`${s.name}(${s.region}-${s.code}): ${e.message}`);
      if (/ERROR-(290|300|310|337)/.test(e.message)) break; // 인증·한도 오류면 멈춘다
    }
  }
  const out = [...byCode.values()].sort((a, b) => a.name.localeCompare(b.name, 'ko'));
  await writeFile(indexPath, JSON.stringify(out) + '\n');
  console.log(`학교 ${schools.length}곳: 수집 ${done}, 최신이라 건너뜀 ${skipped}, 실패 ${failed}. 색인 ${out.length}곳`);
  if (failed && done === 0) process.exit(1);
}

main().catch((e) => { console.error(e.message); process.exit(1); });
