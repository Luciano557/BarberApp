
-- =========================================================================
-- MÓDULO PRODUCTOS — FASE 1
-- =========================================================================

-- 1) MARCAS ----------------------------------------------------------------
CREATE TABLE public.marcas_producto (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL,
  nombre text NOT NULL,
  color text NOT NULL,
  activo boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX marcas_producto_org_nombre_key
  ON public.marcas_producto (organization_id, lower(nombre));

ALTER TABLE public.marcas_producto ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view org marcas_producto"
  ON public.marcas_producto FOR SELECT TO authenticated
  USING (organization_id = public.get_user_organization_id(auth.uid()));

CREATE POLICY "Owner GM Manager full access marcas_producto"
  ON public.marcas_producto FOR ALL TO authenticated
  USING (
    organization_id = public.get_user_organization_id(auth.uid())
    AND (public.has_role(auth.uid(), 'owner') OR public.has_role(auth.uid(), 'general_manager') OR public.has_role(auth.uid(), 'manager'))
  )
  WITH CHECK (
    organization_id = public.get_user_organization_id(auth.uid())
    AND (public.has_role(auth.uid(), 'owner') OR public.has_role(auth.uid(), 'general_manager') OR public.has_role(auth.uid(), 'manager'))
  );

CREATE TRIGGER update_marcas_producto_updated_at
  BEFORE UPDATE ON public.marcas_producto
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- 2) PRODUCTOS (global por organización) -----------------------------------
CREATE TABLE public.productos (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL,
  marca_id uuid NULL REFERENCES public.marcas_producto(id) ON DELETE SET NULL,
  nombre text NOT NULL,
  descripcion text NULL,
  activo boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX productos_org_nombre_marca_key
  ON public.productos (organization_id, lower(nombre), COALESCE(marca_id, '00000000-0000-0000-0000-000000000000'::uuid));

ALTER TABLE public.productos ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view org productos"
  ON public.productos FOR SELECT TO authenticated
  USING (organization_id = public.get_user_organization_id(auth.uid()));

CREATE POLICY "Owner GM Manager full access productos"
  ON public.productos FOR ALL TO authenticated
  USING (
    organization_id = public.get_user_organization_id(auth.uid())
    AND (public.has_role(auth.uid(), 'owner') OR public.has_role(auth.uid(), 'general_manager') OR public.has_role(auth.uid(), 'manager'))
  )
  WITH CHECK (
    organization_id = public.get_user_organization_id(auth.uid())
    AND (public.has_role(auth.uid(), 'owner') OR public.has_role(auth.uid(), 'general_manager') OR public.has_role(auth.uid(), 'manager'))
  );

CREATE TRIGGER update_productos_updated_at
  BEFORE UPDATE ON public.productos
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- 3) PRODUCTOS POR SUCURSAL (precios + stock) ------------------------------
CREATE TABLE public.productos_sucursal (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL,
  sucursal_id uuid NOT NULL,
  producto_id uuid NOT NULL REFERENCES public.productos(id) ON DELETE CASCADE,
  activo boolean NOT NULL DEFAULT true,
  precio_costo numeric NULL,
  precio_venta numeric NOT NULL DEFAULT 0,
  margen_pct numeric NULL,
  stock_actual numeric NOT NULL DEFAULT 0,
  stock_minimo numeric NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (producto_id, sucursal_id)
);
CREATE INDEX productos_sucursal_suc_idx ON public.productos_sucursal (sucursal_id);
CREATE INDEX productos_sucursal_org_idx ON public.productos_sucursal (organization_id);

ALTER TABLE public.productos_sucursal ENABLE ROW LEVEL SECURITY;

-- SELECT: cualquier usuario de la org. Manager y barber filtrados por sucursal.
CREATE POLICY "Owner and GM can view all productos_sucursal"
  ON public.productos_sucursal FOR SELECT TO authenticated
  USING (
    organization_id = public.get_user_organization_id(auth.uid())
    AND (public.has_role(auth.uid(), 'owner') OR public.has_role(auth.uid(), 'general_manager'))
  );

CREATE POLICY "Manager and barber can view sucursal productos_sucursal"
  ON public.productos_sucursal FOR SELECT TO authenticated
  USING (
    organization_id = public.get_user_organization_id(auth.uid())
    AND (public.has_role(auth.uid(), 'manager') OR public.has_role(auth.uid(), 'barber'))
    AND sucursal_id IN (SELECT public.get_user_sucursal_ids(auth.uid()))
  );

-- INSERT/UPDATE: owner/GM toda la org; manager solo sus sucursales.
CREATE POLICY "Owner and GM full access productos_sucursal"
  ON public.productos_sucursal FOR ALL TO authenticated
  USING (
    organization_id = public.get_user_organization_id(auth.uid())
    AND (public.has_role(auth.uid(), 'owner') OR public.has_role(auth.uid(), 'general_manager'))
  )
  WITH CHECK (
    organization_id = public.get_user_organization_id(auth.uid())
    AND (public.has_role(auth.uid(), 'owner') OR public.has_role(auth.uid(), 'general_manager'))
  );

CREATE POLICY "Manager full access productos_sucursal own sucursal"
  ON public.productos_sucursal FOR ALL TO authenticated
  USING (
    organization_id = public.get_user_organization_id(auth.uid())
    AND public.has_role(auth.uid(), 'manager')
    AND sucursal_id IN (SELECT public.get_user_sucursal_ids(auth.uid()))
  )
  WITH CHECK (
    organization_id = public.get_user_organization_id(auth.uid())
    AND public.has_role(auth.uid(), 'manager')
    AND sucursal_id IN (SELECT public.get_user_sucursal_ids(auth.uid()))
  );

CREATE TRIGGER update_productos_sucursal_updated_at
  BEFORE UPDATE ON public.productos_sucursal
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- 4) MOVIMIENTOS DE STOCK (bitácora) ---------------------------------------
CREATE TABLE public.movimientos_stock (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL,
  sucursal_id uuid NOT NULL,
  producto_id uuid NOT NULL REFERENCES public.productos(id) ON DELETE CASCADE,
  producto_sucursal_id uuid NOT NULL REFERENCES public.productos_sucursal(id) ON DELETE CASCADE,
  tipo text NOT NULL CHECK (tipo IN ('stock_inicial','reposicion','ajuste_manual','venta')),
  cantidad numeric NOT NULL,
  stock_previo numeric NOT NULL,
  stock_resultante numeric NOT NULL,
  motivo text NULL,
  venta_id uuid NULL,
  created_by uuid NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX movimientos_stock_ps_idx ON public.movimientos_stock (producto_sucursal_id, created_at DESC);
CREATE INDEX movimientos_stock_suc_idx ON public.movimientos_stock (sucursal_id, created_at DESC);

ALTER TABLE public.movimientos_stock ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Owner GM can view all movimientos_stock"
  ON public.movimientos_stock FOR SELECT TO authenticated
  USING (
    organization_id = public.get_user_organization_id(auth.uid())
    AND (public.has_role(auth.uid(), 'owner') OR public.has_role(auth.uid(), 'general_manager'))
  );

CREATE POLICY "Manager view sucursal movimientos_stock"
  ON public.movimientos_stock FOR SELECT TO authenticated
  USING (
    organization_id = public.get_user_organization_id(auth.uid())
    AND public.has_role(auth.uid(), 'manager')
    AND sucursal_id IN (SELECT public.get_user_sucursal_ids(auth.uid()))
  );

-- Sin INSERT/UPDATE/DELETE directos: solo vía RPC SECURITY DEFINER.

-- 5) RPC: registrar_movimiento_stock --------------------------------------
CREATE OR REPLACE FUNCTION public.registrar_movimiento_stock(
  _producto_sucursal_id uuid,
  _tipo text,
  _cantidad numeric,
  _motivo text DEFAULT NULL,
  _venta_id uuid DEFAULT NULL
) RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _user_id uuid := auth.uid();
  _user_org uuid;
  _ps RECORD;
  _stock_previo numeric;
  _stock_resultante numeric;
  _is_owner_gm boolean;
  _is_manager_of_branch boolean;
  _mov_id uuid;
BEGIN
  IF _user_id IS NULL THEN
    RAISE EXCEPTION 'No autorizado';
  END IF;

  _user_org := public.get_user_organization_id(_user_id);
  IF _user_org IS NULL THEN
    RAISE EXCEPTION 'No autorizado';
  END IF;

  IF _tipo NOT IN ('stock_inicial','reposicion','ajuste_manual','venta') THEN
    RAISE EXCEPTION 'Tipo de movimiento inválido';
  END IF;

  -- Lock fila de stock
  SELECT * INTO _ps
  FROM public.productos_sucursal
  WHERE id = _producto_sucursal_id
  FOR UPDATE;

  IF _ps.id IS NULL THEN
    RAISE EXCEPTION 'Producto/sucursal no encontrado';
  END IF;

  IF _ps.organization_id <> _user_org THEN
    RAISE EXCEPTION 'No autorizado';
  END IF;

  _is_owner_gm := public.has_role(_user_id, 'owner') OR public.has_role(_user_id, 'general_manager');
  _is_manager_of_branch := public.has_role(_user_id, 'manager')
                       AND _ps.sucursal_id IN (SELECT public.get_user_sucursal_ids(_user_id));

  IF _tipo IN ('stock_inicial','reposicion','ajuste_manual') THEN
    IF NOT (_is_owner_gm OR _is_manager_of_branch) THEN
      RAISE EXCEPTION 'Sin permiso para editar stock';
    END IF;
    IF _tipo = 'ajuste_manual' AND (_motivo IS NULL OR length(btrim(_motivo)) = 0) THEN
      RAISE EXCEPTION 'Motivo obligatorio para ajuste manual';
    END IF;
  ELSIF _tipo = 'venta' THEN
    -- Cualquier rol con acceso a Cobrar de esa sucursal
    IF NOT (
      _is_owner_gm
      OR (public.has_role(_user_id, 'manager') AND _ps.sucursal_id IN (SELECT public.get_user_sucursal_ids(_user_id)))
      OR (public.has_role(_user_id, 'barber')  AND _ps.sucursal_id IN (SELECT public.get_user_sucursal_ids(_user_id)))
    ) THEN
      RAISE EXCEPTION 'Sin permiso para venta en esta sucursal';
    END IF;
    IF _venta_id IS NULL THEN
      RAISE EXCEPTION 'venta_id requerido para movimiento de venta';
    END IF;
  END IF;

  _stock_previo := _ps.stock_actual;
  _stock_resultante := _stock_previo + _cantidad;

  UPDATE public.productos_sucursal
  SET stock_actual = _stock_resultante,
      updated_at = now()
  WHERE id = _ps.id;

  INSERT INTO public.movimientos_stock (
    organization_id, sucursal_id, producto_id, producto_sucursal_id,
    tipo, cantidad, stock_previo, stock_resultante,
    motivo, venta_id, created_by
  ) VALUES (
    _ps.organization_id, _ps.sucursal_id, _ps.producto_id, _ps.id,
    _tipo, _cantidad, _stock_previo, _stock_resultante,
    NULLIF(btrim(COALESCE(_motivo, '')), ''), _venta_id, _user_id
  ) RETURNING id INTO _mov_id;

  RETURN _mov_id;
END;
$$;

-- 6) VENTA: ajustes para soportar venta solo-productos --------------------
ALTER TABLE public.venta
  ADD COLUMN IF NOT EXISTS tipo_venta text NOT NULL DEFAULT 'mixta'
    CHECK (tipo_venta IN ('servicio','productos','mixta'));

ALTER TABLE public.venta ALTER COLUMN servicio_id DROP NOT NULL;
ALTER TABLE public.venta ALTER COLUMN precio_servicio DROP NOT NULL;
ALTER TABLE public.venta ALTER COLUMN servicio_nombre DROP NOT NULL;
ALTER TABLE public.venta ALTER COLUMN barbero_id DROP NOT NULL;
ALTER TABLE public.venta ALTER COLUMN barbero_nombre DROP NOT NULL;

CREATE OR REPLACE FUNCTION public.venta_validate_barbero()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.tipo_venta IN ('servicio','mixta') THEN
    IF NEW.barbero_id IS NULL THEN
      RAISE EXCEPTION 'Las ventas con servicio requieren barbero';
    END IF;
  END IF;
  -- En tipo_venta='productos' barbero_id puede ser NULL (venta general de sucursal)
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS venta_validate_barbero_trg ON public.venta;
CREATE TRIGGER venta_validate_barbero_trg
  BEFORE INSERT OR UPDATE ON public.venta
  FOR EACH ROW EXECUTE FUNCTION public.venta_validate_barbero();

-- 7) VENTA_PRODUCTO --------------------------------------------------------
CREATE TABLE public.venta_producto (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  venta_id uuid NOT NULL REFERENCES public.venta(id) ON DELETE CASCADE,
  organization_id uuid NOT NULL,
  sucursal_id uuid NOT NULL,
  producto_id uuid NOT NULL REFERENCES public.productos(id),
  producto_sucursal_id uuid NOT NULL REFERENCES public.productos_sucursal(id),
  producto_nombre text NOT NULL,
  marca_id uuid NULL,
  marca_nombre text NULL,
  precio_unitario numeric NOT NULL,
  cantidad integer NOT NULL DEFAULT 1 CHECK (cantidad > 0),
  subtotal numeric NOT NULL,
  barbero_id uuid NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX venta_producto_venta_idx ON public.venta_producto (venta_id);
CREATE INDEX venta_producto_suc_idx ON public.venta_producto (sucursal_id, created_at DESC);
CREATE INDEX venta_producto_barbero_idx ON public.venta_producto (barbero_id, created_at DESC);

ALTER TABLE public.venta_producto ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Owner GM Manager full access venta_producto"
  ON public.venta_producto FOR ALL TO authenticated
  USING (
    organization_id = public.get_user_organization_id(auth.uid())
    AND (public.has_role(auth.uid(), 'owner') OR public.has_role(auth.uid(), 'general_manager') OR public.has_role(auth.uid(), 'manager'))
  )
  WITH CHECK (
    organization_id = public.get_user_organization_id(auth.uid())
    AND (public.has_role(auth.uid(), 'owner') OR public.has_role(auth.uid(), 'general_manager') OR public.has_role(auth.uid(), 'manager'))
  );

CREATE POLICY "Barber insert venta_producto own sucursal"
  ON public.venta_producto FOR INSERT TO authenticated
  WITH CHECK (
    organization_id = public.get_user_organization_id(auth.uid())
    AND public.has_role(auth.uid(), 'barber')
    AND sucursal_id IN (SELECT public.get_user_sucursal_ids(auth.uid()))
  );

CREATE POLICY "Barber view own venta_producto"
  ON public.venta_producto FOR SELECT TO authenticated
  USING (
    organization_id = public.get_user_organization_id(auth.uid())
    AND public.has_role(auth.uid(), 'barber')
    AND (
      barbero_id = public.get_user_barbero_id(auth.uid())
      OR (barbero_id IS NULL AND sucursal_id IN (SELECT public.get_user_sucursal_ids(auth.uid())))
    )
  );

-- 8) INGRESOS: snapshot de productos --------------------------------------
ALTER TABLE public.ingresos
  ADD COLUMN IF NOT EXISTS productos_total numeric NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS productos_cantidad integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS productos_efectivo numeric NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS productos_digital numeric NOT NULL DEFAULT 0;

-- 9) INGRESOS_ITEMS_PRODUCTOS ---------------------------------------------
CREATE TABLE public.ingresos_items_productos (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL,
  sucursal_id uuid NULL,
  ingreso_id integer NOT NULL,
  barbero_id uuid NULL,
  producto_id uuid NOT NULL,
  producto_nombre text NOT NULL,
  marca_id uuid NULL,
  marca_nombre text NULL,
  qty integer NOT NULL DEFAULT 1,
  unit_price numeric NOT NULL DEFAULT 0,
  subtotal numeric NOT NULL DEFAULT 0,
  payment_method text NOT NULL DEFAULT 'efectivo',
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX ingresos_items_productos_ingreso_idx ON public.ingresos_items_productos (ingreso_id);
CREATE INDEX ingresos_items_productos_suc_idx ON public.ingresos_items_productos (sucursal_id, created_at DESC);

ALTER TABLE public.ingresos_items_productos ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Owner GM Manager full access iip"
  ON public.ingresos_items_productos FOR ALL TO authenticated
  USING (
    organization_id = public.get_user_organization_id(auth.uid())
    AND (public.has_role(auth.uid(), 'owner') OR public.has_role(auth.uid(), 'general_manager') OR public.has_role(auth.uid(), 'manager'))
  )
  WITH CHECK (
    organization_id = public.get_user_organization_id(auth.uid())
    AND (public.has_role(auth.uid(), 'owner') OR public.has_role(auth.uid(), 'general_manager') OR public.has_role(auth.uid(), 'manager'))
  );

CREATE POLICY "Barber view own iip"
  ON public.ingresos_items_productos FOR SELECT TO authenticated
  USING (
    organization_id = public.get_user_organization_id(auth.uid())
    AND public.has_role(auth.uid(), 'barber')
    AND barbero_id = public.get_user_barbero_id(auth.uid())
  );

-- 10) DESCUENTOS: campo aplica_a -----------------------------------------
ALTER TABLE public.descuentos
  ADD COLUMN IF NOT EXISTS aplica_a text NOT NULL DEFAULT 'servicios';
UPDATE public.descuentos SET aplica_a = 'servicios' WHERE aplica_a IS NULL OR aplica_a = '';
ALTER TABLE public.descuentos
  ADD CONSTRAINT descuentos_aplica_a_chk CHECK (aplica_a IN ('servicios'));

-- 11) RPC: cerrar_ventas_generales_sucursal -------------------------------
CREATE OR REPLACE FUNCTION public.cerrar_ventas_generales_sucursal(
  _sucursal_id uuid,
  _fecha date
) RETURNS bigint
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _user_id uuid := auth.uid();
  _org_id uuid;
  _suc_org uuid;
  _suc_tz text;
  _start_ts timestamptz;
  _end_ts timestamptz;
  _ingreso_id bigint;
  _productos_total numeric := 0;
  _productos_cantidad integer := 0;
  _productos_efectivo numeric := 0;
  _productos_digital numeric := 0;
  _v RECORD;
  _vp RECORD;
BEGIN
  IF _user_id IS NULL THEN
    RAISE EXCEPTION 'No autorizado';
  END IF;
  _org_id := public.get_user_organization_id(_user_id);
  IF _org_id IS NULL THEN
    RAISE EXCEPTION 'No autorizado';
  END IF;

  IF NOT (
    public.has_role(_user_id, 'owner')
    OR public.has_role(_user_id, 'general_manager')
    OR (public.has_role(_user_id, 'manager') AND _sucursal_id IN (SELECT public.get_user_sucursal_ids(_user_id)))
  ) THEN
    RAISE EXCEPTION 'Sin permiso';
  END IF;

  SELECT organization_id, COALESCE(timezone, 'America/Argentina/Buenos_Aires')
    INTO _suc_org, _suc_tz
  FROM public.sucursales WHERE id = _sucursal_id;

  IF _suc_org IS NULL OR _suc_org <> _org_id THEN
    RAISE EXCEPTION 'Sucursal inválida';
  END IF;

  _start_ts := (_fecha::text || ' 00:00:00')::timestamp AT TIME ZONE _suc_tz;
  _end_ts   := (_fecha::text || ' 23:59:59.999')::timestamp AT TIME ZONE _suc_tz;

  -- Recorrer ventas tipo 'productos' sin barbero, no anuladas, no cerradas aún
  FOR _v IN
    SELECT v.id, v.total_cobrado, v.total_final
    FROM public.venta v
    WHERE v.sucursal_id = _sucursal_id
      AND v.organization_id = _org_id
      AND v.tipo_venta = 'productos'
      AND v.barbero_id IS NULL
      AND COALESCE(v.estado, 'activo') <> 'anulado'
      AND v.fecha_hora BETWEEN _start_ts AND _end_ts
      AND NOT EXISTS (
        SELECT 1 FROM public.ingresos_items_productos iip
        JOIN public.venta_producto vp2 ON vp2.venta_id = v.id
        WHERE iip.producto_id = vp2.producto_id
          AND iip.ingreso_id IN (
            SELECT id FROM public.ingresos
            WHERE sucursal_id = _sucursal_id
              AND barbero_id IS NULL
              AND created_at BETWEEN _start_ts AND _end_ts
          )
      )
  LOOP
    -- Sumar pagos
    DECLARE
      _ef numeric := 0;
      _di numeric := 0;
    BEGIN
      SELECT
        COALESCE(SUM(CASE WHEN metodo_pago = 'efectivo' THEN monto ELSE 0 END), 0),
        COALESCE(SUM(CASE WHEN metodo_pago <> 'efectivo' THEN monto ELSE 0 END), 0)
      INTO _ef, _di
      FROM public.venta_pagos WHERE venta_id = _v.id;
      _productos_efectivo := _productos_efectivo + _ef;
      _productos_digital  := _productos_digital + _di;
    END;
  END LOOP;

  -- Sumar productos
  SELECT COALESCE(SUM(vp.subtotal), 0), COALESCE(SUM(vp.cantidad), 0)
    INTO _productos_total, _productos_cantidad
  FROM public.venta v
  JOIN public.venta_producto vp ON vp.venta_id = v.id
  WHERE v.sucursal_id = _sucursal_id
    AND v.organization_id = _org_id
    AND v.tipo_venta = 'productos'
    AND v.barbero_id IS NULL
    AND COALESCE(v.estado, 'activo') <> 'anulado'
    AND v.fecha_hora BETWEEN _start_ts AND _end_ts
    AND NOT EXISTS (
      SELECT 1 FROM public.ingresos i
      WHERE i.sucursal_id = _sucursal_id
        AND i.barbero_id IS NULL
        AND i.entry_mode = 'venta_general_sucursal'
        AND i.created_at BETWEEN _start_ts AND _end_ts
    );

  IF _productos_cantidad = 0 THEN
    RETURN NULL;
  END IF;

  -- Insertar ingreso
  INSERT INTO public.ingresos (
    organization_id, sucursal_id, barbero_id, barbero,
    mp, efectivo, total_facturado, total_sin_descuento, perdida,
    cantidad_de_servicios, servicios_con_descuento, servicios_sin_descuento,
    cantidad_de_50_por, cantidad_de_20_por,
    dia, sueldo, extras, identificador, estado, "Usuario",
    servicios_por_linea, created_at, closed_at, entry_mode,
    recargos_total, total_cobrado, efectivo_cobrado, digital_cobrado,
    productos_total, productos_cantidad, productos_efectivo, productos_digital
  ) VALUES (
    _org_id, _sucursal_id, NULL, 'Venta general de sucursal',
    0, 0, 0, 0, 0,
    0, 0, 0,
    0, 0,
    to_char(_fecha, 'TMDay'), 0, 0, gen_random_uuid(), 'activo', 'Sistema',
    '{}'::jsonb, _end_ts, now(), 'venta_general_sucursal',
    0, _productos_efectivo + _productos_digital, _productos_efectivo, _productos_digital,
    _productos_total, _productos_cantidad, _productos_efectivo, _productos_digital
  ) RETURNING id INTO _ingreso_id;

  -- Insertar items productos
  INSERT INTO public.ingresos_items_productos (
    organization_id, sucursal_id, ingreso_id, barbero_id,
    producto_id, producto_nombre, marca_id, marca_nombre,
    qty, unit_price, subtotal, payment_method
  )
  SELECT
    vp.organization_id, vp.sucursal_id, _ingreso_id, NULL,
    vp.producto_id, vp.producto_nombre, vp.marca_id, vp.marca_nombre,
    vp.cantidad, vp.precio_unitario, vp.subtotal, COALESCE(v.metodo_pago, 'efectivo')
  FROM public.venta v
  JOIN public.venta_producto vp ON vp.venta_id = v.id
  WHERE v.sucursal_id = _sucursal_id
    AND v.organization_id = _org_id
    AND v.tipo_venta = 'productos'
    AND v.barbero_id IS NULL
    AND COALESCE(v.estado, 'activo') <> 'anulado'
    AND v.fecha_hora BETWEEN _start_ts AND _end_ts;

  RETURN _ingreso_id;
END;
$$;
