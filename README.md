# 쿠키런: 오븐브레이크 조합표 생성기

12개 아레나 조합표를 만들고 **이미지로 저장**하거나 **짧은 링크**로 공유하는 웹사이트입니다.

- 시즌명·시즌 요리·재료, 아레나별 메인/대체 조합(펫·쿠키·보물·마법사탕·축복·요리·최고점·유튜브 링크)
- 배경(단색/그라데이션/이미지), 글꼴, 점수 표기 방식 설정
- PC·태블릿·휴대폰(가로/세로) 어디서든 같은 배치 비율로 보이고, 저장 이미지는 항상 같은 크기(2열)로 만들어짐
- 키보드·스크린리더로도 사용 가능 (모든 칸이 버튼, 모달은 Esc로 닫힘, 쿠키 비율은 ←/→ 키로 조절)

---

## 아이템 추가하기 (작업자용)

새 쿠키·펫·보물 등은 **이미지 파일만 올리면** 사이트에 자동으로 나타납니다. 데이터 파일(`gameData.json`)은 빌드할 때 자동으로 만들어지므로 직접 고치지 않습니다.

### 1. 이미지 넣기

| 종류 | 폴더 | 등급 폴더 |
|---|---|---|
| 쿠키 | `public/images/cookies/` | 필요 |
| 펫 | `public/images/pets/` | 필요 |
| 보물 | `public/images/treasures/` | 필요 |
| 마법사탕 | `public/images/magic_candies/` | 필요 |
| 요리 | `public/images/dishes/` | 없음 |
| 재료 | `public/images/ingredients/` | 없음 |
| 축복 | `public/images/blessings/` | 없음 |

- 등급 폴더: `legendary`, `epic`, `rare`, `common`
- **파일명 = 사이트에 보이는 이름**입니다. 예: `public/images/cookies/epic/파김치.png` → "파김치"
- 형식: png(권장)·jpg·webp, 1MB 이하 권장
- 새 쿠키는 보통 쿠키·마법사탕·펫 세 폴더에 **같은 이름**으로 넣습니다.

### 2. (선택) 추가 정보 — `data/item-meta.json`

이름으로 지정하며, 같은 이름이면 쿠키·마법사탕·펫 모두에 적용됩니다.

```jsonc
{
  "pinned": ["빈배경", "공사중"],            // 선택 창 맨 앞에 고정
  "added": {},                                // (보통 비워 둠) 추가 날짜를 Git 기록 대신 직접 정할 때만
  "aliases": { "브레이브 로드": ["브로"] },   // 검색 별칭
  "descriptions": { "lv1": "설명 문구" },     // 선택 창·마우스 오버에 보이는 설명
  "hidden": [],                               // 파일은 두고 목록에서만 숨기기
  "renamed": { "옛 이름": "새 이름" }          // 파일명을 바꿨을 때 (아래 참고)
}
```

> 실제 파일은 주석(`//`)을 쓸 수 없는 JSON입니다. 위 예시의 주석은 설명용입니다.

### 3. 파일명을 바꿀 때 (오타 수정 등)

파일명을 바꾸면 예전에 저장·공유된 조합표에서 그 아이템이 사라질 수 있습니다.
`renamed`에 `"옛 이름": "새 이름"`을 한 줄 추가하면 예전 조합표도 새 이미지로 자동 연결됩니다.
등급 폴더만 옮긴 경우(예: epic → legendary)는 자동으로 연결되므로 아무것도 안 해도 됩니다.

### 4. 업데이트 소식 (자동)

새 이미지를 올리면 **업데이트 소식이 자동으로 만들어집니다.** 빌드할 때 Git 기록에서 이미지가 처음 추가된 날짜를 읽어 날짜별로 "쿠키 ○○ 추가" 같은 항목을 만들고, 사이트에 다시 들어온 사용자에게 업데이트 창이 한 번 뜹니다(도구 막대 🔔 버튼으로 언제든 다시 볼 수 있음). 새 아이템에는 30일 동안 NEW 배지가 붙습니다.

- 쿠키와 같은 이름의 펫·마법사탕은 쿠키 한 줄로 묶입니다.
- 한 날짜에 40개보다 많이 추가된 경우(처음 데이터 등록 같은 일괄 작업)는 소식에서 뺍니다.
- 아이템 말고 기능 변경 같은 소식은 `data/updates.json`에 직접 씁니다. '·', 'ㅡ' 같은 기호 대신 쉼표나 문장으로 써 주세요(검사가 알려 줌).

```json
[{ "date": "2026-11-10", "title": "기능 개선", "items": ["설정에 카드 꾸미기 추가"] }]
```

> Vercel은 기본적으로 최근 커밋 일부만 받아서 빌드합니다. 오래된 소식까지 모두 보이게 하려면 Vercel 프로젝트 환경변수에 `VERCEL_DEEP_CLONE=true`를 추가하세요.

### 5. 검사

```bash
npm run check:content
```

- **오류**(빨간 글씨): 고쳐야 배포됩니다. 예) 등급 폴더 이름 오타, 지원하지 않는 파일 형식, `renamed`의 새 이름 파일이 없음, JSON 문법 오류
- **경고**: 사이트는 동작합니다. 예) 쿠키는 있는데 같은 이름의 마법사탕·펫이 없음, `item-meta.json`에 적은 이름의 파일이 없음(오타 의심)

GitHub에 올리면(PR 또는 main 이외 브랜치) **검사** 워크플로가 자동으로 같은 검사를 실행합니다. main 배포 시에도 빌드 과정에서 검사하며, 오류가 있으면 배포되지 않고 이전 버전이 유지됩니다.

---

## 개발

```bash
npm install
npm run dev            # http://localhost:3000
npm run build          # 프로덕션 빌드 (이미지 데이터 생성 포함)
npm run check:content  # 아이템 이미지·메타데이터 검사만
npm run lint
```

### 짧은 공유 링크 (Supabase)

1. Supabase 프로젝트에 `supabase/migrations/` 의 SQL을 적용합니다. (공유 데이터 테이블 `shares`, 함수 `create_share`·`get_share`, 업로드 버킷 `share-assets`)
2. `.env.example`을 참고해 `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`를 설정합니다. (공개용 키라 브라우저에 노출돼도 됩니다. 테이블은 RLS로 막혀 있고 두 함수로만 접근 가능)

설정이 없거나 연결에 실패하면 예전 방식의 긴 링크(`?data=`)로 대신 공유합니다. 예전에 만든 긴 링크도 계속 열립니다.

### 구조

```
app/
  page.tsx              메인 (편집 화면)
  s/[id]/page.tsx       짧은 링크로 공유된 조합표
components/
  Editor.tsx            화면 전체 (데이터·공유 링크 불러오기, 배경·글꼴 적용)
  Toolbar.tsx           상단 도구 막대 (설정·이미지 저장·링크 공유)
  Header.tsx            시즌명·시즌 요리·재료
  ComboBlock.tsx        아레나 1개 조합표
  Slot.tsx              이미지 칸 (버튼)
  ImageSelectModal.tsx  아이템 선택 창 (검색·등급/신규 필터)
  SettingsModal.tsx     설정 (배경·글꼴·점수 표기)
  ShareDialog.tsx / YoutubeDialog.tsx / Toast.tsx / ui/*
lib/
  board.ts              보드 배율 단위 u(), 저장 이미지 폭
  items.ts              아이템 조회, 예전 이미지 경로 → 현재 아이템 연결
  share.ts              짧은 링크 (Supabase)
  exportImage.ts        이미지 저장 (html2canvas, 필요할 때만 로드)
store/useAppStore.ts    상태 (브라우저에 자동 저장)
scripts/generateImageData.js  이미지 폴더 → gameData.json + 검사
data/item-meta.json     아이템 추가 정보
supabase/migrations/    짧은 링크 DB 구조
```

### 디자인 기준 (DESIGN.md)

편집 화면(도구 막대·창·빈 칸)의 색·글꼴·간격·모서리·컴포넌트 규칙은 [`DESIGN.md`](DESIGN.md)([google-labs-code/design.md](https://github.com/google-labs-code/design.md) 형식)가 원본입니다.

```bash
npm run design:lint    # 형식·명도 대비(WCAG AA) 검사
npm run design:tokens  # DESIGN.md → design-tokens.json (tailwind.config.js가 읽음)
```

색을 바꿀 때는 DESIGN.md를 고친 뒤 `design:tokens`를 실행하면 Tailwind 클래스(`bg-primary`, `text-ink` 등)에 반영됩니다.

### 배치 비율 유지 방식

조합표는 기준 크기(2열 1552px / 1열 764px)로 디자인돼 있고, 모든 크기를 `u(px)`(= `px × --u`)로 지정해 화면 폭에 맞춰 통째로 확대·축소합니다. 화면 폭이 1000px 이상이면 2열, 그보다 좁으면 1열로 보여주며, 이미지 저장은 화면과 관계없이 2열(조합표 1552px + 설정의 바깥 여백, 기본 64px)로 만듭니다.
