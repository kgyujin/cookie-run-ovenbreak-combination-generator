# 쿠키런: 오븐브레이크 조합표 생성기

쿠키런: 오븐브레이크의 최적 조합표를 생성하고 공유할 수 있는 웹 애플리케이션입니다.

## 🎨 주요 기능

- **Glassmorphism 디자인**: 애플 스타일의 아름다운 글라스모피즘 UI
- **12개 아레나 조합 관리**: 각 아레나별 상세 조합 설정
- **커스텀 배경**: 단색, 그라데이션, 이미지 배경 설정
- **YouTube 링크 연동**: 각 아레나에 YouTube URL 추가
- **마법사탕 & 축복**: 마법사탕과 축복 효과 상세 표시
- **이미지 저장**: 전체 조합표를 PNG 이미지로 다운로드
- **URL 공유**: 조합표를 URL로 압축하여 공유
- **반응형 디자인**: 모바일 프레임 방식의 깔끔한 레이아웃

## 🚀 시작하기

### 1. 패키지 설치

```bash
npm install
```

### 2. 개발 서버 실행

```bash
npm run dev
```

브라우저에서 [http://localhost:3000](http://localhost:3000)을 열어 확인하세요.

### 3. 프로덕션 빌드

```bash
npm run build
```

정적 파일은 `out` 폴더에 생성됩니다.

## 📁 프로젝트 구조

```
cookie-run-ovenbreak-combination-generator/
├── app/
│   ├── layout.tsx          # 루트 레이아웃 (SEO 메타태그)
│   ├── page.tsx            # 메인 페이지
│   └── globals.css         # 글로벌 스타일
├── components/
│   ├── Header.tsx          # 헤더 (시즌명, 시즌 요리, 재료)
│   ├── ComboBlock.tsx      # 아레나 조합 블록
│   ├── ImageSelectModal.tsx # 이미지 선택 모달
│   ├── BackgroundModal.tsx # 배경 설정 모달
│   └── ActionButtons.tsx   # 저장/공유 버튼
├── store/
│   └── useAppStore.ts      # Zustand 글로벌 상태 관리
├── types/
│   └── index.ts            # TypeScript 타입 정의
├── public/
│   ├── data/
│   │   └── gameData.json   # 게임 데이터 (쿠키, 펫, 보물 등)
│   └── images/             # 게임 이미지 폴더
│       ├── cookies/
│       ├── pets/
│       ├── treasures/
│       ├── dishes/
│       ├── ingredients/
│       ├── magic_candies/
│       └── blessings/
└── package.json
```

## 📝 데이터 관리

모든 게임 데이터는 `public/data/gameData.json`에서 관리됩니다.

### 데이터 추가 방법

1. `public/images/` 폴더의 해당 카테고리에 이미지를 추가합니다.
2. `gameData.json`에 새로운 항목을 추가합니다:

```json
{
  "cookies": [
    {
      "id": "cookie001",
      "name": "용감한 쿠키",
      "image": "/images/cookies/brave_cookie.png"
    }
  ],
  "blessings": [
    {
      "id": "bless001",
      "name": "핑크곰젤리 점수 증가",
      "image": "/images/blessings/bless_pink_bear.png",
      "description": "모든 핑크곰젤리 점수 3,000점 증가"
    }
  ]
}
```

## 🎯 주요 컴포넌트 설명

### Header
- 시즌명 입력
- 배경 설정 (단색/그라데이션/이미지)
- 시즌 요리 선택
- 재료 3개 선택

### ComboBlock (12개)
- 아레나 번호 + YouTube URL 연동
- 메인 조합 (펫, 쿠키 2개, 보물 3개)
- 마법사탕 & 축복 (선달/이달 각각)
- 최고점 입력 (숫자 + 단위)
- 개별 요리
- 대체 조합 (펼치기/접기)

### ImageSelectModal
- 카테고리별 이미지 검색 및 선택
- 실시간 검색 기능
- 축복 설명 표시

### ActionButtons
- **이미지 저장**: html2canvas로 PNG 다운로드
- **URL 공유**: lz-string으로 압축된 공유 링크 생성

## 🌐 배포

### Vercel
```bash
vercel
```

### Netlify
```bash
netlify deploy --prod
```

## 🛠 기술 스택

- **Framework**: Next.js 14 (App Router)
- **Language**: TypeScript
- **Styling**: Tailwind CSS
- **State Management**: Zustand
- **Image Capture**: html2canvas
- **Data Compression**: lz-string

## 📄 라이선스

MIT License

## 🙏 기여

이슈와 PR은 언제나 환영합니다!
