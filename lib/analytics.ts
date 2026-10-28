/** Google Analytics 측정 ID (Vercel 환경변수 NEXT_PUBLIC_GA_ID, 예: G-AB12CD34EF). 없으면 아무것도 보내지 않는다 */
const id = process.env.NEXT_PUBLIC_GA_ID ?? '';
export const GA_ID = /^G-[A-Z0-9]+$/.test(id) ? id : undefined;

declare global {
  interface Window {
    gtag?: (...args: unknown[]) => void;
  }
}

/** 어떤 기능을 썼는지만 기록한다 (조합표 내용이나 개인 정보는 보내지 않음) */
export function track(event: string, params?: Record<string, string>) {
  window.gtag?.('event', event, params);
}
