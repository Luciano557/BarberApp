import { useState } from 'react';
import { Plus, Edit2, Trash2, Save, X, Scissors, Sparkles, Users, Tag } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Switch } from '@/components/ui/switch';
import { Service, Extra, Barber, Discount } from '@/types/barbershop';

interface ConfigurationPanelProps {
  services: Service[];
  extras: Extra[];
  barbers: Barber[];
  discounts: Discount[];
  onAddService: (service: Omit<Service, 'id'>) => void;
  onUpdateService: (id: string, updates: Partial<Service>) => void;
  onDeleteService: (id: string) => void;
  onAddExtra: (extra: Omit<Extra, 'id'>) => void;
  onUpdateExtra: (id: string, updates: Partial<Extra>) => void;
  onDeleteExtra: (id: string) => void;
  onAddBarber: (barber: Omit<Barber, 'id'>) => void;
  onUpdateBarber: (id: string, updates: Partial<Barber>) => void;
  onDeleteBarber: (id: string) => void;
  onAddDiscount: (discount: Omit<Discount, 'id'>) => void;
  onUpdateDiscount: (id: string, updates: Partial<Discount>) => void;
  onDeleteDiscount: (id: string) => void;
}

export function ConfigurationPanel({
  services,
  extras,
  barbers,
  discounts,
  onAddService,
  onUpdateService,
  onDeleteService,
  onAddExtra,
  onUpdateExtra,
  onDeleteExtra,
  onAddBarber,
  onUpdateBarber,
  onDeleteBarber,
  onAddDiscount,
  onUpdateDiscount,
  onDeleteDiscount,
}: ConfigurationPanelProps) {
  return (
    <div className="space-y-8 animate-fade-in">
      <div>
        <h1 className="text-2xl font-semibold text-foreground">Configuración</h1>
        <p className="text-muted-foreground text-sm mt-1">Administra servicios, extras, staff y descuentos</p>
      </div>

      <Tabs defaultValue="services" className="w-full">
        <TabsList className="w-full h-11 bg-muted p-1 rounded-lg">
          <TabsTrigger value="services" className="flex-1 flex items-center justify-center gap-2 data-[state=active]:bg-card rounded-md text-xs sm:text-sm">
            <Scissors className="h-4 w-4" />
            <span className="hidden sm:inline">Servicios</span>
          </TabsTrigger>
          <TabsTrigger value="extras" className="flex-1 flex items-center justify-center gap-2 data-[state=active]:bg-card rounded-md text-xs sm:text-sm">
            <Sparkles className="h-4 w-4" />
            <span className="hidden sm:inline">Extras</span>
          </TabsTrigger>
          <TabsTrigger value="staff" className="flex-1 flex items-center justify-center gap-2 data-[state=active]:bg-card rounded-md text-xs sm:text-sm">
            <Users className="h-4 w-4" />
            <span className="hidden sm:inline">Staff</span>
          </TabsTrigger>
          <TabsTrigger value="discounts" className="flex-1 flex items-center justify-center gap-2 data-[state=active]:bg-card rounded-md text-xs sm:text-sm">
            <Tag className="h-4 w-4" />
            <span className="hidden sm:inline">Descuentos</span>
          </TabsTrigger>
        </TabsList>

        <TabsContent value="services" className="mt-6">
          <ServicesList
            services={services}
            onAdd={onAddService}
            onUpdate={onUpdateService}
            onDelete={onDeleteService}
          />
        </TabsContent>

        <TabsContent value="extras" className="mt-6">
          <ExtrasList
            extras={extras}
            onAdd={onAddExtra}
            onUpdate={onUpdateExtra}
            onDelete={onDeleteExtra}
          />
        </TabsContent>

        <TabsContent value="staff" className="mt-6">
          <StaffList
            barbers={barbers}
            onAdd={onAddBarber}
            onUpdate={onUpdateBarber}
            onDelete={onDeleteBarber}
          />
        </TabsContent>

        <TabsContent value="discounts" className="mt-6">
          <DiscountsList
            discounts={discounts}
            onAdd={onAddDiscount}
            onUpdate={onUpdateDiscount}
            onDelete={onDeleteDiscount}
          />
        </TabsContent>
      </Tabs>
    </div>
  );
}

function ServicesList({
  services,
  onAdd,
  onUpdate,
  onDelete,
}: {
  services: Service[];
  onAdd: (service: Omit<Service, 'id'>) => void;
  onUpdate: (id: string, updates: Partial<Service>) => void;
  onDelete: (id: string) => void;
}) {
  const [isAdding, setIsAdding] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [newName, setNewName] = useState('');
  const [newPrice, setNewPrice] = useState('');

  const handleAdd = () => {
    if (newName && newPrice) {
      onAdd({ name: newName, price: parseFloat(newPrice) });
      setNewName('');
      setNewPrice('');
      setIsAdding(false);
    }
  };

  const handleUpdate = (id: string) => {
    if (newName && newPrice) {
      onUpdate(id, { name: newName, price: parseFloat(newPrice) });
      setEditingId(null);
      setNewName('');
      setNewPrice('');
    }
  };

  const startEdit = (service: Service) => {
    setEditingId(service.id);
    setNewName(service.name);
    setNewPrice(service.price.toString());
  };

  return (
    <Card className="border border-border bg-card">
      <CardHeader className="flex flex-row items-center justify-between">
        <CardTitle className="text-base font-medium">Servicios</CardTitle>
        {!isAdding && (
          <Button variant="outline" size="sm" onClick={() => setIsAdding(true)}>
            <Plus className="h-4 w-4 mr-1" />
            Agregar
          </Button>
        )}
      </CardHeader>
      <CardContent className="space-y-2">
        {isAdding && (
          <div className="flex gap-2 p-3 bg-muted rounded-lg animate-scale-in">
            <Input
              placeholder="Nombre"
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              className="flex-1"
            />
            <Input
              type="number"
              placeholder="Precio"
              value={newPrice}
              onChange={(e) => setNewPrice(e.target.value)}
              className="w-28"
            />
            <Button size="icon" onClick={handleAdd} className="bg-success hover:bg-success/90">
              <Save className="h-4 w-4" />
            </Button>
            <Button size="icon" variant="ghost" onClick={() => setIsAdding(false)}>
              <X className="h-4 w-4" />
            </Button>
          </div>
        )}

        {services.map((service) => (
          <div
            key={service.id}
            className="flex items-center gap-3 p-3 rounded-lg bg-muted/50 group hover:bg-muted transition-colors"
          >
            {editingId === service.id ? (
              <>
                <Input
                  value={newName}
                  onChange={(e) => setNewName(e.target.value)}
                  className="flex-1"
                />
                <Input
                  type="number"
                  value={newPrice}
                  onChange={(e) => setNewPrice(e.target.value)}
                  className="w-28"
                />
                <Button size="icon" onClick={() => handleUpdate(service.id)} className="bg-success hover:bg-success/90">
                  <Save className="h-4 w-4" />
                </Button>
                <Button size="icon" variant="ghost" onClick={() => setEditingId(null)}>
                  <X className="h-4 w-4" />
                </Button>
              </>
            ) : (
              <>
                <span className="flex-1 font-medium text-foreground">{service.name}</span>
                <span className="text-muted-foreground">${service.price.toLocaleString()}</span>
                <Button
                  size="icon"
                  variant="ghost"
                  onClick={() => startEdit(service)}
                  className="opacity-0 group-hover:opacity-100 transition-opacity h-8 w-8"
                >
                  <Edit2 className="h-4 w-4" />
                </Button>
                <Button
                  size="icon"
                  variant="ghost"
                  onClick={() => onDelete(service.id)}
                  className="opacity-0 group-hover:opacity-100 transition-opacity text-destructive hover:text-destructive h-8 w-8"
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
              </>
            )}
          </div>
        ))}
      </CardContent>
    </Card>
  );
}

function ExtrasList({
  extras,
  onAdd,
  onUpdate,
  onDelete,
}: {
  extras: Extra[];
  onAdd: (extra: Omit<Extra, 'id'>) => void;
  onUpdate: (id: string, updates: Partial<Extra>) => void;
  onDelete: (id: string) => void;
}) {
  const [isAdding, setIsAdding] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [newName, setNewName] = useState('');
  const [newPrice, setNewPrice] = useState('');

  const handleAdd = () => {
    if (newName && newPrice) {
      onAdd({ name: newName, price: parseFloat(newPrice) });
      setNewName('');
      setNewPrice('');
      setIsAdding(false);
    }
  };

  const handleUpdate = (id: string) => {
    if (newName && newPrice) {
      onUpdate(id, { name: newName, price: parseFloat(newPrice) });
      setEditingId(null);
      setNewName('');
      setNewPrice('');
    }
  };

  const startEdit = (extra: Extra) => {
    setEditingId(extra.id);
    setNewName(extra.name);
    setNewPrice(extra.price.toString());
  };

  return (
    <Card className="border border-border bg-card">
      <CardHeader className="flex flex-row items-center justify-between">
        <CardTitle className="text-base font-medium">Extras</CardTitle>
        {!isAdding && (
          <Button variant="outline" size="sm" onClick={() => setIsAdding(true)}>
            <Plus className="h-4 w-4 mr-1" />
            Agregar
          </Button>
        )}
      </CardHeader>
      <CardContent className="space-y-2">
        {isAdding && (
          <div className="flex gap-2 p-3 bg-muted rounded-lg animate-scale-in">
            <Input
              placeholder="Nombre"
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              className="flex-1"
            />
            <Input
              type="number"
              placeholder="Precio"
              value={newPrice}
              onChange={(e) => setNewPrice(e.target.value)}
              className="w-28"
            />
            <Button size="icon" onClick={handleAdd} className="bg-success hover:bg-success/90">
              <Save className="h-4 w-4" />
            </Button>
            <Button size="icon" variant="ghost" onClick={() => setIsAdding(false)}>
              <X className="h-4 w-4" />
            </Button>
          </div>
        )}

        {extras.map((extra) => (
          <div
            key={extra.id}
            className="flex items-center gap-3 p-3 rounded-lg bg-muted/50 group hover:bg-muted transition-colors"
          >
            {editingId === extra.id ? (
              <>
                <Input
                  value={newName}
                  onChange={(e) => setNewName(e.target.value)}
                  className="flex-1"
                />
                <Input
                  type="number"
                  value={newPrice}
                  onChange={(e) => setNewPrice(e.target.value)}
                  className="w-28"
                />
                <Button size="icon" onClick={() => handleUpdate(extra.id)} className="bg-success hover:bg-success/90">
                  <Save className="h-4 w-4" />
                </Button>
                <Button size="icon" variant="ghost" onClick={() => setEditingId(null)}>
                  <X className="h-4 w-4" />
                </Button>
              </>
            ) : (
              <>
                <span className="flex-1 font-medium text-foreground">{extra.name}</span>
                <span className="text-muted-foreground">${extra.price.toLocaleString()}</span>
                <Button
                  size="icon"
                  variant="ghost"
                  onClick={() => startEdit(extra)}
                  className="opacity-0 group-hover:opacity-100 transition-opacity h-8 w-8"
                >
                  <Edit2 className="h-4 w-4" />
                </Button>
                <Button
                  size="icon"
                  variant="ghost"
                  onClick={() => onDelete(extra.id)}
                  className="opacity-0 group-hover:opacity-100 transition-opacity text-destructive hover:text-destructive h-8 w-8"
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
              </>
            )}
          </div>
        ))}
      </CardContent>
    </Card>
  );
}

function StaffList({
  barbers,
  onAdd,
  onUpdate,
  onDelete,
}: {
  barbers: Barber[];
  onAdd: (barber: Omit<Barber, 'id'>) => void;
  onUpdate: (id: string, updates: Partial<Barber>) => void;
  onDelete: (id: string) => void;
}) {
  const [isAdding, setIsAdding] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [newName, setNewName] = useState('');

  const handleAdd = () => {
    if (newName) {
      onAdd({ name: newName, active: true });
      setNewName('');
      setIsAdding(false);
    }
  };

  const handleUpdate = (id: string) => {
    if (newName) {
      onUpdate(id, { name: newName });
      setEditingId(null);
      setNewName('');
    }
  };

  const startEdit = (barber: Barber) => {
    setEditingId(barber.id);
    setNewName(barber.name);
  };

  return (
    <Card className="border border-border bg-card">
      <CardHeader className="flex flex-row items-center justify-between">
        <CardTitle className="text-base font-medium">Staff</CardTitle>
        {!isAdding && (
          <Button variant="outline" size="sm" onClick={() => setIsAdding(true)}>
            <Plus className="h-4 w-4 mr-1" />
            Agregar
          </Button>
        )}
      </CardHeader>
      <CardContent className="space-y-2">
        {isAdding && (
          <div className="flex gap-2 p-3 bg-muted rounded-lg animate-scale-in">
            <Input
              placeholder="Nombre"
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              className="flex-1"
            />
            <Button size="icon" onClick={handleAdd} className="bg-success hover:bg-success/90">
              <Save className="h-4 w-4" />
            </Button>
            <Button size="icon" variant="ghost" onClick={() => setIsAdding(false)}>
              <X className="h-4 w-4" />
            </Button>
          </div>
        )}

        {barbers.map((barber) => (
          <div
            key={barber.id}
            className="flex items-center gap-3 p-3 rounded-lg bg-muted/50 group hover:bg-muted transition-colors"
          >
            {editingId === barber.id ? (
              <>
                <Input
                  value={newName}
                  onChange={(e) => setNewName(e.target.value)}
                  className="flex-1"
                />
                <Button size="icon" onClick={() => handleUpdate(barber.id)} className="bg-success hover:bg-success/90">
                  <Save className="h-4 w-4" />
                </Button>
                <Button size="icon" variant="ghost" onClick={() => setEditingId(null)}>
                  <X className="h-4 w-4" />
                </Button>
              </>
            ) : (
              <>
                <span className="flex-1 font-medium text-foreground">{barber.name}</span>
                <div className="flex items-center gap-2">
                  <span className="text-xs text-muted-foreground">
                    {barber.active ? 'Activo' : 'Inactivo'}
                  </span>
                  <Switch
                    checked={barber.active}
                    onCheckedChange={(checked) => onUpdate(barber.id, { active: checked })}
                  />
                </div>
                <Button
                  size="icon"
                  variant="ghost"
                  onClick={() => startEdit(barber)}
                  className="opacity-0 group-hover:opacity-100 transition-opacity h-8 w-8"
                >
                  <Edit2 className="h-4 w-4" />
                </Button>
                <Button
                  size="icon"
                  variant="ghost"
                  onClick={() => onDelete(barber.id)}
                  className="opacity-0 group-hover:opacity-100 transition-opacity text-destructive hover:text-destructive h-8 w-8"
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
              </>
            )}
          </div>
        ))}
      </CardContent>
    </Card>
  );
}

function DiscountsList({
  discounts,
  onAdd,
  onUpdate,
  onDelete,
}: {
  discounts: Discount[];
  onAdd: (discount: Omit<Discount, 'id'>) => void;
  onUpdate: (id: string, updates: Partial<Discount>) => void;
  onDelete: (id: string) => void;
}) {
  const [isAdding, setIsAdding] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [newLabel, setNewLabel] = useState('');
  const [newValue, setNewValue] = useState('');

  const handleAdd = () => {
    if (newLabel && newValue) {
      onAdd({ label: newLabel, value: parseFloat(newValue) });
      setNewLabel('');
      setNewValue('');
      setIsAdding(false);
    }
  };

  const handleUpdate = (id: string) => {
    if (newLabel && newValue) {
      onUpdate(id, { label: newLabel, value: parseFloat(newValue) });
      setEditingId(null);
      setNewLabel('');
      setNewValue('');
    }
  };

  const startEdit = (discount: Discount) => {
    setEditingId(discount.id);
    setNewLabel(discount.label);
    setNewValue(discount.value.toString());
  };

  return (
    <Card className="border border-border bg-card">
      <CardHeader className="flex flex-row items-center justify-between">
        <CardTitle className="text-base font-medium">Descuentos Predefinidos</CardTitle>
        {!isAdding && (
          <Button variant="outline" size="sm" onClick={() => setIsAdding(true)}>
            <Plus className="h-4 w-4 mr-1" />
            Agregar
          </Button>
        )}
      </CardHeader>
      <CardContent className="space-y-2">
        <p className="text-sm text-muted-foreground mb-4">
          Configura los porcentajes de descuento que aparecerán al registrar un cobro.
        </p>

        {isAdding && (
          <div className="flex gap-2 p-3 bg-muted rounded-lg animate-scale-in">
            <Input
              placeholder="Nombre (ej: Promo Amigo)"
              value={newLabel}
              onChange={(e) => setNewLabel(e.target.value)}
              className="flex-1"
            />
            <Input
              type="number"
              placeholder="% (ej: 15)"
              value={newValue}
              onChange={(e) => setNewValue(e.target.value)}
              className="w-24"
              min="0"
              max="100"
            />
            <Button size="icon" onClick={handleAdd} className="bg-success hover:bg-success/90">
              <Save className="h-4 w-4" />
            </Button>
            <Button size="icon" variant="ghost" onClick={() => setIsAdding(false)}>
              <X className="h-4 w-4" />
            </Button>
          </div>
        )}

        {discounts.map((discount) => (
          <div
            key={discount.id}
            className="flex items-center gap-3 p-3 rounded-lg bg-muted/50 group hover:bg-muted transition-colors"
          >
            {editingId === discount.id ? (
              <>
                <Input
                  value={newLabel}
                  onChange={(e) => setNewLabel(e.target.value)}
                  className="flex-1"
                />
                <Input
                  type="number"
                  value={newValue}
                  onChange={(e) => setNewValue(e.target.value)}
                  className="w-24"
                  min="0"
                  max="100"
                />
                <Button size="icon" onClick={() => handleUpdate(discount.id)} className="bg-success hover:bg-success/90">
                  <Save className="h-4 w-4" />
                </Button>
                <Button size="icon" variant="ghost" onClick={() => setEditingId(null)}>
                  <X className="h-4 w-4" />
                </Button>
              </>
            ) : (
              <>
                <span className="flex-1 font-medium text-foreground">{discount.label}</span>
                <span className="text-muted-foreground">{discount.value}%</span>
                {discount.id !== 'none' && (
                  <>
                    <Button
                      size="icon"
                      variant="ghost"
                      onClick={() => startEdit(discount)}
                      className="opacity-0 group-hover:opacity-100 transition-opacity h-8 w-8"
                    >
                      <Edit2 className="h-4 w-4" />
                    </Button>
                    <Button
                      size="icon"
                      variant="ghost"
                      onClick={() => onDelete(discount.id)}
                      className="opacity-0 group-hover:opacity-100 transition-opacity text-destructive hover:text-destructive h-8 w-8"
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </>
                )}
              </>
            )}
          </div>
        ))}
      </CardContent>
    </Card>
  );
}
