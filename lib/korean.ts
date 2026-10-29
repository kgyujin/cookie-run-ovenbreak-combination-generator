/** 숫자를 한국어로 읽을 때 끝소리에 받침이 있는지 (0 영, 1 일, 3 삼, 6 육, 7 칠, 8 팔) */
const DIGIT_HAS_FINAL = [true, true, false, true, false, false, true, true, true, false];

/**
 * 이름 뒤에 붙는 목적격 조사 (조합표 19를, 여름을). 받침을 알 수 없는 글자(영문 등)는 '을(를)'.
 * 사용자가 붙인 이름을 문장에 넣을 때 '테마 2 테마를'처럼 같은 말이 반복되지 않게 한다.
 */
export function objectParticle(word: string) {
  const last = word.trim().slice(-1);
  const code = last.charCodeAt(0);
  if (code >= 0xac00 && code <= 0xd7a3) return (code - 0xac00) % 28 ? '을' : '를';
  if (/[0-9]/.test(last)) return DIGIT_HAS_FINAL[Number(last)] ? '을' : '를';
  return '을(를)';
}
