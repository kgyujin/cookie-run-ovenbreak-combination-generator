import Viewer from '@/components/Viewer';
import Analytics from '@/components/Analytics';

// 보기 전용 공유 링크 /v/<id> (next.config.js에서 이 정적 페이지로 보내고, 아이디는 화면에서 주소를 읽어 불러온다)
export default function ViewPage() {
  return (
    <>
      <Viewer />
      <Analytics />
    </>
  );
}
