# 이미지 폴더 안내

이 폴더들에 게임 이미지를 추가해주세요.

## 폴더 구조

- `cookies/` - 쿠키 이미지
- `pets/` - 펫 이미지
- `treasures/` - 보물 이미지
- `dishes/` - 요리 이미지
- `ingredients/` - 재료 이미지
- `magic_candies/` - 마법사탕 이미지
- `blessings/` - 축복 이미지

## 이미지 추가 방법

1. 각 폴더에 PNG 또는 JPG 이미지 파일을 추가합니다.
2. `public/data/gameData.json` 파일을 열어 해당 항목을 추가합니다.

예시:
```json
{
  "cookies": [
    {
      "id": "cookie001",
      "name": "용감한 쿠키",
      "image": "/images/cookies/brave_cookie.png"
    }
  ]
}
```

## 권장 이미지 사양

- 형식: PNG (투명 배경 권장)
- 크기: 128x128px ~ 256x256px
- 파일명: 영문_소문자_언더스코어 (예: brave_cookie.png)

## Placeholder 이미지

개발/테스트 목적으로 placeholder 이미지를 사용하려면:
- https://via.placeholder.com/128x128.png?text=Cookie
- 또는 임의의 색상 배경 이미지를 사용하세요.
