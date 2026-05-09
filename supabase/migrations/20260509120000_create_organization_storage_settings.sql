-- Migration: create_organization_storage_settings.sql

create table if not exists public.organization_storage_settings (
  id                  uuid primary key default gen_random_uuid(),
  tenant_id           uuid not null references public.organizations(id) on delete cascade,

  provider            text not null default 'google_drive'
                        check (provider in (
                          'google_drive',
                          'onedrive',
                          'dropbox',
                          's3'
                        )),

  display_name        text,
  root_folder_id      text,
  root_folder_url     text,

  is_enabled          boolean not null default false,

  connection_status   text not null default 'manual'
                        check (connection_status in (
                          'manual',
                          'connected',
                          'error',
                          'disabled'
                        )),

  locked_at           timestamptz,
  locked_by           uuid references auth.users(id) on delete set null,

  connected_at        timestamptz,
  connected_by        uuid references auth.users(id) on delete set null,

  created_at          timestamptz not null default now(),
  updated_at          timestamptz not null default now(),

  unique (tenant_id)
);

create index if not exists org_storage_tenant_id_idx
  on public.organization_storage_settings(tenant_id);

create index if not exists org_storage_provider_idx
  on public.organization_storage_settings(provider);

create index if not exists org_storage_tenant_provider_idx
  on public.organization_storage_settings(tenant_id, provider);

create trigger organization_storage_settings_updated_at
  before update on public.organization_storage_settings
  for each row execute function public.set_updated_at();

alter table public.organization_storage_settings enable row level security;

create policy "org_storage_select"
  on public.organization_storage_settings
  for select
  using (
    tenant_id = public.current_tenant_id()
    or public.has_role('superadmin')
  );

create policy "org_storage_insert"
  on public.organization_storage_settings
  for insert
  with check (
    (
      tenant_id = public.current_tenant_id()
      and public.has_role('tenant_admin')
    )
    or public.has_role('superadmin')
  );

create policy "org_storage_update"
  on public.organization_storage_settings
  for update
  using (
    (
      tenant_id = public.current_tenant_id()
      and public.has_role('tenant_admin')
    )
    or public.has_role('superadmin')
  );

create policy "org_storage_delete"
  on public.organization_storage_settings
  for delete
  using (
    (
      tenant_id = public.current_tenant_id()
      and public.has_role('tenant_admin')
    )
    or public.has_role('superadmin')
  );
