export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  // Allows to automatically instantiate createClient with right options
  // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
  __InternalSupabase: {
    PostgrestVersion: "13.0.5"
  }
  public: {
    Tables: {
      access_logs: {
        Row: {
          accessed_at: string | null
          id: string
          organization_id: string | null
          section: string
          user_email: string
          user_id: string | null
          user_name: string | null
        }
        Insert: {
          accessed_at?: string | null
          id?: string
          organization_id?: string | null
          section: string
          user_email: string
          user_id?: string | null
          user_name?: string | null
        }
        Update: {
          accessed_at?: string | null
          id?: string
          organization_id?: string | null
          section?: string
          user_email?: string
          user_id?: string | null
          user_name?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "access_logs_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      agenda_config: {
        Row: {
          anticipacion_minima_reserva_min: number
          buffer_antes_min: number
          buffer_despues_min: number
          cancelacion_limite_hs: number
          created_at: string
          dias_anticipacion: number
          duracion_base_min: number
          id: string
          modificacion_limite_hs: number
          organization_id: string
          sucursal_id: string
          updated_at: string
        }
        Insert: {
          anticipacion_minima_reserva_min?: number
          buffer_antes_min?: number
          buffer_despues_min?: number
          cancelacion_limite_hs?: number
          created_at?: string
          dias_anticipacion?: number
          duracion_base_min?: number
          id?: string
          modificacion_limite_hs?: number
          organization_id: string
          sucursal_id: string
          updated_at?: string
        }
        Update: {
          anticipacion_minima_reserva_min?: number
          buffer_antes_min?: number
          buffer_despues_min?: number
          cancelacion_limite_hs?: number
          created_at?: string
          dias_anticipacion?: number
          duracion_base_min?: number
          id?: string
          modificacion_limite_hs?: number
          organization_id?: string
          sucursal_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "agenda_config_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "agenda_config_sucursal_id_fkey"
            columns: ["sucursal_id"]
            isOneToOne: false
            referencedRelation: "sucursales"
            referencedColumns: ["id"]
          },
        ]
      }
      anulaciones_cierre: {
        Row: {
          anulado_at: string
          anulado_por_email: string
          anulado_por_id: string
          anulado_por_nombre: string
          barbero_nombre: string
          created_at: string
          fecha_cierre: string
          id: string
          ingreso_id: number
          motivo: string | null
          organization_id: string
        }
        Insert: {
          anulado_at?: string
          anulado_por_email: string
          anulado_por_id: string
          anulado_por_nombre: string
          barbero_nombre: string
          created_at?: string
          fecha_cierre: string
          id?: string
          ingreso_id: number
          motivo?: string | null
          organization_id: string
        }
        Update: {
          anulado_at?: string
          anulado_por_email?: string
          anulado_por_id?: string
          anulado_por_nombre?: string
          barbero_nombre?: string
          created_at?: string
          fecha_cierre?: string
          id?: string
          ingreso_id?: number
          motivo?: string | null
          organization_id?: string
        }
        Relationships: []
      }
      barberos: {
        Row: {
          access_email: string | null
          activo: boolean
          apellido: string
          comision: number
          created_at: string
          dni: string | null
          fecha_cobro_dia: number
          id: string
          nombre: string
          organization_id: string | null
          pin_hash: string | null
          rol_equipo: string
          roles_equipo: string[]
          sucursal_id: string | null
          sueldo_fijo: number | null
          telefono: string | null
          tipo_compensacion: string
          updated_at: string
        }
        Insert: {
          access_email?: string | null
          activo?: boolean
          apellido: string
          comision?: number
          created_at?: string
          dni?: string | null
          fecha_cobro_dia?: number
          id?: string
          nombre: string
          organization_id?: string | null
          pin_hash?: string | null
          rol_equipo?: string
          roles_equipo?: string[]
          sucursal_id?: string | null
          sueldo_fijo?: number | null
          telefono?: string | null
          tipo_compensacion?: string
          updated_at?: string
        }
        Update: {
          access_email?: string | null
          activo?: boolean
          apellido?: string
          comision?: number
          created_at?: string
          dni?: string | null
          fecha_cobro_dia?: number
          id?: string
          nombre?: string
          organization_id?: string | null
          pin_hash?: string | null
          rol_equipo?: string
          roles_equipo?: string[]
          sucursal_id?: string | null
          sueldo_fijo?: number | null
          telefono?: string | null
          tipo_compensacion?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "barberos_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "barberos_sucursal_id_fkey"
            columns: ["sucursal_id"]
            isOneToOne: false
            referencedRelation: "sucursales"
            referencedColumns: ["id"]
          },
        ]
      }
      barberos_sucursales: {
        Row: {
          barbero_id: string
          created_at: string
          disponible: boolean
          id: string
          organization_id: string
          sucursal_id: string
          updated_at: string
          updated_by: string | null
        }
        Insert: {
          barbero_id: string
          created_at?: string
          disponible?: boolean
          id?: string
          organization_id: string
          sucursal_id: string
          updated_at?: string
          updated_by?: string | null
        }
        Update: {
          barbero_id?: string
          created_at?: string
          disponible?: boolean
          id?: string
          organization_id?: string
          sucursal_id?: string
          updated_at?: string
          updated_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "barberos_sucursales_barbero_id_fkey"
            columns: ["barbero_id"]
            isOneToOne: false
            referencedRelation: "barberos"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "barberos_sucursales_barbero_id_fkey"
            columns: ["barbero_id"]
            isOneToOne: false
            referencedRelation: "barberos_safe"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "barberos_sucursales_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "barberos_sucursales_sucursal_id_fkey"
            columns: ["sucursal_id"]
            isOneToOne: false
            referencedRelation: "sucursales"
            referencedColumns: ["id"]
          },
        ]
      }
      bloqueos_agenda: {
        Row: {
          barbero_id: string | null
          created_at: string
          fecha_fin: string
          fecha_inicio: string
          hora_fin: string | null
          hora_inicio: string | null
          id: string
          motivo: string | null
          organization_id: string
          sucursal_id: string
          todo_el_dia: boolean
        }
        Insert: {
          barbero_id?: string | null
          created_at?: string
          fecha_fin: string
          fecha_inicio: string
          hora_fin?: string | null
          hora_inicio?: string | null
          id?: string
          motivo?: string | null
          organization_id: string
          sucursal_id: string
          todo_el_dia?: boolean
        }
        Update: {
          barbero_id?: string | null
          created_at?: string
          fecha_fin?: string
          fecha_inicio?: string
          hora_fin?: string | null
          hora_inicio?: string | null
          id?: string
          motivo?: string | null
          organization_id?: string
          sucursal_id?: string
          todo_el_dia?: boolean
        }
        Relationships: [
          {
            foreignKeyName: "bloqueos_agenda_barbero_id_fkey"
            columns: ["barbero_id"]
            isOneToOne: false
            referencedRelation: "barberos"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "bloqueos_agenda_barbero_id_fkey"
            columns: ["barbero_id"]
            isOneToOne: false
            referencedRelation: "barberos_safe"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "bloqueos_agenda_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "bloqueos_agenda_sucursal_id_fkey"
            columns: ["sucursal_id"]
            isOneToOne: false
            referencedRelation: "sucursales"
            referencedColumns: ["id"]
          },
        ]
      }
      bono_fijo_config: {
        Row: {
          activa: boolean
          barbero_id: string
          created_at: string
          fecha_fin: string | null
          fecha_inicio: string
          id: string
          monto: number
          organization_id: string
          proxima_fecha: string
          repeat_byweekday: number[] | null
          repeat_frequency: string | null
          repeat_interval: number | null
          repeat_preset: string
          sucursal_id: string | null
          updated_at: string
        }
        Insert: {
          activa?: boolean
          barbero_id: string
          created_at?: string
          fecha_fin?: string | null
          fecha_inicio: string
          id?: string
          monto: number
          organization_id: string
          proxima_fecha: string
          repeat_byweekday?: number[] | null
          repeat_frequency?: string | null
          repeat_interval?: number | null
          repeat_preset?: string
          sucursal_id?: string | null
          updated_at?: string
        }
        Update: {
          activa?: boolean
          barbero_id?: string
          created_at?: string
          fecha_fin?: string | null
          fecha_inicio?: string
          id?: string
          monto?: number
          organization_id?: string
          proxima_fecha?: string
          repeat_byweekday?: number[] | null
          repeat_frequency?: string | null
          repeat_interval?: number | null
          repeat_preset?: string
          sucursal_id?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      bono_fijo_ocurrencias: {
        Row: {
          barbero_id: string
          config_id: string
          created_at: string
          fecha: string
          id: string
          monto: number
          organization_id: string
          sucursal_id: string | null
        }
        Insert: {
          barbero_id: string
          config_id: string
          created_at?: string
          fecha: string
          id?: string
          monto: number
          organization_id: string
          sucursal_id?: string | null
        }
        Update: {
          barbero_id?: string
          config_id?: string
          created_at?: string
          fecha?: string
          id?: string
          monto?: number
          organization_id?: string
          sucursal_id?: string | null
        }
        Relationships: []
      }
      clientes: {
        Row: {
          acepta_marketing: boolean
          alergias: string | null
          apellido: string | null
          bloqueado: boolean
          created_at: string
          eliminado: boolean
          eliminado_at: string | null
          eliminado_por: string | null
          email: string | null
          external_customer_id: string | null
          external_source: string | null
          fecha_cliente_desde: string | null
          fecha_importacion: string | null
          fecha_nacimiento: string | null
          id: string
          instagram: string | null
          motivo_bloqueo: string | null
          nombre: string
          nota_interna: string | null
          organization_id: string
          origen: string
          otra_red_social: string | null
          telefono: string | null
          tiktok: string | null
          updated_at: string
        }
        Insert: {
          acepta_marketing?: boolean
          alergias?: string | null
          apellido?: string | null
          bloqueado?: boolean
          created_at?: string
          eliminado?: boolean
          eliminado_at?: string | null
          eliminado_por?: string | null
          email?: string | null
          external_customer_id?: string | null
          external_source?: string | null
          fecha_cliente_desde?: string | null
          fecha_importacion?: string | null
          fecha_nacimiento?: string | null
          id?: string
          instagram?: string | null
          motivo_bloqueo?: string | null
          nombre: string
          nota_interna?: string | null
          organization_id: string
          origen?: string
          otra_red_social?: string | null
          telefono?: string | null
          tiktok?: string | null
          updated_at?: string
        }
        Update: {
          acepta_marketing?: boolean
          alergias?: string | null
          apellido?: string | null
          bloqueado?: boolean
          created_at?: string
          eliminado?: boolean
          eliminado_at?: string | null
          eliminado_por?: string | null
          email?: string | null
          external_customer_id?: string | null
          external_source?: string | null
          fecha_cliente_desde?: string | null
          fecha_importacion?: string | null
          fecha_nacimiento?: string | null
          id?: string
          instagram?: string | null
          motivo_bloqueo?: string | null
          nombre?: string
          nota_interna?: string | null
          organization_id?: string
          origen?: string
          otra_red_social?: string | null
          telefono?: string | null
          tiktok?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      clientes_sucursales: {
        Row: {
          cliente_id: string
          created_at: string
          id: string
          organization_id: string
          origen_relacion: string
          sucursal_id: string
          updated_at: string
        }
        Insert: {
          cliente_id: string
          created_at?: string
          id?: string
          organization_id: string
          origen_relacion?: string
          sucursal_id: string
          updated_at?: string
        }
        Update: {
          cliente_id?: string
          created_at?: string
          id?: string
          organization_id?: string
          origen_relacion?: string
          sucursal_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "clientes_sucursales_cliente_fk"
            columns: ["cliente_id"]
            isOneToOne: false
            referencedRelation: "clientes"
            referencedColumns: ["id"]
          },
        ]
      }
      comision_equipo_config: {
        Row: {
          activa: boolean
          created_at: string
          encargado_id: string
          id: string
          organization_id: string
          scope_type: string
          sucursal_id: string | null
          updated_at: string
        }
        Insert: {
          activa?: boolean
          created_at?: string
          encargado_id: string
          id?: string
          organization_id: string
          scope_type?: string
          sucursal_id?: string | null
          updated_at?: string
        }
        Update: {
          activa?: boolean
          created_at?: string
          encargado_id?: string
          id?: string
          organization_id?: string
          scope_type?: string
          sucursal_id?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "comision_equipo_config_encargado_id_fkey"
            columns: ["encargado_id"]
            isOneToOne: false
            referencedRelation: "barberos"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "comision_equipo_config_encargado_id_fkey"
            columns: ["encargado_id"]
            isOneToOne: false
            referencedRelation: "barberos_safe"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "comision_equipo_config_sucursal_id_fkey"
            columns: ["sucursal_id"]
            isOneToOne: false
            referencedRelation: "sucursales"
            referencedColumns: ["id"]
          },
        ]
      }
      comision_equipo_reglas: {
        Row: {
          activa: boolean
          barbero_origen_id: string
          config_id: string
          created_at: string
          id: string
          organization_id: string
          porcentaje: number
          sucursal_id: string
          updated_at: string
          vigencia_desde: string
          vigencia_hasta: string | null
        }
        Insert: {
          activa?: boolean
          barbero_origen_id: string
          config_id: string
          created_at?: string
          id?: string
          organization_id: string
          porcentaje?: number
          sucursal_id: string
          updated_at?: string
          vigencia_desde?: string
          vigencia_hasta?: string | null
        }
        Update: {
          activa?: boolean
          barbero_origen_id?: string
          config_id?: string
          created_at?: string
          id?: string
          organization_id?: string
          porcentaje?: number
          sucursal_id?: string
          updated_at?: string
          vigencia_desde?: string
          vigencia_hasta?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "comision_equipo_reglas_barbero_origen_id_fkey"
            columns: ["barbero_origen_id"]
            isOneToOne: false
            referencedRelation: "barberos"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "comision_equipo_reglas_barbero_origen_id_fkey"
            columns: ["barbero_origen_id"]
            isOneToOne: false
            referencedRelation: "barberos_safe"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "comision_equipo_reglas_config_id_fkey"
            columns: ["config_id"]
            isOneToOne: false
            referencedRelation: "comision_equipo_config"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "comision_equipo_reglas_sucursal_id_fkey"
            columns: ["sucursal_id"]
            isOneToOne: false
            referencedRelation: "sucursales"
            referencedColumns: ["id"]
          },
        ]
      }
      comision_productos_config: {
        Row: {
          activa: boolean
          barbero_id: string
          created_at: string
          fecha_fin: string | null
          fecha_inicio: string
          id: string
          organization_id: string
          porcentaje: number
          sucursal_id: string | null
          updated_at: string
        }
        Insert: {
          activa?: boolean
          barbero_id: string
          created_at?: string
          fecha_fin?: string | null
          fecha_inicio?: string
          id?: string
          organization_id: string
          porcentaje: number
          sucursal_id?: string | null
          updated_at?: string
        }
        Update: {
          activa?: boolean
          barbero_id?: string
          created_at?: string
          fecha_fin?: string | null
          fecha_inicio?: string
          id?: string
          organization_id?: string
          porcentaje?: number
          sucursal_id?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      descuentos: {
        Row: {
          activo: boolean
          aplica_a: string
          created_at: string
          eliminado: boolean
          eliminado_at: string | null
          eliminado_por: string | null
          id: string
          metodo_pago: string | null
          nombre: string
          organization_id: string | null
          redondeo: string | null
          redondeo_unidad: number | null
          sucursal_id: string | null
          tipo: string
          updated_at: string
          valor: number
        }
        Insert: {
          activo?: boolean
          aplica_a?: string
          created_at?: string
          eliminado?: boolean
          eliminado_at?: string | null
          eliminado_por?: string | null
          id?: string
          metodo_pago?: string | null
          nombre: string
          organization_id?: string | null
          redondeo?: string | null
          redondeo_unidad?: number | null
          sucursal_id?: string | null
          tipo: string
          updated_at?: string
          valor?: number
        }
        Update: {
          activo?: boolean
          aplica_a?: string
          created_at?: string
          eliminado?: boolean
          eliminado_at?: string | null
          eliminado_por?: string | null
          id?: string
          metodo_pago?: string | null
          nombre?: string
          organization_id?: string | null
          redondeo?: string | null
          redondeo_unidad?: number | null
          sucursal_id?: string | null
          tipo?: string
          updated_at?: string
          valor?: number
        }
        Relationships: [
          {
            foreignKeyName: "descuentos_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "descuentos_sucursal_id_fkey"
            columns: ["sucursal_id"]
            isOneToOne: false
            referencedRelation: "sucursales"
            referencedColumns: ["id"]
          },
        ]
      }
      descuentos_sucursales: {
        Row: {
          activo: boolean
          created_at: string
          descuento_id: string
          id: string
          organization_id: string
          sucursal_id: string
          updated_at: string
        }
        Insert: {
          activo?: boolean
          created_at?: string
          descuento_id: string
          id?: string
          organization_id: string
          sucursal_id: string
          updated_at?: string
        }
        Update: {
          activo?: boolean
          created_at?: string
          descuento_id?: string
          id?: string
          organization_id?: string
          sucursal_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "descuentos_sucursales_descuento_id_fkey"
            columns: ["descuento_id"]
            isOneToOne: false
            referencedRelation: "descuentos"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "descuentos_sucursales_sucursal_id_fkey"
            columns: ["sucursal_id"]
            isOneToOne: false
            referencedRelation: "sucursales"
            referencedColumns: ["id"]
          },
        ]
      }
      deudas: {
        Row: {
          acreedor: string
          created_at: string
          cuotas_pagadas: number
          cuotas_totales: number | null
          descripcion: string | null
          estado: string
          fecha_inicio: string
          fecha_proximo_pago: string | null
          id: string
          inversion_id: string | null
          monto_cuota: number | null
          monto_pagado: number
          monto_total: number
          organization_id: string
          sucursal_id: string | null
        }
        Insert: {
          acreedor: string
          created_at?: string
          cuotas_pagadas?: number
          cuotas_totales?: number | null
          descripcion?: string | null
          estado?: string
          fecha_inicio: string
          fecha_proximo_pago?: string | null
          id?: string
          inversion_id?: string | null
          monto_cuota?: number | null
          monto_pagado?: number
          monto_total: number
          organization_id: string
          sucursal_id?: string | null
        }
        Update: {
          acreedor?: string
          created_at?: string
          cuotas_pagadas?: number
          cuotas_totales?: number | null
          descripcion?: string | null
          estado?: string
          fecha_inicio?: string
          fecha_proximo_pago?: string | null
          id?: string
          inversion_id?: string | null
          monto_cuota?: number | null
          monto_pagado?: number
          monto_total?: number
          organization_id?: string
          sucursal_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "deudas_inversion_id_fkey"
            columns: ["inversion_id"]
            isOneToOne: false
            referencedRelation: "inversiones"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "deudas_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "deudas_sucursal_id_fkey"
            columns: ["sucursal_id"]
            isOneToOne: false
            referencedRelation: "sucursales"
            referencedColumns: ["id"]
          },
        ]
      }
      Egresos: {
        Row: {
          anulado_at: string | null
          anulado_motivo: string | null
          anulado_por: string | null
          anulado_por_pin_user_id: string | null
          Categoria: string | null
          Descripcion: string | null
          estado: string
          Fecha: string | null
          gasto_recurrente_id: string | null
          id: number
          inversion_id: string | null
          Monto: number | null
          organization_id: string | null
          sucursal_id: string | null
          tipo_costo: string | null
        }
        Insert: {
          anulado_at?: string | null
          anulado_motivo?: string | null
          anulado_por?: string | null
          anulado_por_pin_user_id?: string | null
          Categoria?: string | null
          Descripcion?: string | null
          estado?: string
          Fecha?: string | null
          gasto_recurrente_id?: string | null
          id?: number
          inversion_id?: string | null
          Monto?: number | null
          organization_id?: string | null
          sucursal_id?: string | null
          tipo_costo?: string | null
        }
        Update: {
          anulado_at?: string | null
          anulado_motivo?: string | null
          anulado_por?: string | null
          anulado_por_pin_user_id?: string | null
          Categoria?: string | null
          Descripcion?: string | null
          estado?: string
          Fecha?: string | null
          gasto_recurrente_id?: string | null
          id?: number
          inversion_id?: string | null
          Monto?: number | null
          organization_id?: string | null
          sucursal_id?: string | null
          tipo_costo?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "Egresos_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "Egresos_sucursal_id_fkey"
            columns: ["sucursal_id"]
            isOneToOne: false
            referencedRelation: "sucursales"
            referencedColumns: ["id"]
          },
        ]
      }
      extras: {
        Row: {
          activo: boolean
          created_at: string
          eliminado: boolean
          eliminado_at: string | null
          eliminado_por: string | null
          id: string
          nombre: string
          organization_id: string | null
          precio: number
          sucursal_id: string | null
          updated_at: string
        }
        Insert: {
          activo?: boolean
          created_at?: string
          eliminado?: boolean
          eliminado_at?: string | null
          eliminado_por?: string | null
          id?: string
          nombre: string
          organization_id?: string | null
          precio?: number
          sucursal_id?: string | null
          updated_at?: string
        }
        Update: {
          activo?: boolean
          created_at?: string
          eliminado?: boolean
          eliminado_at?: string | null
          eliminado_por?: string | null
          id?: string
          nombre?: string
          organization_id?: string | null
          precio?: number
          sucursal_id?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "extras_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "extras_sucursal_id_fkey"
            columns: ["sucursal_id"]
            isOneToOne: false
            referencedRelation: "sucursales"
            referencedColumns: ["id"]
          },
        ]
      }
      extras_sucursales: {
        Row: {
          activo: boolean
          created_at: string
          extra_id: string
          id: string
          organization_id: string
          precio: number
          sucursal_id: string
          updated_at: string
        }
        Insert: {
          activo?: boolean
          created_at?: string
          extra_id: string
          id?: string
          organization_id: string
          precio?: number
          sucursal_id: string
          updated_at?: string
        }
        Update: {
          activo?: boolean
          created_at?: string
          extra_id?: string
          id?: string
          organization_id?: string
          precio?: number
          sucursal_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "extras_sucursales_extra_id_fkey"
            columns: ["extra_id"]
            isOneToOne: false
            referencedRelation: "extras"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "extras_sucursales_sucursal_id_fkey"
            columns: ["sucursal_id"]
            isOneToOne: false
            referencedRelation: "sucursales"
            referencedColumns: ["id"]
          },
        ]
      }
      gastos_recurrentes: {
        Row: {
          activo: boolean
          categoria: string
          created_at: string
          descripcion: string | null
          fecha_inicio: string
          id: string
          monto: number
          organization_id: string
          proxima_fecha: string
          repeat_byweekday: number[] | null
          repeat_frequency: string | null
          repeat_interval: number | null
          repeat_preset: string
          sucursal_id: string | null
          tipo_costo: string
        }
        Insert: {
          activo?: boolean
          categoria: string
          created_at?: string
          descripcion?: string | null
          fecha_inicio?: string
          id?: string
          monto: number
          organization_id: string
          proxima_fecha?: string
          repeat_byweekday?: number[] | null
          repeat_frequency?: string | null
          repeat_interval?: number | null
          repeat_preset?: string
          sucursal_id?: string | null
          tipo_costo?: string
        }
        Update: {
          activo?: boolean
          categoria?: string
          created_at?: string
          descripcion?: string | null
          fecha_inicio?: string
          id?: string
          monto?: number
          organization_id?: string
          proxima_fecha?: string
          repeat_byweekday?: number[] | null
          repeat_frequency?: string | null
          repeat_interval?: number | null
          repeat_preset?: string
          sucursal_id?: string | null
          tipo_costo?: string
        }
        Relationships: []
      }
      horarios_trabajo: {
        Row: {
          activo: boolean
          barbero_id: string | null
          created_at: string
          dia_semana: number
          hora_fin: string
          hora_inicio: string
          id: string
          organization_id: string
          sucursal_id: string
          updated_at: string
        }
        Insert: {
          activo?: boolean
          barbero_id?: string | null
          created_at?: string
          dia_semana: number
          hora_fin: string
          hora_inicio: string
          id?: string
          organization_id: string
          sucursal_id: string
          updated_at?: string
        }
        Update: {
          activo?: boolean
          barbero_id?: string | null
          created_at?: string
          dia_semana?: number
          hora_fin?: string
          hora_inicio?: string
          id?: string
          organization_id?: string
          sucursal_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "horarios_trabajo_barbero_id_fkey"
            columns: ["barbero_id"]
            isOneToOne: false
            referencedRelation: "barberos"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "horarios_trabajo_barbero_id_fkey"
            columns: ["barbero_id"]
            isOneToOne: false
            referencedRelation: "barberos_safe"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "horarios_trabajo_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "horarios_trabajo_sucursal_id_fkey"
            columns: ["sucursal_id"]
            isOneToOne: false
            referencedRelation: "sucursales"
            referencedColumns: ["id"]
          },
        ]
      }
      ingresos: {
        Row: {
          backfill_note: string | null
          backfill_reason: string | null
          backfilled_at: string | null
          backfilled_by: string | null
          barbero: string | null
          barbero_id: string | null
          cantidad_de_20_por: number | null
          cantidad_de_50_por: number | null
          cantidad_de_servicios: number | null
          closed_at: string | null
          comision_productos: number
          created_at: string
          deluxe: number | null
          dia: string | null
          digital_cobrado: number | null
          efectivo: number | null
          efectivo_cobrado: number | null
          entry_mode: string
          essencial: number | null
          estado: string | null
          extras: number | null
          id: number
          identificador: string | null
          mp: number | null
          organization_id: string | null
          perdida: number | null
          productos_cantidad: number
          productos_digital: number
          productos_efectivo: number
          productos_total: number
          recargos_total: number
          servicios_con_descuento: number | null
          servicios_por_linea: Json | null
          servicios_sin_descuento: number | null
          sucursal_id: string | null
          sueldo: number | null
          total_cobrado: number | null
          total_facturado: number | null
          total_sin_descuento: number | null
          Usuario: string | null
        }
        Insert: {
          backfill_note?: string | null
          backfill_reason?: string | null
          backfilled_at?: string | null
          backfilled_by?: string | null
          barbero?: string | null
          barbero_id?: string | null
          cantidad_de_20_por?: number | null
          cantidad_de_50_por?: number | null
          cantidad_de_servicios?: number | null
          closed_at?: string | null
          comision_productos?: number
          created_at: string
          deluxe?: number | null
          dia?: string | null
          digital_cobrado?: number | null
          efectivo?: number | null
          efectivo_cobrado?: number | null
          entry_mode?: string
          essencial?: number | null
          estado?: string | null
          extras?: number | null
          id?: number
          identificador?: string | null
          mp?: number | null
          organization_id?: string | null
          perdida?: number | null
          productos_cantidad?: number
          productos_digital?: number
          productos_efectivo?: number
          productos_total?: number
          recargos_total?: number
          servicios_con_descuento?: number | null
          servicios_por_linea?: Json | null
          servicios_sin_descuento?: number | null
          sucursal_id?: string | null
          sueldo?: number | null
          total_cobrado?: number | null
          total_facturado?: number | null
          total_sin_descuento?: number | null
          Usuario?: string | null
        }
        Update: {
          backfill_note?: string | null
          backfill_reason?: string | null
          backfilled_at?: string | null
          backfilled_by?: string | null
          barbero?: string | null
          barbero_id?: string | null
          cantidad_de_20_por?: number | null
          cantidad_de_50_por?: number | null
          cantidad_de_servicios?: number | null
          closed_at?: string | null
          comision_productos?: number
          created_at?: string
          deluxe?: number | null
          dia?: string | null
          digital_cobrado?: number | null
          efectivo?: number | null
          efectivo_cobrado?: number | null
          entry_mode?: string
          essencial?: number | null
          estado?: string | null
          extras?: number | null
          id?: number
          identificador?: string | null
          mp?: number | null
          organization_id?: string | null
          perdida?: number | null
          productos_cantidad?: number
          productos_digital?: number
          productos_efectivo?: number
          productos_total?: number
          recargos_total?: number
          servicios_con_descuento?: number | null
          servicios_por_linea?: Json | null
          servicios_sin_descuento?: number | null
          sucursal_id?: string | null
          sueldo?: number | null
          total_cobrado?: number | null
          total_facturado?: number | null
          total_sin_descuento?: number | null
          Usuario?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "ingresos_barbero_id_fkey"
            columns: ["barbero_id"]
            isOneToOne: false
            referencedRelation: "barberos"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ingresos_barbero_id_fkey"
            columns: ["barbero_id"]
            isOneToOne: false
            referencedRelation: "barberos_safe"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ingresos_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ingresos_sucursal_id_fkey"
            columns: ["sucursal_id"]
            isOneToOne: false
            referencedRelation: "sucursales"
            referencedColumns: ["id"]
          },
        ]
      }
      ingresos_items: {
        Row: {
          barbero_id: string
          created_at: string
          id: string
          ingreso_id: number
          linea_id: string | null
          organization_id: string
          payment_method: string
          qty: number
          servicio_id: string | null
          servicio_nombre: string
          subtotal: number
          sucursal_id: string | null
          unit_price: number
        }
        Insert: {
          barbero_id: string
          created_at?: string
          id?: string
          ingreso_id: number
          linea_id?: string | null
          organization_id: string
          payment_method?: string
          qty?: number
          servicio_id?: string | null
          servicio_nombre?: string
          subtotal?: number
          sucursal_id?: string | null
          unit_price?: number
        }
        Update: {
          barbero_id?: string
          created_at?: string
          id?: string
          ingreso_id?: number
          linea_id?: string | null
          organization_id?: string
          payment_method?: string
          qty?: number
          servicio_id?: string | null
          servicio_nombre?: string
          subtotal?: number
          sucursal_id?: string | null
          unit_price?: number
        }
        Relationships: [
          {
            foreignKeyName: "ingresos_items_barbero_id_fkey"
            columns: ["barbero_id"]
            isOneToOne: false
            referencedRelation: "barberos"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ingresos_items_barbero_id_fkey"
            columns: ["barbero_id"]
            isOneToOne: false
            referencedRelation: "barberos_safe"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ingresos_items_ingreso_id_fkey"
            columns: ["ingreso_id"]
            isOneToOne: false
            referencedRelation: "ingresos"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ingresos_items_linea_id_fkey"
            columns: ["linea_id"]
            isOneToOne: false
            referencedRelation: "lineas"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ingresos_items_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ingresos_items_servicio_id_fkey"
            columns: ["servicio_id"]
            isOneToOne: false
            referencedRelation: "servicios"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ingresos_items_sucursal_id_fkey"
            columns: ["sucursal_id"]
            isOneToOne: false
            referencedRelation: "sucursales"
            referencedColumns: ["id"]
          },
        ]
      }
      ingresos_items_productos: {
        Row: {
          barbero_id: string | null
          comision_modo_snap: string | null
          comision_monto: number
          comision_pct_snap: number | null
          created_at: string
          id: string
          ingreso_id: number
          marca_id: string | null
          marca_nombre: string | null
          organization_id: string
          payment_method: string
          precio_costo_snap: number | null
          producto_id: string
          producto_nombre: string
          qty: number
          subtotal: number
          sucursal_id: string | null
          unit_price: number
        }
        Insert: {
          barbero_id?: string | null
          comision_modo_snap?: string | null
          comision_monto?: number
          comision_pct_snap?: number | null
          created_at?: string
          id?: string
          ingreso_id: number
          marca_id?: string | null
          marca_nombre?: string | null
          organization_id: string
          payment_method?: string
          precio_costo_snap?: number | null
          producto_id: string
          producto_nombre: string
          qty?: number
          subtotal?: number
          sucursal_id?: string | null
          unit_price?: number
        }
        Update: {
          barbero_id?: string | null
          comision_modo_snap?: string | null
          comision_monto?: number
          comision_pct_snap?: number | null
          created_at?: string
          id?: string
          ingreso_id?: number
          marca_id?: string | null
          marca_nombre?: string | null
          organization_id?: string
          payment_method?: string
          precio_costo_snap?: number | null
          producto_id?: string
          producto_nombre?: string
          qty?: number
          subtotal?: number
          sucursal_id?: string | null
          unit_price?: number
        }
        Relationships: []
      }
      inversiones: {
        Row: {
          activa: boolean
          categoria: string | null
          created_at: string
          descripcion: string | null
          fecha_compra: string
          id: string
          meses_amortizacion: number
          monto_total: number
          nombre: string
          organization_id: string
          sucursal_id: string | null
        }
        Insert: {
          activa?: boolean
          categoria?: string | null
          created_at?: string
          descripcion?: string | null
          fecha_compra: string
          id?: string
          meses_amortizacion: number
          monto_total: number
          nombre: string
          organization_id: string
          sucursal_id?: string | null
        }
        Update: {
          activa?: boolean
          categoria?: string | null
          created_at?: string
          descripcion?: string | null
          fecha_compra?: string
          id?: string
          meses_amortizacion?: number
          monto_total?: number
          nombre?: string
          organization_id?: string
          sucursal_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "inversiones_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "inversiones_sucursal_id_fkey"
            columns: ["sucursal_id"]
            isOneToOne: false
            referencedRelation: "sucursales"
            referencedColumns: ["id"]
          },
        ]
      }
      lineas: {
        Row: {
          activo: boolean
          color: string | null
          created_at: string
          eliminado: boolean
          eliminado_at: string | null
          eliminado_por: string | null
          id: string
          nombre: string
          organization_id: string | null
          updated_at: string
        }
        Insert: {
          activo?: boolean
          color?: string | null
          created_at?: string
          eliminado?: boolean
          eliminado_at?: string | null
          eliminado_por?: string | null
          id?: string
          nombre: string
          organization_id?: string | null
          updated_at?: string
        }
        Update: {
          activo?: boolean
          color?: string | null
          created_at?: string
          eliminado?: boolean
          eliminado_at?: string | null
          eliminado_por?: string | null
          id?: string
          nombre?: string
          organization_id?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "lineas_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      marcas_producto: {
        Row: {
          activo: boolean
          color: string
          created_at: string
          id: string
          nombre: string
          organization_id: string
          updated_at: string
        }
        Insert: {
          activo?: boolean
          color: string
          created_at?: string
          id?: string
          nombre: string
          organization_id: string
          updated_at?: string
        }
        Update: {
          activo?: boolean
          color?: string
          created_at?: string
          id?: string
          nombre?: string
          organization_id?: string
          updated_at?: string
        }
        Relationships: []
      }
      movimientos_stock: {
        Row: {
          cantidad: number
          created_at: string
          created_by: string | null
          id: string
          motivo: string | null
          organization_id: string
          producto_id: string
          producto_sucursal_id: string
          stock_previo: number
          stock_resultante: number
          sucursal_id: string
          tipo: string
          venta_id: string | null
        }
        Insert: {
          cantidad: number
          created_at?: string
          created_by?: string | null
          id?: string
          motivo?: string | null
          organization_id: string
          producto_id: string
          producto_sucursal_id: string
          stock_previo: number
          stock_resultante: number
          sucursal_id: string
          tipo: string
          venta_id?: string | null
        }
        Update: {
          cantidad?: number
          created_at?: string
          created_by?: string | null
          id?: string
          motivo?: string | null
          organization_id?: string
          producto_id?: string
          producto_sucursal_id?: string
          stock_previo?: number
          stock_resultante?: number
          sucursal_id?: string
          tipo?: string
          venta_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "movimientos_stock_producto_id_fkey"
            columns: ["producto_id"]
            isOneToOne: false
            referencedRelation: "productos"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "movimientos_stock_producto_sucursal_id_fkey"
            columns: ["producto_sucursal_id"]
            isOneToOne: false
            referencedRelation: "productos_sucursal"
            referencedColumns: ["id"]
          },
        ]
      }
      notification_deliveries: {
        Row: {
          created_at: string
          hidden_at: string | null
          id: string
          notification_id: string
          organization_id: string
          read_at: string | null
          user_id: string
        }
        Insert: {
          created_at?: string
          hidden_at?: string | null
          id?: string
          notification_id: string
          organization_id: string
          read_at?: string | null
          user_id: string
        }
        Update: {
          created_at?: string
          hidden_at?: string | null
          id?: string
          notification_id?: string
          organization_id?: string
          read_at?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "notification_deliveries_notification_id_fkey"
            columns: ["notification_id"]
            isOneToOne: false
            referencedRelation: "notifications"
            referencedColumns: ["id"]
          },
        ]
      }
      notification_reads: {
        Row: {
          created_at: string
          id: string
          notification_id: string | null
          organization_id: string
          read_at: string
          source_id: string
          source_type: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          notification_id?: string | null
          organization_id: string
          read_at?: string
          source_id: string
          source_type: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          notification_id?: string | null
          organization_id?: string
          read_at?: string
          source_id?: string
          source_type?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "notification_reads_notification_id_fkey"
            columns: ["notification_id"]
            isOneToOne: false
            referencedRelation: "notifications"
            referencedColumns: ["id"]
          },
        ]
      }
      notifications: {
        Row: {
          actor_account_type: string | null
          actor_name: string | null
          actor_user_id: string | null
          authorized_by_name: string | null
          authorized_by_user_id: string | null
          body: string | null
          category: string | null
          created_at: string
          event_key: string
          expires_at: string | null
          id: string
          metadata: Json
          notification_at: string
          organization_id: string
          source_id: string | null
          source_module: string
          source_table: string | null
          sucursal_id: string | null
          summary: string | null
          title: string
          type: string
          updated_at: string
        }
        Insert: {
          actor_account_type?: string | null
          actor_name?: string | null
          actor_user_id?: string | null
          authorized_by_name?: string | null
          authorized_by_user_id?: string | null
          body?: string | null
          category?: string | null
          created_at?: string
          event_key: string
          expires_at?: string | null
          id?: string
          metadata?: Json
          notification_at?: string
          organization_id: string
          source_id?: string | null
          source_module: string
          source_table?: string | null
          sucursal_id?: string | null
          summary?: string | null
          title: string
          type: string
          updated_at?: string
        }
        Update: {
          actor_account_type?: string | null
          actor_name?: string | null
          actor_user_id?: string | null
          authorized_by_name?: string | null
          authorized_by_user_id?: string | null
          body?: string | null
          category?: string | null
          created_at?: string
          event_key?: string
          expires_at?: string | null
          id?: string
          metadata?: Json
          notification_at?: string
          organization_id?: string
          source_id?: string | null
          source_module?: string
          source_table?: string | null
          sucursal_id?: string | null
          summary?: string | null
          title?: string
          type?: string
          updated_at?: string
        }
        Relationships: []
      }
      organizations: {
        Row: {
          address: string | null
          created_at: string | null
          id: string
          is_active: boolean | null
          last_payment_at: string | null
          logo_url: string | null
          name: string
          peticiones_vencimiento_dias: number
          phone: string | null
          plan: string | null
          plan_expires_at: string | null
          slug: string
          tareas_vencimiento_dias_default: number
          timezone: string | null
          updated_at: string | null
        }
        Insert: {
          address?: string | null
          created_at?: string | null
          id?: string
          is_active?: boolean | null
          last_payment_at?: string | null
          logo_url?: string | null
          name: string
          peticiones_vencimiento_dias?: number
          phone?: string | null
          plan?: string | null
          plan_expires_at?: string | null
          slug: string
          tareas_vencimiento_dias_default?: number
          timezone?: string | null
          updated_at?: string | null
        }
        Update: {
          address?: string | null
          created_at?: string | null
          id?: string
          is_active?: boolean | null
          last_payment_at?: string | null
          logo_url?: string | null
          name?: string
          peticiones_vencimiento_dias?: number
          phone?: string | null
          plan?: string | null
          plan_expires_at?: string | null
          slug?: string
          tareas_vencimiento_dias_default?: number
          timezone?: string | null
          updated_at?: string | null
        }
        Relationships: []
      }
      pagos_sueldos: {
        Row: {
          barbero_id: string
          barbero_nombre: string
          concepto: string | null
          created_at: string
          fecha: string
          id: string
          monto: number
          organization_id: string
          sucursal_id: string | null
          updated_at: string
        }
        Insert: {
          barbero_id: string
          barbero_nombre: string
          concepto?: string | null
          created_at?: string
          fecha?: string
          id?: string
          monto?: number
          organization_id: string
          sucursal_id?: string | null
          updated_at?: string
        }
        Update: {
          barbero_id?: string
          barbero_nombre?: string
          concepto?: string | null
          created_at?: string
          fecha?: string
          id?: string
          monto?: number
          organization_id?: string
          sucursal_id?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "pagos_sueldos_sucursal_id_fkey"
            columns: ["sucursal_id"]
            isOneToOne: false
            referencedRelation: "sucursales"
            referencedColumns: ["id"]
          },
        ]
      }
      payment_methods_config: {
        Row: {
          activo: boolean
          created_at: string
          id: string
          metodo_pago: string
          organization_id: string
          recargo_pct: number
          sucursal_id: string | null
          updated_at: string
        }
        Insert: {
          activo?: boolean
          created_at?: string
          id?: string
          metodo_pago: string
          organization_id: string
          recargo_pct?: number
          sucursal_id?: string | null
          updated_at?: string
        }
        Update: {
          activo?: boolean
          created_at?: string
          id?: string
          metodo_pago?: string
          organization_id?: string
          recargo_pct?: number
          sucursal_id?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "payment_methods_config_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "payment_methods_config_sucursal_id_fkey"
            columns: ["sucursal_id"]
            isOneToOne: false
            referencedRelation: "sucursales"
            referencedColumns: ["id"]
          },
        ]
      }
      plan_features: {
        Row: {
          can_export_reports: boolean | null
          can_view_analytics: boolean | null
          created_at: string | null
          id: string
          max_barbers: number | null
          max_services: number | null
          plan: string
          price_monthly: number | null
        }
        Insert: {
          can_export_reports?: boolean | null
          can_view_analytics?: boolean | null
          created_at?: string | null
          id?: string
          max_barbers?: number | null
          max_services?: number | null
          plan: string
          price_monthly?: number | null
        }
        Update: {
          can_export_reports?: boolean | null
          can_view_analytics?: boolean | null
          created_at?: string | null
          id?: string
          max_barbers?: number | null
          max_services?: number | null
          plan?: string
          price_monthly?: number | null
        }
        Relationships: []
      }
      portal_config: {
        Row: {
          cover_path: string | null
          cover_position_x: number
          cover_position_y: number
          cover_zoom: number
          created_at: string
          description: string | null
          links: Json
          logo_path: string | null
          organization_id: string
          primary_color: string | null
          updated_at: string
        }
        Insert: {
          cover_path?: string | null
          cover_position_x?: number
          cover_position_y?: number
          cover_zoom?: number
          created_at?: string
          description?: string | null
          links?: Json
          logo_path?: string | null
          organization_id: string
          primary_color?: string | null
          updated_at?: string
        }
        Update: {
          cover_path?: string | null
          cover_position_x?: number
          cover_position_y?: number
          cover_zoom?: number
          created_at?: string
          description?: string | null
          links?: Json
          logo_path?: string | null
          organization_id?: string
          primary_color?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "portal_config_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: true
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      productos: {
        Row: {
          activo: boolean
          created_at: string
          descripcion: string | null
          id: string
          marca_id: string | null
          nombre: string
          organization_id: string
          updated_at: string
        }
        Insert: {
          activo?: boolean
          created_at?: string
          descripcion?: string | null
          id?: string
          marca_id?: string | null
          nombre: string
          organization_id: string
          updated_at?: string
        }
        Update: {
          activo?: boolean
          created_at?: string
          descripcion?: string | null
          id?: string
          marca_id?: string | null
          nombre?: string
          organization_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "productos_marca_id_fkey"
            columns: ["marca_id"]
            isOneToOne: false
            referencedRelation: "marcas_producto"
            referencedColumns: ["id"]
          },
        ]
      }
      productos_sucursal: {
        Row: {
          activo: boolean
          comision_modo: string
          comision_porcentaje: number | null
          created_at: string
          id: string
          margen_pct: number | null
          organization_id: string
          precio_costo: number | null
          precio_venta: number
          producto_id: string
          stock_actual: number
          stock_minimo: number
          sucursal_id: string
          updated_at: string
        }
        Insert: {
          activo?: boolean
          comision_modo?: string
          comision_porcentaje?: number | null
          created_at?: string
          id?: string
          margen_pct?: number | null
          organization_id: string
          precio_costo?: number | null
          precio_venta?: number
          producto_id: string
          stock_actual?: number
          stock_minimo?: number
          sucursal_id: string
          updated_at?: string
        }
        Update: {
          activo?: boolean
          comision_modo?: string
          comision_porcentaje?: number | null
          created_at?: string
          id?: string
          margen_pct?: number | null
          organization_id?: string
          precio_costo?: number | null
          precio_venta?: number
          producto_id?: string
          stock_actual?: number
          stock_minimo?: number
          sucursal_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "productos_sucursal_producto_id_fkey"
            columns: ["producto_id"]
            isOneToOne: false
            referencedRelation: "productos"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          barbero_id: string | null
          created_at: string | null
          default_sucursal_id: string | null
          email: string
          full_name: string | null
          id: string
          organization_id: string | null
          updated_at: string | null
        }
        Insert: {
          barbero_id?: string | null
          created_at?: string | null
          default_sucursal_id?: string | null
          email: string
          full_name?: string | null
          id: string
          organization_id?: string | null
          updated_at?: string | null
        }
        Update: {
          barbero_id?: string | null
          created_at?: string | null
          default_sucursal_id?: string | null
          email?: string
          full_name?: string | null
          id?: string
          organization_id?: string | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "profiles_barbero_id_fkey"
            columns: ["barbero_id"]
            isOneToOne: false
            referencedRelation: "barberos"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "profiles_barbero_id_fkey"
            columns: ["barbero_id"]
            isOneToOne: false
            referencedRelation: "barberos_safe"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "profiles_default_sucursal_id_fkey"
            columns: ["default_sucursal_id"]
            isOneToOne: false
            referencedRelation: "sucursales"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "profiles_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      ReportesMensuales: {
        Row: {
          ComisionesTotales: number | null
          ComisiónPromedioPorBarbero: number | null
          ComisiónPromedioPorCorte: number | null
          ComisiónPromedioPorCortePorcentual: number | null
          CostoMedioPorServicio: number | null
          CostoPorServicio: number | null
          created_at: string
          CrecimientoEnFacturación: number | null
          CrecimientoEnServicios: number | null
          FacturacionTotal: number | null
          GananciaNeta: number | null
          GastosFijos: number | null
          id: number
          MargenBruto: number | null
          MargenBrutoPorcentual: number | null
          Mes: string | null
          organization_id: string | null
          PromDiarioPorBarbero: number | null
          PuntoDeEquilibrioEnCortes: number | null
          Rentabilidad: number | null
          ServiciosPorBarbero: number | null
          ServiciosTotales: number | null
          sucursal_id: string | null
          TasaDeOcupación: number | null
          TicketPromedio: number | null
        }
        Insert: {
          ComisionesTotales?: number | null
          ComisiónPromedioPorBarbero?: number | null
          ComisiónPromedioPorCorte?: number | null
          ComisiónPromedioPorCortePorcentual?: number | null
          CostoMedioPorServicio?: number | null
          CostoPorServicio?: number | null
          created_at?: string
          CrecimientoEnFacturación?: number | null
          CrecimientoEnServicios?: number | null
          FacturacionTotal?: number | null
          GananciaNeta?: number | null
          GastosFijos?: number | null
          id?: number
          MargenBruto?: number | null
          MargenBrutoPorcentual?: number | null
          Mes?: string | null
          organization_id?: string | null
          PromDiarioPorBarbero?: number | null
          PuntoDeEquilibrioEnCortes?: number | null
          Rentabilidad?: number | null
          ServiciosPorBarbero?: number | null
          ServiciosTotales?: number | null
          sucursal_id?: string | null
          TasaDeOcupación?: number | null
          TicketPromedio?: number | null
        }
        Update: {
          ComisionesTotales?: number | null
          ComisiónPromedioPorBarbero?: number | null
          ComisiónPromedioPorCorte?: number | null
          ComisiónPromedioPorCortePorcentual?: number | null
          CostoMedioPorServicio?: number | null
          CostoPorServicio?: number | null
          created_at?: string
          CrecimientoEnFacturación?: number | null
          CrecimientoEnServicios?: number | null
          FacturacionTotal?: number | null
          GananciaNeta?: number | null
          GastosFijos?: number | null
          id?: number
          MargenBruto?: number | null
          MargenBrutoPorcentual?: number | null
          Mes?: string | null
          organization_id?: string | null
          PromDiarioPorBarbero?: number | null
          PuntoDeEquilibrioEnCortes?: number | null
          Rentabilidad?: number | null
          ServiciosPorBarbero?: number | null
          ServiciosTotales?: number | null
          sucursal_id?: string | null
          TasaDeOcupación?: number | null
          TicketPromedio?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "ReportesMensuales_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ReportesMensuales_sucursal_id_fkey"
            columns: ["sucursal_id"]
            isOneToOne: false
            referencedRelation: "sucursales"
            referencedColumns: ["id"]
          },
        ]
      }
      servicios: {
        Row: {
          activo: boolean
          created_at: string
          duracion_min: number
          eliminado: boolean
          eliminado_at: string | null
          eliminado_por: string | null
          id: string
          linea_id: string | null
          nombre: string
          organization_id: string | null
          precio: number
          sucursal_id: string | null
          updated_at: string
        }
        Insert: {
          activo?: boolean
          created_at?: string
          duracion_min?: number
          eliminado?: boolean
          eliminado_at?: string | null
          eliminado_por?: string | null
          id?: string
          linea_id?: string | null
          nombre: string
          organization_id?: string | null
          precio?: number
          sucursal_id?: string | null
          updated_at?: string
        }
        Update: {
          activo?: boolean
          created_at?: string
          duracion_min?: number
          eliminado?: boolean
          eliminado_at?: string | null
          eliminado_por?: string | null
          id?: string
          linea_id?: string | null
          nombre?: string
          organization_id?: string | null
          precio?: number
          sucursal_id?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "servicios_linea_id_fkey"
            columns: ["linea_id"]
            isOneToOne: false
            referencedRelation: "lineas"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "servicios_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "servicios_sucursal_id_fkey"
            columns: ["sucursal_id"]
            isOneToOne: false
            referencedRelation: "sucursales"
            referencedColumns: ["id"]
          },
        ]
      }
      servicios_sucursales: {
        Row: {
          activo: boolean
          created_at: string
          id: string
          organization_id: string
          precio: number
          servicio_id: string
          sucursal_id: string
          updated_at: string
        }
        Insert: {
          activo?: boolean
          created_at?: string
          id?: string
          organization_id: string
          precio?: number
          servicio_id: string
          sucursal_id: string
          updated_at?: string
        }
        Update: {
          activo?: boolean
          created_at?: string
          id?: string
          organization_id?: string
          precio?: number
          servicio_id?: string
          sucursal_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "servicios_sucursales_servicio_id_fkey"
            columns: ["servicio_id"]
            isOneToOne: false
            referencedRelation: "servicios"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "servicios_sucursales_sucursal_id_fkey"
            columns: ["sucursal_id"]
            isOneToOne: false
            referencedRelation: "sucursales"
            referencedColumns: ["id"]
          },
        ]
      }
      sucursal_accounts: {
        Row: {
          created_at: string
          email: string
          estado: string
          id: string
          last_password_reset_at: string | null
          organization_id: string
          sucursal_id: string
          temp_password_pending: boolean
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          email: string
          estado?: string
          id?: string
          last_password_reset_at?: string | null
          organization_id: string
          sucursal_id: string
          temp_password_pending?: boolean
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          email?: string
          estado?: string
          id?: string
          last_password_reset_at?: string | null
          organization_id?: string
          sucursal_id?: string
          temp_password_pending?: boolean
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      sucursal_action_pin_config: {
        Row: {
          action_key: string
          created_at: string
          id: string
          organization_id: string
          requires_pin: boolean
          sucursal_id: string | null
          updated_at: string
        }
        Insert: {
          action_key: string
          created_at?: string
          id?: string
          organization_id: string
          requires_pin?: boolean
          sucursal_id?: string | null
          updated_at?: string
        }
        Update: {
          action_key?: string
          created_at?: string
          id?: string
          organization_id?: string
          requires_pin?: boolean
          sucursal_id?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      sucursal_payment_settings: {
        Row: {
          created_at: string
          organization_id: string
          sucursal_id: string
          updated_at: string
          usar_config_general: boolean
        }
        Insert: {
          created_at?: string
          organization_id: string
          sucursal_id: string
          updated_at?: string
          usar_config_general?: boolean
        }
        Update: {
          created_at?: string
          organization_id?: string
          sucursal_id?: string
          updated_at?: string
          usar_config_general?: boolean
        }
        Relationships: [
          {
            foreignKeyName: "sucursal_payment_settings_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sucursal_payment_settings_sucursal_id_fkey"
            columns: ["sucursal_id"]
            isOneToOne: true
            referencedRelation: "sucursales"
            referencedColumns: ["id"]
          },
        ]
      }
      sucursal_settings: {
        Row: {
          capacidad_diaria: number
          created_at: string
          id: string
          organization_id: string
          sucursal_id: string
          updated_at: string
        }
        Insert: {
          capacidad_diaria?: number
          created_at?: string
          id?: string
          organization_id: string
          sucursal_id: string
          updated_at?: string
        }
        Update: {
          capacidad_diaria?: number
          created_at?: string
          id?: string
          organization_id?: string
          sucursal_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "sucursal_settings_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sucursal_settings_sucursal_id_fkey"
            columns: ["sucursal_id"]
            isOneToOne: true
            referencedRelation: "sucursales"
            referencedColumns: ["id"]
          },
        ]
      }
      sucursales: {
        Row: {
          activa: boolean
          created_at: string
          direccion: string | null
          id: string
          nombre: string
          organization_id: string
          telefono: string | null
          timezone: string | null
          updated_at: string
        }
        Insert: {
          activa?: boolean
          created_at?: string
          direccion?: string | null
          id?: string
          nombre: string
          organization_id: string
          telefono?: string | null
          timezone?: string | null
          updated_at?: string
        }
        Update: {
          activa?: boolean
          created_at?: string
          direccion?: string | null
          id?: string
          nombre?: string
          organization_id?: string
          telefono?: string | null
          timezone?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "sucursales_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      tareas: {
        Row: {
          asignado_a_id: string | null
          asignado_a_nombre: string | null
          assignment_scope: string
          completada_at: string | null
          completada_por_id: string | null
          completada_por_nombre: string | null
          creado_por_id: string | null
          creado_por_nombre: string | null
          created_at: string
          descripcion: string | null
          estado: string
          fecha_inicio: string | null
          fecha_limite: string | null
          hora: string | null
          id: string
          organization_id: string
          recurrencia_id: string | null
          recurrente: boolean | null
          repeat_byweekday: number[] | null
          repeat_frequency: string | null
          repeat_interval: number | null
          repeat_preset: string | null
          sucursal_id: string | null
          tipo: string
          titulo: string
          updated_at: string
          vencida_at: string | null
          vencimiento_dias: number | null
        }
        Insert: {
          asignado_a_id?: string | null
          asignado_a_nombre?: string | null
          assignment_scope?: string
          completada_at?: string | null
          completada_por_id?: string | null
          completada_por_nombre?: string | null
          creado_por_id?: string | null
          creado_por_nombre?: string | null
          created_at?: string
          descripcion?: string | null
          estado?: string
          fecha_inicio?: string | null
          fecha_limite?: string | null
          hora?: string | null
          id?: string
          organization_id: string
          recurrencia_id?: string | null
          recurrente?: boolean | null
          repeat_byweekday?: number[] | null
          repeat_frequency?: string | null
          repeat_interval?: number | null
          repeat_preset?: string | null
          sucursal_id?: string | null
          tipo?: string
          titulo: string
          updated_at?: string
          vencida_at?: string | null
          vencimiento_dias?: number | null
        }
        Update: {
          asignado_a_id?: string | null
          asignado_a_nombre?: string | null
          assignment_scope?: string
          completada_at?: string | null
          completada_por_id?: string | null
          completada_por_nombre?: string | null
          creado_por_id?: string | null
          creado_por_nombre?: string | null
          created_at?: string
          descripcion?: string | null
          estado?: string
          fecha_inicio?: string | null
          fecha_limite?: string | null
          hora?: string | null
          id?: string
          organization_id?: string
          recurrencia_id?: string | null
          recurrente?: boolean | null
          repeat_byweekday?: number[] | null
          repeat_frequency?: string | null
          repeat_interval?: number | null
          repeat_preset?: string | null
          sucursal_id?: string | null
          tipo?: string
          titulo?: string
          updated_at?: string
          vencida_at?: string | null
          vencimiento_dias?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "tareas_asignado_a_id_fkey"
            columns: ["asignado_a_id"]
            isOneToOne: false
            referencedRelation: "barberos"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tareas_asignado_a_id_fkey"
            columns: ["asignado_a_id"]
            isOneToOne: false
            referencedRelation: "barberos_safe"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tareas_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tareas_recurrencia_id_fkey"
            columns: ["recurrencia_id"]
            isOneToOne: false
            referencedRelation: "tareas_recurrentes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tareas_sucursal_id_fkey"
            columns: ["sucursal_id"]
            isOneToOne: false
            referencedRelation: "sucursales"
            referencedColumns: ["id"]
          },
        ]
      }
      tareas_recurrentes: {
        Row: {
          activo: boolean
          asignado_a: string | null
          asignado_nombre: string | null
          assignment_scope: string
          created_at: string
          created_by: string | null
          descripcion: string | null
          fecha_inicio: string
          hora: string | null
          id: string
          organization_id: string
          proxima_fecha: string
          repeat_byweekday: number[] | null
          repeat_frequency: string | null
          repeat_interval: number | null
          repeat_preset: string
          sucursal_id: string
          titulo: string
          updated_at: string
        }
        Insert: {
          activo?: boolean
          asignado_a?: string | null
          asignado_nombre?: string | null
          assignment_scope?: string
          created_at?: string
          created_by?: string | null
          descripcion?: string | null
          fecha_inicio: string
          hora?: string | null
          id?: string
          organization_id: string
          proxima_fecha: string
          repeat_byweekday?: number[] | null
          repeat_frequency?: string | null
          repeat_interval?: number | null
          repeat_preset?: string
          sucursal_id: string
          titulo: string
          updated_at?: string
        }
        Update: {
          activo?: boolean
          asignado_a?: string | null
          asignado_nombre?: string | null
          assignment_scope?: string
          created_at?: string
          created_by?: string | null
          descripcion?: string | null
          fecha_inicio?: string
          hora?: string | null
          id?: string
          organization_id?: string
          proxima_fecha?: string
          repeat_byweekday?: number[] | null
          repeat_frequency?: string | null
          repeat_interval?: number | null
          repeat_preset?: string
          sucursal_id?: string
          titulo?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "tareas_recurrentes_asignado_a_fkey"
            columns: ["asignado_a"]
            isOneToOne: false
            referencedRelation: "barberos"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tareas_recurrentes_asignado_a_fkey"
            columns: ["asignado_a"]
            isOneToOne: false
            referencedRelation: "barberos_safe"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tareas_recurrentes_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tareas_recurrentes_sucursal_id_fkey"
            columns: ["sucursal_id"]
            isOneToOne: false
            referencedRelation: "sucursales"
            referencedColumns: ["id"]
          },
        ]
      }
      turnos: {
        Row: {
          barbero_id: string
          cancelado_at: string | null
          cancelado_motivo: string | null
          cliente_email: string | null
          cliente_id: string | null
          cliente_nombre: string | null
          cliente_telefono: string | null
          created_at: string
          estado: string
          fecha: string
          hora_fin: string
          hora_inicio: string
          id: string
          notas: string | null
          organization_id: string
          rango_horario: unknown
          servicio_id: string
          sucursal_id: string
          timezone: string
          updated_at: string
          user_id: string | null
        }
        Insert: {
          barbero_id: string
          cancelado_at?: string | null
          cancelado_motivo?: string | null
          cliente_email?: string | null
          cliente_id?: string | null
          cliente_nombre?: string | null
          cliente_telefono?: string | null
          created_at?: string
          estado?: string
          fecha: string
          hora_fin: string
          hora_inicio: string
          id?: string
          notas?: string | null
          organization_id: string
          rango_horario?: unknown
          servicio_id: string
          sucursal_id: string
          timezone?: string
          updated_at?: string
          user_id?: string | null
        }
        Update: {
          barbero_id?: string
          cancelado_at?: string | null
          cancelado_motivo?: string | null
          cliente_email?: string | null
          cliente_id?: string | null
          cliente_nombre?: string | null
          cliente_telefono?: string | null
          created_at?: string
          estado?: string
          fecha?: string
          hora_fin?: string
          hora_inicio?: string
          id?: string
          notas?: string | null
          organization_id?: string
          rango_horario?: unknown
          servicio_id?: string
          sucursal_id?: string
          timezone?: string
          updated_at?: string
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "turnos_barbero_id_fkey"
            columns: ["barbero_id"]
            isOneToOne: false
            referencedRelation: "barberos"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "turnos_barbero_id_fkey"
            columns: ["barbero_id"]
            isOneToOne: false
            referencedRelation: "barberos_safe"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "turnos_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "turnos_servicio_id_fkey"
            columns: ["servicio_id"]
            isOneToOne: false
            referencedRelation: "servicios"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "turnos_sucursal_id_fkey"
            columns: ["sucursal_id"]
            isOneToOne: false
            referencedRelation: "sucursales"
            referencedColumns: ["id"]
          },
        ]
      }
      user_notification_preferences: {
        Row: {
          created_at: string
          enabled: boolean
          event_type: string
          id: string
          mode: string | null
          organization_id: string
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          enabled?: boolean
          event_type: string
          id?: string
          mode?: string | null
          organization_id: string
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          enabled?: boolean
          event_type?: string
          id?: string
          mode?: string | null
          organization_id?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      user_onboarding: {
        Row: {
          completed_at: string | null
          completed_steps: string[]
          current_step: string | null
          started_at: string | null
          status: string
          updated_at: string
          user_id: string
        }
        Insert: {
          completed_at?: string | null
          completed_steps?: string[]
          current_step?: string | null
          started_at?: string | null
          status?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          completed_at?: string | null
          completed_steps?: string[]
          current_step?: string | null
          started_at?: string | null
          status?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      user_pins: {
        Row: {
          created_at: string | null
          id: string
          pin_hash: string
          updated_at: string | null
          user_id: string
        }
        Insert: {
          created_at?: string | null
          id?: string
          pin_hash: string
          updated_at?: string | null
          user_id: string
        }
        Update: {
          created_at?: string | null
          id?: string
          pin_hash?: string
          updated_at?: string | null
          user_id?: string
        }
        Relationships: []
      }
      user_roles: {
        Row: {
          created_at: string | null
          id: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Insert: {
          created_at?: string | null
          id?: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Update: {
          created_at?: string | null
          id?: string
          role?: Database["public"]["Enums"]["app_role"]
          user_id?: string
        }
        Relationships: []
      }
      user_sucursales: {
        Row: {
          created_at: string
          id: string
          organization_id: string
          sucursal_id: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          organization_id: string
          sucursal_id: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          organization_id?: string
          sucursal_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "user_sucursales_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "user_sucursales_sucursal_id_fkey"
            columns: ["sucursal_id"]
            isOneToOne: false
            referencedRelation: "sucursales"
            referencedColumns: ["id"]
          },
        ]
      }
      venta: {
        Row: {
          anulado_at: string | null
          anulado_por: string | null
          anulado_por_id: string | null
          barbero_id: string | null
          barbero_nombre: string | null
          created_at: string
          descuento_pct: number | null
          estado: string | null
          fecha_hora: string
          id: string
          metodo_pago: string
          organization_id: string | null
          precio_servicio: number | null
          recargo_total: number
          servicio_id: string | null
          servicio_nombre: string | null
          sucursal_id: string | null
          tipo_venta: string
          total_cobrado: number | null
          total_final: number
        }
        Insert: {
          anulado_at?: string | null
          anulado_por?: string | null
          anulado_por_id?: string | null
          barbero_id?: string | null
          barbero_nombre?: string | null
          created_at?: string
          descuento_pct?: number | null
          estado?: string | null
          fecha_hora?: string
          id?: string
          metodo_pago: string
          organization_id?: string | null
          precio_servicio?: number | null
          recargo_total?: number
          servicio_id?: string | null
          servicio_nombre?: string | null
          sucursal_id?: string | null
          tipo_venta?: string
          total_cobrado?: number | null
          total_final?: number
        }
        Update: {
          anulado_at?: string | null
          anulado_por?: string | null
          anulado_por_id?: string | null
          barbero_id?: string | null
          barbero_nombre?: string | null
          created_at?: string
          descuento_pct?: number | null
          estado?: string | null
          fecha_hora?: string
          id?: string
          metodo_pago?: string
          organization_id?: string | null
          precio_servicio?: number | null
          recargo_total?: number
          servicio_id?: string | null
          servicio_nombre?: string | null
          sucursal_id?: string | null
          tipo_venta?: string
          total_cobrado?: number | null
          total_final?: number
        }
        Relationships: [
          {
            foreignKeyName: "venta_barbero_id_fkey"
            columns: ["barbero_id"]
            isOneToOne: false
            referencedRelation: "barberos"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "venta_barbero_id_fkey"
            columns: ["barbero_id"]
            isOneToOne: false
            referencedRelation: "barberos_safe"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "venta_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "venta_servicio_id_fkey"
            columns: ["servicio_id"]
            isOneToOne: false
            referencedRelation: "servicios"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "venta_sucursal_id_fkey"
            columns: ["sucursal_id"]
            isOneToOne: false
            referencedRelation: "sucursales"
            referencedColumns: ["id"]
          },
        ]
      }
      venta_descuentos_aplicados: {
        Row: {
          barbero_id: string | null
          created_at: string
          descuento_aplica_a: string
          descuento_id: string | null
          descuento_nombre: string
          descuento_tipo: string
          descuento_valor: number
          id: string
          monto_aplicado: number
          organization_id: string
          subtotal_base: number
          sucursal_id: string | null
          venta_id: string
        }
        Insert: {
          barbero_id?: string | null
          created_at?: string
          descuento_aplica_a: string
          descuento_id?: string | null
          descuento_nombre: string
          descuento_tipo: string
          descuento_valor?: number
          id?: string
          monto_aplicado?: number
          organization_id: string
          subtotal_base?: number
          sucursal_id?: string | null
          venta_id: string
        }
        Update: {
          barbero_id?: string | null
          created_at?: string
          descuento_aplica_a?: string
          descuento_id?: string | null
          descuento_nombre?: string
          descuento_tipo?: string
          descuento_valor?: number
          id?: string
          monto_aplicado?: number
          organization_id?: string
          subtotal_base?: number
          sucursal_id?: string | null
          venta_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "venta_descuentos_aplicados_descuento_id_fkey"
            columns: ["descuento_id"]
            isOneToOne: false
            referencedRelation: "descuentos"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "venta_descuentos_aplicados_venta_id_fkey"
            columns: ["venta_id"]
            isOneToOne: false
            referencedRelation: "venta"
            referencedColumns: ["id"]
          },
        ]
      }
      venta_extra: {
        Row: {
          cantidad: number
          extra_id: string
          extra_nombre: string
          id: string
          precio_extra: number
          venta_id: string
        }
        Insert: {
          cantidad?: number
          extra_id: string
          extra_nombre: string
          id?: string
          precio_extra?: number
          venta_id: string
        }
        Update: {
          cantidad?: number
          extra_id?: string
          extra_nombre?: string
          id?: string
          precio_extra?: number
          venta_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "venta_extra_extra_id_fkey"
            columns: ["extra_id"]
            isOneToOne: false
            referencedRelation: "extras"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "venta_extra_venta_id_fkey"
            columns: ["venta_id"]
            isOneToOne: false
            referencedRelation: "venta"
            referencedColumns: ["id"]
          },
        ]
      }
      venta_pagos: {
        Row: {
          base_pago: number | null
          created_at: string
          id: string
          metodo_pago: string
          monto: number
          orden: number
          organization_id: string
          recargo_monto: number
          recargo_pct: number
          sucursal_id: string | null
          venta_id: string
        }
        Insert: {
          base_pago?: number | null
          created_at?: string
          id?: string
          metodo_pago: string
          monto?: number
          orden?: number
          organization_id: string
          recargo_monto?: number
          recargo_pct?: number
          sucursal_id?: string | null
          venta_id: string
        }
        Update: {
          base_pago?: number | null
          created_at?: string
          id?: string
          metodo_pago?: string
          monto?: number
          orden?: number
          organization_id?: string
          recargo_monto?: number
          recargo_pct?: number
          sucursal_id?: string | null
          venta_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "venta_pagos_venta_id_fkey"
            columns: ["venta_id"]
            isOneToOne: false
            referencedRelation: "venta"
            referencedColumns: ["id"]
          },
        ]
      }
      venta_producto: {
        Row: {
          barbero_id: string | null
          cantidad: number
          created_at: string
          id: string
          marca_id: string | null
          marca_nombre: string | null
          organization_id: string
          precio_unitario: number
          producto_id: string
          producto_nombre: string
          producto_sucursal_id: string
          subtotal: number
          sucursal_id: string
          venta_id: string
        }
        Insert: {
          barbero_id?: string | null
          cantidad?: number
          created_at?: string
          id?: string
          marca_id?: string | null
          marca_nombre?: string | null
          organization_id: string
          precio_unitario: number
          producto_id: string
          producto_nombre: string
          producto_sucursal_id: string
          subtotal: number
          sucursal_id: string
          venta_id: string
        }
        Update: {
          barbero_id?: string | null
          cantidad?: number
          created_at?: string
          id?: string
          marca_id?: string | null
          marca_nombre?: string | null
          organization_id?: string
          precio_unitario?: number
          producto_id?: string
          producto_nombre?: string
          producto_sucursal_id?: string
          subtotal?: number
          sucursal_id?: string
          venta_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "venta_producto_producto_id_fkey"
            columns: ["producto_id"]
            isOneToOne: false
            referencedRelation: "productos"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "venta_producto_producto_sucursal_id_fkey"
            columns: ["producto_sucursal_id"]
            isOneToOne: false
            referencedRelation: "productos_sucursal"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "venta_producto_venta_id_fkey"
            columns: ["venta_id"]
            isOneToOne: false
            referencedRelation: "venta"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      barberos_safe: {
        Row: {
          activo: boolean | null
          apellido: string | null
          created_at: string | null
          id: string | null
          nombre: string | null
          organization_id: string | null
          rol_equipo: string | null
          sucursal_id: string | null
          updated_at: string | null
        }
        Insert: {
          activo?: boolean | null
          apellido?: string | null
          created_at?: string | null
          id?: string | null
          nombre?: string | null
          organization_id?: string | null
          rol_equipo?: string | null
          sucursal_id?: string | null
          updated_at?: string | null
        }
        Update: {
          activo?: boolean | null
          apellido?: string | null
          created_at?: string | null
          id?: string | null
          nombre?: string | null
          organization_id?: string | null
          rol_equipo?: string | null
          sucursal_id?: string | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "barberos_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "barberos_sucursal_id_fkey"
            columns: ["sucursal_id"]
            isOneToOne: false
            referencedRelation: "sucursales"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Functions: {
      _assert_can_write_sucursal_catalog: {
        Args: { _org_id: string; _sucursal_id: string }
        Returns: undefined
      }
      _calc_next_tarea_date: {
        Args: {
          _current_date: string
          _repeat_byweekday: number[]
          _repeat_frequency: string
          _repeat_interval: number
          _repeat_preset: string
        }
        Returns: string
      }
      _canon_phone_ar: { Args: { input: string }; Returns: string }
      _notif_actor_account_type: { Args: { _user: string }; Returns: string }
      _notif_actor_name: { Args: { _user: string }; Returns: string }
      _notif_emit: {
        Args: {
          _actor_name: string
          _actor_user_id: string
          _body: string
          _category: string
          _default_enabled: boolean
          _event_key: string
          _event_type: string
          _metadata: Json
          _organization_id: string
          _recipients: string[]
          _source_id: string
          _source_module: string
          _source_table: string
          _sucursal_id: string
          _summary: string
          _title: string
        }
        Returns: undefined
      }
      _notif_emit_sensitive: {
        Args: {
          _actor_user_id: string
          _category: string
          _default_mode: string
          _event_key: string
          _event_type: string
          _metadata: Json
          _organization_id: string
          _recipients: string[]
          _source_id: string
          _source_module: string
          _source_table: string
          _sucursal_id: string
          _summary: string
          _supports_mode: boolean
          _title: string
        }
        Returns: undefined
      }
      _notif_org_admins: { Args: { _org: string }; Returns: string[] }
      _notif_pref_mode: {
        Args: { _default_mode: string; _event_type: string; _user: string }
        Returns: string
      }
      _notif_sucursal_account: {
        Args: { _org: string; _sucursal: string }
        Returns: string[]
      }
      _notif_sucursal_barbers: {
        Args: { _org: string; _sucursal: string }
        Returns: string[]
      }
      _notif_sucursal_managers: {
        Args: { _org: string; _sucursal: string }
        Returns: string[]
      }
      _notif_turno_dispatch: {
        Args: {
          _event_key_suffix: string
          _turno: Database["public"]["Tables"]["turnos"]["Row"]
          _verbo: string
        }
        Returns: undefined
      }
      _notif_turno_metadata: {
        Args: { _turno: Database["public"]["Tables"]["turnos"]["Row"] }
        Returns: Json
      }
      _notif_turno_title: {
        Args: {
          _turno: Database["public"]["Tables"]["turnos"]["Row"]
          _verbo: string
        }
        Returns: string
      }
      barberos_pin_status: {
        Args: { _ids: string[] }
        Returns: {
          has_pin: boolean
          id: string
        }[]
      }
      cerrar_ventas_generales_sucursal: {
        Args: { _fecha: string; _sucursal_id: string }
        Returns: number
      }
      check_org_limit: {
        Args: { _org_id: string; _resource: string }
        Returns: boolean
      }
      clear_sucursal_temp_password: {
        Args: { p_user_id: string }
        Returns: undefined
      }
      create_cliente_with_sucursal: {
        Args: {
          _acepta_marketing?: boolean
          _alergias?: string
          _apellido?: string
          _email?: string
          _fecha_nacimiento?: string
          _instagram?: string
          _nombre: string
          _otra_red_social?: string
          _sucursal_id?: string
          _telefono?: string
          _tiktok?: string
        }
        Returns: string
      }
      current_user_has_pin: { Args: never; Returns: boolean }
      get_user_barbero_id: { Args: { _user_id: string }; Returns: string }
      get_user_barbero_name: { Args: { _user_id: string }; Returns: string }
      get_user_organization_id: { Args: { _user_id: string }; Returns: string }
      get_user_sucursal_ids: { Args: { _user_id: string }; Returns: string[] }
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
      import_clientes_with_sucursal: {
        Args: { _clientes: Json; _sucursal_id: string }
        Returns: Json
      }
      is_sucursal_account: { Args: { _user_id: string }; Returns: boolean }
      notif_emit_action_blocked: {
        Args: { _action_key: string; _sucursal_id: string }
        Returns: undefined
      }
      notif_emit_login_sucursal_account: {
        Args: { _sucursal_id: string }
        Returns: undefined
      }
      notif_emit_pin_authorized: {
        Args: {
          _action_key: string
          _authorized_by_name: string
          _authorized_by_user_id: string
          _sucursal_id: string
        }
        Returns: undefined
      }
      notif_emit_view_event: {
        Args: { _module: string; _sucursal_id: string }
        Returns: undefined
      }
      org_has_any_pin: { Args: never; Returns: boolean }
      process_tareas_recurrentes: { Args: never; Returns: number }
      process_vencimientos_tareas: { Args: never; Returns: number }
      registrar_movimiento_stock: {
        Args: {
          _cantidad: number
          _motivo?: string
          _producto_sucursal_id: string
          _tipo: string
          _venta_id?: string
        }
        Returns: string
      }
      seed_payment_methods_for_org: {
        Args: { _org_id: string }
        Returns: undefined
      }
      set_descuento_sucursal_activo: {
        Args: { _activo: boolean; _id: string }
        Returns: {
          activo: boolean
          created_at: string
          descuento_id: string
          id: string
          organization_id: string
          sucursal_id: string
          updated_at: string
        }
        SetofOptions: {
          from: "*"
          to: "descuentos_sucursales"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      set_extra_sucursal_activo: {
        Args: { _activo: boolean; _id: string }
        Returns: {
          activo: boolean
          created_at: string
          extra_id: string
          id: string
          organization_id: string
          precio: number
          sucursal_id: string
          updated_at: string
        }
        SetofOptions: {
          from: "*"
          to: "extras_sucursales"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      set_extra_sucursal_precio: {
        Args: { _id: string; _precio: number }
        Returns: {
          activo: boolean
          created_at: string
          extra_id: string
          id: string
          organization_id: string
          precio: number
          sucursal_id: string
          updated_at: string
        }
        SetofOptions: {
          from: "*"
          to: "extras_sucursales"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      set_servicio_sucursal_activo: {
        Args: { _activo: boolean; _id: string }
        Returns: {
          activo: boolean
          created_at: string
          id: string
          organization_id: string
          precio: number
          servicio_id: string
          sucursal_id: string
          updated_at: string
        }
        SetofOptions: {
          from: "*"
          to: "servicios_sucursales"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      set_servicio_sucursal_precio: {
        Args: { _id: string; _precio: number }
        Returns: {
          activo: boolean
          created_at: string
          id: string
          organization_id: string
          precio: number
          servicio_id: string
          sucursal_id: string
          updated_at: string
        }
        SetofOptions: {
          from: "*"
          to: "servicios_sucursales"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      soft_delete_cliente: { Args: { _cliente_id: string }; Returns: undefined }
      sucursal_action_requires_pin: {
        Args: {
          _action_key: string
          _organization_id: string
          _sucursal_id: string
        }
        Returns: boolean
      }
      upsert_notification: {
        Args: {
          _actor_account_type?: string
          _actor_name?: string
          _actor_user_id?: string
          _authorized_by_name?: string
          _authorized_by_user_id?: string
          _body: string
          _category?: string
          _deliver_to_caller?: boolean
          _event_key: string
          _expires_at?: string
          _metadata: Json
          _notification_at: string
          _organization_id: string
          _source_id: string
          _source_module: string
          _source_table: string
          _sucursal_id?: string
          _summary?: string
          _title: string
          _type: string
        }
        Returns: {
          actor_account_type: string | null
          actor_name: string | null
          actor_user_id: string | null
          authorized_by_name: string | null
          authorized_by_user_id: string | null
          body: string | null
          category: string | null
          created_at: string
          event_key: string
          expires_at: string | null
          id: string
          metadata: Json
          notification_at: string
          organization_id: string
          source_id: string | null
          source_module: string
          source_table: string | null
          sucursal_id: string | null
          summary: string | null
          title: string
          type: string
          updated_at: string
        }
        SetofOptions: {
          from: "*"
          to: "notifications"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      upsert_notification_delivery: {
        Args: { _notification_id: string; _user_id: string }
        Returns: {
          created_at: string
          hidden_at: string | null
          id: string
          notification_id: string
          organization_id: string
          read_at: string | null
          user_id: string
        }
        SetofOptions: {
          from: "*"
          to: "notification_deliveries"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      user_belongs_to_org: {
        Args: { _org_id: string; _user_id: string }
        Returns: boolean
      }
      validate_portal_links: { Args: { p_links: Json }; Returns: boolean }
    }
    Enums: {
      app_role:
        | "owner"
        | "manager"
        | "barber"
        | "general_manager"
        | "otros"
        | "sucursal_account"
      caja_mov_tipo: "ingreso" | "egreso"
      metodo_pago: "efectivo" | "mercado_pago"
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">]

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] &
        DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] &
        DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R
      }
      ? R
      : never
    : never

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I
      }
      ? I
      : never
    : never

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U
      }
      ? U
      : never
    : never

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    | keyof DefaultSchema["Enums"]
    | { schema: keyof DatabaseWithoutInternals },
  EnumName extends DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never

export const Constants = {
  public: {
    Enums: {
      app_role: [
        "owner",
        "manager",
        "barber",
        "general_manager",
        "otros",
        "sucursal_account",
      ],
      caja_mov_tipo: ["ingreso", "egreso"],
      metodo_pago: ["efectivo", "mercado_pago"],
    },
  },
} as const
