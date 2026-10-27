'use client';

import clsx from 'clsx';
import { UpdateNote } from '@/lib/updates';
import Modal from './ui/Modal';
import Button from './ui/Button';

/** 업데이트 기록. newCount개의 최신 항목에 NEW 표시 */
export default function UpdatesDialog({ updates, newCount, onClose }: { updates: UpdateNote[]; newCount: number; onClose: () => void }) {
  return (
    <Modal
      title="업데이트"
      onClose={onClose}
      footer={
        <Button variant="primary" className="ml-auto" onClick={onClose} data-autofocus>
          확인
        </Button>
      }
    >
      <ol className="space-y-3 p-5">
        {updates.map((note, i) => {
          const isNew = i < newCount;
          return (
            <li
              key={`${note.date}-${note.title}`}
              className={clsx('blur-fade rounded-lg border p-4', isNew ? 'border-primary-ink/40 bg-primary-soft/60' : 'border-line')}
              style={{ ['--i' as string]: i }}
            >
              <div className="flex items-center gap-2">
                <h3 className="text-label-md text-ink">{note.title}</h3>
                {isNew && <span className="rounded-full bg-primary px-1.5 py-0.5 text-[10px] font-bold leading-none text-on-primary">NEW</span>}
                <time dateTime={note.date} className="ml-auto text-caption tabular-nums text-ink-subtle">
                  {note.date.replaceAll('-', '.')}
                </time>
              </div>
              <ul className="mt-2 space-y-1">
                {note.items.map((item) => (
                  <li key={item} className="flex gap-2 text-body-md text-ink-muted">
                    <span className="mt-[9px] h-1 w-1 shrink-0 rounded-full bg-ink-subtle" aria-hidden="true" />
                    {item}
                  </li>
                ))}
              </ul>
            </li>
          );
        })}
      </ol>
    </Modal>
  );
}
