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
          is_enabled: boolean
          system_prompt: string
          updated_at: string
          updated_by: string | null
        }
        Insert: {
          id?: string
          is_enabled?: boolean
          system_prompt?: string
          updated_at?: string
          updated_by?: string | null
        }
        Update: {
          id?: string
          is_enabled?: boolean
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
      attendance_event_logs: {
        Row: {
          chat_id: string | null
          created_at: string
          event_type: string
          from_band: string | null
          id: string
          message: string
          metadata: Json
          to_band: string | null
          user_id: string | null
        }
        Insert: {
          chat_id?: string | null
          created_at?: string
          event_type: string
          from_band?: string | null
          id?: string
          message?: string
          metadata?: Json
          to_band?: string | null
          user_id?: string | null
        }
        Update: {
          chat_id?: string | null
          created_at?: string
          event_type?: string
          from_band?: string | null
          id?: string
          message?: string
          metadata?: Json
          to_band?: string | null
          user_id?: string | null
        }
        Relationships: []
      }
      attendance_event_settings: {
        Row: {
          created_at: string
          daily_review_enabled: boolean
          daily_review_message: string
          daily_review_sound: boolean
          daily_review_time: string
          id: string
          sla_band_change_enabled: boolean
          sla_band_change_sound: boolean
          updated_at: string
        }
        Insert: {
          created_at?: string
          daily_review_enabled?: boolean
          daily_review_message?: string
          daily_review_sound?: boolean
          daily_review_time?: string
          id?: string
          sla_band_change_enabled?: boolean
          sla_band_change_sound?: boolean
          updated_at?: string
        }
        Update: {
          created_at?: string
          daily_review_enabled?: boolean
          daily_review_message?: string
          daily_review_sound?: boolean
          daily_review_time?: string
          id?: string
          sla_band_change_enabled?: boolean
          sla_band_change_sound?: boolean
          updated_at?: string
        }
        Relationships: []
      }
      attendance_flow_history: {
        Row: {
          attendance_flow_instance_id: string
          created_at: string
          decision_value: string | null
          from_step_id: string | null
          id: string
          moved_by_user_id: string | null
          movement_reason: string | null
          to_step_id: string | null
        }
        Insert: {
          attendance_flow_instance_id: string
          created_at?: string
          decision_value?: string | null
          from_step_id?: string | null
          id?: string
          moved_by_user_id?: string | null
          movement_reason?: string | null
          to_step_id?: string | null
        }
        Update: {
          attendance_flow_instance_id?: string
          created_at?: string
          decision_value?: string | null
          from_step_id?: string | null
          id?: string
          moved_by_user_id?: string | null
          movement_reason?: string | null
          to_step_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "attendance_flow_history_attendance_flow_instance_id_fkey"
            columns: ["attendance_flow_instance_id"]
            isOneToOne: false
            referencedRelation: "attendance_flow_instances"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "attendance_flow_history_from_step_id_fkey"
            columns: ["from_step_id"]
            isOneToOne: false
            referencedRelation: "service_flow_steps"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "attendance_flow_history_to_step_id_fkey"
            columns: ["to_step_id"]
            isOneToOne: false
            referencedRelation: "service_flow_steps"
            referencedColumns: ["id"]
          },
        ]
      }
      attendance_flow_instances: {
        Row: {
          attendance_id: string
          current_step_id: string | null
          finished_at: string | null
          flow_id: string
          id: string
          started_at: string
          status: Database["public"]["Enums"]["flow_instance_status"]
        }
        Insert: {
          attendance_id: string
          current_step_id?: string | null
          finished_at?: string | null
          flow_id: string
          id?: string
          started_at?: string
          status?: Database["public"]["Enums"]["flow_instance_status"]
        }
        Update: {
          attendance_id?: string
          current_step_id?: string | null
          finished_at?: string | null
          flow_id?: string
          id?: string
          started_at?: string
          status?: Database["public"]["Enums"]["flow_instance_status"]
        }
        Relationships: [
          {
            foreignKeyName: "attendance_flow_instances_current_step_id_fkey"
            columns: ["current_step_id"]
            isOneToOne: false
            referencedRelation: "service_flow_steps"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "attendance_flow_instances_flow_id_fkey"
            columns: ["flow_id"]
            isOneToOne: false
            referencedRelation: "service_flows"
            referencedColumns: ["id"]
          },
        ]
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
      business_hours_settings: {
        Row: {
          cooldown_minutes: number
          created_at: string
          holidays: Json
          id: string
          is_enabled: boolean
          out_of_hours_message: string
          schedule: Json
          timezone: string
          updated_at: string
          updated_by: string | null
        }
        Insert: {
          cooldown_minutes?: number
          created_at?: string
          holidays?: Json
          id?: string
          is_enabled?: boolean
          out_of_hours_message?: string
          schedule?: Json
          timezone?: string
          updated_at?: string
          updated_by?: string | null
        }
        Update: {
          cooldown_minutes?: number
          created_at?: string
          holidays?: Json
          id?: string
          is_enabled?: boolean
          out_of_hours_message?: string
          schedule?: Json
          timezone?: string
          updated_at?: string
          updated_by?: string | null
        }
        Relationships: []
      }
      category_routing_rules: {
        Row: {
          auto_create_ticket: boolean
          category_key: string
          category_label: string
          created_at: string
          id: string
          is_active: boolean
          target_sector_id: string
          target_sector_name: string
          updated_at: string
        }
        Insert: {
          auto_create_ticket?: boolean
          category_key: string
          category_label?: string
          created_at?: string
          id?: string
          is_active?: boolean
          target_sector_id?: string
          target_sector_name?: string
          updated_at?: string
        }
        Update: {
          auto_create_ticket?: boolean
          category_key?: string
          category_label?: string
          created_at?: string
          id?: string
          is_active?: boolean
          target_sector_id?: string
          target_sector_name?: string
          updated_at?: string
        }
        Relationships: []
      }
      channels: {
        Row: {
          bot_mode: string | null
          created_at: string
          created_by: string | null
          id: string
          is_active: boolean
          name: string
          organization_id: string | null
          platform: string
          token: string
          updated_at: string
          webhook_secret: string | null
          zapi_client_token: string | null
          zapi_instance_id: string | null
        }
        Insert: {
          bot_mode?: string | null
          created_at?: string
          created_by?: string | null
          id?: string
          is_active?: boolean
          name: string
          organization_id?: string | null
          platform?: string
          token: string
          updated_at?: string
          webhook_secret?: string | null
          zapi_client_token?: string | null
          zapi_instance_id?: string | null
        }
        Update: {
          bot_mode?: string | null
          created_at?: string
          created_by?: string | null
          id?: string
          is_active?: boolean
          name?: string
          organization_id?: string | null
          platform?: string
          token?: string
          updated_at?: string
          webhook_secret?: string | null
          zapi_client_token?: string | null
          zapi_instance_id?: string | null
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
      company_observations: {
        Row: {
          author_name: string
          company_id: string
          content: string
          created_at: string
          created_by: string | null
          id: string
        }
        Insert: {
          author_name?: string
          company_id: string
          content: string
          created_at?: string
          created_by?: string | null
          id?: string
        }
        Update: {
          author_name?: string
          company_id?: string
          content?: string
          created_at?: string
          created_by?: string | null
          id?: string
        }
        Relationships: [
          {
            foreignKeyName: "company_observations_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
        ]
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
          contact_type: string
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
          contact_type?: string
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
          contact_type?: string
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
      daily_motivational_quotes: {
        Row: {
          author: string | null
          content: string
          created_at: string
          id: string
          quote_date: string
          user_id: string | null
        }
        Insert: {
          author?: string | null
          content: string
          created_at?: string
          id?: string
          quote_date: string
          user_id?: string | null
        }
        Update: {
          author?: string | null
          content?: string
          created_at?: string
          id?: string
          quote_date?: string
          user_id?: string | null
        }
        Relationships: []
      }
      daily_welcome_settings: {
        Row: {
          greeting_text: string
          id: string
          is_enabled: boolean
          manual_quote: string | null
          manual_quote_author: string | null
          quote_source: string
          reset_hour: number
          show_quote: boolean
          show_reminders: boolean
          show_tasks: boolean
          show_tickets: boolean
          updated_at: string
          updated_by: string | null
        }
        Insert: {
          greeting_text?: string
          id?: string
          is_enabled?: boolean
          manual_quote?: string | null
          manual_quote_author?: string | null
          quote_source?: string
          reset_hour?: number
          show_quote?: boolean
          show_reminders?: boolean
          show_tasks?: boolean
          show_tickets?: boolean
          updated_at?: string
          updated_by?: string | null
        }
        Update: {
          greeting_text?: string
          id?: string
          is_enabled?: boolean
          manual_quote?: string | null
          manual_quote_author?: string | null
          quote_source?: string
          reset_hour?: number
          show_quote?: boolean
          show_reminders?: boolean
          show_tasks?: boolean
          show_tickets?: boolean
          updated_at?: string
          updated_by?: string | null
        }
        Relationships: []
      }
      email_channels: {
        Row: {
          created_at: string
          created_by: string | null
          default_priority: Database["public"]["Enums"]["ticket_priority"]
          default_sector: string | null
          email_address: string
          id: string
          ignore_domains: string[] | null
          ignore_emails: string[] | null
          is_active: boolean
          last_poll_error: string | null
          last_poll_status: string | null
          last_polled_at: string | null
          mark_as_read: boolean
          name: string
          polling_enabled: boolean
          updated_at: string
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          default_priority?: Database["public"]["Enums"]["ticket_priority"]
          default_sector?: string | null
          email_address: string
          id?: string
          ignore_domains?: string[] | null
          ignore_emails?: string[] | null
          is_active?: boolean
          last_poll_error?: string | null
          last_poll_status?: string | null
          last_polled_at?: string | null
          mark_as_read?: boolean
          name: string
          polling_enabled?: boolean
          updated_at?: string
        }
        Update: {
          created_at?: string
          created_by?: string | null
          default_priority?: Database["public"]["Enums"]["ticket_priority"]
          default_sector?: string | null
          email_address?: string
          id?: string
          ignore_domains?: string[] | null
          ignore_emails?: string[] | null
          is_active?: boolean
          last_poll_error?: string | null
          last_poll_status?: string | null
          last_polled_at?: string | null
          mark_as_read?: boolean
          name?: string
          polling_enabled?: boolean
          updated_at?: string
        }
        Relationships: []
      }
      email_processed: {
        Row: {
          email_channel_id: string
          from_address: string | null
          id: string
          internet_message_id: string | null
          message_id: string
          processed_at: string
          received_at: string | null
          subject: string | null
          ticket_id: string | null
        }
        Insert: {
          email_channel_id: string
          from_address?: string | null
          id?: string
          internet_message_id?: string | null
          message_id: string
          processed_at?: string
          received_at?: string | null
          subject?: string | null
          ticket_id?: string | null
        }
        Update: {
          email_channel_id?: string
          from_address?: string | null
          id?: string
          internet_message_id?: string | null
          message_id?: string
          processed_at?: string
          received_at?: string | null
          subject?: string | null
          ticket_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "email_processed_email_channel_id_fkey"
            columns: ["email_channel_id"]
            isOneToOne: false
            referencedRelation: "email_channels"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "email_processed_ticket_id_fkey"
            columns: ["ticket_id"]
            isOneToOne: false
            referencedRelation: "service_tickets"
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
      liberacao_equipamento_items: {
        Row: {
          created_at: string
          description: string | null
          id: string
          is_active: boolean
          name: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          description?: string | null
          id?: string
          is_active?: boolean
          name: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          description?: string | null
          id?: string
          is_active?: boolean
          name?: string
          updated_at?: string
        }
        Relationships: []
      }
      notifications: {
        Row: {
          created_at: string
          id: string
          is_read: boolean
          message: string
          metadata: Json | null
          ticket_id: string | null
          title: string
          type: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          is_read?: boolean
          message?: string
          metadata?: Json | null
          ticket_id?: string | null
          title: string
          type: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          is_read?: boolean
          message?: string
          metadata?: Json | null
          ticket_id?: string | null
          title?: string
          type?: string
          user_id?: string
        }
        Relationships: []
      }
      out_of_hours_message_log: {
        Row: {
          chat_id: string | null
          contact_phone: string
          id: string
          message_sent: string
          sent_at: string
        }
        Insert: {
          chat_id?: string | null
          contact_phone: string
          id?: string
          message_sent: string
          sent_at?: string
        }
        Update: {
          chat_id?: string | null
          contact_phone?: string
          id?: string
          message_sent?: string
          sent_at?: string
        }
        Relationships: []
      }
      profiles: {
        Row: {
          attendance_target_minutes: number | null
          avatar_url: string | null
          created_at: string
          group_id: string | null
          id: string
          name: string
          updated_at: string
          user_id: string
        }
        Insert: {
          attendance_target_minutes?: number | null
          avatar_url?: string | null
          created_at?: string
          group_id?: string | null
          id?: string
          name?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          attendance_target_minutes?: number | null
          avatar_url?: string | null
          created_at?: string
          group_id?: string | null
          id?: string
          name?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "profiles_group_id_fkey"
            columns: ["group_id"]
            isOneToOne: false
            referencedRelation: "sector_groups"
            referencedColumns: ["id"]
          },
        ]
      }
      sector_groups: {
        Row: {
          created_at: string
          description: string | null
          id: string
          is_active: boolean
          name: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          description?: string | null
          id?: string
          is_active?: boolean
          name: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          description?: string | null
          id?: string
          is_active?: boolean
          name?: string
          updated_at?: string
        }
        Relationships: []
      }
      sectors: {
        Row: {
          created_at: string
          description: string | null
          group_id: string | null
          id: string
          is_active: boolean
          name: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          description?: string | null
          group_id?: string | null
          id?: string
          is_active?: boolean
          name: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          description?: string | null
          group_id?: string | null
          id?: string
          is_active?: boolean
          name?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "sectors_group_id_fkey"
            columns: ["group_id"]
            isOneToOne: false
            referencedRelation: "sector_groups"
            referencedColumns: ["id"]
          },
        ]
      }
      service_flow_step_rules: {
        Row: {
          allowed_roles: string[] | null
          can_finalize: boolean
          created_at: string
          decision_options: string[] | null
          finalization_requires_decision: boolean
          id: string
          required_fields: string[] | null
          step_id: string
          updated_at: string
        }
        Insert: {
          allowed_roles?: string[] | null
          can_finalize?: boolean
          created_at?: string
          decision_options?: string[] | null
          finalization_requires_decision?: boolean
          id?: string
          required_fields?: string[] | null
          step_id: string
          updated_at?: string
        }
        Update: {
          allowed_roles?: string[] | null
          can_finalize?: boolean
          created_at?: string
          decision_options?: string[] | null
          finalization_requires_decision?: boolean
          id?: string
          required_fields?: string[] | null
          step_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "service_flow_step_rules_step_id_fkey"
            columns: ["step_id"]
            isOneToOne: false
            referencedRelation: "service_flow_steps"
            referencedColumns: ["id"]
          },
        ]
      }
      service_flow_steps: {
        Row: {
          allow_return: boolean
          allow_skip: boolean
          auto_advance: boolean
          created_at: string
          expected_time_minutes: number | null
          flow_id: string
          id: string
          is_required: boolean
          requires_assignment: boolean
          sector_name: string
          step_name: string
          step_order: number
          updated_at: string
        }
        Insert: {
          allow_return?: boolean
          allow_skip?: boolean
          auto_advance?: boolean
          created_at?: string
          expected_time_minutes?: number | null
          flow_id: string
          id?: string
          is_required?: boolean
          requires_assignment?: boolean
          sector_name?: string
          step_name: string
          step_order?: number
          updated_at?: string
        }
        Update: {
          allow_return?: boolean
          allow_skip?: boolean
          auto_advance?: boolean
          created_at?: string
          expected_time_minutes?: number | null
          flow_id?: string
          id?: string
          is_required?: boolean
          requires_assignment?: boolean
          sector_name?: string
          step_name?: string
          step_order?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "service_flow_steps_flow_id_fkey"
            columns: ["flow_id"]
            isOneToOne: false
            referencedRelation: "service_flows"
            referencedColumns: ["id"]
          },
        ]
      }
      service_flows: {
        Row: {
          created_at: string
          description: string | null
          id: string
          is_active: boolean
          name: string
          trigger_categories: string[]
          updated_at: string
        }
        Insert: {
          created_at?: string
          description?: string | null
          id?: string
          is_active?: boolean
          name: string
          trigger_categories?: string[]
          updated_at?: string
        }
        Update: {
          created_at?: string
          description?: string | null
          id?: string
          is_active?: boolean
          name?: string
          trigger_categories?: string[]
          updated_at?: string
        }
        Relationships: []
      }
      service_tickets: {
        Row: {
          assigned_to: string | null
          attendance_id: string
          category: string | null
          channel_id: string | null
          closed_at: string | null
          company_id: string | null
          contact_name: string | null
          contact_phone: string | null
          created_at: string
          id: string
          liberacao_date: string | null
          notes: string | null
          opened_by: string | null
          pendencia_key: string | null
          plate: string | null
          priority: Database["public"]["Enums"]["ticket_priority"]
          reminder_date: string | null
          reminder_note: string | null
          reopened_at: string | null
          sector: string | null
          status: Database["public"]["Enums"]["service_ticket_status"]
          tracking_code: string | null
          updated_at: string
        }
        Insert: {
          assigned_to?: string | null
          attendance_id: string
          category?: string | null
          channel_id?: string | null
          closed_at?: string | null
          company_id?: string | null
          contact_name?: string | null
          contact_phone?: string | null
          created_at?: string
          id?: string
          liberacao_date?: string | null
          notes?: string | null
          opened_by?: string | null
          pendencia_key?: string | null
          plate?: string | null
          priority?: Database["public"]["Enums"]["ticket_priority"]
          reminder_date?: string | null
          reminder_note?: string | null
          reopened_at?: string | null
          sector?: string | null
          status?: Database["public"]["Enums"]["service_ticket_status"]
          tracking_code?: string | null
          updated_at?: string
        }
        Update: {
          assigned_to?: string | null
          attendance_id?: string
          category?: string | null
          channel_id?: string | null
          closed_at?: string | null
          company_id?: string | null
          contact_name?: string | null
          contact_phone?: string | null
          created_at?: string
          id?: string
          liberacao_date?: string | null
          notes?: string | null
          opened_by?: string | null
          pendencia_key?: string | null
          plate?: string | null
          priority?: Database["public"]["Enums"]["ticket_priority"]
          reminder_date?: string | null
          reminder_note?: string | null
          reopened_at?: string | null
          sector?: string | null
          status?: Database["public"]["Enums"]["service_ticket_status"]
          tracking_code?: string | null
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
      suprimento_items: {
        Row: {
          created_at: string
          default_quantity: number
          id: string
          is_active: boolean
          name: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          default_quantity?: number
          id?: string
          is_active?: boolean
          name: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          default_quantity?: number
          id?: string
          is_active?: boolean
          name?: string
          updated_at?: string
        }
        Relationships: []
      }
      task_categories: {
        Row: {
          color: string
          created_at: string
          id: string
          name: string
        }
        Insert: {
          color?: string
          created_at?: string
          id?: string
          name: string
        }
        Update: {
          color?: string
          created_at?: string
          id?: string
          name?: string
        }
        Relationships: []
      }
      task_comments: {
        Row: {
          content: string
          created_at: string
          id: string
          task_id: string
          user_id: string
        }
        Insert: {
          content: string
          created_at?: string
          id?: string
          task_id: string
          user_id: string
        }
        Update: {
          content?: string
          created_at?: string
          id?: string
          task_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "task_comments_task_id_fkey"
            columns: ["task_id"]
            isOneToOne: false
            referencedRelation: "tasks"
            referencedColumns: ["id"]
          },
        ]
      }
      task_participants: {
        Row: {
          created_at: string
          id: string
          task_id: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          task_id: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          task_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "task_participants_task_id_fkey"
            columns: ["task_id"]
            isOneToOne: false
            referencedRelation: "tasks"
            referencedColumns: ["id"]
          },
        ]
      }
      tasks: {
        Row: {
          assigned_to: string | null
          category_id: string | null
          completed_at: string | null
          created_at: string
          created_by: string
          description: string
          due_date: string | null
          id: string
          is_group_task: boolean
          parent_task_id: string | null
          priority: string
          recurrence_end_date: string | null
          recurrence_interval: number | null
          recurrence_type: string | null
          reminder_at: string | null
          status: string
          ticket_id: string | null
          title: string
          updated_at: string
        }
        Insert: {
          assigned_to?: string | null
          category_id?: string | null
          completed_at?: string | null
          created_at?: string
          created_by: string
          description?: string
          due_date?: string | null
          id?: string
          is_group_task?: boolean
          parent_task_id?: string | null
          priority?: string
          recurrence_end_date?: string | null
          recurrence_interval?: number | null
          recurrence_type?: string | null
          reminder_at?: string | null
          status?: string
          ticket_id?: string | null
          title: string
          updated_at?: string
        }
        Update: {
          assigned_to?: string | null
          category_id?: string | null
          completed_at?: string | null
          created_at?: string
          created_by?: string
          description?: string
          due_date?: string | null
          id?: string
          is_group_task?: boolean
          parent_task_id?: string | null
          priority?: string
          recurrence_end_date?: string | null
          recurrence_interval?: number | null
          recurrence_type?: string | null
          reminder_at?: string | null
          status?: string
          ticket_id?: string | null
          title?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "tasks_category_id_fkey"
            columns: ["category_id"]
            isOneToOne: false
            referencedRelation: "task_categories"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tasks_parent_task_id_fkey"
            columns: ["parent_task_id"]
            isOneToOne: false
            referencedRelation: "tasks"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tasks_ticket_id_fkey"
            columns: ["ticket_id"]
            isOneToOne: false
            referencedRelation: "service_tickets"
            referencedColumns: ["id"]
          },
        ]
      }
      teste_equipamento_settings: {
        Row: {
          auto_sync_gsystem: boolean
          id: string
          is_enabled: boolean
          require_garantia: boolean
          require_motivo_when_cobrar: boolean
          require_subtipo: boolean
          target_sector_name: string
          target_status: string
          trigger_category_key: string
          trigger_category_label: string
          updated_at: string
          updated_by: string | null
        }
        Insert: {
          auto_sync_gsystem?: boolean
          id?: string
          is_enabled?: boolean
          require_garantia?: boolean
          require_motivo_when_cobrar?: boolean
          require_subtipo?: boolean
          target_sector_name?: string
          target_status?: string
          trigger_category_key?: string
          trigger_category_label?: string
          updated_at?: string
          updated_by?: string | null
        }
        Update: {
          auto_sync_gsystem?: boolean
          id?: string
          is_enabled?: boolean
          require_garantia?: boolean
          require_motivo_when_cobrar?: boolean
          require_subtipo?: boolean
          target_sector_name?: string
          target_status?: string
          trigger_category_key?: string
          trigger_category_label?: string
          updated_at?: string
          updated_by?: string | null
        }
        Relationships: []
      }
      ticket_agents: {
        Row: {
          assigned_by: string | null
          created_at: string
          id: string
          ticket_id: string
          user_id: string
        }
        Insert: {
          assigned_by?: string | null
          created_at?: string
          id?: string
          ticket_id: string
          user_id: string
        }
        Update: {
          assigned_by?: string | null
          created_at?: string
          id?: string
          ticket_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "ticket_agents_ticket_id_fkey"
            columns: ["ticket_id"]
            isOneToOne: false
            referencedRelation: "service_tickets"
            referencedColumns: ["id"]
          },
        ]
      }
      ticket_assignments: {
        Row: {
          assigned_by: string | null
          assigned_to: string | null
          created_at: string
          id: string
          sector_name: string | null
          ticket_id: string
        }
        Insert: {
          assigned_by?: string | null
          assigned_to?: string | null
          created_at?: string
          id?: string
          sector_name?: string | null
          ticket_id: string
        }
        Update: {
          assigned_by?: string | null
          assigned_to?: string | null
          created_at?: string
          id?: string
          sector_name?: string | null
          ticket_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "ticket_assignments_ticket_id_fkey"
            columns: ["ticket_id"]
            isOneToOne: false
            referencedRelation: "service_tickets"
            referencedColumns: ["id"]
          },
        ]
      }
      ticket_attachments: {
        Row: {
          created_at: string
          file_name: string
          file_path: string
          file_size: number | null
          id: string
          mime_type: string | null
          ticket_id: string
          uploaded_by: string | null
        }
        Insert: {
          created_at?: string
          file_name: string
          file_path: string
          file_size?: number | null
          id?: string
          mime_type?: string | null
          ticket_id: string
          uploaded_by?: string | null
        }
        Update: {
          created_at?: string
          file_name?: string
          file_path?: string
          file_size?: number | null
          id?: string
          mime_type?: string | null
          ticket_id?: string
          uploaded_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "ticket_attachments_ticket_id_fkey"
            columns: ["ticket_id"]
            isOneToOne: false
            referencedRelation: "service_tickets"
            referencedColumns: ["id"]
          },
        ]
      }
      ticket_comments: {
        Row: {
          comment_type: string
          content: string
          created_at: string
          edited_at: string | null
          id: string
          ticket_id: string
          updated_at: string
          user_id: string | null
        }
        Insert: {
          comment_type?: string
          content?: string
          created_at?: string
          edited_at?: string | null
          id?: string
          ticket_id: string
          updated_at?: string
          user_id?: string | null
        }
        Update: {
          comment_type?: string
          content?: string
          created_at?: string
          edited_at?: string | null
          id?: string
          ticket_id?: string
          updated_at?: string
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "ticket_comments_ticket_id_fkey"
            columns: ["ticket_id"]
            isOneToOne: false
            referencedRelation: "service_tickets"
            referencedColumns: ["id"]
          },
        ]
      }
      ticket_liberacao_items: {
        Row: {
          created_at: string
          id: string
          item_id: string | null
          item_name: string
          liberado_at: string | null
          liberado_by: string | null
          quantity: number
          status: string
          ticket_id: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          id?: string
          item_id?: string | null
          item_name: string
          liberado_at?: string | null
          liberado_by?: string | null
          quantity?: number
          status?: string
          ticket_id: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          id?: string
          item_id?: string | null
          item_name?: string
          liberado_at?: string | null
          liberado_by?: string | null
          quantity?: number
          status?: string
          ticket_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "ticket_liberacao_items_item_id_fkey"
            columns: ["item_id"]
            isOneToOne: false
            referencedRelation: "liberacao_equipamento_items"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ticket_liberacao_items_ticket_id_fkey"
            columns: ["ticket_id"]
            isOneToOne: false
            referencedRelation: "service_tickets"
            referencedColumns: ["id"]
          },
        ]
      }
      ticket_reminder_history: {
        Row: {
          completed_at: string
          completed_by: string | null
          completion_comment: string | null
          created_at: string
          id: string
          next_scheduled_for: string | null
          parent_reminder_id: string | null
          recurrence_type: string | null
          reminder_id: string | null
          reminder_note: string | null
          scheduled_for: string
          ticket_id: string
        }
        Insert: {
          completed_at?: string
          completed_by?: string | null
          completion_comment?: string | null
          created_at?: string
          id?: string
          next_scheduled_for?: string | null
          parent_reminder_id?: string | null
          recurrence_type?: string | null
          reminder_id?: string | null
          reminder_note?: string | null
          scheduled_for: string
          ticket_id: string
        }
        Update: {
          completed_at?: string
          completed_by?: string | null
          completion_comment?: string | null
          created_at?: string
          id?: string
          next_scheduled_for?: string | null
          parent_reminder_id?: string | null
          recurrence_type?: string | null
          reminder_id?: string | null
          reminder_note?: string | null
          scheduled_for?: string
          ticket_id?: string
        }
        Relationships: []
      }
      ticket_reminders: {
        Row: {
          completed_at: string | null
          completed_by: string | null
          completion_comment: string | null
          created_at: string
          created_by: string | null
          id: string
          is_dismissed: boolean
          parent_reminder_id: string | null
          recurrence_end_date: string | null
          recurrence_type: string | null
          reminder_date: string
          reminder_note: string | null
          ticket_id: string
        }
        Insert: {
          completed_at?: string | null
          completed_by?: string | null
          completion_comment?: string | null
          created_at?: string
          created_by?: string | null
          id?: string
          is_dismissed?: boolean
          parent_reminder_id?: string | null
          recurrence_end_date?: string | null
          recurrence_type?: string | null
          reminder_date: string
          reminder_note?: string | null
          ticket_id: string
        }
        Update: {
          completed_at?: string | null
          completed_by?: string | null
          completion_comment?: string | null
          created_at?: string
          created_by?: string | null
          id?: string
          is_dismissed?: boolean
          parent_reminder_id?: string | null
          recurrence_end_date?: string | null
          recurrence_type?: string | null
          reminder_date?: string
          reminder_note?: string | null
          ticket_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "ticket_reminders_parent_reminder_id_fkey"
            columns: ["parent_reminder_id"]
            isOneToOne: false
            referencedRelation: "ticket_reminders"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ticket_reminders_ticket_id_fkey"
            columns: ["ticket_id"]
            isOneToOne: false
            referencedRelation: "service_tickets"
            referencedColumns: ["id"]
          },
        ]
      }
      ticket_suprimento_items: {
        Row: {
          created_at: string
          delivered_at: string | null
          delivered_by: string | null
          id: string
          item_id: string | null
          item_name: string
          quantity: number
          status: string
          ticket_id: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          delivered_at?: string | null
          delivered_by?: string | null
          id?: string
          item_id?: string | null
          item_name: string
          quantity?: number
          status?: string
          ticket_id: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          delivered_at?: string | null
          delivered_by?: string | null
          id?: string
          item_id?: string | null
          item_name?: string
          quantity?: number
          status?: string
          ticket_id?: string
          updated_at?: string
        }
        Relationships: []
      }
      ticket_tracking: {
        Row: {
          carrier: string
          created_at: string
          events: Json
          id: string
          is_delivered: boolean
          last_checked_at: string | null
          last_error: string | null
          last_location: string | null
          last_status: string | null
          last_status_date: string | null
          ticket_id: string
          tracking_code: string
          updated_at: string
        }
        Insert: {
          carrier?: string
          created_at?: string
          events?: Json
          id?: string
          is_delivered?: boolean
          last_checked_at?: string | null
          last_error?: string | null
          last_location?: string | null
          last_status?: string | null
          last_status_date?: string | null
          ticket_id: string
          tracking_code: string
          updated_at?: string
        }
        Update: {
          carrier?: string
          created_at?: string
          events?: Json
          id?: string
          is_delivered?: boolean
          last_checked_at?: string | null
          last_error?: string | null
          last_location?: string | null
          last_status?: string | null
          last_status_date?: string | null
          ticket_id?: string
          tracking_code?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "ticket_tracking_ticket_id_fkey"
            columns: ["ticket_id"]
            isOneToOne: true
            referencedRelation: "service_tickets"
            referencedColumns: ["id"]
          },
        ]
      }
      tracking_settings: {
        Row: {
          auto_close_ticket_on_delivery: boolean
          auto_refresh_enabled: boolean
          id: string
          notify_assigned_only: boolean
          notify_on_delivered: boolean
          notify_on_exception: boolean
          notify_sector_members: boolean
          refresh_interval_minutes: number
          require_tracking_code: boolean
          tracking_code_pattern: string
          updated_at: string
          updated_by: string | null
          whatsapp_notify_client: boolean
        }
        Insert: {
          auto_close_ticket_on_delivery?: boolean
          auto_refresh_enabled?: boolean
          id?: string
          notify_assigned_only?: boolean
          notify_on_delivered?: boolean
          notify_on_exception?: boolean
          notify_sector_members?: boolean
          refresh_interval_minutes?: number
          require_tracking_code?: boolean
          tracking_code_pattern?: string
          updated_at?: string
          updated_by?: string | null
          whatsapp_notify_client?: boolean
        }
        Update: {
          auto_close_ticket_on_delivery?: boolean
          auto_refresh_enabled?: boolean
          id?: string
          notify_assigned_only?: boolean
          notify_on_delivered?: boolean
          notify_on_exception?: boolean
          notify_sector_members?: boolean
          refresh_interval_minutes?: number
          require_tracking_code?: boolean
          tracking_code_pattern?: string
          updated_at?: string
          updated_by?: string | null
          whatsapp_notify_client?: boolean
        }
        Relationships: []
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
      user_sector_assignments: {
        Row: {
          created_at: string
          id: string
          sector_id: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          sector_id: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          sector_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "user_sector_assignments_sector_id_fkey"
            columns: ["sector_id"]
            isOneToOne: false
            referencedRelation: "sectors"
            referencedColumns: ["id"]
          },
        ]
      }
      zapi_bot_flows: {
        Row: {
          channel_id: string | null
          created_at: string
          id: string
          is_active: boolean
          name: string
          nodes: Json
          updated_at: string
        }
        Insert: {
          channel_id?: string | null
          created_at?: string
          id?: string
          is_active?: boolean
          name: string
          nodes?: Json
          updated_at?: string
        }
        Update: {
          channel_id?: string | null
          created_at?: string
          id?: string
          is_active?: boolean
          name?: string
          nodes?: Json
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "zapi_bot_flows_channel_id_fkey"
            columns: ["channel_id"]
            isOneToOne: false
            referencedRelation: "channels"
            referencedColumns: ["id"]
          },
        ]
      }
      zapi_chats: {
        Row: {
          assigned_to: string | null
          bot_state: Json
          channel_id: string
          contact_avatar: string | null
          contact_name: string | null
          created_at: string
          id: string
          last_message_at: string | null
          last_message_preview: string | null
          phone: string
          sector_name: string | null
          status: string
          tags: Json
          unread_count: number
          updated_at: string
        }
        Insert: {
          assigned_to?: string | null
          bot_state?: Json
          channel_id: string
          contact_avatar?: string | null
          contact_name?: string | null
          created_at?: string
          id?: string
          last_message_at?: string | null
          last_message_preview?: string | null
          phone: string
          sector_name?: string | null
          status?: string
          tags?: Json
          unread_count?: number
          updated_at?: string
        }
        Update: {
          assigned_to?: string | null
          bot_state?: Json
          channel_id?: string
          contact_avatar?: string | null
          contact_name?: string | null
          created_at?: string
          id?: string
          last_message_at?: string | null
          last_message_preview?: string | null
          phone?: string
          sector_name?: string | null
          status?: string
          tags?: Json
          unread_count?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "zapi_chats_channel_id_fkey"
            columns: ["channel_id"]
            isOneToOne: false
            referencedRelation: "channels"
            referencedColumns: ["id"]
          },
        ]
      }
      zapi_message_templates: {
        Row: {
          content: string
          created_at: string
          id: string
          key: string
          label: string
          updated_at: string
          updated_by: string | null
        }
        Insert: {
          content?: string
          created_at?: string
          id?: string
          key: string
          label?: string
          updated_at?: string
          updated_by?: string | null
        }
        Update: {
          content?: string
          created_at?: string
          id?: string
          key?: string
          label?: string
          updated_at?: string
          updated_by?: string | null
        }
        Relationships: []
      }
      zapi_messages: {
        Row: {
          chat_id: string
          created_at: string
          from_me: boolean
          id: string
          is_typing: boolean
          is_whisper: boolean
          media_type: string | null
          media_url: string | null
          sent_by_user_id: string | null
          status: string
          text: string | null
          whisper_author: string | null
          zapi_message_id: string | null
        }
        Insert: {
          chat_id: string
          created_at?: string
          from_me: boolean
          id?: string
          is_typing?: boolean
          is_whisper?: boolean
          media_type?: string | null
          media_url?: string | null
          sent_by_user_id?: string | null
          status?: string
          text?: string | null
          whisper_author?: string | null
          zapi_message_id?: string | null
        }
        Update: {
          chat_id?: string
          created_at?: string
          from_me?: boolean
          id?: string
          is_typing?: boolean
          is_whisper?: boolean
          media_type?: string | null
          media_url?: string | null
          sent_by_user_id?: string | null
          status?: string
          text?: string | null
          whisper_author?: string | null
          zapi_message_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "zapi_messages_chat_id_fkey"
            columns: ["chat_id"]
            isOneToOne: false
            referencedRelation: "zapi_chats"
            referencedColumns: ["id"]
          },
        ]
      }
      zapi_quick_replies: {
        Row: {
          content: string
          created_at: string
          created_by: string | null
          id: string
          is_global: boolean
          label: string
          shortcut: string
          updated_at: string
        }
        Insert: {
          content: string
          created_at?: string
          created_by?: string | null
          id?: string
          is_global?: boolean
          label: string
          shortcut: string
          updated_at?: string
        }
        Update: {
          content?: string
          created_at?: string
          created_by?: string | null
          id?: string
          is_global?: boolean
          label?: string
          shortcut?: string
          updated_at?: string
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
      is_task_assigned: {
        Args: { _task_id: string; _user_id: string }
        Returns: boolean
      }
      is_task_creator: {
        Args: { _task_id: string; _user_id: string }
        Returns: boolean
      }
      is_task_participant: {
        Args: { _task_id: string; _user_id: string }
        Returns: boolean
      }
      pick_least_loaded_agent: { Args: { _sector: string }; Returns: string }
    }
    Enums: {
      app_role: "admin" | "gestor" | "atendente"
      flow_instance_status: "em_andamento" | "pausado" | "finalizado"
      inventory_status: "disponivel" | "vinculado"
      movement_type: "entrada" | "saida"
      service_ticket_status:
        | "aberto"
        | "em_andamento"
        | "finalizado"
        | "reaberto"
      ticket_priority: "baixa" | "media" | "alta" | "urgente"
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
      flow_instance_status: ["em_andamento", "pausado", "finalizado"],
      inventory_status: ["disponivel", "vinculado"],
      movement_type: ["entrada", "saida"],
      service_ticket_status: [
        "aberto",
        "em_andamento",
        "finalizado",
        "reaberto",
      ],
      ticket_priority: ["baixa", "media", "alta", "urgente"],
      ticket_status: ["aberto", "resolvido"],
    },
  },
} as const
