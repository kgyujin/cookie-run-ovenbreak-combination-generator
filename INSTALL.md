# 🚀 설치 및 실행 가이드

## 1단계: 패키지 설치

프로젝트 폴더에서 다음 명령어를 실행하세요:

```powershell
npm install
```

이 명령어는 다음 패키지들을 설치합니다:
- next (Next.js 14)
- react, react-dom
- typescript
- tailwindcss
- zustand (상태 관리)
- html2canvas (이미지 저장)
- lz-string (URL 압축)

## 2단계: 개발 서버 실행

```powershell
npm run dev
```

브라우저에서 http://localhost:3000 을 열어 확인하세요.

## 3단계: 이미지 추가

### 방법 1: 실제 게임 이미지 사용
1. `public/images/` 폴더의 각 카테고리에 이미지를 추가합니다.
2. `public/data/gameData.json` 파일을 수정하여 이미지 경로를 업데이트합니다.

### 방법 2: Placeholder 이미지 사용 (테스트용)
`gameData.json`의 이미지 경로를 다음과 같이 변경:
```json
"image": "https://via.placeholder.com/128x128/667eea/ffffff?text=Cookie"
```

## 4단계: 프로덕션 빌드

### 정적 사이트 빌드
```powershell
npm run build
```

빌드된 파일은 `out` 폴더에 생성됩니다.

## 배포하기

### Vercel에 배포
1. Vercel 계정 생성 (https://vercel.com)
2. GitHub 리포지토리 연결
3. 자동 배포 완료!

### Netlify에 배포
1. Netlify 계정 생성 (https://netlify.com)
2. `out` 폴더를 드래그 앤 드롭
3. 배포 완료!

## 문제 해결

### 포트가 이미 사용 중인 경우
```powershell
npm run dev -- -p 3001
```

### 캐시 문제
```powershell
Remove-Item -Recurse -Force .next
npm run dev
```

### TypeScript 에러
```powershell
npm install --save-dev @types/node @types/react @types/react-dom
```

## 추가 정보

- Next.js 문서: https://nextjs.org/docs
- Tailwind CSS 문서: https://tailwindcss.com/docs
- Zustand 문서: https://github.com/pmndrs/zustand

## 문의사항

이슈가 있으면 GitHub Issues에 등록해주세요!
