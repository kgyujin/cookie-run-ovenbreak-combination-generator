import { ScoreDisplayType } from '@/types';

const UNIT_VALUES: Record<string, number> = { K: 1e3, M: 1e6, B: 1e9, T: 1e12, 만: 1e4, 억: 1e8, 조: 1e12 };

/**
 * 입력한 점수를 숫자로 읽는다.
 * '331000000', '331,000,000' 같은 숫자뿐 아니라 '3억 3100만', '1.5억', '331M'처럼 단위를 붙여 써도 된다.
 * 읽을 수 없으면 null (입력한 글자를 그대로 보여준다).
 */
function parseScore(value: string): number | null {
  const s = value.replace(/[,\s]/g, '').replace(/점$/, '').toUpperCase();
  if (!s) return null;
  if (/^\d+$/.test(s)) return Number(s);
  const parts = s.match(/\d+(?:\.\d+)?(?:조|억|만|K|M|B|T)?/g);
  if (!parts || parts.join('') !== s) return null;
  return parts.reduce((sum, part) => {
    const unit = part.match(/(조|억|만|K|M|B|T)$/)?.[1];
    return sum + parseFloat(part) * (unit ? UNIT_VALUES[unit] : 1);
  }, 0);
}

/**
 * 점수를 지정된 형식으로 포맷팅합니다.
 * @param value 점수 문자열
 * @param displayType 표시 형식
 * @returns 포맷팅된 점수 문자열
 */
export function formatScore(value: string, displayType: ScoreDisplayType): string {
  if (!value || value.trim() === '') return value;

  // 전각 숫자(１２３)도 읽는다
  const input = value.normalize('NFKC');
  // 숫자만 쓴 경우 콤마·한글 표기는 문자열·큰 정수로 처리 (아주 큰 수도 자릿수가 틀어지지 않게)
  const digits = input.replace(/[,\s]/g, '').replace(/점$/, '');
  if (/^\d+$/.test(digits)) {
    if (displayType === 'comma') return digits.replace(/^0+(?=\d)/, '').replace(/\B(?=(\d{3})+(?!\d))/g, ',');
    if (displayType === 'korean') return formatKoreanBig(BigInt(digits));
  }

  const num = parseScore(input);
  if (num === null || !Number.isFinite(num)) return value;

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
 * 숫자를 K/M/B/T 단위로 축약 (331M = 3억 3100만)
 * 반올림해서 1000이 되면 다음 단위로 올린다 (999,950 → 1M)
 */
function formatAbbreviated(num: number): string {
  const units: [number, string][] = [
    [1e3, 'K'],
    [1e6, 'M'],
    [1e9, 'B'],
    [1e12, 'T'],
  ];
  if (num < 1000) return Math.round(num).toString();
  const round1 = (v: number) => Math.round(v * 10) / 10;
  let i = units.filter(([unit]) => num >= unit).length - 1;
  let value = round1(num / units[i][0]);
  if (value >= 1000 && i < units.length - 1) value = round1(num / units[++i][0]);
  return `${value % 1 === 0 ? value : value.toFixed(1)}${units[i][1]}`;
}

/**
 * 숫자에 콤마 추가 (1,234,567)
 */
function formatComma(num: number): string {
  return Math.round(num).toLocaleString('en-US');
}

/** 한글 단위 표기의 큰 정수 버전 (조 단위를 넘는 아주 큰 수) */
function formatKoreanBig(num: bigint): string {
  if (num === BigInt(0)) return '0';
  const units: [bigint, string][] = [
    [BigInt('10000000000000000'), '경'],
    [BigInt('1000000000000'), '조'],
    [BigInt('100000000'), '억'],
    [BigInt('10000'), '만'],
  ];
  const parts: string[] = [];
  for (const [value, unit] of units) {
    if (num >= value) {
      parts.push(`${num / value}${unit}`);
      num %= value;
    }
  }
  if (num > BigInt(0)) parts.push(num.toString());
  return parts.join(' ');
}

/**
 * 한글 단위로 표기 (3억 3100만)
 */
function formatKorean(num: number): string {
  num = Math.round(num);
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
