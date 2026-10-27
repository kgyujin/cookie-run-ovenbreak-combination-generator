---
version: alpha
name: Cookie Run Combo Board
description: 쿠키런 오븐브레이크 조합표 생성기의 편집 화면(도구 막대·창·빈 칸) 디자인 기준. 조합표 자체의 배치와 저장 이미지는 이 문서의 대상이 아니다.
colors:
  primary: "#C2410C"
  primary-hover: "#9A3412"
  primary-soft: "#FFEDD5"
  on-primary: "#FFFFFF"
  ink: "#1C1917"
  ink-muted: "#57534E"
  ink-subtle: "#78716C"
  surface: "#FFFFFF"
  surface-cream: "#FFFBF5"
  surface-sunken: "#F5F0E8"
  line: "#E7E0D6"
  danger: "#B91C1C"
  on-danger: "#FFFFFF"
  focus: "#C2410C"
typography:
  title-md:
    fontFamily: Pretendard
    fontSize: 1.125rem
    fontWeight: 700
    lineHeight: 1.4
    letterSpacing: -0.01em
  body-md:
    fontFamily: Pretendard
    fontSize: 0.875rem
    fontWeight: 500
    lineHeight: 1.5
  label-md:
    fontFamily: Pretendard
    fontSize: 0.875rem
    fontWeight: 600
    lineHeight: 1.4
  caption:
    fontFamily: Pretendard
    fontSize: 0.75rem
    fontWeight: 500
    lineHeight: 1.4
rounded:
  sm: 8px
  md: 12px
  lg: 16px
  xl: 24px
  full: 9999px
spacing:
  xs: 4px
  sm: 8px
  md: 12px
  lg: 16px
  xl: 24px
  touch: 44px
components:
  button-primary:
    backgroundColor: "{colors.primary}"
    textColor: "{colors.on-primary}"
    typography: "{typography.label-md}"
    rounded: "{rounded.md}"
    height: "{spacing.touch}"
    padding: "0 16px"
  button-primary-hover:
    backgroundColor: "{colors.primary-hover}"
    textColor: "{colors.on-primary}"
  button-secondary:
    backgroundColor: "{colors.surface}"
    textColor: "{colors.ink}"
    typography: "{typography.label-md}"
    rounded: "{rounded.md}"
    height: "{spacing.touch}"
  button-secondary-hover:
    backgroundColor: "{colors.surface-sunken}"
    textColor: "{colors.ink}"
  button-danger:
    backgroundColor: "{colors.danger}"
    textColor: "{colors.on-danger}"
    rounded: "{rounded.md}"
    height: "{spacing.touch}"
  toolbar:
    backgroundColor: "{colors.surface-cream}"
    textColor: "{colors.ink}"
    typography: "{typography.title-md}"
    rounded: "{rounded.xl}"
    height: 56px
  dialog:
    backgroundColor: "{colors.surface}"
    textColor: "{colors.ink}"
    typography: "{typography.title-md}"
    rounded: "{rounded.xl}"
  dialog-section:
    backgroundColor: "{colors.surface-cream}"
    textColor: "{colors.ink-muted}"
    typography: "{typography.body-md}"
  chip:
    backgroundColor: "{colors.surface-sunken}"
    textColor: "{colors.ink-muted}"
    typography: "{typography.label-md}"
    rounded: "{rounded.full}"
    height: 36px
  chip-selected:
    backgroundColor: "{colors.primary}"
    textColor: "{colors.on-primary}"
  item-card:
    backgroundColor: "{colors.surface}"
    textColor: "{colors.ink}"
    typography: "{typography.caption}"
    rounded: "{rounded.lg}"
    padding: 8px
  item-card-selected:
    backgroundColor: "{colors.primary-soft}"
    textColor: "{colors.ink}"
  field:
    backgroundColor: "{colors.surface}"
    textColor: "{colors.ink}"
    typography: "{typography.body-md}"
    rounded: "{rounded.md}"
    height: "{spacing.touch}"
  hint:
    backgroundColor: "{colors.surface}"
    textColor: "{colors.ink-subtle}"
    typography: "{typography.caption}"
  empty-slot:
    backgroundColor: "{colors.surface}"
    textColor: "{colors.ink-muted}"
    typography: "{typography.caption}"
    rounded: "{rounded.sm}"
  divider:
    backgroundColor: "{colors.line}"
    textColor: "{colors.ink}"
  focus-ring:
    backgroundColor: "{colors.surface}"
    textColor: "{colors.focus}"
---

## Overview

갓 구운 쿠키처럼 따뜻하고 가벼운 인상. 화면의 주인공은 사용자가 꾸미는 **조합표**이고, 편집 도구(도구 막대·창·빈 칸)는 미색 바탕의 조용한 틀로 물러나 있다가 필요할 때만 오렌지 포인트로 시선을 끈다.

- 조합표 배치·크기·저장 이미지 모양은 바꾸지 않는다. 이 문서는 편집 화면에만 적용한다.
- 한 화면에 오렌지(primary)는 **가장 중요한 행동 하나**에만 쓴다. 예: 도구 막대의 "링크 공유", 창의 "적용/저장", 선택된 아이템.
- 편집 화면의 글꼴은 **Pretendard 하나만** 쓴다 (패키지 `pretendard`를 직접 호스팅, 가변 글꼴·필요한 글자만 내려받음).
- 화면 글은 최소한으로: 라벨·버튼 이름만 두고 설명 문구는 넣지 않는다. 필요한 설명은 스크린리더용(sr-only)으로만.

## Colors

- **primary `#C2410C`**: 구운 쿠키 오렌지. 흰 글자 대비 5.2:1로 본문 크기에서도 AA 통과.
- **primary-soft `#FFEDD5`**: 선택된 카드·칩 배경 등 약한 강조.
- **ink / ink-muted / ink-subtle**: 따뜻한 회갈색 계열 글자. subtle은 보조 설명에만 쓴다(흰 바탕 4.8:1).
- **surface-cream `#FFFBF5`**: 도구 막대·창 머리말 등 틀 영역. 순백(surface)은 입력·카드처럼 내용이 놓이는 곳.
- **line `#E7E0D6`**: 구분선·테두리. 회색 대신 따뜻한 베이지로 통일.
- 조합표 배경색은 사용자가 정하므로, 그 위에 뜨는 요소(도구 막대·빈 칸)는 반투명 흰 바탕 + 블러로 어떤 배경에서도 읽히게 한다.

## Typography

- 모든 글자는 Pretendard. 앱 이름은 title-md(18px/700).
- 창 제목 title-md(18px/700), 본문·라벨 14px, 보조 설명 caption(12px).
- 숫자(점수 미리보기 등)는 `tabular-nums`.
- 한국어 줄바꿈은 `word-break: keep-all`로 어절 단위.

## Layout

- 간격은 4px 배수(xs 4 · sm 8 · md 12 · lg 16 · xl 24).
- 누를 수 있는 것은 최소 44×44px(touch). 칩처럼 촘촘한 것은 36px까지 허용하되 간격을 둔다.
- 도구 막대는 화면 위에 떠 있는 둥근 막대(최대 폭 1680px, 위·좌우 여백 8~12px).
- 창은 데스크톱에서 화면 가운데, 640px 미만 화면에서는 **아래에서 올라오는 시트**(위쪽만 둥글게, 손잡이 표시).

## Elevation & Depth

| 단계 | 쓰임 | 그림자 |
|---|---|---|
| 0 | 카드·입력 | 없음, 1px line 테두리 |
| 1 | 빈 칸, 아이템 카드 hover | `0 1px 2px rgb(28 25 23 / .06), 0 4px 12px rgb(28 25 23 / .08)` |
| 2 | 도구 막대 | `0 1px 0 rgb(255 255 255 / .6) inset, 0 8px 24px rgb(28 25 23 / .12)` |
| 3 | 창·알림 | `0 24px 64px rgb(28 25 23 / .24)` |

창 뒤 배경은 `rgb(28 25 23 / .45)` + 4px 블러.

## Shapes

- 입력·버튼 md(12px), 카드 lg(16px), 창·도구 막대 xl(24px), 칩·알림 full.
- 조합표의 빈 칸은 sm(8px) 유지(기존 배치와 같은 모양).
- 빈 칸 테두리는 1.5px **점선**: "여기를 눌러 채우세요"라는 신호.

## Components

- **도구 막대**: 왼쪽 쿠키 아이콘 + 앱 이름, 오른쪽 업데이트·설정(아이콘)·이미지 저장(secondary)·링크 공유(primary). 확인하지 않은 업데이트가 있으면 업데이트 버튼에 primary 점. 좁은 화면에서는 아이콘만, 이름은 스크린리더용으로 유지.
- **버튼**: 누를 때 `scale(.97)` 눌림. primary는 hover 시 빛이 한 번 스치는 효과(shine)로 주목도를 준다.
- **창(Dialog)**: 머리말은 cream 바탕, 제목 + 닫기. 등장은 데스크톱 scale-in, 모바일 slide-up(200ms, ease-out-expo).
- **설정 서랍(Drawer)**: 데스크톱은 오른쪽에 붙는 400px 서랍, 모바일은 화면 62% 높이 시트. 뒤 배경을 거의 가리지 않아(12% 어둡게) 조합표가 보인다. 값을 바꾸면 **즉시 조합표에 반영**하고, 하단에 [전체 초기화(위험)] … [되돌리기] [완료].
- **배경 프리셋**: 10종 스와치(이름은 화면에 쓰지 않고 마우스 오버·스크린리더로만). 고르면 그 배경에서 읽히는 글자색(ink)도 함께 적용. 세부 조정은 접히는 "직접 설정"에.
- **색 입력**: 색 고르기 + #코드 직접 입력을 한 칸에.
- **업데이트 노트**: 확인하지 않은 업데이트가 있으면 처음 들어올 때 창으로 바로 보여 준다(새 항목에 NEW). 닫으면 확인한 것으로 기록. 이후에는 도구 막대 버튼으로만 연다.
- **아이템 선택 창**: 검색 + 필터 칩 + 카드 격자. 카드는 차례로 흐릿함→선명(blur-fade, 항목당 15ms 지연, 최대 300ms). 선택된 카드는 primary 테두리 + ✓ 배지. NEW는 primary 배지, 등급은 색 점 + 글자.
- **빈 칸**: 반투명 흰 바탕 + 점선 테두리 + 라벨. hover 시 2px 떠오르고 테두리가 primary로.
- **알림(Toast)**: 화면 아래 가운데 ink 바탕 알약 + 아이콘, 아래에서 튀어 오르듯 등장.
- **포커스**: 모든 조작 요소에 primary 3px 외곽선(offset 2px). 조합표 위에서는 흰 안쪽 테두리를 더해 어떤 배경에서도 보이게.

## Do's and Don'ts

- Do: primary는 화면당 핵심 행동 하나에만.
- Do: 모든 움직임은 `prefers-reduced-motion`에서 끈다.
- Do: 저장 이미지에 나오지 않는 편집 전용 요소에만 이 스타일을 적용한다.
- Don't: 조합표 칸의 위치·크기·간격을 바꾸지 않는다.
- Don't: 회색(gray) 계열을 새로 쓰지 않는다. 따뜻한 ink/line 계열을 쓴다.
- Don't: 400ms보다 긴 애니메이션, 반복 애니메이션(로딩 표시 제외).
- Don't: Pretendard 외 글꼴(조합표 시즌명·점수의 사용자 글꼴 설정은 예외), 화면에 보이는 설명 문구.
