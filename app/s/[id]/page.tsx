import Editor from '@/components/Editor';

export default function SharedBoard({ params }: { params: { id: string } }) {
  return <Editor shareId={params.id} />;
}
