alter table public.entries
add column if not exists completed_at timestamptz;

comment on column public.entries.completed_at is
'작성자 본인이 완료 버튼을 누르자마자 바로 저장되는 시각';
