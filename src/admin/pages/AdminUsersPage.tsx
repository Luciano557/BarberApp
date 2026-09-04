import { useEffect, useState } from 'react';
import { Search, UserRoundX, Users } from 'lucide-react';

import { AdminCollectionCard } from '@/admin/components/AdminCollectionCard';
import { AdminPagination } from '@/admin/components/AdminPagination';
import { formatAdminDate, statusTone } from '@/admin/adminFormatters';
import { Input } from '@/components/ui/input';
import { PageHeader } from '@/components/ui/PageHeader';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { StatusPill } from '@/components/ui/StatusPill';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { usePlatformAdminUsers } from '@/hooks/usePlatformAdmin';
import type { PlatformAdminTenantRole, PlatformAdminUserDto } from '@/types/platformAdmin';
import { useAdminDebouncedValue } from '@/admin/useAdminDebouncedValue';

const PAGE_SIZE = 25;

const ROLE_LABELS: Record<PlatformAdminTenantRole, string> = {
  owner: 'Dueño',
  general_manager: 'Enc. general',
  manager: 'Enc. sucursal',
  barber: 'Barbero',
  sucursal_account: 'Cuenta sucursal',
  otros: 'Otro',
};

const USER_STATUS_LABELS: Record<PlatformAdminUserDto['status'], string> = {
  active: 'Habilitado',
  inactive: 'Inactivo',
  invited: 'Invitado',
  disabled: 'Bloqueado',
};

export default function AdminUsersPage() {
  const [page, setPage] = useState(1);
  const [searchInput, setSearchInput] = useState('');
  const [activity, setActivity] = useState('all');
  const [role, setRole] = useState('all');
  const [status, setStatus] = useState('all');
  const [sort, setSort] = useState('lastSignInAt:desc');
  const search = useAdminDebouncedValue(searchInput.trim());
  const [sortField, sortDirection] = sort.split(':') as [string, 'asc' | 'desc'];

  useEffect(() => setPage(1), [activity, role, search, sort, status]);

  const query = usePlatformAdminUsers({
    page,
    pageSize: PAGE_SIZE,
    search,
    filters: {
      ...(activity !== 'all' ? { activity: activity as 'mau30' | 'inactive' } : {}),
      ...(role !== 'all' ? { role: role as PlatformAdminTenantRole } : {}),
      ...(status !== 'all' ? { status: status as PlatformAdminUserDto['status'] } : {}),
    },
    sort: { field: sortField, direction: sortDirection },
  });

  const result = query.data;
  const items = result?.items ?? [];

  return (
    <div>
      <PageHeader
        title="Usuarios"
        subtitle="Cuentas tenant, roles y último inicio de sesión; no representa presencia en línea."
        icon={Users}
      />

      <AdminCollectionCard
        toolbar={(
          <div className="space-y-4">
            <div>
              <h2 className="text-base font-medium text-foreground">Directorio de usuarios</h2>
              <p className="mt-0.5 text-xs text-muted-foreground">MAU 30 = inició sesión al menos una vez durante los últimos 30 días.</p>
            </div>
            <div className="grid gap-2 sm:grid-cols-2 xl:grid-cols-[minmax(15rem,1fr)_10rem_11rem_10rem_12rem]">
              <div className="relative sm:col-span-2 xl:col-span-1">
                <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                  value={searchInput}
                  onChange={(event) => setSearchInput(event.target.value)}
                  placeholder="Nombre, email o barbería…"
                  aria-label="Buscar usuarios"
                  maxLength={200}
                  className="pl-9"
                />
              </div>
              <Select value={activity} onValueChange={setActivity}>
                <SelectTrigger aria-label="Filtrar por actividad"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Toda actividad</SelectItem>
                  <SelectItem value="mau30">MAU 30</SelectItem>
                  <SelectItem value="inactive">Sin login 30 d.</SelectItem>
                </SelectContent>
              </Select>
              <Select value={role} onValueChange={setRole}>
                <SelectTrigger aria-label="Filtrar por rol"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todos los roles</SelectItem>
                  {(Object.entries(ROLE_LABELS) as Array<[PlatformAdminTenantRole, string]>).map(([value, label]) => (
                    <SelectItem key={value} value={value}>{label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Select value={status} onValueChange={setStatus}>
                <SelectTrigger aria-label="Filtrar por estado"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todo estado</SelectItem>
                  <SelectItem value="active">Habilitados</SelectItem>
                  <SelectItem value="invited">Invitados</SelectItem>
                  <SelectItem value="inactive">Inactivos</SelectItem>
                  <SelectItem value="disabled">Bloqueados</SelectItem>
                </SelectContent>
              </Select>
              <Select value={sort} onValueChange={setSort}>
                <SelectTrigger aria-label="Ordenar usuarios"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="lastSignInAt:desc">Login más reciente</SelectItem>
                  <SelectItem value="createdAt:desc">Alta más reciente</SelectItem>
                  <SelectItem value="fullName:asc">Nombre A–Z</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        )}
        isPending={query.isPending}
        isError={query.isError}
        isFetching={query.isFetching}
        hasData={Boolean(result)}
        isEmpty={Boolean(result && items.length === 0)}
        errorMessage="No pudimos cargar los usuarios."
        emptyIcon={UserRoundX}
        emptyTitle="No encontramos usuarios"
        emptyDescription="Probá con otra búsqueda o quitá alguno de los filtros."
        onRetry={() => void query.refetch()}
        footer={result ? (
          <AdminPagination page={result.page} pageSize={result.pageSize} total={result.total} onPageChange={setPage} disabled={query.isFetching} />
        ) : undefined}
      >
        <div className="hidden md:block">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Usuario</TableHead>
                <TableHead>Barbería</TableHead>
                <TableHead>Roles</TableHead>
                <TableHead>Último ingreso</TableHead>
                <TableHead>Alta</TableHead>
                <TableHead>Estado</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {items.map((item) => <UserRow key={item.id} item={item} />)}
            </TableBody>
          </Table>
        </div>
        <div className="divide-y divide-border md:hidden">
          {items.map((item) => <UserCard key={item.id} item={item} />)}
        </div>
      </AdminCollectionCard>
    </div>
  );
}

function UserRow({ item }: { item: PlatformAdminUserDto }) {
  return (
    <TableRow>
      <TableCell>
        <p className="font-medium text-foreground">{item.fullName ?? 'Sin nombre'}</p>
        <p className="mt-0.5 max-w-64 truncate text-xs text-muted-foreground">{item.email}</p>
      </TableCell>
      <TableCell>
        <p className="max-w-48 truncate text-sm text-foreground">{item.organizationName ?? 'Sin barbería'}</p>
        {item.organizationSlug && <p className="mt-0.5 text-xs text-muted-foreground">{item.organizationSlug}</p>}
      </TableCell>
      <TableCell>
        <div className="flex max-w-52 flex-wrap gap-1">
          {item.roles.length > 0 ? item.roles.map((role) => (
            <span key={role} className="rounded-full border border-border bg-muted px-2 py-0.5 text-[10px] font-medium text-muted-foreground">
              {ROLE_LABELS[role]}
            </span>
          )) : <span className="text-xs text-muted-foreground">Sin rol</span>}
        </div>
      </TableCell>
      <TableCell className="whitespace-nowrap">
        <p className="text-sm text-foreground">{formatAdminDate(item.lastSignInAt, true)}</p>
        <p className="mt-1 text-xs text-muted-foreground">{item.isMau30 ? 'Dentro de MAU 30' : 'Fuera de MAU 30'}</p>
      </TableCell>
      <TableCell className="whitespace-nowrap text-muted-foreground">{formatAdminDate(item.createdAt)}</TableCell>
      <TableCell>
        <StatusPill
          status={item.status === 'active' && item.isMau30 ? 'success' : item.status === 'disabled' ? 'error' : statusTone(item.status)}
          label={USER_STATUS_LABELS[item.status]}
          size="sm"
        />
      </TableCell>
    </TableRow>
  );
}

function UserCard({ item }: { item: PlatformAdminUserDto }) {
  return (
    <article className="space-y-3 p-4">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <h3 className="truncate text-sm font-medium text-foreground">{item.fullName ?? 'Sin nombre'}</h3>
          <p className="mt-0.5 truncate text-xs text-muted-foreground">{item.email}</p>
        </div>
        <StatusPill status={item.isMau30 ? 'success' : 'neutral'} label={item.isMau30 ? 'MAU 30' : 'Sin actividad'} size="sm" />
      </div>
      <dl className="grid grid-cols-2 gap-3 text-xs">
        <Info label="Barbería" value={item.organizationName ?? 'Sin barbería'} />
        <Info label="Último ingreso" value={formatAdminDate(item.lastSignInAt, true)} />
        <Info label="Roles" value={item.roles.map((role) => ROLE_LABELS[role]).join(', ') || 'Sin rol'} />
        <Info label="Alta" value={formatAdminDate(item.createdAt)} />
      </dl>
    </article>
  );
}

function Info({ label, value }: { label: string; value: string }) {
  return <div><dt className="text-muted-foreground">{label}</dt><dd className="mt-0.5 font-medium text-foreground">{value}</dd></div>;
}
