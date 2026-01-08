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
      barbero: {
        Row: {
          activo: boolean
          comision: number
          created_at: string
          direccion: string | null
          dni: string | null
          id: number
          nombre: string
          telefono: string | null
        }
        Insert: {
          activo?: boolean
          comision?: number
          created_at?: string
          direccion?: string | null
          dni?: string | null
          id?: never
          nombre: string
          telefono?: string | null
        }
        Update: {
          activo?: boolean
          comision?: number
          created_at?: string
          direccion?: string | null
          dni?: string | null
          id?: never
          nombre?: string
          telefono?: string | null
        }
        Relationships: []
      }
      caja_movimiento: {
        Row: {
          caja_sesion_id: number
          concepto: string
          creado_en: string
          id: number
          monto: number
          tipo: Database["public"]["Enums"]["caja_mov_tipo"]
        }
        Insert: {
          caja_sesion_id: number
          concepto: string
          creado_en?: string
          id?: never
          monto: number
          tipo: Database["public"]["Enums"]["caja_mov_tipo"]
        }
        Update: {
          caja_sesion_id?: number
          concepto?: string
          creado_en?: string
          id?: never
          monto?: number
          tipo?: Database["public"]["Enums"]["caja_mov_tipo"]
        }
        Relationships: [
          {
            foreignKeyName: "caja_movimiento_caja_sesion_id_fkey"
            columns: ["caja_sesion_id"]
            isOneToOne: false
            referencedRelation: "caja_sesion"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "caja_movimiento_caja_sesion_id_fkey"
            columns: ["caja_sesion_id"]
            isOneToOne: false
            referencedRelation: "v_caja_sesion_resumen"
            referencedColumns: ["caja_sesion_id"]
          },
        ]
      }
      caja_sesion: {
        Row: {
          abierta_en: string
          abierta_por: string
          cerrada_en: string | null
          cerrada_por: string | null
          created_at: string
          id: number
          saldo_final: number | null
          saldo_inicial: number
        }
        Insert: {
          abierta_en?: string
          abierta_por: string
          cerrada_en?: string | null
          cerrada_por?: string | null
          created_at?: string
          id?: never
          saldo_final?: number | null
          saldo_inicial?: number
        }
        Update: {
          abierta_en?: string
          abierta_por?: string
          cerrada_en?: string | null
          cerrada_por?: string | null
          created_at?: string
          id?: never
          saldo_final?: number | null
          saldo_inicial?: number
        }
        Relationships: []
      }
      Egresos: {
        Row: {
          Categoria: string | null
          Descripcion: string | null
          Fecha: string | null
          id: number
          Monto: number | null
        }
        Insert: {
          Categoria?: string | null
          Descripcion?: string | null
          Fecha?: string | null
          id?: number
          Monto?: number | null
        }
        Update: {
          Categoria?: string | null
          Descripcion?: string | null
          Fecha?: string | null
          id?: number
          Monto?: number | null
        }
        Relationships: []
      }
      extra: {
        Row: {
          activo: boolean
          created_at: string
          id: number
          nombre: string
          precio_base: number
        }
        Insert: {
          activo?: boolean
          created_at?: string
          id?: never
          nombre: string
          precio_base: number
        }
        Update: {
          activo?: boolean
          created_at?: string
          id?: never
          nombre?: string
          precio_base?: number
        }
        Relationships: []
      }
      ingresos: {
        Row: {
          barbero: string | null
          cantidad_de_20_por: number | null
          cantidad_de_50_por: number | null
          cantidad_de_servicios: number | null
          created_at: string
          deluxe: number | null
          dia: string | null
          efectivo: number | null
          essencial: number | null
          estado: string | null
          extras: number | null
          id: number
          identificador: string | null
          mp: number | null
          perdida: number | null
          servicios_con_descuento: number | null
          servicios_sin_descuento: number | null
          sueldo: number | null
          total_facturado: number | null
          total_sin_descuento: number | null
          Usuario: string | null
        }
        Insert: {
          barbero?: string | null
          cantidad_de_20_por?: number | null
          cantidad_de_50_por?: number | null
          cantidad_de_servicios?: number | null
          created_at: string
          deluxe?: number | null
          dia?: string | null
          efectivo?: number | null
          essencial?: number | null
          estado?: string | null
          extras?: number | null
          id?: number
          identificador?: string | null
          mp?: number | null
          perdida?: number | null
          servicios_con_descuento?: number | null
          servicios_sin_descuento?: number | null
          sueldo?: number | null
          total_facturado?: number | null
          total_sin_descuento?: number | null
          Usuario?: string | null
        }
        Update: {
          barbero?: string | null
          cantidad_de_20_por?: number | null
          cantidad_de_50_por?: number | null
          cantidad_de_servicios?: number | null
          created_at?: string
          deluxe?: number | null
          dia?: string | null
          efectivo?: number | null
          essencial?: number | null
          estado?: string | null
          extras?: number | null
          id?: number
          identificador?: string | null
          mp?: number | null
          perdida?: number | null
          servicios_con_descuento?: number | null
          servicios_sin_descuento?: number | null
          sueldo?: number | null
          total_facturado?: number | null
          total_sin_descuento?: number | null
          Usuario?: string | null
        }
        Relationships: []
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
          PromDiarioPorBarbero: number | null
          PuntoDeEquilibrioEnCortes: number | null
          Rentabilidad: number | null
          ServiciosPorBarbero: number | null
          ServiciosTotales: number | null
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
          PromDiarioPorBarbero?: number | null
          PuntoDeEquilibrioEnCortes?: number | null
          Rentabilidad?: number | null
          ServiciosPorBarbero?: number | null
          ServiciosTotales?: number | null
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
          PromDiarioPorBarbero?: number | null
          PuntoDeEquilibrioEnCortes?: number | null
          Rentabilidad?: number | null
          ServiciosPorBarbero?: number | null
          ServiciosTotales?: number | null
          TasaDeOcupación?: number | null
          TicketPromedio?: number | null
        }
        Relationships: []
      }
      servicio: {
        Row: {
          activo: boolean
          created_at: string
          id: number
          nombre: string
          precio_base: number
        }
        Insert: {
          activo?: boolean
          created_at?: string
          id?: never
          nombre: string
          precio_base: number
        }
        Update: {
          activo?: boolean
          created_at?: string
          id?: never
          nombre?: string
          precio_base?: number
        }
        Relationships: []
      }
      venta: {
        Row: {
          barbero_id: number
          created_at: string
          descuento_global_pct: number
          fecha_hora: string
          id: number
          metodo_pago: Database["public"]["Enums"]["metodo_pago"]
          observaciones: string | null
          total_final: number
        }
        Insert: {
          barbero_id: number
          created_at?: string
          descuento_global_pct?: number
          fecha_hora?: string
          id?: never
          metodo_pago: Database["public"]["Enums"]["metodo_pago"]
          observaciones?: string | null
          total_final?: number
        }
        Update: {
          barbero_id?: number
          created_at?: string
          descuento_global_pct?: number
          fecha_hora?: string
          id?: never
          metodo_pago?: Database["public"]["Enums"]["metodo_pago"]
          observaciones?: string | null
          total_final?: number
        }
        Relationships: [
          {
            foreignKeyName: "venta_barbero_id_fkey"
            columns: ["barbero_id"]
            isOneToOne: false
            referencedRelation: "barbero"
            referencedColumns: ["id"]
          },
        ]
      }
      venta_servicio: {
        Row: {
          cantidad: number
          created_at: string
          descuento_linea_pct: number
          id: number
          precio_unitario: number
          servicio_id: number
          venta_id: number
        }
        Insert: {
          cantidad?: number
          created_at?: string
          descuento_linea_pct?: number
          id?: never
          precio_unitario: number
          servicio_id: number
          venta_id: number
        }
        Update: {
          cantidad?: number
          created_at?: string
          descuento_linea_pct?: number
          id?: never
          precio_unitario?: number
          servicio_id?: number
          venta_id?: number
        }
        Relationships: [
          {
            foreignKeyName: "venta_servicio_servicio_id_fkey"
            columns: ["servicio_id"]
            isOneToOne: false
            referencedRelation: "servicio"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "venta_servicio_venta_id_fkey"
            columns: ["venta_id"]
            isOneToOne: false
            referencedRelation: "v_venta_total"
            referencedColumns: ["venta_id"]
          },
          {
            foreignKeyName: "venta_servicio_venta_id_fkey"
            columns: ["venta_id"]
            isOneToOne: false
            referencedRelation: "venta"
            referencedColumns: ["id"]
          },
        ]
      }
      venta_servicio_extra: {
        Row: {
          cantidad: number
          created_at: string
          extra_id: number
          id: number
          precio_unitario: number
          venta_servicio_id: number
        }
        Insert: {
          cantidad?: number
          created_at?: string
          extra_id: number
          id?: never
          precio_unitario: number
          venta_servicio_id: number
        }
        Update: {
          cantidad?: number
          created_at?: string
          extra_id?: number
          id?: never
          precio_unitario?: number
          venta_servicio_id?: number
        }
        Relationships: [
          {
            foreignKeyName: "venta_servicio_extra_extra_id_fkey"
            columns: ["extra_id"]
            isOneToOne: false
            referencedRelation: "extra"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "venta_servicio_extra_venta_servicio_id_fkey"
            columns: ["venta_servicio_id"]
            isOneToOne: false
            referencedRelation: "v_venta_linea_total"
            referencedColumns: ["venta_servicio_id"]
          },
          {
            foreignKeyName: "venta_servicio_extra_venta_servicio_id_fkey"
            columns: ["venta_servicio_id"]
            isOneToOne: false
            referencedRelation: "venta_servicio"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      v_caja_sesion_resumen: {
        Row: {
          abierta_en: string | null
          caja_sesion_id: number | null
          cerrada_en: string | null
          egresos_manual: number | null
          ingresos_manual: number | null
          saldo_efectivo_proyectado: number | null
          saldo_inicial: number | null
          ventas_efectivo: number | null
          ventas_mercado_pago: number | null
        }
        Insert: {
          abierta_en?: string | null
          caja_sesion_id?: number | null
          cerrada_en?: string | null
          egresos_manual?: never
          ingresos_manual?: never
          saldo_efectivo_proyectado?: never
          saldo_inicial?: number | null
          ventas_efectivo?: never
          ventas_mercado_pago?: never
        }
        Update: {
          abierta_en?: string | null
          caja_sesion_id?: number | null
          cerrada_en?: string | null
          egresos_manual?: never
          ingresos_manual?: never
          saldo_efectivo_proyectado?: never
          saldo_inicial?: number | null
          ventas_efectivo?: never
          ventas_mercado_pago?: never
        }
        Relationships: []
      }
      v_venta_linea_total: {
        Row: {
          cantidad: number | null
          descuento_linea_pct: number | null
          precio_unitario: number | null
          total_extras: number | null
          total_linea: number | null
          venta_id: number | null
          venta_servicio_id: number | null
        }
        Relationships: [
          {
            foreignKeyName: "venta_servicio_venta_id_fkey"
            columns: ["venta_id"]
            isOneToOne: false
            referencedRelation: "v_venta_total"
            referencedColumns: ["venta_id"]
          },
          {
            foreignKeyName: "venta_servicio_venta_id_fkey"
            columns: ["venta_id"]
            isOneToOne: false
            referencedRelation: "venta"
            referencedColumns: ["id"]
          },
        ]
      }
      v_venta_total: {
        Row: {
          barbero_id: number | null
          descuento_global_pct: number | null
          fecha_hora: string | null
          metodo_pago: Database["public"]["Enums"]["metodo_pago"] | null
          subtotal: number | null
          total_con_descuento: number | null
          venta_id: number | null
        }
        Relationships: [
          {
            foreignKeyName: "venta_barbero_id_fkey"
            columns: ["barbero_id"]
            isOneToOne: false
            referencedRelation: "barbero"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Functions: {
      [_ in never]: never
    }
    Enums: {
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
      caja_mov_tipo: ["ingreso", "egreso"],
      metodo_pago: ["efectivo", "mercado_pago"],
    },
  },
} as const
