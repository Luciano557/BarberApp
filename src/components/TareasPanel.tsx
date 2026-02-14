import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { useTareas } from '@/hooks/useTareas';
import { Plus, Trash2, CheckCircle, Clock, XCircle, RefreshCw } from 'lucide-react';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';

import { Barber, getBarberDisplayName } from '@/types/barbershop';

interface TareasPanelProps {
  barbers: Barber[];
}

export function TareasPanel({ barbers }: TareasPanelProps) {
  const { tareas, isLoading, addTarea, updateTarea, deleteTarea } = useTareas();

  const [titulo, setTitulo] = useState('');
  const [descripcion, setDescripcion] = useState('');
  const [asignadoId, setAsignadoId] = useState('');
  const [recurrente, setRecurrente] = useState(false);
  const [frecuenciaDias, setFrecuenciaDias] = useState('');
  const [fechaLimite, setFechaLimite] = useState('');
  const [filtroEstado, setFiltroEstado] = useState('todos');

  const activeBarbers = barbers.filter(b => b.active);

  const handleSubmitTarea = () => {
    if (!titulo.trim()) return;
    const barber = activeBarbers.find(b => b.id === asignadoId);
    const barberName = barber ? getBarberDisplayName(barber) : undefined;
    addTarea.mutate({
      tipo: 'tarea',
      titulo: titulo.trim(),
      descripcion: descripcion.trim() || undefined,
      asignado_a_id: asignadoId || undefined,
      asignado_a_nombre: barberName,
      recurrente,
      frecuencia_dias: recurrente && frecuenciaDias ? parseInt(frecuenciaDias) : undefined,
      fecha_limite: recurrente && frecuenciaDias
        ? new Date(Date.now() + parseInt(frecuenciaDias) * 86400000).toISOString().split('T')[0]
        : (fechaLimite || undefined),
    });
    setTitulo('');
    setDescripcion('');
    setAsignadoId('');
    setRecurrente(false);
    setFrecuenciaDias('');
    setFechaLimite('');
  };

  const tareasFiltradas = tareas.filter(t => {
    if (filtroEstado === 'todos') return true;
    return t.estado === filtroEstado;
  });

  const tareasAdmin = tareasFiltradas.filter(t => t.tipo === 'tarea');
  const peticiones = tareasFiltradas.filter(t => t.tipo === 'peticion');

  const getEstadoBadge = (estado: string) => {
    switch (estado) {
      case 'pendiente':
        return <Badge variant="outline" className="text-amber-600 border-amber-300 bg-amber-50"><Clock className="w-3 h-3 mr-1" />Pendiente</Badge>;
      case 'en_progreso':
        return <Badge variant="outline" className="text-blue-600 border-blue-300 bg-blue-50"><RefreshCw className="w-3 h-3 mr-1" />En progreso</Badge>;
      case 'completada':
        return <Badge variant="outline" className="text-green-600 border-green-300 bg-green-50"><CheckCircle className="w-3 h-3 mr-1" />Completada</Badge>;
      case 'rechazada':
        return <Badge variant="outline" className="text-red-600 border-red-300 bg-red-50"><XCircle className="w-3 h-3 mr-1" />Rechazada</Badge>;
      default:
        return <Badge variant="outline">{estado}</Badge>;
    }
  };

  const renderTable = (items: typeof tareas) => (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>Título</TableHead>
          <TableHead>Asignado a</TableHead>
          <TableHead>Estado</TableHead>
          <TableHead>Recurrente</TableHead>
          <TableHead>Fecha límite</TableHead>
          <TableHead>Creado</TableHead>
          <TableHead className="text-right">Acciones</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {items.length === 0 ? (
          <TableRow>
            <TableCell colSpan={7} className="text-center text-muted-foreground py-8">
              No hay tareas
            </TableCell>
          </TableRow>
        ) : items.map(t => (
          <TableRow key={t.id}>
            <TableCell>
              <div>
                <p className="font-medium">{t.titulo}</p>
                {t.descripcion && <p className="text-xs text-muted-foreground mt-1">{t.descripcion}</p>}
              </div>
            </TableCell>
            <TableCell>{t.asignado_a_nombre || '—'}</TableCell>
            <TableCell>{getEstadoBadge(t.estado)}</TableCell>
            <TableCell>
              {t.recurrente ? (
                <span className="text-xs text-muted-foreground">Cada {t.frecuencia_dias} días</span>
              ) : '—'}
            </TableCell>
            <TableCell>
              {t.fecha_limite ? format(new Date(t.fecha_limite), 'dd/MM/yyyy') : '—'}
            </TableCell>
            <TableCell className="text-xs text-muted-foreground">
              {format(new Date(t.created_at), 'dd/MM/yy', { locale: es })}
            </TableCell>
            <TableCell className="text-right">
              <div className="flex items-center justify-end gap-1">
                {t.estado === 'pendiente' && (
                  <Button size="sm" variant="ghost" onClick={() => updateTarea.mutate({ id: t.id, estado: 'en_progreso' })} title="En progreso">
                    <RefreshCw className="h-4 w-4" />
                  </Button>
                )}
                {(t.estado === 'pendiente' || t.estado === 'en_progreso') && (
                  <Button size="sm" variant="ghost" className="text-green-600" onClick={() => updateTarea.mutate({ id: t.id, estado: 'completada' })} title="Completar">
                    <CheckCircle className="h-4 w-4" />
                  </Button>
                )}
                {t.tipo === 'peticion' && t.estado === 'pendiente' && (
                  <Button size="sm" variant="ghost" className="text-red-600" onClick={() => updateTarea.mutate({ id: t.id, estado: 'rechazada' })} title="Rechazar">
                    <XCircle className="h-4 w-4" />
                  </Button>
                )}
                <Button size="sm" variant="ghost" className="text-destructive" onClick={() => deleteTarea.mutate(t.id)} title="Eliminar">
                  <Trash2 className="h-4 w-4" />
                </Button>
              </div>
            </TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );

  if (isLoading) {
    return <div className="text-center py-8 text-muted-foreground">Cargando tareas...</div>;
  }

  return (
    <div className="space-y-6">
      <h1 className="text-3xl font-bold text-foreground">Tareas y Peticiones</h1>

      {/* Formulario nueva tarea */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Nueva tarea</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <Input placeholder="Título de la tarea" value={titulo} onChange={e => setTitulo(e.target.value)} />
          <Textarea placeholder="Descripción (opcional)" value={descripcion} onChange={e => setDescripcion(e.target.value)} rows={2} />
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <Label className="text-sm mb-1.5 block">Asignar a</Label>
              <Select value={asignadoId} onValueChange={setAsignadoId}>
                <SelectTrigger><SelectValue placeholder="Sin asignar" /></SelectTrigger>
                <SelectContent>
                  {activeBarbers.map(b => (
                    <SelectItem key={b.id} value={b.id}>{getBarberDisplayName(b)}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            {!recurrente && (
              <div>
                <Label className="text-sm mb-1.5 block">Fecha límite</Label>
                <Input type="date" value={fechaLimite} onChange={e => setFechaLimite(e.target.value)} />
              </div>
            )}
          </div>
          <div className="flex items-center gap-4">
            <div className="flex items-center gap-2">
              <Switch checked={recurrente} onCheckedChange={setRecurrente} />
              <Label className="text-sm">Recurrente</Label>
            </div>
            {recurrente && (
              <div className="flex items-center gap-2">
                <Label className="text-sm">Cada</Label>
                <Input type="number" className="w-20" value={frecuenciaDias} onChange={e => setFrecuenciaDias(e.target.value)} min="1" />
                <Label className="text-sm">días</Label>
              </div>
            )}
          </div>
          <Button onClick={handleSubmitTarea} disabled={!titulo.trim() || addTarea.isPending}>
            <Plus className="h-4 w-4 mr-2" />
            Crear tarea
          </Button>
        </CardContent>
      </Card>

      {/* Filtro de estado */}
      <div className="flex items-center gap-2">
        <Label className="text-sm">Filtrar:</Label>
        <Select value={filtroEstado} onValueChange={setFiltroEstado}>
          <SelectTrigger className="w-40"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="todos">Todos</SelectItem>
            <SelectItem value="pendiente">Pendiente</SelectItem>
            <SelectItem value="en_progreso">En progreso</SelectItem>
            <SelectItem value="completada">Completada</SelectItem>
            <SelectItem value="rechazada">Rechazada</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Tabs: Tareas vs Peticiones */}
      <Tabs defaultValue="tareas">
        <TabsList>
          <TabsTrigger value="tareas">Tareas ({tareasAdmin.length})</TabsTrigger>
          <TabsTrigger value="peticiones">Peticiones ({peticiones.length})</TabsTrigger>
        </TabsList>
        <TabsContent value="tareas">
          <Card>
            <CardContent className="p-0">
              {renderTable(tareasAdmin)}
            </CardContent>
          </Card>
        </TabsContent>
        <TabsContent value="peticiones">
          <Card>
            <CardContent className="p-0">
              {renderTable(peticiones)}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
