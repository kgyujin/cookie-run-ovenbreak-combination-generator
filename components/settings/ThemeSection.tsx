'use client';

import { FormEvent, useState } from 'react';
import { pickBoard, pickTheme, sanitizeTheme, useAppStore } from '@/store/useAppStore';
import { MAX_NAME, SavedEntry, STORAGE_FULL_MESSAGE, useLibrary } from '@/lib/library';
import { track } from '@/lib/analytics';
import { Theme } from '@/types';
import Button from '../ui/Button';
import SavedList from '../SavedList';
import { Section } from './controls';

/** 설정 패널의 테마: 지금 꾸미기(배경, 글꼴, 카드, 칸 위치, 보이는 영역 등)를 저장해 두고 다른 조합표에 한 번에 적용한다 */
export default function ThemeSection() {
  const themes = useLibrary((s) => s.themes);
  const [name, setName] = useState('');
  const { showToast, applyTheme } = useAppStore.getState();
  const library = useLibrary.getState();

  const save = (e: FormEvent) => {
    e.preventDefault();
    const theme = pickTheme(pickBoard(useAppStore.getState()));
    if (!library.save('themes', name || `테마 ${themes.length + 1}`, theme)) return showToast(STORAGE_FULL_MESSAGE, 'error');
    setName('');
    showToast('테마로 저장했어요');
    track('save_theme');
  };
  const apply = (entry: SavedEntry<Theme>) => {
    applyTheme(sanitizeTheme(entry.data));
    showToast(`${entry.name} 테마를 적용했어요`);
    track('apply_theme');
  };
  const failIfFull = (ok: boolean) => {
    if (!ok) showToast(STORAGE_FULL_MESSAGE, 'error');
    return ok;
  };

  return (
    <Section id="theme" title="테마">
      <form onSubmit={save} className="flex gap-2">
        <input value={name} onChange={(e) => setName(e.target.value)} maxLength={MAX_NAME} placeholder={`테마 ${themes.length + 1}`} aria-label="새 테마 이름" className="field min-w-0 flex-1" />
        <Button type="submit" variant="primary">
          지금 꾸미기 저장
        </Button>
      </form>
      <SavedList
        items={themes}
        noun="테마"
        primaryLabel="적용"
        onPrimary={apply}
        onRename={(id, next) => failIfFull(library.rename('themes', id, next))}
        onDelete={(id) => failIfFull(library.remove('themes', id))}
        emptyText="저장한 테마가 없어요. 배경, 글꼴, 카드, 칸 위치 같은 꾸미기를 저장해 두면 다른 조합표에도 바로 쓸 수 있어요."
      />
    </Section>
  );
}
