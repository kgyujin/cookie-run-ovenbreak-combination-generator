import Script from 'next/script';
import { GA_ID } from '@/lib/analytics';

/** Google Analytics. 조합표 화면에만 넣는다 (관리 페이지의 비공개 주소가 기록되지 않게) */
export default function Analytics() {
  if (!GA_ID) return null;
  return (
    <>
      <Script src={`https://www.googletagmanager.com/gtag/js?id=${GA_ID}`} strategy="afterInteractive" />
      <Script id="ga" strategy="afterInteractive">
        {`window.dataLayer=window.dataLayer||[];function gtag(){dataLayer.push(arguments)}gtag('js',new Date());gtag('config','${GA_ID}');`}
      </Script>
    </>
  );
}
