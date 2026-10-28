import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import Studio from '@/components/studio/Studio';
import { STUDIO_PATH, studioConfigured } from '@/lib/studio/config';
import { LOCAL_PATH, localMode } from '@/lib/studio/local';

// 관리 페이지 주소는 빌드 결과(공개되는 JS)에 남지 않도록 요청할 때 서버에서만 비교한다
export const dynamic = 'force-dynamic';

const isStudio = (slug: string) => (studioConfigured() && slug === STUDIO_PATH) || (localMode() && slug === LOCAL_PATH);

// 다른 주소(잘못 친 주소)의 404 화면에는 관리 페이지 제목을 붙이지 않는다
export function generateMetadata({ params }: { params: { slug: string } }): Metadata {
  return isStudio(params.slug) ? { title: '데이터 관리', robots: { index: false, follow: false } } : {};
}

export default function StudioPage({ params }: { params: { slug: string } }) {
  if (!isStudio(params.slug)) notFound();
  return <Studio />;
}
