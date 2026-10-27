-- 짧은 공유 링크 (/s/{id})
-- 테이블은 RLS로 막아 두고, 브라우저(공개 키)는 아래 두 함수로만 저장·조회한다.
-- → 남의 공유 데이터를 목록으로 훑어보거나 수정·삭제할 수 없다.

create table if not exists public.shares (
  id text primary key,
  data jsonb not null,
  created_at timestamptz not null default now()
);

alter table public.shares enable row level security;

-- 저장: 7자리 무작위 ID를 만들어 돌려준다
create or replace function public.create_share(payload jsonb)
returns text
language plpgsql
security definer
set search_path = ''
as $$
declare
  alphabet constant text := '23456789abcdefghijkmnpqrstuvwxyzABCDEFGHJKLMNPQRSTUVWXYZ';
  new_id text;
begin
  if jsonb_typeof(payload) <> 'object' or pg_column_size(payload) > 200000 then
    raise exception 'invalid payload';
  end if;
  loop
    new_id := '';
    for i in 1..7 loop
      new_id := new_id || substr(alphabet, 1 + floor(random() * length(alphabet))::int, 1);
    end loop;
    begin
      insert into public.shares (id, data) values (new_id, payload);
      return new_id;
    exception when unique_violation then
      -- 드물게 겹치면 다시 만든다
    end;
  end loop;
end;
$$;

-- 조회
create or replace function public.get_share(share_id text)
returns jsonb
language sql
stable
security definer
set search_path = ''
as $$
  select data from public.shares where id = share_id;
$$;

revoke all on function public.create_share(jsonb) from public;
revoke all on function public.get_share(text) from public;
grant execute on function public.create_share(jsonb) to anon, authenticated;
grant execute on function public.get_share(text) to anon, authenticated;

-- 직접 올린 배경 이미지·글꼴 파일 (공개 읽기, 업로드만 허용, 5MB 제한)
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'share-assets', 'share-assets', true, 5242880,
  array['image/png', 'image/jpeg', 'image/webp', 'image/gif', 'font/ttf', 'font/otf', 'font/woff', 'font/woff2']
)
on conflict (id) do nothing;

drop policy if exists "share-assets: anyone can upload" on storage.objects;
create policy "share-assets: anyone can upload"
  on storage.objects for insert
  to anon, authenticated
  with check (bucket_id = 'share-assets');
