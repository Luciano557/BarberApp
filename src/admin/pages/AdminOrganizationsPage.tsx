import { useEffect, useState } from 'react';
import { Building2, Search } from 'lucide-react';

import { AdminCollectionCard } from '@/admin/components/AdminCollectionCard';
import { AdminPagination } from '@/admin/components/AdminPagination';
import { formatAdminDate, formatAdminMoney, planLabel, statusTone, subscriptionStatusLabel } from '@/admin/adminFormatters';
import { Input } from '@/components/ui/input';
import { PageHeader } from '@/components/ui/PageHeader';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { StatusPill } from '@/components/ui/StatusPill';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { usePlatformAdminOrganizations } from '@/hooks/usePlatformAdmin';
import type { PlatformAdminAccessStatus, PlatformAdminOrganizationDto } from '@/types/platformAdmin';
import { useAdminDebouncedValue } from '@/admin/useAdminDebouncedValue';

const PAGE_SIZE = 25;

export default function AdminOrganizationsPage() {
  const [page, setPage] = useState(1);
  const [searchInput, setSearchInput] = useState('');
  const [planCode, setPlanCode] = useState('all');
  const [accessStatus, setAccessStatus] = useState('all');
  const [sort, setSort] = useState('createdAt:desc');
  const search = useAdminDebouncedValue(searchInput.trim());
  const [sortField, sortDirection] = sort.split(':') as [string, 'asc' | 'desc'];

  useEffect(() => setPage(1), [accessStatus, planCode, search, sort]);

  const query = usePlatformAdminOrganizations({
    page,
    pageSize: PAGE_SIZE,
    search,
    filters: {
      ...(planCode !== 'all' ? { planCode } : {}),
      ...(accessStatus !== 'all' ? { accessStatus: accessStatus as PlatformAdminAccessStatus } : {}),
    },
    sort: { field: sortField, direction: sortDirection },
  });

  const result = query.data;
  const items = result?.items ?? [];

  return (
    <div>
      <PageHeader
        title="Barberías"
        subtitle="Organizaciones, acceso vigente y adopción de Vittro sin exponer datos operativos."
        icon={Building2}
      />

      <AdminCollectionCard
        toolbar={(
          <div className="space-y-4">
            <div>
              <h2 className="text-base font-medium text-foreground">Directorio de barberías</h2>
              <p className="mt-0.5 text-xs text-muted-foreground">Filtros y orden se resuelven en servidor.</p>
            </div>
            <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-[minmax(15rem,1fr)_11rem_11rem_12rem]">
              <div className="relative sm:col-span-2 lg:col-span-1">
                <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                  value={searchInput}
                  onChange={(event) => setSearchInput(event.target.value)}
                  placeholder="Buscar por nombre o slug…"
                  aria-label="Buscar barberías"
                  maxLength={200}
                  className="pl-9"
                />
              </div>
              <Select value={planCode} onValueChange={setPlanCode}>
                <SelectTrigger aria-label="Filtrar por plan"><SelectValue placeholder="Todos los planes" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todos los planes</SelectItem>
                  <SelectItem value="basico">Básico</SelectItem>
                  <SelectItem value="profesional">Profesional</SelectItem>
                  <SelectItem value="premium">Premium</SelectItem>
                </SelectContent>
              </Select>
              <Select value={accessStatus} onValueChange={setAccessStatus}>
                <SelectTrigger aria-label="Filtrar por acceso"><SelectValue placeholder="Todo acceso" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todo acceso</SelectItem>
                  <SelectItem value="active">Acceso pago</SelectItem>
                  <SelectItem value="trialing">Trial vigente</SelectItem>
                  <SelectItem value="past_due">Pago pendiente</SelectItem>
                  <SelectItem value="expired">Vencida</SelectItem>
                  <SelectItem value="cancelled">Cancelada</SelectItem>
                  <SelectItem value="legacy">Legacy</SelectItem>
                  <SelectItem value="inactive">Inactiva</SelectItem>
                </SelectContent>
              </Select>
              <Select value={sort} onValueChange={setSort}>
                <SelectTrigger aria-label="Ordenar barberías"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="createdAt:desc">Más recientes</SelectItem>
                  <SelectItem value="createdAt:asc">Más antiguas</SelectItem>
                  <SelectItem value="name:asc">Nombre A–Z</SelectItem>
                  <SelectItem value="mau30:desc">Mayor actividad</SelectItem>
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
        errorMessage="No pudimos cargar las barberías."
        emptyIcon={Building2}
        emptyTitle="No encontramos barberías"
        emptyDescription="Probá con otros términos o quitá alguno de los filtros."
        onRetry={() => void query.refetch()}
        footer={result ? (
          <AdminPagination
            page={result.page}
            pageSize={result.pageSize}
            total={result.total}
            onPageChange={setPage}
            disabled={query.isFetching}
          />
        ) : undefined}
      >
        <div className="hidden md:block">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Barbería</TableHead>
                <TableHead>Acceso</TableHead>
                <TableHead>Plan / facturación</TableHead>
                <TableHead className="text-right">Sucursales</TableHead>
                <TableHead className="text-right">Usuarios</TableHead>
                <TableHead className="text-right">MAU 30</TableHead>
                <TableHead>Alta</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {items.map((item) => <OrganizationRow key={item.id} item={item} />)}
            </TableBody>
          </Table>
        </div>

        <div className="divide-y divide-border md:hidden">
          {items.map((item) => <OrganizationCard key={item.id} item={item} />)}
        </div>
      </AdminCollectionCard>
    </div>
  );
}

function OrganizationRow({ item }: { item: PlatformAdminOrganizationDto }) {
  return (
    <TableRow>
      <TableCell>
        <p className="font-medium text-foreground">{item.name}</p>
        <p className="mt-0.5 text-xs text-muted-foreground">{item.slug ?? 'Sin slug'}</p>
      </TableCell>
      <TableCell>
        <div className="space-y-1.5">
          <StatusPill status={statusTone(item.accessStatus)} label={subscriptionStatusLabel(item.accessStatus)} size="sm" />
          {!item.isEnabled && <p className="text-[11px] text-status-error-foreground">Organización deshabilitada</p>}
        </div>
      </TableCell>
      <TableCell>
        <p className="text-sm text-foreground">{item.planName ?? planLabel(item.planCode)}</p>
        <p className="mt-0.5 text-xs tabular-nums text-muted-foreground">{formatAdminMoney(item.billingAmountArs)}</p>
      </TableCell>
      <TableCell className="text-right tabular-nums">{item.branchesCount}</TableCell>
      <TableCell className="text-right tabular-nums">{item.usersCount}</TableCell>
      <TableCell className="text-right font-medium tabular-nums">{item.mau30}</TableCell>
      <TableCell className="whitespace-nowrap text-muted-foreground">{formatAdminDate(item.createdAt)}</TableCell>
    </TableRow>
  );
}

function OrganizationCard({ item }: { item: PlatformAdminOrganizationDto }) {
  return (
    <article className="space-y-3 p-4">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <h3 className="truncate text-sm font-medium text-foreground">{item.name}</h3>
          <p className="mt-0.5 truncate text-xs text-muted-foreground">{item.slug ?? 'Sin slug'}</p>
        </div>
        <StatusPill status={statusTone(item.accessStatus)} label={subscriptionStatusLabel(item.accessStatus)} size="sm" />
      </div>
      <dl className="grid grid-cols-2 gap-x-4 gap-y-3 text-xs">
        <Info label="Plan" value={item.planName ?? planLabel(item.planCode)} />
        <Info label="Importe" value={formatAdminMoney(item.billingAmountArs)} />
        <Info label="Sucursales" value={String(item.branchesCount)} />
        <Info label="Usuarios / MAU" value={`${item.usersCount} / ${item.mau30}`} />
      </dl>
      {!item.isEnabled && <p className="text-xs font-medium text-status-error-foreground">Organización deshabilitada</p>}
    </article>
  );
}

function Info({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <dt className="text-muted-foreground">{label}</dt>
      <dd className="mt-0.5 font-medium text-foreground">{value}</dd>
    </div>
  );
}
