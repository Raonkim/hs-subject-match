# -*- coding: utf-8 -*-
"""B 서비스 데이터 생성: subjects.json + universities/*.json
입력: 어디가 xlsx(로컬, 재배포 안 함). 출력: 정리한 규칙 JSON.
"""
import sys, json, re, os, collections
import openpyxl

XLSX, OUT = sys.argv[1], sys.argv[2]
RETRIEVED = "2026-10-10"

# ---------------- 1) 과목 사전 (총론 <표5>, 일부 <표6>) ----------------
T = []
def add(area, typ, names, special=None):
    for n in names:
        d = {"name": n, "area": area, "type": typ, "aliases": []}
        if special: d["special"] = special
        T.append(d)

add("국어", "공통", ["공통국어1", "공통국어2"])
add("국어", "일반선택", ["화법과 언어", "독서와 작문", "문학"])
add("국어", "진로선택", ["주제 탐구 독서", "문학과 영상", "직무 의사소통"])
add("국어", "융합선택", ["독서 토론과 글쓰기", "매체 의사소통", "언어생활 탐구"])
add("수학", "공통", ["공통수학1", "공통수학2"])
add("수학", "공통", ["기본수학1", "기본수학2"], special="공통과목 대체이수(151과목 미포함)")
add("수학", "일반선택", ["대수", "미적분Ⅰ", "확률과 통계"])
add("수학", "진로선택", ["기하", "미적분Ⅱ", "경제 수학", "인공지능 수학", "직무 수학"])
add("수학", "융합선택", ["수학과 문화", "실용 통계", "수학과제 탐구"])
add("영어", "공통", ["공통영어1", "공통영어2"])
add("영어", "공통", ["기본영어1", "기본영어2"], special="공통과목 대체이수(151과목 미포함)")
add("영어", "일반선택", ["영어Ⅰ", "영어Ⅱ", "영어 독해와 작문"])
add("영어", "진로선택", ["영미 문학 읽기", "영어 발표와 토론", "심화 영어", "심화 영어 독해와 작문", "직무 영어"])
add("영어", "융합선택", ["실생활 영어 회화", "미디어 영어", "세계 문화와 영어"])
add("사회", "공통", ["한국사1", "한국사2", "통합사회1", "통합사회2"])
add("사회", "일반선택", ["세계시민과 지리", "세계사", "사회와 문화", "현대사회와 윤리"])
add("사회", "진로선택", ["한국지리 탐구", "도시의 미래 탐구", "동아시아 역사 기행", "정치", "법과 사회", "경제",
                      "윤리와 사상", "인문학과 윤리", "국제 관계의 이해"])
add("사회", "융합선택", ["여행지리", "역사로 탐구하는 현대 세계", "사회문제 탐구", "금융과 경제생활",
                      "윤리문제 탐구", "기후변화와 지속가능한 세계"])
add("과학", "공통", ["통합과학1", "통합과학2", "과학탐구실험1", "과학탐구실험2"])
add("과학", "일반선택", ["물리학", "화학", "생명과학", "지구과학"])
SCI_C = ["역학과 에너지", "전자기와 양자", "물질과 에너지", "화학 반응의 세계",
         "세포와 물질대사", "생물의 유전", "지구시스템과학", "행성우주과학"]
add("과학", "진로선택", SCI_C)
add("과학", "융합선택", ["과학의 역사와 문화", "기후변화와 환경생태", "융합과학 탐구"])
add("기술·가정", "일반선택", ["기술·가정"])
add("기술·가정", "진로선택", ["로봇과 공학세계", "생활과학 탐구"])
add("기술·가정", "융합선택", ["창의 공학 설계", "지식 재산 일반", "생애 설계와 자립", "아동발달과 부모"])
add("정보", "일반선택", ["정보"])
add("정보", "진로선택", ["인공지능 기초", "데이터 과학"])
add("정보", "융합선택", ["소프트웨어와 생활"])
LANGS = ["독일어", "프랑스어", "스페인어", "중국어", "일본어", "러시아어", "아랍어", "베트남어"]
CULT = ["독일어권 문화", "프랑스어권 문화", "스페인어권 문화", "중국 문화", "일본 문화", "러시아 문화", "아랍 문화", "베트남 문화"]
add("제2외국어", "일반선택", LANGS)
add("제2외국어", "진로선택", [l + " 회화" for l in LANGS] + ["심화 " + l for l in LANGS])
add("제2외국어", "융합선택", CULT)
add("한문", "일반선택", ["한문"])
add("한문", "진로선택", ["한문 고전 읽기"])
add("한문", "융합선택", ["언어생활과 한자"])
add("체육", "일반선택", ["체육1", "체육2"])
add("체육", "진로선택", ["운동과 건강", "스포츠 문화", "스포츠 과학"])
add("체육", "융합선택", ["스포츠 생활1", "스포츠 생활2"])
add("예술", "일반선택", ["음악", "미술", "연극"])
add("예술", "진로선택", ["음악 연주와 창작", "음악 감상과 비평", "미술 창작", "미술 감상과 비평"])
add("예술", "융합선택", ["음악과 미디어", "미술과 매체"])
add("교양", "일반선택", ["진로와 직업", "생태와 환경"])
add("교양", "진로선택", ["인간과 철학", "논리와 사고", "인간과 심리", "교육의 이해", "삶과 종교", "보건"])
add("교양", "융합선택", ["인간과 경제활동", "논술"])
# <표6> 과학계열 특목고 전공 관련 과목(수학·과학·정보만)
SP6 = "과학계열 특목고 전공 관련 과목(총론 표6)"
add("수학", "진로선택", ["전문 수학", "이산 수학", "고급 기하", "고급 대수", "고급 미적분"], SP6)
add("과학", "진로선택", ["고급 물리학", "고급 화학", "고급 생명과학", "고급 지구과학", "과학과제 연구"], SP6)
add("과학", "융합선택", ["물리학 실험", "화학 실험", "생명과학 실험", "지구과학 실험"], SP6)
add("정보", "진로선택", ["정보과학"], SP6)

# 실제로 관찰된 오타·변형(출처는 SOURCES.md)
OBSERVED = {
    "생물의 유전": ["생물과 유전"],            # 어디가 xlsx 경희대 생명계열 행
    "주제 탐구 독서": ["주제탐구 독서"],        # 어디가 xlsx
    "동아시아 역사 기행": ["동아시아 역사기행"],  # 어디가 xlsx
    "도시의 미래 탐구": ["도시의 미래탐구"],      # 어디가 xlsx
    "영어 독해와 작문": ["영어독해와 작문"],      # 어디가 xlsx
    "사회와 문화": ["사화와 문화"],              # 어디가 xlsx(오타)
    "국제 관계의 이해": ["국제관계의 이해"],      # 어디가 xlsx
    "스포츠 과학": ["스포츠과학"],              # 어디가 xlsx
    "기술·가정": ["기술가정"],                  # 어디가 xlsx
}
ROMAN = {"Ⅰ": ["I", "1"], "Ⅱ": ["II", "2"]}
names = [s["name"] for s in T]
assert len(names) == len(set(names)), "중복 과목명"
for s in T:
    n = s["name"]; al = []
    al += OBSERVED.get(n, [])
    for r, alts in ROMAN.items():
        if r in n:
            for a in alts:
                al.append(n.replace(r, a))
            al.append(n.replace(r, " " + r))
    if " " in n:
        al.append(n.replace(" ", ""))
    if "·" in n:
        al.append(n.replace("·", "ㆍ")); al.append(n.replace("·", "・"))
    seen = []
    for a in al:
        if a != n and a not in seen and a not in names:
            seen.append(a)
    s["aliases"] = seen
ALIAS = {}
for s in T:
    ALIAS[s["name"]] = s["name"]
    for a in s["aliases"]:
        assert a not in ALIAS or ALIAS[a] == s["name"], a
        ALIAS[a] = s["name"]
AREA = {s["name"]: s["area"] for s in T}

UNKNOWN = []
def norm(tok, ctx):
    t = tok.strip().strip("[]").strip()
    t = re.sub(r"\s+", " ", t)
    if t in ALIAS:
        return ALIAS[t]
    if t.replace(" ", "") in ALIAS:
        return ALIAS[t.replace(" ", "")]
    UNKNOWN.append((ctx, t))
    return None

def split_top(s):
    out, buf, depth = [], "", 0
    for ch in s:
        if ch == "[": depth += 1
        if ch == "]": depth -= 1
        if ch == "," and depth == 0:
            out.append(buf); buf = ""
        else:
            buf += ch
    if buf.strip(): out.append(buf)
    return [x.strip() for x in out if x.strip() and x.strip() != "-"]

def parse_list(s, ctx):
    """'A, B, [C, D 중 2과목], [E 또는 F], G 또는 H' -> rules"""
    rules, alls, notes = [], [], []
    if not s or s.strip() in ("-", ""):
        return rules, notes
    for tok in split_top(s):
        m = re.match(r"^\[(.+?)\s*중\s*(\d)과목(?: 이상)?\]$", tok)
        if m:
            of = [norm(x, ctx) for x in m.group(1).split(",")]
            rules.append({"choose": int(m.group(2)), "of": [x for x in of if x]}); continue
        inner = tok[1:-1] if tok.startswith("[") and tok.endswith("]") else tok
        if "또는" in inner:
            of = [norm(x, ctx) for x in inner.split("또는")]
            rules.append({"choose": 1, "of": [x for x in of if x]}); continue
        n = norm(tok, ctx)
        if n: alls.append(n)
    if alls:
        rules.insert(0, {"all": alls})
    return rules, notes

def cell(v):
    return "" if v is None else str(v).replace("\n", " ").strip()

def raw_of(c, r, b):
    parts = []
    if c and c != "-": parts.append("핵심과목: " + c)
    if r and r != "-": parts.append("권장과목: " + r)
    if b and b != "-": parts.append("비고: " + b)
    return " | ".join(parts) if parts else "-"

wb = openpyxl.load_workbook(XLSX, read_only=True, data_only=True)
ROWS = [r for r in list(wb.worksheets[0].iter_rows(values_only=True))[4:] if r[2]]
def rows_of(u):
    return [r for r in ROWS if cell(r[2]).replace(" ", "") == u]

ADIGA = {"title": "2028학년도 권역별 대학별 권장과목(반영과목) (한국대학교육협의회 대입정보포털)",
         "url": "https://www.adiga.kr/uct/ces/archiveView.do?menuId=PCUCTCES1000&prtlBbsId=26634",
         "basis_date": "2026-02-20", "retrieved": RETRIEVED}
REF_ADIGA = "adiga-2028-region-xlsx"

def scicount(lst):
    return [x for x in lst if AREA.get(x) == "과학"]

def finish(univ, key, source, majors, extra=None):
    d = {"university": univ, "key": key, "admission_year": 2028, "source": source}
    if extra: d.update(extra)
    d["majors"] = majors
    # 검증
    for m in majors:
        for grp in ("core", "recommended"):
            for rule in m[grp]:
                for x in rule.get("all", []) + rule.get("of", []):
                    assert x in AREA, (univ, m["name"], x)
    with open(os.path.join(OUT, "universities", key + ".json"), "w", encoding="utf-8") as f:
        json.dump(d, f, ensure_ascii=False, indent=2)
    return d

STATS = {}
def stat(d):
    n = len(d["majors"]); c = sum(1 for m in d["majors"] if "해석 확인 필요" in m["note"])
    STATS[d["key"]] = (d["university"], n, c)

# ---------------- 경희대 ----------------
KHU_FIELD = {"수학": "자연", "물리": "자연", "화학": "자연", "천문·지구": "자연",
             "생명과학·환경/생활과학/농림": "자연", "컴퓨터": "공학", "산업": "공학", "기계": "공학",
             "전기·전자": "공학", "건설/건축": "공학", "재료/화공·고분자·에너지": "공학",
             "의학": "의약", "약학": "의약", "간호/보건": "의약"}
majors = []
for r in rows_of("경희대"):
    grp, name, c, rc, b = cell(r[3]), cell(r[4]) or cell(r[3]), cell(r[5]), cell(r[6]), cell(r[7])
    ctx = "경희대/" + name
    before = len(UNKNOWN)
    core, _ = parse_list(c, ctx); rec, _ = parse_list(rc, ctx)
    note = "핵심/권장은 어디가 xlsx 열 구분을 따름."
    if "생물과 유전" in c + rc:
        note += " 원문 '생물과 유전'은 오타로 보고 '생물의 유전'으로 정규화."
    if len(UNKNOWN) > before:
        note += " 해석 확인 필요: 사전에 없는 표기 " + ", ".join(t for _, t in UNKNOWN[before:])
    majors.append({"name": name, "field": KHU_FIELD.get(grp, ""), "core": core, "recommended": rec,
                   "raw": raw_of(c, rc, b), "note": note, "source_ref": REF_ADIGA})
stat(finish("경희대학교", "khu", ADIGA, majors))

# ---------------- 고려대 ----------------
KU_FIELD = {"생명과학대학": "자연", "이과대학": "자연", "공과대학": "공학", "의과대학": "의약",
            "사범대학": "자연", "간호대학": "의약", "정보대학": "공학", "보건과학대학": "의약",
            "스마트보안학부": "공학", "스마트모빌리티학부": "공학"}
majors = []
for r in rows_of("고려대"):
    col, name, c, rc, b = cell(r[3]), cell(r[4]), cell(r[5]), cell(r[6]), cell(r[7])
    ctx = "고려대/" + name
    rec, _ = parse_list(rc, ctx)
    note = "원문이 권장과목만 제시(핵심 구분 없음)."
    if "과학 교과 권장 과목 중 2과목 이상" in b:
        alls = rec[0]["all"]
        sci = scicount(alls); math = [x for x in alls if x not in sci]
        rec = ([{"all": math}] if math else []) + [{"choose": 2, "of": sci}]
        note += " 비고 '과학 교과 권장 과목 중 2과목 이상'을 과학 과목 choose 2로 변환."
    majors.append({"name": name, "field": KU_FIELD.get(col, ""), "core": [], "recommended": rec,
                   "raw": raw_of(c, rc, b), "note": note, "source_ref": REF_ADIGA})
stat(finish("고려대학교", "korea", ADIGA, majors))

# ---------------- 중앙대 ----------------
CAU_MED = {"약학부", "의학부", "간호학과"}
CAU_NAT = {"물리학과", "수학과", "생명과학과", "화학과", "시스템생명공학과"}
majors = []
for r in rows_of("중앙대"):
    name, c, b = cell(r[3]), cell(r[5]), cell(r[7])
    ctx = "중앙대/" + name
    rules, _ = parse_list(c, ctx)
    note = "원문(중앙대 PDF)은 '이수 권장과목'으로만 제시(핵심 구분 없음). 중앙대 PDF와 대조함."
    m = re.match(r"^\*(.+?):\s*(\d)과목 이상", b)
    if m:
        pick = [norm(x, ctx) for x in m.group(1).split(",")]
        rules[0]["all"] = [x for x in rules[0]["all"] if x not in pick]
        rules.append({"choose": int(m.group(2)), "of": pick})
    if name in CAU_MED: fld = "의약"
    elif name in CAU_NAT or name.startswith("식품공학과") or name.startswith("생명자원공학부"): fld = "자연"
    else: fld = "공학"
    majors.append({"name": name, "field": fld, "core": [], "recommended": rules,
                   "raw": raw_of(c, "", b).replace("핵심과목: ", "이수 권장과목: "), "note": note,
                   "source_ref": REF_ADIGA})
stat(finish("중앙대학교", "cau", ADIGA, majors, {"cross_check": {
    "title": "2028학년도 대입전형 학문단위별 이수 권장과목 안내(자연계열)",
    "url": "https://admission.cau.ac.kr/files/2026/CAU_2028_subjects.pdf", "retrieved": RETRIEVED}}))

# ---------------- 서울대 (유형② 자연·의약만) ----------------
SNU_FIELD = {"자연과학대학": "자연", "간호대학": "의약", "공과대학": "공학", "농업생명과학대학": "자연",
             "사범대학": "자연", "생활과학대학": "자연", "수의과대학": "의약", "의과대학": "의약",
             "첨단융합학부": "공학", "치의학대학원": "의약", "약학대학": "의약"}
majors = []
for r in rows_of("서울대"):
    col, name, c, rc, b = cell(r[3]), cell(r[4]), cell(r[5]), cell(r[6]), cell(r[7])
    if "과학" not in rc:
        continue
    ctx = "서울대/" + name
    rules = []
    if "기하 또는 미적분Ⅱ" in rc:
        rules.append({"choose": 1, "of": ["기하", "미적분Ⅱ"]})
    else:
        rules.append({"all": ["기하", "미적분Ⅱ"]})
    note = "서울대는 2028부터 핵심/권장 구분을 없애 recommended에만 넣음. 원문 '과학'은 과학 교과 진로선택 8과목 중 선택으로 해석."
    if c and c != "-":
        pr, _ = parse_list(c, ctx)
        rules = pr + rules
        note += " '" + c + "'은 모집단위가 우선 이수를 권장하는 일반선택 과목으로 해석(어디가 xlsx 핵심과목 열에 기재)."
    if "포함" in b:
        rules.append({"all": ["세포와 물질대사", "생물의 유전"]})
    rules.append({"choose": 3, "of": SCI_C})
    if name in ("식품영양학과", "의류학과"):
        note += " 같은 모집단위에 유형①(제2외국어/한문 1과목 이상) 행도 있음 — 해석 확인 필요(두 유형 모두 적용인지)."
    majors.append({"name": name, "field": SNU_FIELD.get(col, ""), "core": [], "recommended": rules,
                   "raw": raw_of(c, rc, b), "note": note, "source_ref": REF_ADIGA})
stat(finish("서울대학교", "snu", ADIGA, majors, {"cross_check": {
    "title": "2028학년도 서울대학교 전공 연계 과목 선택 안내 발표(보도자료, 2025-07-01)",
    "url": "https://www.snu.ac.kr/snunow/press?md=v&bbsidx=156226", "retrieved": RETRIEVED}}))

# ---------------- 부산대 (자연·공학·의약만) ----------------
REL = {"물리학": ["물리학", "역학과 에너지", "전자기와 양자"], "화학": ["화학", "물질과 에너지", "화학 반응의 세계"],
       "생명과학": ["생명과학", "세포와 물질대사", "생물의 유전"], "지구과학": ["지구과학", "지구시스템과학", "행성우주과학"]}
PNU_SKIP = {"경제통상대학", "경영대학"}
PNU_MED = {"간호대학", "약학부", "의과대학", "치과대학", "한의학전문대학원"}
PNU_ENG = {"공과대학", "정보의생명공학대학"}
majors = []
for r in rows_of("부산대"):
    col, name, c, b = cell(r[3]), cell(r[4]), cell(r[5]), cell(r[7])
    if col in PNU_SKIP:
        continue
    if col == "공과대학" and name == "수학교육과":
        continue  # 사범대학 수학교육과와 중복된 행(어디가 xlsx 오류로 보임) — SOURCES.md 기록
    ctx = "부산대/" + name
    toks = [norm(x, ctx) for x in split_top(c)]
    math = [x for x in toks if AREA.get(x) == "수학"]; sci = [x for x in toks if AREA.get(x) == "과학"]
    rules, note = [], "어디가 xlsx '핵심과목' 열에 기재(부산대 원문 미대조)."
    rel = [y for s in sci for y in REL[s]]
    mm = re.search(r"관련 일반선택 과목 및 진로선택 과목 중\s*(\d)과목 이상", b)
    if "기하, 미적분Ⅱ 중 1과목 이상" in b:
        rules.append({"choose": 1, "of": ["기하", "미적분Ⅱ"]})
    elif math and "제시 과목 중" in b:
        k = int(re.search(r"제시 과목 중,?\s*(\d)과목", b).group(1))
        rules.append({"choose": k, "of": math})
    elif math:
        rules.append({"all": math})
        note += " 비고(이수 조건)가 비어 있음 — 같은 대학 수학 계열은 '제시 과목 중 2과목 이상'이라 해석 확인 필요."
    if sci:
        if mm:
            rules.append({"choose": int(mm.group(1)), "of": rel})
            note += " '관련 일반선택·진로선택'은 " + "/".join(sci) + " 관련 과목(같은 표의 정의: 일반선택 1 + 진로선택 2)으로 전개."
        else:
            rules.append({"all": sci}); note += " 해석 확인 필요: 과학 이수 조건 없음."
    fld = "의약" if col in PNU_MED else ("공학" if col in PNU_ENG or "공학" in name else "자연")
    if col == "생명자원과학대학" and name == "바이오산업기계공학과": fld = "공학"
    if col == "학부대학" and name == "첨단융합학부": fld = "공학"
    if "검퓨터" in name:
        name = name.replace("검퓨터", "컴퓨터"); note += " 모집단위명 원문 '검퓨터공학전공'은 오타로 보고 '컴퓨터공학전공'으로 표기."
    majors.append({"name": name, "field": fld, "core": rules, "recommended": [],
                   "raw": raw_of(c, "", b), "note": note, "source_ref": REF_ADIGA})
stat(finish("부산대학교", "pnu", ADIGA, majors))

# ---------------- 한양대 ----------------
r = rows_of("한양대")[0]
c, b = cell(r[5]), cell(r[7])
majors = [{"name": "자연계열 전 모집단위", "field": "자연", "core": [
    {"choose": 1, "of": ["미적분Ⅱ", "기하"]},
    {"choose": 1, "of": ["물리학", "화학", "생명과학"]},
    {"choose": 2, "of": SCI_C}], "recommended": [],
    "raw": raw_of(c, "", b),
    "note": "모집단위별 구분 없이 자연계열 전체 1개 규칙. 어디가 xlsx의 '핵심과목' 열(정의: 필수적 이수를 권장하는 과목)에 기재된 대로 핵심으로 분류. '과학 진로선택 과목 2과목 이상'은 진로선택 8과목 중 선택으로 해석.",
    "source_ref": REF_ADIGA}]
stat(finish("한양대학교(서울)", "hanyang", ADIGA, majors))

# ---------------- 연세대 (대학 공식 PDF) ----------------
YS = [  # (대학, 모집단위, 과학 일반선택)
 ("이과대학", "수학과", "자율선택"), ("이과대학", "물리학과", "물리학"), ("이과대학", "화학과", "화학"),
 ("이과대학", "지구시스템과학과", "지구과학"), ("이과대학", "천문우주학과", "지구과학"), ("이과대학", "대기과학과", "지구과학"),
 ("공과대학", "화공생명공학부", "화학"), ("공과대학", "전기전자공학부", "물리학"), ("공과대학", "건축공학과", "자율선택"),
 ("공과대학", "도시공학과", "자율선택"), ("공과대학", "사회환경시스템공학부", "자율선택"), ("공과대학", "기계공학부", "물리학"),
 ("공과대학", "신소재공학부", "화학"), ("공과대학", "산업공학과", "자율선택"), ("공과대학", "시스템반도체공학과", "물리학"),
 ("공과대학", "디스플레이융합공학과", "물리학"),
 ("생명시스템대학", "생명과학부", "생명과학"), ("생명시스템대학", "시스템생물학과", "생명과학"),
 ("생명시스템대학", "생화학과", "생명과학"), ("생명시스템대학", "생명공학과", "생명과학"),
 ("인공지능융합대학", "컴퓨터과학과", "자율선택"), ("인공지능융합대학", "인공지능학과", "자율선택"),
 ("인공지능융합대학", "인공지능시스템학과", "자율선택"), ("인공지능융합대학", "IT융합공학전공", "자율선택"),
 ("인공지능융합대학", "지능형반도체전공", "자율선택"), ("인공지능융합대학", "모빌리티시스템전공", "자율선택"),
 ("언더우드국제대학", "언더우드학부(생명과학공학)", "자율선택"), ("언더우드국제대학", "융합과학공학부(ISE)", "자율선택"),
 ("진리자유학부", "진리자유학부(자연)", "자율선택"),
 ("의과대학", "의예과", "생명과학"), ("치과대학", "치의예과", "물리학, 화학, 생명과학 中 택 1"),
 ("약학대학", "약학과", "생명과학 또는 화학"), ("약학대학", "첨단약과학과", "생명과학 또는 화학")]
majors = []
for col, name, gen in YS:
    rules = [{"all": ["기하", "미적분Ⅱ"]}]
    note = "원문이 권장과목만 제시(핵심 구분 없음)."
    if gen == "자율선택":
        note += " 과학 일반선택 '자율선택'(물리학·화학·생명과학·지구과학 중 자율 선택)은 이수 개수가 명시되지 않아 규칙에서 뺌 — 해석 확인 필요."
    elif "택 1" in gen or "또는" in gen:
        rules.append({"choose": 1, "of": [x.strip() for x in re.split(r",|또는|中 택 1", gen) if x.strip()]})
    else:
        rules.append({"all": [gen]})
    rules.append({"choose": 3, "of": SCI_C})
    note += " 과학 진로선택 '3과목 이상'은 원문상 '일반선택과목 간 위계를 고려'하라는 단서가 있으나 특정 과목 지정이 없어 진로선택 8과목 중 3으로 표현."
    fld = "의약" if col in ("의과대학", "치과대학", "약학대학") else ("자연" if col in ("이과대학", "생명시스템대학") else "공학")
    if name == "진리자유학부(자연)": fld = "자연"
    majors.append({"name": name, "field": fld, "core": [], "recommended": rules,
                   "raw": "수학 진로선택: 기하, 미적분Ⅱ | 과학 일반선택: " + gen + " | 과학 진로선택: 3과목 이상",
                   "note": note, "source_ref": "yonsei-2028-guide"})
stat(finish("연세대학교", "yonsei", {"title": "2028학년도 연세대학교 전공연계과목 선택 가이드라인 안내 / 모집단위별 전공연계과목 선택 안내",
    "url": "https://www2.yonsei.ac.kr/entrance/plan/2028_guide.pdf", "basis_date": "2026-04", "retrieved": RETRIEVED}, majors))

with open(os.path.join(OUT, "subjects.json"), "w", encoding="utf-8") as f:
    json.dump(T, f, ensure_ascii=False, indent=2)

rep = open(os.path.join(sys.argv[3]), "w", encoding="utf-8")
rep.write(f"subjects={len(T)} (151과목 체크: {sum(1 for s in T if 'special' not in s)})\n")
cnt = collections.Counter((s['area'], s['type']) for s in T)
rep.write(str(dict(cnt)) + "\n")
for k, v in STATS.items(): rep.write(f"{k}\t{v}\n")
rep.write("UNKNOWN=" + json.dumps(UNKNOWN, ensure_ascii=False) + "\n")
