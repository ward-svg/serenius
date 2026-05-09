-- Migration: create_organization_storage_credentials.sql

create table if not exists public.organization_storage_credentials (
  id                      uuid primary key default gen_random_uuid(),
  tenant_id               uuid not null references public.organizations(id) on delete cascade,

  provider                text not null default 'google_drive'
                            check (provider in (
                              'google_drive',
                              'onedrive',
                              'dropbox',
                              's3'
                            )),

  access_token            text,
  refresh_token           text,
  token_type              text,
  scope                   text,
  expiry_date             timestamptz,

  external_account_email  text,
  external_account_name   text,

  created_at              timestamptz not null default now(),
  updated_at              timestamptz not null default now(),

  unique (tenant_id, provider)
);

create index if not exists org_storage_creds_tenant_id_idx
  on public.organization_storage_credentials(tenant_id);

create index if not exists org_storage_creds_tenant_provider_idx
  on public.organization_storage_credentials(tenant_id, provider);

create index if not exists org_storage_creds_provider_idx
  on public.organization_storage_credentials(provider);

create trigger organization_storage_credentials_updated_at
  before update on public.organization_storage_credentials
  for each row execute function public.set_updated_at();

alter table public.organization_storage_credentials enable row level security;

create policy "org_storage_credentials_superadmin_only"
  on public.organization_storage_credentials
  for all
  using (public.has_role('superadmin'));
