import Link from 'next/link';

export default function NotFound() {
  return (
    <main className="grid min-h-dvh place-items-center bg-surface-cream p-6 text-center">
      <div>
        <p className="text-5xl" aria-hidden="true">🍪</p>
        <h1 className="mt-4 text-title-md text-ink">페이지를 찾을 수 없어요</h1>
        <Link href="/" className="btn-link mt-6">
          조합표로 가기
        </Link>
      </div>
    </main>
  );
}
