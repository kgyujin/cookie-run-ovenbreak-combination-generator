import { ReactNode } from 'react';
import { CookieLogo } from './ui/icons';

/** 화면 상단 고정 막대: 사이트 이름과 오른쪽 버튼들 (편집 화면, 보기 전용 화면 공통. 이미지 저장 대상이 아님) */
export default function TopBar({ children }: { children: ReactNode }) {
  return (
    <header className="sticky top-0 z-40 px-2 pt-2 sm:px-3 sm:pt-3">
      <div className="mx-auto flex h-14 max-w-[1680px] items-center gap-1 rounded-xl border border-white/70 bg-surface-cream/85 pl-2 pr-1.5 shadow-e2 backdrop-blur-md sm:gap-2 sm:pl-3">
        <h1 className="mr-auto flex min-w-0 items-center gap-2">
          {/* 아주 좁은 화면(340px 미만)에서는 로고도 버튼에 자리를 내준다 */}
          <span className="shrink-0 max-[339px]:hidden">
            <CookieLogo />
          </span>
          {/* 좁은 화면에서는 버튼 자리를 위해 로고만 (이름은 화면 읽기 프로그램에) */}
          <span className="truncate text-title-md text-ink max-[479px]:sr-only">쿠키런 조합표</span>
        </h1>
        {children}
      </div>
    </header>
  );
}
