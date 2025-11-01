import { ScoreDisplayType } from '@/types';

/**
 * 점수를 지정된 형식으로 포맷팅합니다.
 * @param value 점수 문자열
 * @param displayType 표시 형식
 * @returns 포맷팅된 점수 문자열
 */
export function formatScore(value: string, displayType: ScoreDisplayType): string {
  if (!value || value.trim() === '') return value;
  
  // 숫자만 추출
  const numericValue = value.replace(/[^0-9]/g, '');
  if (!numericValue) return value;
  
  const num = parseInt(numericValue, 10);
  if (isNaN(num)) return value;

  switch (displayType) {
    case 'abbreviated':
      return formatAbbreviated(num);
    case 'comma':
      return formatComma(num);
    case 'korean':
      return formatKorean(num);
    default:
      return value;
  }
}

/**
 * 숫자를 M/B 단위로 축약 (331M = 3억 3100만)
 */
function formatAbbreviated(num: number): string {
  if (num >= 1_000_000_000_000) {
    // 1조 이상
    const value = num / 1_000_000_000_000;
    return value % 1 === 0 ? `${value}T` : `${value.toFixed(1)}T`;
  } else if (num >= 1_000_000_000) {
    // 10억 이상
    const value = num / 1_000_000_000;
    return value % 1 === 0 ? `${value}B` : `${value.toFixed(1)}B`;
  } else if (num >= 1_000_000) {
    // 100만 이상
    const value = num / 1_000_000;
    return value % 1 === 0 ? `${value}M` : `${value.toFixed(1)}M`;
  } else if (num >= 1_000) {
    // 1천 이상
    const value = num / 1_000;
    return value % 1 === 0 ? `${value}K` : `${value.toFixed(1)}K`;
  }
  return num.toString();
}

/**
 * 숫자에 콤마 추가 (1,234,567)
 */
function formatComma(num: number): string {
  return num.toLocaleString('en-US');
}

/**
 * 한글 단위로 표기 (3억 3100만)
 */
function formatKorean(num: number): string {
  if (num === 0) return '0';

  const units = [
    { value: 1_0000_0000_0000, unit: '조' },
    { value: 1_0000_0000, unit: '억' },
    { value: 1_0000, unit: '만' },
  ];

  const parts: string[] = [];

  for (const { value, unit } of units) {
    if (num >= value) {
      const quotient = Math.floor(num / value);
      parts.push(`${quotient}${unit}`);
      num = num % value;
    }
  }

  if (num > 0) {
    parts.push(num.toString());
  }

  return parts.join(' ');
}
