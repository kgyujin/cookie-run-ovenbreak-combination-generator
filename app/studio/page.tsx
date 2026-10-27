import type { Metadata } from 'next';
import Studio from '@/components/studio/Studio';

export const metadata: Metadata = {
  title: '데이터 관리',
  robots: { index: false, follow: false },
};

export default function StudioPage() {
  return <Studio />;
}
