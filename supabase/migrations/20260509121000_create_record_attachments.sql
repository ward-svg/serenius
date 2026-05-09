-- Migration: create_record_attachments.sql

create table if not exists public.record_attachments (
  id                  uuid primary key default gen_random_uuid(),
  tenant_id           uuid not null references public.organizations(id) on delete cascade,

  record_type         text not null check (trim(record_type) <> ''),
  record_id           uuid not null,

  storage_provider    text not null default 'google_drive'
                        check (storage_provider in (
                          'google_drive',
                          'onedrive',
                          'dropbox',
                          's3'
                        )),

  provider_file_id    text,
  provider_folder_id  text,

  file_name           text not null check (trim(file_name) <> ''),
  file_url            text,
  mime_type           text,
  file_size_bytes     bigint check (file_size_bytes is null or file_size_bytes >= 0),
  description         text,
  metadata            jsonb not null default '{}'::jsonb,

  uploaded_by         uuid references auth.users(id) on delete set null,
  created_at          timestamptz not null default now(),
  updated_at          timestamptz not null default now()
);

create index if not exists record_attachments_tenant_id_idx
  on public.record_attachments(tenant_id);

create index if not exists record_attachments_tenant_record_idx
  on public.record_attachments(tenant_id, record_type, record_id);

create index if not exists record_attachments_storage_provider_idx
  on public.record_attachments(storage_provider);

create index if not exists record_attachments_uploaded_by_idx
  on public.record_attachments(uploaded_by);

create index if not exists record_attachments_created_at_idx
  on public.record_attachments(created_at desc);

create trigger record_attachments_updated_at
  before update on public.record_attachments
  for each row execute function public.set_updated_at();

alter table public.record_attachments enable row level security;

create policy "record_attachments_select"
  on public.record_attachments
  for select
  using (
    tenant_id = public.current_tenant_id()
    or public.has_role('superadmin')
  );

create policy "record_attachments_insert"
  on public.record_attachments
  for insert
  with check (
    tenant_id = public.current_tenant_id()
    or public.has_role('superadmin')
  );

create policy "record_attachments_update"
  on public.record_attachments
  for update
  using (
    tenant_id = public.current_tenant_id()
    or public.has_role('superadmin')
  );

create policy "record_attachments_delete"
  on public.record_attachments
  for delete
  using (
    tenant_id = public.current_tenant_id()
    or public.has_role('superadmin')
  );
