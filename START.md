# 🎮 쿠키런: 오븐브레이크 조합표 생성기 - 시작 가이드

## ✅ 프로젝트가 성공적으로 생성되었습니다!

모든 파일과 구조가 완벽하게 생성되었습니다. 이제 아래 단계를 따라 프로젝트를 시작하세요.

## 📦 1단계: 패키지 설치

PowerShell에서 프로젝트 폴더로 이동한 후:

```powershell
cd c:\Users\gyu09\Desktop\cookie-run-ovenbreak-combination-generator
npm install
```

**예상 시간**: 2-3분

## 🚀 2단계: 개발 서버 실행

```powershell
npm run dev
```

브라우저에서 http://localhost:3000 을 엽니다.

## 🎨 3단계: 이미지 추가 (선택사항)

### 옵션 A: 실제 게임 이미지 사용
1. `public/images/` 폴더의 각 카테고리에 PNG/JPG 이미지를 추가합니다.
2. `public/data/gameData.json`의 `image` 경로를 실제 파일명으로 수정합니다.

### 옵션 B: 온라인 Placeholder 사용 (즉시 테스트)
`gameData.json`의 이미지 경로를 온라인 placeholder로 변경:

```json
{
  "cookies": [
    {
      "id": "cookie001",
      "name": "용감한 쿠키",
      "image": "https://via.placeholder.com/128/667eea/ffffff?text=Cookie"
    }
  ]
}
```

## ✨ 주요 기능 사용법

### 배경 설정
1. 우측 상단의 ⚙️ 버튼 클릭
2. 단색/그라데이션/이미지 중 선택
3. 그라데이션의 경우 "🎲 랜덤 조합" 버튼으로 자동 생성 가능

### 조합 입력
1. 각 슬롯(펫, 쿠키, 보물 등)을 클릭하여 이미지 선택
2. 검색창에서 이름으로 검색 가능
3. 축복 선택 시 자동으로 설명이 표시됨

### YouTube 연동
1. 아레나 번호를 클릭
2. YouTube URL 입력
3. YouTube 로고가 표시되며 클릭 시 새 창으로 열림

### 저장 및 공유
- **이미지로 저장**: 전체 조합표를 PNG로 다운로드
- **URL 공유**: 현재 상태를 압축하여 공유 가능한 링크 생성

## 🏗️ 프로젝트 구조

```
📁 cookie-run-ovenbreak-combination-generator/
├── 📁 app/
│   ├── layout.tsx          ← SEO 메타태그, 루트 레이아웃
│   ├── page.tsx            ← 메인 페이지 (12개 조합 블록)
│   └── globals.css         ← Glassmorphism 스타일
├── 📁 components/
│   ├── Header.tsx          ← 시즌 정보, 배경 설정
│   ├── ComboBlock.tsx      ← 아레나별 조합 입력
│   ├── ImageSelectModal.tsx ← 이미지 선택 UI
│   ├── BackgroundModal.tsx ← 배경 커스터마이징
│   └── ActionButtons.tsx   ← 저장/공유 기능
├── 📁 store/
│   └── useAppStore.ts      ← Zustand 상태 관리
├── 📁 types/
│   └── index.ts            ← TypeScript 타입
├── 📁 public/
│   ├── 📁 data/
│   │   └── gameData.json   ← 모든 게임 데이터
│   └── 📁 images/          ← 이미지 폴더 (7개 카테고리)
└── package.json
```

## 🔧 커스터마이징

### gameData.json 편집
모든 게임 아이템은 이 파일에서 관리됩니다:
- `cookies`: 쿠키
- `pets`: 펫
- `treasures`: 보물
- `dishes`: 요리
- `ingredients`: 재료
- `magicCandies`: 마법사탕
- `blessings`: 축복 (description 필드 필수)

### 색상 테마 변경
`app/globals.css`에서 `.glass` 클래스를 수정하여 글라스모피즘 효과 조정:
```css
.glass {
  background: rgba(255, 255, 255, 0.2);  /* 투명도 조절 */
  backdrop-filter: blur(12px);            /* 블러 강도 */
  border: 1px solid rgba(255, 255, 255, 0.3);
}
```

## 🚢 배포하기

### Vercel (권장)
```powershell
npm install -g vercel
vercel
```

### Netlify
```powershell
npm run build
# out 폴더를 Netlify에 드래그 앤 드롭
```

## 🐛 문제 해결

### TypeScript 에러
```powershell
npm install
```
패키지 설치 후 자동으로 해결됩니다.

### 포트 충돌
```powershell
npm run dev -- -p 3001
```

### 빌드 에러
```powershell
Remove-Item -Recurse -Force .next
npm run build
```

## 📚 참고 문서

- [Next.js 14 문서](https://nextjs.org/docs)
- [Tailwind CSS](https://tailwindcss.com/docs)
- [Zustand](https://github.com/pmndrs/zustand)
- [html2canvas](https://html2canvas.hertzen.com/)

## 🎉 개발 완료 체크리스트

- ✅ Next.js 14 App Router 프로젝트 생성
- ✅ TypeScript + Tailwind CSS 설정
- ✅ Glassmorphism 디자인 시스템
- ✅ 12개 아레나 조합 관리
- ✅ YouTube URL 연동
- ✅ 마법사탕 & 축복 시스템
- ✅ 이미지 저장 기능 (html2canvas)
- ✅ URL 공유 기능 (lz-string)
- ✅ 반응형 모바일 프레임 레이아웃
- ✅ SEO 최적화 메타태그
- ✅ 정적 사이트 Export 지원

## 🎊 축하합니다!

프로젝트가 완벽하게 준비되었습니다. 즐거운 개발 되세요! 🚀

---

**문의사항이 있으시면 GitHub Issues에 등록해주세요!**
