-- Migration 20: Storage bucket for faculty assessment attachments
-- Faculty can attach reference files (PDF, doc, etc.) to any assessment

insert into storage.buckets (id, name, public)
  values ('attachments', 'attachments', true)
  on conflict (id) do nothing;

create policy "Authenticated users can read attachments"
  on storage.objects for select to authenticated
  using (bucket_id = 'attachments');

create policy "Authenticated users can upload attachments"
  on storage.objects for insert to authenticated
  with check (bucket_id = 'attachments');

create policy "Authenticated users can delete attachments"
  on storage.objects for delete to authenticated
  using (bucket_id = 'attachments');
