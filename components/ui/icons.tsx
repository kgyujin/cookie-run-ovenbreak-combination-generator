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
export const DownloadIcon = () => <Icon d="M12 4v11m0 0-4-4m4 4 4-4M5 19h14" />;
export const LinkIcon = () => <Icon d="M10 14a4 4 0 0 0 5.7 0l3-3a4 4 0 0 0-5.7-5.7l-1 1M14 10a4 4 0 0 0-5.7 0l-3 3a4 4 0 0 0 5.7 5.7l1-1" />;
export const SearchIcon = () => <Icon d="m21 21-4.3-4.3M11 18a7 7 0 1 0 0-14 7 7 0 0 0 0 14Z" className="h-4 w-4" />;
export const PlayIcon = () => <Icon d="M7 5v14l11-7L7 5Z" className="h-4 w-4" />;
export const CheckIcon = ({ className = 'h-4 w-4' }: { className?: string }) => <Icon d="m5 12 5 5L20 7" className={className} />;
export const CopyIcon = () => <Icon d="M9 9h10v10H9zM5 15V5h10" className="h-4 w-4" />;
export const ShareIcon = () => <Icon d="M12 3v12m0-12 4 4m-4-4L8 7M5 13v6h14v-6" className="h-4 w-4" />;
