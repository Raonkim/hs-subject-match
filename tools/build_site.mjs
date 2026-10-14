#!/usr/bin/env node
// data/ 의 원본을 검증한 뒤 docs/data/ 로 복사하고 대학 목록(index)을 만든다.
// 규칙에 사전에 없는 과목명이 하나라도 있으면 실패한다.
import { readFile, writeFile, mkdir, readdir } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { unknownSubjects } from '../docs/match.js';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const src = join(root, 'data');
const out = join(root, 'docs', 'data');

const subjects = JSON.parse(await readFile(join(src, 'subjects.json'), 'utf8'));
await mkdir(join(out, 'universities'), { recursive: true });
await writeFile(join(out, 'subjects.json'), JSON.stringify(subjects) + '\n');

const index = [];
let failed = false;
for (const file of (await readdir(join(src, 'universities'))).filter((f) => f.endsWith('.json')).sort()) {
  const u = JSON.parse(await readFile(join(src, 'universities', file), 'utf8'));
  const bad = unknownSubjects(u, subjects);
  if (bad.length) { console.error(`${file}: 사전에 없는 과목 ${bad.join(', ')}`); failed = true; }
  if (!u.source?.url || !u.key || !Array.isArray(u.majors)) { console.error(`${file}: 필수 필드 누락`); failed = true; }
  if (u.source?.url && !u.source.url.startsWith('https://')) { console.error(`${file}: 출처 링크는 https만`); failed = true; }
  await writeFile(join(out, 'universities', file), JSON.stringify(u) + '\n');
  index.push({ key: u.key, university: u.university, majors: u.majors.length, basis_date: u.source.basis_date });
}
if (failed) process.exit(1);
index.sort((a, b) => a.university.localeCompare(b.university, 'ko'));
await writeFile(join(out, 'universities.json'), JSON.stringify(index, null, 1) + '\n');
console.log(`대학 ${index.length}곳, 모집단위 ${index.reduce((s, u) => s + u.majors, 0)}개, 과목 ${subjects.length}개`);
