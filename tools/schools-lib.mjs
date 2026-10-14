// 학교 시간표 수집의 순수 함수(테스트 대상).

// 이미 모은 파일을 다시 받지 않아도 되는지. 파일 수정 시각은 checkout 시각이라 믿을 수 없으므로
// 파일 안의 수집 날짜(collected)로 판단한다.
// - 키 없이 받은 표본은 항상 다시 받는다.
// - 지나간 표본 기간 중 가장 최근 것이 끝난 뒤에 모은 파일이어야 한다(5월 파일은 10월에 다시 받는다).
export function isFresh(file, ay, windows, today, maxAgeDays) {
  if (!file || file.keyless || file.ay !== ay || !file.collected) return false;
  const iso = (ymd) => `${ymd.slice(0, 4)}-${ymd.slice(4, 6)}-${ymd.slice(6, 8)}`;
  const passed = windows.map((w) => iso(w.to)).filter((d) => d < today).sort();
  const lastEnd = passed[passed.length - 1];
  if (lastEnd && file.collected <= lastEnd) return false;
  return (Date.parse(today) - Date.parse(file.collected)) / 864e5 <= maxAgeDays;
}

// 2022 개정 교육과정은 2025년 고1 입학생부터 적용된다. 그 전 입학생 학년의 시간표는
// 기하·영어Ⅰ처럼 이름이 같은 2015 개정 과목이 섞이므로 '운영 확인'에서 뺀다.
export const CURRICULUM_2022_FIRST_ENTRY = 2025;
export function is2022Cohort(ay, grade) {
  return Number(ay) - Number(grade) + 1 >= CURRICULUM_2022_FIRST_ENTRY;
}

// 학년도를 따로 주지 않으면, 1학기 표본 기간(4월 중순)이 끝나기 전에는 지난 학년도를 본다.
// 그래야 1~4월에 수동으로 돌려도 아직 시간표가 없는 새 학년도로 조회하지 않는다.
export function defaultAcademicYear(today) {
  const year = Number(today.slice(0, 4));
  return String(today.slice(5) < '04-25' ? year - 1 : year);
}

// 새로 모은 과목이 0개인데 기존 파일에 과목이 있으면 덮어쓰지 않는다(일시 오류·빈 기간으로 데이터를 잃지 않게).
export function shouldWrite(subjects, existing) {
  const fresh = Object.keys(subjects || {}).length;
  const old = Object.keys(existing?.subjects || {}).length;
  return fresh > 0 || old === 0;
}
