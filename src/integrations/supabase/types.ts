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
      barberos: {
        Row: {
          activo: boolean
          apellido: string
          comision: number
          created_at: string
          dni: string | null
          id: string
          nombre: string
          telefono: string | null
          updated_at: string
        }
        Insert: {
          activo?: boolean
          apellido: string
          comision?: number
          created_at?: string
          dni?: string | null
          id?: string
          nombre: string
          telefono?: string | null
          updated_at?: string
        }
        Update: {
          activo?: boolean
          apellido?: string
          comision?: number
          created_at?: string
          dni?: string | null
          id?: string
          nombre?: string
          telefono?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      descuentos: {
        Row: {
          activo: boolean
          created_at: string
          id: string
          nombre: string
          tipo: string
          updated_at: string
          valor: number
        }
        Insert: {
          activo?: boolean
          created_at?: string
          id?: string
          nombre: string
          tipo: string
          updated_at?: string
          valor?: number
        }
        Update: {
          activo?: boolean
          created_at?: string
          id?: string
          nombre?: string
          tipo?: string
          updated_at?: string
          valor?: number
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
      extras: {
        Row: {
          activo: boolean
          created_at: string
          id: string
          nombre: string
          precio: number
          updated_at: string
        }
        Insert: {
          activo?: boolean
          created_at?: string
          id?: string
          nombre: string
          precio?: number
          updated_at?: string
        }
        Update: {
          activo?: boolean
          created_at?: string
          id?: string
          nombre?: string
          precio?: number
          updated_at?: string
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
          servicios_por_linea: Json | null
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
          servicios_por_linea?: Json | null
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
          servicios_por_linea?: Json | null
          servicios_sin_descuento?: number | null
          sueldo?: number | null
          total_facturado?: number | null
          total_sin_descuento?: number | null
          Usuario?: string | null
        }
        Relationships: []
      }
      lineas: {
        Row: {
          activo: boolean
          created_at: string
          id: string
          nombre: string
          updated_at: string
        }
        Insert: {
          activo?: boolean
          created_at?: string
          id?: string
          nombre: string
          updated_at?: string
        }
        Update: {
          activo?: boolean
          created_at?: string
          id?: string
          nombre?: string
          updated_at?: string
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
      servicios: {
        Row: {
          activo: boolean
          created_at: string
          id: string
          linea_id: string | null
          nombre: string
          precio: number
          updated_at: string
        }
        Insert: {
          activo?: boolean
          created_at?: string
          id?: string
          linea_id?: string | null
          nombre: string
          precio?: number
          updated_at?: string
        }
        Update: {
          activo?: boolean
          created_at?: string
          id?: string
          linea_id?: string | null
          nombre?: string
          precio?: number
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
        ]
      }
      venta: {
        Row: {
          barbero_id: string
          barbero_nombre: string
          created_at: string
          descuento_pct: number | null
          fecha_hora: string
          id: string
          metodo_pago: string
          precio_servicio: number
          servicio_id: string
          servicio_nombre: string
          total_final: number
        }
        Insert: {
          barbero_id: string
          barbero_nombre: string
          created_at?: string
          descuento_pct?: number | null
          fecha_hora?: string
          id?: string
          metodo_pago: string
          precio_servicio?: number
          servicio_id: string
          servicio_nombre: string
          total_final?: number
        }
        Update: {
          barbero_id?: string
          barbero_nombre?: string
          created_at?: string
          descuento_pct?: number | null
          fecha_hora?: string
          id?: string
          metodo_pago?: string
          precio_servicio?: number
          servicio_id?: string
          servicio_nombre?: string
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
            foreignKeyName: "venta_servicio_id_fkey"
            columns: ["servicio_id"]
            isOneToOne: false
            referencedRelation: "servicios"
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
    }
    Views: {
      [_ in never]: never
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
