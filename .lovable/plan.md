

## Plan: Fix barber filtering in ComisionEquipoConfig + add bulk action

### Problem
`ComisionEquipoConfig` receives `allBarbers` as a prop, but this list is not filtered by sucursal. A branch manager (`branch_only`) sees barbers from all branches in the dropdown.

### Solution

**File: `src/components/config/ComisionEquipoConfig.tsx`**

1. **Fetch filtered barbers directly from DB** instead of relying on the `allBarbers` prop for the dropdown. After loading the config, query `barberos` table:
   - If `scope_type === 'branch_only'`: filter by `sucursal_id = config.sucursal_id` (or the passed `sucursalId`)
   - If `scope_type === 'multi_branch'`: fetch all active barbers for the organization
   - Always exclude the `barberId` (the encargado) and barbers already with open rules

2. **Keep `allBarbers` prop** only for display (resolving names in existing rules list), since a rule might reference a barber from any branch historically.

3. **Add "Agregar todos" bulk action** for `branch_only` configs:
   - Button below the dropdown: "Agregar todos los barberos de esta sucursal"
   - Only visible when `scope_type === 'branch_only'` and there are available barbers without open rules
   - Requires a percentage input before clicking
   - Inserts one rule per available barber with the same percentage and `vigencia_desde = hoy`

### Technical details

- New state: `filteredBarbers: Barber[]` populated by a `fetchFilteredBarbers()` called after config is loaded
- Query: `supabase.from('barberos').select('*').eq('organization_id', organizationId).eq('activo', true)` + `.eq('sucursal_id', sucursalId)` for branch_only
- Map results with the existing `dbToBarber`-style mapping inline (or import it)
- The `availableBarbers` derivation changes from filtering `allBarbers` to filtering `filteredBarbers`
- Bulk insert uses `supabase.from('comision_equipo_reglas').insert([...])` with an array of rows

### No other files change
The filtering logic is fully contained within `ComisionEquipoConfig.tsx`. Props interface stays the same.

