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
    PostgrestVersion: "14.5"
  }
  public: {
    Tables: {
      ai_assistant_config: {
        Row: {
          id: string
          system_prompt: string
          updated_at: string
          updated_by: string | null
        }
        Insert: {
          id?: string
          system_prompt?: string
          updated_at?: string
          updated_by?: string | null
        }
        Update: {
          id?: string
          system_prompt?: string
          updated_at?: string
          updated_by?: string | null
        }
        Relationships: []
      }
      ai_knowledge_docs: {
        Row: {
          created_at: string
          file_name: string
          file_path: string
          file_size: number | null
          id: string
          uploaded_by: string | null
        }
        Insert: {
          created_at?: string
          file_name: string
          file_path: string
          file_size?: number | null
          id?: string
          uploaded_by?: string | null
        }
        Update: {
          created_at?: string
          file_name?: string
          file_path?: string
          file_size?: number | null
          id?: string
          uploaded_by?: string | null
        }
        Relationships: []
      }
      attendance_alert_settings: {
        Row: {
          created_at: string
          enable_blink_effect: boolean
          enable_priority_sort: boolean
          enable_sound_alert: boolean
          highlight_critical_conversations: boolean
          id: string
          notify_supervisor_on_red: boolean
          updated_at: string
        }
        Insert: {
          created_at?: string
          enable_blink_effect?: boolean
          enable_priority_sort?: boolean
          enable_sound_alert?: boolean
          highlight_critical_conversations?: boolean
          id?: string
          notify_supervisor_on_red?: boolean
          updated_at?: string
        }
        Update: {
          created_at?: string
          enable_blink_effect?: boolean
          enable_priority_sort?: boolean
          enable_sound_alert?: boolean
          highlight_critical_conversations?: boolean
          id?: string
          notify_supervisor_on_red?: boolean
          updated_at?: string
        }
        Relationships: []
      }
      attendance_metric_settings: {
        Row: {
          created_at: string
          id: string
          show_agent_productivity: boolean
          show_attention_count: boolean
          show_avg_interaction_time: boolean
          show_avg_transfer_time: boolean
          show_critical_count: boolean
          show_first_response_time: boolean
          show_queue_time: boolean
          show_reopen_rate: boolean
          show_risk_count: boolean
          show_sector_congestion: boolean
          show_total_service_time: boolean
          show_transfer_rate: boolean
          updated_at: string
        }
        Insert: {
          created_at?: string
          id?: string
          show_agent_productivity?: boolean
          show_attention_count?: boolean
          show_avg_interaction_time?: boolean
          show_avg_transfer_time?: boolean
          show_critical_count?: boolean
          show_first_response_time?: boolean
          show_queue_time?: boolean
          show_reopen_rate?: boolean
          show_risk_count?: boolean
          show_sector_congestion?: boolean
          show_total_service_time?: boolean
          show_transfer_rate?: boolean
          updated_at?: string
        }
        Update: {
          created_at?: string
          id?: string
          show_agent_productivity?: boolean
          show_attention_count?: boolean
          show_avg_interaction_time?: boolean
          show_avg_transfer_time?: boolean
          show_critical_count?: boolean
          show_first_response_time?: boolean
          show_queue_time?: boolean
          show_reopen_rate?: boolean
          show_risk_count?: boolean
          show_sector_congestion?: boolean
          show_total_service_time?: boolean
          show_transfer_rate?: boolean
          updated_at?: string
        }
        Relationships: []
      }
      attendance_sla_rules: {
        Row: {
          created_at: string
          green_color: string
          green_limit_minutes: number
          id: string
          is_active: boolean
          orange_color: string
          orange_limit_minutes: number
          red_color: string
          red_limit_minutes: number
          rule_name: string
          sector_name: string
          time_reference: string
          updated_at: string
          yellow_color: string
          yellow_limit_minutes: number
        }
        Insert: {
          created_at?: string
          green_color?: string
          green_limit_minutes?: number
          id?: string
          is_active?: boolean
          orange_color?: string
          orange_limit_minutes?: number
          red_color?: string
          red_limit_minutes?: number
          rule_name: string
          sector_name: string
          time_reference?: string
          updated_at?: string
          yellow_color?: string
          yellow_limit_minutes?: number
        }
        Update: {
          created_at?: string
          green_color?: string
          green_limit_minutes?: number
          id?: string
          is_active?: boolean
          orange_color?: string
          orange_limit_minutes?: number
          red_color?: string
          red_limit_minutes?: number
          rule_name?: string
          sector_name?: string
          time_reference?: string
          updated_at?: string
          yellow_color?: string
          yellow_limit_minutes?: number
        }
        Relationships: []
      }
      attendance_visual_settings: {
        Row: {
          created_at: string
          critical_effect: string
          highlight_style: string
          id: string
          show_clock: boolean
          show_sla_banner: boolean
          show_status_badge: boolean
          updated_at: string
        }
        Insert: {
          created_at?: string
          critical_effect?: string
          highlight_style?: string
          id?: string
          show_clock?: boolean
          show_sla_banner?: boolean
          show_status_badge?: boolean
          updated_at?: string
        }
        Update: {
          created_at?: string
          critical_effect?: string
          highlight_style?: string
          id?: string
          show_clock?: boolean
          show_sla_banner?: boolean
          show_status_badge?: boolean
          updated_at?: string
        }
        Relationships: []
      }
      audit_logs: {
        Row: {
          action: string
          created_at: string
          details: Json | null
          entity_id: string | null
          entity_type: string
          id: string
          user_id: string | null
        }
        Insert: {
          action: string
          created_at?: string
          details?: Json | null
          entity_id?: string | null
          entity_type: string
          id?: string
          user_id?: string | null
        }
        Update: {
          action?: string
          created_at?: string
          details?: Json | null
          entity_id?: string | null
          entity_type?: string
          id?: string
          user_id?: string | null
        }
        Relationships: []
      }
      auto_tickets: {
        Row: {
          created_at: string
          current_quantity: number
          id: string
          item_name: string
          min_quantity: number
          resolved_at: string | null
          rule_id: string | null
          status: Database["public"]["Enums"]["ticket_status"]
        }
        Insert: {
          created_at?: string
          current_quantity: number
          id?: string
          item_name: string
          min_quantity: number
          resolved_at?: string | null
          rule_id?: string | null
          status?: Database["public"]["Enums"]["ticket_status"]
        }
        Update: {
          created_at?: string
          current_quantity?: number
          id?: string
          item_name?: string
          min_quantity?: number
          resolved_at?: string | null
          rule_id?: string | null
          status?: Database["public"]["Enums"]["ticket_status"]
        }
        Relationships: [
          {
            foreignKeyName: "auto_tickets_rule_id_fkey"
            columns: ["rule_id"]
            isOneToOne: false
            referencedRelation: "inventory_min_rules"
            referencedColumns: ["id"]
          },
        ]
      }
      channels: {
        Row: {
          created_at: string
          created_by: string | null
          id: string
          is_active: boolean
          name: string
          organization_id: string | null
          platform: string
          token: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          id?: string
          is_active?: boolean
          name: string
          organization_id?: string | null
          platform?: string
          token: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          created_by?: string | null
          id?: string
          is_active?: boolean
          name?: string
          organization_id?: string | null
          platform?: string
          token?: string
          updated_at?: string
        }
        Relationships: []
      }
      companies: {
        Row: {
          cnpj: string | null
          contacts: Json | null
          created_at: string
          emails: string[] | null
          id: string
          instructions: string | null
          name: string
          notes: string | null
          phone: string | null
          updated_at: string
        }
        Insert: {
          cnpj?: string | null
          contacts?: Json | null
          created_at?: string
          emails?: string[] | null
          id?: string
          instructions?: string | null
          name: string
          notes?: string | null
          phone?: string | null
          updated_at?: string
        }
        Update: {
          cnpj?: string | null
          contacts?: Json | null
          created_at?: string
          emails?: string[] | null
          id?: string
          instructions?: string | null
          name?: string
          notes?: string | null
          phone?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      company_phones: {
        Row: {
          company_id: string
          created_at: string
          id: string
          phone_number: string
        }
        Insert: {
          company_id: string
          created_at?: string
          id?: string
          phone_number: string
        }
        Update: {
          company_id?: string
          created_at?: string
          id?: string
          phone_number?: string
        }
        Relationships: [
          {
            foreignKeyName: "company_phones_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
        ]
      }
      crm_categories: {
        Row: {
          created_at: string
          description: string | null
          id: string
          name: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          description?: string | null
          id?: string
          name: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          description?: string | null
          id?: string
          name?: string
          updated_at?: string
        }
        Relationships: []
      }
      crm_contacts: {
        Row: {
          category_id: string | null
          company_id: string | null
          created_at: string
          created_by: string | null
          email: string | null
          id: string
          name: string
          notes: string | null
          phone: string
          updated_at: string
        }
        Insert: {
          category_id?: string | null
          company_id?: string | null
          created_at?: string
          created_by?: string | null
          email?: string | null
          id?: string
          name: string
          notes?: string | null
          phone: string
          updated_at?: string
        }
        Update: {
          category_id?: string | null
          company_id?: string | null
          created_at?: string
          created_by?: string | null
          email?: string | null
          id?: string
          name?: string
          notes?: string | null
          phone?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "crm_contacts_category_id_fkey"
            columns: ["category_id"]
            isOneToOne: false
            referencedRelation: "crm_categories"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "crm_contacts_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
        ]
      }
      entity_links: {
        Row: {
          channel_id: string | null
          created_at: string
          entity_type: string
          external_id: string
          id: string
          local_id: string
          metadata: Json | null
        }
        Insert: {
          channel_id?: string | null
          created_at?: string
          entity_type: string
          external_id: string
          id?: string
          local_id: string
          metadata?: Json | null
        }
        Update: {
          channel_id?: string | null
          created_at?: string
          entity_type?: string
          external_id?: string
          id?: string
          local_id?: string
          metadata?: Json | null
        }
        Relationships: [
          {
            foreignKeyName: "entity_links_channel_id_fkey"
            columns: ["channel_id"]
            isOneToOne: false
            referencedRelation: "channels"
            referencedColumns: ["id"]
          },
        ]
      }
      integration_logs: {
        Row: {
          channel_id: string | null
          created_at: string
          endpoint: string
          error_code: string | null
          error_message: string | null
          id: string
          method: string
          response_time_ms: number | null
          status_code: number | null
        }
        Insert: {
          channel_id?: string | null
          created_at?: string
          endpoint: string
          error_code?: string | null
          error_message?: string | null
          id?: string
          method?: string
          response_time_ms?: number | null
          status_code?: number | null
        }
        Update: {
          channel_id?: string | null
          created_at?: string
          endpoint?: string
          error_code?: string | null
          error_message?: string | null
          id?: string
          method?: string
          response_time_ms?: number | null
          status_code?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "integration_logs_channel_id_fkey"
            columns: ["channel_id"]
            isOneToOne: false
            referencedRelation: "channels"
            referencedColumns: ["id"]
          },
        ]
      }
      inventory_categories: {
        Row: {
          created_at: string
          description: string | null
          id: string
          name: string
        }
        Insert: {
          created_at?: string
          description?: string | null
          id?: string
          name: string
        }
        Update: {
          created_at?: string
          description?: string | null
          id?: string
          name?: string
        }
        Relationships: []
      }
      inventory_items: {
        Row: {
          category_id: string
          created_at: string
          id: string
          linked_at: string | null
          linked_to: string | null
          model: string | null
          name: string
          notes: string | null
          serial_number: string | null
          status: Database["public"]["Enums"]["inventory_status"]
          updated_at: string
        }
        Insert: {
          category_id: string
          created_at?: string
          id?: string
          linked_at?: string | null
          linked_to?: string | null
          model?: string | null
          name: string
          notes?: string | null
          serial_number?: string | null
          status?: Database["public"]["Enums"]["inventory_status"]
          updated_at?: string
        }
        Update: {
          category_id?: string
          created_at?: string
          id?: string
          linked_at?: string | null
          linked_to?: string | null
          model?: string | null
          name?: string
          notes?: string | null
          serial_number?: string | null
          status?: Database["public"]["Enums"]["inventory_status"]
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "inventory_items_category_id_fkey"
            columns: ["category_id"]
            isOneToOne: false
            referencedRelation: "inventory_categories"
            referencedColumns: ["id"]
          },
        ]
      }
      inventory_min_rules: {
        Row: {
          auto_ticket: boolean
          category_id: string | null
          created_at: string
          id: string
          item_name: string
          min_quantity: number
        }
        Insert: {
          auto_ticket?: boolean
          category_id?: string | null
          created_at?: string
          id?: string
          item_name: string
          min_quantity?: number
        }
        Update: {
          auto_ticket?: boolean
          category_id?: string | null
          created_at?: string
          id?: string
          item_name?: string
          min_quantity?: number
        }
        Relationships: [
          {
            foreignKeyName: "inventory_min_rules_category_id_fkey"
            columns: ["category_id"]
            isOneToOne: false
            referencedRelation: "inventory_categories"
            referencedColumns: ["id"]
          },
        ]
      }
      inventory_movements: {
        Row: {
          created_at: string
          created_by: string | null
          id: string
          item_id: string
          notes: string | null
          quantity: number
          type: Database["public"]["Enums"]["movement_type"]
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          id?: string
          item_id: string
          notes?: string | null
          quantity?: number
          type: Database["public"]["Enums"]["movement_type"]
        }
        Update: {
          created_at?: string
          created_by?: string | null
          id?: string
          item_id?: string
          notes?: string | null
          quantity?: number
          type?: Database["public"]["Enums"]["movement_type"]
        }
        Relationships: [
          {
            foreignKeyName: "inventory_movements_item_id_fkey"
            columns: ["item_id"]
            isOneToOne: false
            referencedRelation: "inventory_items"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          avatar_url: string | null
          created_at: string
          id: string
          name: string
          updated_at: string
          user_id: string
        }
        Insert: {
          avatar_url?: string | null
          created_at?: string
          id?: string
          name?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          avatar_url?: string | null
          created_at?: string
          id?: string
          name?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      service_tickets: {
        Row: {
          attendance_id: string
          channel_id: string | null
          closed_at: string | null
          company_id: string | null
          contact_name: string | null
          contact_phone: string | null
          created_at: string
          id: string
          notes: string | null
          opened_by: string | null
          pendencia_key: string | null
          plate: string | null
          status: Database["public"]["Enums"]["service_ticket_status"]
          updated_at: string
        }
        Insert: {
          attendance_id: string
          channel_id?: string | null
          closed_at?: string | null
          company_id?: string | null
          contact_name?: string | null
          contact_phone?: string | null
          created_at?: string
          id?: string
          notes?: string | null
          opened_by?: string | null
          pendencia_key?: string | null
          plate?: string | null
          status?: Database["public"]["Enums"]["service_ticket_status"]
          updated_at?: string
        }
        Update: {
          attendance_id?: string
          channel_id?: string | null
          closed_at?: string | null
          company_id?: string | null
          contact_name?: string | null
          contact_phone?: string | null
          created_at?: string
          id?: string
          notes?: string | null
          opened_by?: string | null
          pendencia_key?: string | null
          plate?: string | null
          status?: Database["public"]["Enums"]["service_ticket_status"]
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "service_tickets_channel_id_fkey"
            columns: ["channel_id"]
            isOneToOne: false
            referencedRelation: "channels"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "service_tickets_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
        ]
      }
      sub_clients: {
        Row: {
          company_id: string
          created_at: string
          created_by: string | null
          email: string | null
          id: string
          name: string
          notes: string | null
          phone: string
          updated_at: string
        }
        Insert: {
          company_id: string
          created_at?: string
          created_by?: string | null
          email?: string | null
          id?: string
          name: string
          notes?: string | null
          phone: string
          updated_at?: string
        }
        Update: {
          company_id?: string
          created_at?: string
          created_by?: string | null
          email?: string | null
          id?: string
          name?: string
          notes?: string | null
          phone?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "sub_clients_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
        ]
      }
      user_gsystem_links: {
        Row: {
          channel_id: string | null
          created_at: string
          gsystem_user_id: string
          gsystem_user_name: string
          id: string
          updated_at: string
          user_id: string
        }
        Insert: {
          channel_id?: string | null
          created_at?: string
          gsystem_user_id: string
          gsystem_user_name?: string
          id?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          channel_id?: string | null
          created_at?: string
          gsystem_user_id?: string
          gsystem_user_name?: string
          id?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "user_gsystem_links_channel_id_fkey"
            columns: ["channel_id"]
            isOneToOne: false
            referencedRelation: "channels"
            referencedColumns: ["id"]
          },
        ]
      }
      user_roles: {
        Row: {
          created_at: string
          id: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          role?: Database["public"]["Enums"]["app_role"]
          user_id?: string
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
    }
    Enums: {
      app_role: "admin" | "gestor" | "atendente"
      inventory_status: "disponivel" | "vinculado"
      movement_type: "entrada" | "saida"
      service_ticket_status: "aberto" | "em_andamento" | "finalizado"
      ticket_status: "aberto" | "resolvido"
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
      app_role: ["admin", "gestor", "atendente"],
      inventory_status: ["disponivel", "vinculado"],
      movement_type: ["entrada", "saida"],
      service_ticket_status: ["aberto", "em_andamento", "finalizado"],
      ticket_status: ["aberto", "resolvido"],
    },
  },
} as const
