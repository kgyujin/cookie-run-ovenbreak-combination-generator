-- 짧은 링크 보안 강화
-- 1) 테이블 직접 접근 차단 (RLS가 꺼지더라도)
-- 2) 저장·조회 요청 수 제한 (IP별·전체, 1시간 단위)
-- 3) 저장 데이터 크기·필드 검사, 추측하기 어려운 10자리 ID
-- 4) 업로드 파일 이름 형식·시간당 개수 제한

create schema if not exists private;
revoke all on schema private from public, anon, authenticated;

revoke all on table public.shares from anon, authenticated;

create table if not exists private.rate_limit (
  key text not null,
  bucket timestamptz not null,
  hits int not null default 0,
  primary key (key, bucket)
);

create or replace function private.client_ip()
returns text
language sql
stable
set search_path = ''
as $$
  select coalesce(
    nullif(trim(split_part(current_setting('request.headers', true)::json ->> 'x-forwarded-for', ',', 1)), ''),
    'unknown'
  );
$$;

create or replace function private.hit(p_key text, p_limit int)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  n int;
begin
  insert into private.rate_limit as r (key, bucket, hits)
  values (p_key, date_trunc('hour', now()), 1)
  on conflict (key, bucket) do update set hits = r.hits + 1
  returning hits into n;
  if n > p_limit then
    raise exception 'rate limited' using errcode = 'P0001';
  end if;
  -- 가끔 오래된 기록 정리
  if random() < 0.01 then
    delete from private.rate_limit where bucket < now() - interval '1 day';
  end if;
end;
$$;

create or replace function public.create_share(payload jsonb)
returns text
language plpgsql
security definer
set search_path = ''
as $$
declare
  alphabet constant text := '23456789abcdefghijkmnpqrstuvwxyzABCDEFGHJKLMNPQRSTUVWXYZ';
  new_id text;
  b bytea;
begin
  if payload is null
     or jsonb_typeof(payload) <> 'object'
     or octet_length(payload::text) > 49152
     or exists (
       select 1 from jsonb_object_keys(payload) k
       where k not in ('background', 'seasonName', 'seasonDish', 'seasonIngredients', 'arenas', 'fontSettings', 'displaySettings', 'boardStyle')
     ) then
    raise exception 'invalid payload' using errcode = '22023';
  end if;
  perform private.hit('create:' || private.client_ip(), 30);
  perform private.hit('create:global', 2000);
  loop
    b := extensions.gen_random_bytes(10);
    new_id := '';
    for i in 0..9 loop
      new_id := new_id || substr(alphabet, 1 + get_byte(b, i) % 56, 1);
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

create or replace function public.get_share(share_id text)
returns jsonb
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  result jsonb;
begin
  if share_id is null or share_id !~ '^[A-Za-z0-9]{4,16}$' then
    return null;
  end if;
  perform private.hit('get:' || private.client_ip(), 600);
  select data into result from public.shares where id = share_id;
  return result;
end;
$$;

revoke all on function public.create_share(jsonb) from public;
revoke all on function public.get_share(text) from public;
grant execute on function public.create_share(jsonb) to anon, authenticated;
grant execute on function public.get_share(text) to anon, authenticated;

-- 업로드: 앱이 만드는 이름 형식(무작위 UUID + 확장자)만, 전체 시간당 300개까지
update storage.buckets
set public = true,
    file_size_limit = 5242880,
    allowed_mime_types = array['image/png', 'image/jpeg', 'image/webp', 'image/gif', 'font/ttf', 'font/otf', 'font/woff', 'font/woff2']
where id = 'share-assets';

create or replace function private.share_assets_quota_ok()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select count(*) < 300
  from storage.objects
  where bucket_id = 'share-assets' and created_at > now() - interval '1 hour';
$$;

grant usage on schema private to anon, authenticated;
revoke all on all functions in schema private from public, anon, authenticated;
grant execute on function private.share_assets_quota_ok() to anon, authenticated;

drop policy if exists "share-assets: anyone can upload" on storage.objects;
create policy "share-assets: anyone can upload"
  on storage.objects for insert
  to anon, authenticated
  with check (
    bucket_id = 'share-assets'
    and name ~ '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\.(png|jpg|webp|gif|ttf|otf|woff|woff2)$'
    and private.share_assets_quota_ok()
  );
