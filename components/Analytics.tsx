'use client';

import Script from 'next/script';
import { Analytics as VercelAnalytics, type BeforeSendEvent } from '@vercel/analytics/next';
import { GA_ID } from '@/lib/analytics';

/**
 * 방문 기록: Vercel Analytics(방문자, 페이지 조회수)와 Google Analytics(기능 사용).
 * 조합표 화면에만 넣는다 (관리 페이지의 비공개 주소가 기록되지 않게)
 */
export default function Analytics() {
  return (
    <>
      <VercelAnalytics beforeSend={hideBoard} />
      {GA_ID && (
        <>
          <Script src={`https://www.googletagmanager.com/gtag/js?id=${GA_ID}`} strategy="afterInteractive" />
          <Script id="ga" strategy="afterInteractive">
            {`window.dataLayer=window.dataLayer||[];function gtag(){dataLayer.push(arguments)}gtag('js',new Date());gtag('config','${GA_ID}');`}
          </Script>
        </>
      )}
    </>
  );
}

/** 공유 링크의 아이디와 예전 긴 링크의 조합표 내용(?data=)은 보내지 않는다 */
function hideBoard(event: BeforeSendEvent): BeforeSendEvent {
  const url = new URL(event.url);
  url.pathname = url.pathname.replace(/^\/(s|v)\/[^/]+/, '/$1/[id]');
  url.search = '';
  url.hash = '';
  return { ...event, url: url.toString() };
}
