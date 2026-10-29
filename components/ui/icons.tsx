// 스트로크 아이콘 (24x24). 장식용이므로 aria-hidden, 이름은 버튼에 붙인다.
const Icon = ({ d, className = 'h-5 w-5' }: { d: string; className?: string }) => (
  <svg className={'shrink-0 ' + className} fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" viewBox="0 0 24 24" aria-hidden="true">
    <path d={d} />
  </svg>
);

export const CloseIcon = () => <Icon d="M6 18 18 6M6 6l12 12" />;
export const SettingsIcon = () => (
  <Icon d="M12 15a3 3 0 1 0 0-6 3 3 0 0 0 0 6Zm7.4-3a7.4 7.4 0 0 0-.1-1.2l2-1.6-2-3.4-2.4 1a7.6 7.6 0 0 0-2-1.2L14.5 3h-5l-.4 2.6a7.6 7.6 0 0 0-2 1.2l-2.4-1-2 3.4 2 1.6a7.4 7.4 0 0 0 0 2.4l-2 1.6 2 3.4 2.4-1a7.6 7.6 0 0 0 2 1.2l.4 2.6h5l.4-2.6a7.6 7.6 0 0 0 2-1.2l2.4 1 2-3.4-2-1.6c.1-.4.1-.8.1-1.2Z" />
);
export const BellIcon = () => <Icon d="M6 8a6 6 0 1 1 12 0c0 7 3 9 3 9H3s3-2 3-9m4.3 13a1.9 1.9 0 0 0 3.4 0" />;
export const FolderIcon = () => <Icon d="M3 7a2 2 0 0 1 2-2h4l2 2h8a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V7Z" />;
export const ReplaceIcon = () => <Icon d="M4 4v6h6M20 20v-6h-6M5.5 15a7 7 0 0 0 12.3 2.5L20 14M18.5 9A7 7 0 0 0 6.2 6.5L4 10" className="h-4 w-4" />;
export const PencilIcon = () => <Icon d="M4 20h4L18.5 9.5a2.1 2.1 0 0 0-3-3L5 17v3Z" className="h-4 w-4" />;
export const TrashIcon = () => <Icon d="M4 7h16M10 11v6m4-6v6M9 7V4h6v3M6 7l1 13h10l1-13" className="h-4 w-4" />;
export const PlusIcon = ({ className }: { className?: string }) => <Icon d="M12 5v14M5 12h14" className={className} />;
export const UndoIcon = ({ className }: { className?: string }) => <Icon d="M9 14 4 9l5-5M4 9h10.5a5.5 5.5 0 0 1 0 11H11" className={className} />;
export const DownloadIcon = () => <Icon d="M12 4v11m0 0-4-4m4 4 4-4M5 19h14" />;
export const LinkIcon = () => <Icon d="M10 14a4 4 0 0 0 5.7 0l3-3a4 4 0 0 0-5.7-5.7l-1 1M14 10a4 4 0 0 0-5.7 0l-3 3a4 4 0 0 0 5.7 5.7l1-1" />;
export const SearchIcon = () => <Icon d="m21 21-4.3-4.3M11 18a7 7 0 1 0 0-14 7 7 0 0 0 0 14Z" className="h-4 w-4" />;
export const PlayIcon = () => <Icon d="M7 5v14l11-7L7 5Z" className="h-4 w-4" />;
export const CheckIcon = ({ className = 'h-4 w-4' }: { className?: string }) => <Icon d="m5 12 5 5L20 7" className={className} />;
export const CopyIcon = () => <Icon d="M9 9h10v10H9zM5 15V5h10" className="h-4 w-4" />;
export const ImageIcon = ({ className = 'h-6 w-6' }: { className?: string }) => (
  <Icon d="M4 5h16v14H4zM4 16l4.5-4.5 4 4 2.5-2.5L20 18M15.5 9.5h.01" className={className} />
);
export const EyeIcon = () => <Icon d="M2 12s3.6-7 10-7 10 7 10 7-3.6 7-10 7S2 12 2 12Zm10 3a3 3 0 1 0 0-6 3 3 0 0 0 0 6Z" className="h-4 w-4" />;
export const EyeOffIcon = () => <Icon d="M3 3l18 18M10.6 5.1A9.8 9.8 0 0 1 12 5c6.4 0 10 7 10 7a17 17 0 0 1-2.9 3.7M6.6 6.6C3.8 8.4 2 12 2 12s3.6 7 10 7a9.6 9.6 0 0 0 5.4-1.6M9.9 9.9a3 3 0 0 0 4.2 4.2" className="h-4 w-4" />;
export const PinIcon = () => <Icon d="M9 4h6l-1 6 3 3H7l3-3-1-6Zm3 9v7" className="h-4 w-4" />;
export const ShareIcon = () => <Icon d="M12 3v12m0-12 4 4m-4-4L8 7M5 13v6h14v-6" className="h-4 w-4" />;
// 글자와 함께 쓰는 동작 버튼용 (저장, 다시 불러오기, 처음대로, 파일 올리기, 선택 해제, 초기화)
export const SaveIcon = () => <Icon d="M5 4h11l3 3v12a1 1 0 0 1-1 1H6a1 1 0 0 1-1-1V4ZM8 4v4h7V4M8 20v-6h8v6" className="h-4 w-4" />;
export const RefreshIcon = () => <Icon d="M20 12a8 8 0 1 1-8-8c2.2 0 4.2.9 5.7 2.3L20 8.6M20 4v4.6h-4.6" className="h-4 w-4" />;
export const ResetIcon = () => <Icon d="M4 12a8 8 0 1 0 8-8c-2.2 0-4.2.9-5.7 2.3L4 8.6M4 4v4.6h4.6" className="h-4 w-4" />;
export const UploadIcon = () => <Icon d="M14 3H7a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V8l-5-5ZM14 3v5h5M12 18v-6m-2.5 2.5L12 12l2.5 2.5" className="h-4 w-4" />;
export const ClearIcon = () => <Icon d="M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18ZM5.6 5.6l12.8 12.8" className="h-4 w-4" />;
export const PaletteIcon = () => (
  <Icon d="M12 21a9 9 0 1 1 9-9c0 2.2-1.8 3.5-3.6 3.5h-1.9a1.8 1.8 0 0 0-1.3 3.1A1.4 1.4 0 0 1 12 21ZM7.5 12h.01M9 8h.01M14 7.5h.01M17 11h.01" className="h-4 w-4" />
);
export const EraserIcon = () => <Icon d="M8 21h12M3.7 14.3l9.6-9.6a2 2 0 0 1 2.8 0l3.2 3.2a2 2 0 0 1 0 2.8L11 19H8.4l-4.7-4.7ZM9 9l6 6" className="h-4 w-4" />;

/** 앱 로고: 초코칩 쿠키 */
export const CookieLogo = () => (
  <svg viewBox="0 0 32 32" className="h-8 w-8" aria-hidden="true">
    <circle cx="16" cy="16" r="14" fill="#F3B562" />
    <circle cx="16" cy="16" r="14" fill="none" stroke="#C2410C" strokeWidth="2" />
    <circle cx="11" cy="11" r="2.2" fill="#5B3418" />
    <circle cx="20" cy="10" r="1.6" fill="#5B3418" />
    <circle cx="21" cy="19" r="2.4" fill="#5B3418" />
    <circle cx="12" cy="20" r="1.8" fill="#5B3418" />
    <circle cx="16" cy="15" r="1.2" fill="#5B3418" />
  </svg>
);
