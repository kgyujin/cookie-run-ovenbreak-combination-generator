'use client';

import { pickTheme, sanitizeTheme, useAppStore } from '@/store/useAppStore';
import { SavedEntry, useLibrary } from '@/lib/library';
import { track } from '@/lib/analytics';
import { objectParticle } from '@/lib/korean';
import SavedList, { NewEntryForm } from '../SavedList';
import { Section } from './controls';

/** 지금 꾸미기 (테마로 저장하거나 덮어쓸 내용) */
const currentTheme = () => pickTheme(useAppStore.getState());

/** 설정 패널의 테마: 지금 꾸미기(배경, 글꼴, 카드, 칸 위치, 보이는 영역 등)를 저장해 두고 다른 조합표에 한 번에 적용한다 */
export default function ThemeSection() {
  const count = useLibrary((s) => s.themes.length);
  const { showToast, applyTheme } = useAppStore.getState();

  const apply = (entry: SavedEntry) => {
    applyTheme(sanitizeTheme(entry.data));
    showToast(`${entry.name}${objectParticle(entry.name)} 적용했어요`);
    track('apply_theme');
  };

  return (
    <Section id="theme" title="테마">
      <NewEntryForm
        kind="themes"
        label="새 테마 이름"
        placeholder={`테마 ${count + 1}`}
        buttonLabel="지금 꾸미기 저장"
        data={currentTheme}
        onSaved={() => {
          showToast('테마로 저장했어요');
          track('save_theme');
        }}
      />
      <SavedList
        kind="themes"
        noun="테마"
        primaryLabel="적용"
        onPrimary={apply}
        current={currentTheme}
        currentLabel="지금 꾸미기"
        emptyText="저장한 테마가 없어요. 배경, 글꼴, 카드, 칸 위치 같은 꾸미기를 저장해 두면 다른 조합표에도 바로 쓸 수 있어요."
      />
    </Section>
  );
}
