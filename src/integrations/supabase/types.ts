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
      ai_manager_reports: {
        Row: {
          generated_at: string
          generated_by: string | null
          id: string
          payload: Json
          period_days: number
          scope: string
        }
        Insert: {
          generated_at?: string
          generated_by?: string | null
          id?: string
          payload: Json
          period_days: number
          scope: string
        }
        Update: {
          generated_at?: string
          generated_by?: string | null
          id?: string
          payload?: Json
          period_days?: number
          scope?: string
        }
        Relationships: []
      }
      ai_manager_settings: {
        Row: {
          id: string
          instructions: string
          singleton: boolean
          updated_at: string
          updated_by: string | null
        }
        Insert: {
          id?: string
          instructions?: string
          singleton?: boolean
          updated_at?: string
          updated_by?: string | null
        }
        Update: {
          id?: string
          instructions?: string
          singleton?: boolean
          updated_at?: string
          updated_by?: string | null
        }
        Relationships: []
      }
      ai_usage_logs: {
        Row: {
          created_at: string
          estimated_cost_usd: number
          feature: string
          id: string
          input_tokens: number
          metadata: Json
          model: string
          output_tokens: number
          total_tokens: number
          user_id: string | null
        }
        Insert: {
          created_at?: string
          estimated_cost_usd?: number
          feature?: string
          id?: string
          input_tokens?: number
          metadata?: Json
          model?: string
          output_tokens?: number
          total_tokens?: number
          user_id?: string | null
        }
        Update: {
          created_at?: string
          estimated_cost_usd?: number
          feature?: string
          id?: string
          input_tokens?: number
          metadata?: Json
          model?: string
          output_tokens?: number
          total_tokens?: number
          user_id?: string | null
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
          event_category: string | null
          event_type: string | null
          id: string
          ip_address: string | null
          metadata: Json
          target_id: string | null
          target_label: string | null
          target_type: string | null
          user_agent: string | null
          user_id: string | null
          user_name: string | null
        }
        Insert: {
          action: string
          created_at?: string
          details?: Json | null
          entity_id?: string | null
          entity_type: string
          event_category?: string | null
          event_type?: string | null
          id?: string
          ip_address?: string | null
          metadata?: Json
          target_id?: string | null
          target_label?: string | null
          target_type?: string | null
          user_agent?: string | null
          user_id?: string | null
          user_name?: string | null
        }
        Update: {
          action?: string
          created_at?: string
          details?: Json | null
          entity_id?: string | null
          entity_type?: string
          event_category?: string | null
          event_type?: string | null
          id?: string
          ip_address?: string | null
          metadata?: Json
          target_id?: string | null
          target_label?: string | null
          target_type?: string | null
          user_agent?: string | null
          user_id?: string | null
          user_name?: string | null
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
          call_reject_enabled: boolean
          call_reject_message: string | null
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
          call_reject_enabled?: boolean
          call_reject_message?: string | null
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
          call_reject_enabled?: boolean
          call_reject_message?: string | null
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
      chat_controle_links: {
        Row: {
          chat_id: string | null
          created_at: string
          created_by: string | null
          id: string
          label: string | null
          ticket_id: string | null
          updated_at: string
          updated_by: string | null
          url: string
        }
        Insert: {
          chat_id?: string | null
          created_at?: string
          created_by?: string | null
          id?: string
          label?: string | null
          ticket_id?: string | null
          updated_at?: string
          updated_by?: string | null
          url: string
        }
        Update: {
          chat_id?: string | null
          created_at?: string
          created_by?: string | null
          id?: string
          label?: string | null
          ticket_id?: string | null
          updated_at?: string
          updated_by?: string | null
          url?: string
        }
        Relationships: [
          {
            foreignKeyName: "chat_controle_links_chat_id_fkey"
            columns: ["chat_id"]
            isOneToOne: true
            referencedRelation: "zapi_chats"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "chat_controle_links_ticket_id_fkey"
            columns: ["ticket_id"]
            isOneToOne: false
            referencedRelation: "service_tickets"
            referencedColumns: ["id"]
          },
        ]
      }
      chat_idle_auto_message_logs: {
        Row: {
          channel_id: string | null
          chat_id: string
          contact_name: string | null
          id: string
          idle_minutes_at_send: number | null
          message_sent: string | null
          phone: string | null
          rule_id: string | null
          sent_at: string
          target: string
        }
        Insert: {
          channel_id?: string | null
          chat_id: string
          contact_name?: string | null
          id?: string
          idle_minutes_at_send?: number | null
          message_sent?: string | null
          phone?: string | null
          rule_id?: string | null
          sent_at?: string
          target: string
        }
        Update: {
          channel_id?: string | null
          chat_id?: string
          contact_name?: string | null
          id?: string
          idle_minutes_at_send?: number | null
          message_sent?: string | null
          phone?: string | null
          rule_id?: string | null
          sent_at?: string
          target?: string
        }
        Relationships: [
          {
            foreignKeyName: "chat_idle_auto_message_logs_rule_id_fkey"
            columns: ["rule_id"]
            isOneToOne: false
            referencedRelation: "chat_idle_auto_messages"
            referencedColumns: ["id"]
          },
        ]
      }
      chat_idle_auto_messages: {
        Row: {
          apply_to_groups: boolean
          channel_id: string | null
          cooldown_minutes: number
          created_at: string
          id: string
          idle_minutes: number
          is_enabled: boolean
          max_sends_per_ticket: number
          message_template: string
          name: string
          target: string
          updated_at: string
        }
        Insert: {
          apply_to_groups?: boolean
          channel_id?: string | null
          cooldown_minutes?: number
          created_at?: string
          id?: string
          idle_minutes?: number
          is_enabled?: boolean
          max_sends_per_ticket?: number
          message_template: string
          name: string
          target: string
          updated_at?: string
        }
        Update: {
          apply_to_groups?: boolean
          channel_id?: string | null
          cooldown_minutes?: number
          created_at?: string
          id?: string
          idle_minutes?: number
          is_enabled?: boolean
          max_sends_per_ticket?: number
          message_template?: string
          name?: string
          target?: string
          updated_at?: string
        }
        Relationships: []
      }
      chat_inactivity_alert_logs: {
        Row: {
          acknowledged_at: string | null
          alert_message: string
          assigned_user_id: string | null
          chat_id: string | null
          chat_phone: string | null
          contact_name: string | null
          id: string
          inactivity_minutes: number
          last_message_at: string | null
          last_message_from_me: boolean | null
          metadata: Json
          recipient_name: string
          recipient_user_id: string
          triggered_at: string
        }
        Insert: {
          acknowledged_at?: string | null
          alert_message?: string
          assigned_user_id?: string | null
          chat_id?: string | null
          chat_phone?: string | null
          contact_name?: string | null
          id?: string
          inactivity_minutes?: number
          last_message_at?: string | null
          last_message_from_me?: boolean | null
          metadata?: Json
          recipient_name?: string
          recipient_user_id: string
          triggered_at?: string
        }
        Update: {
          acknowledged_at?: string | null
          alert_message?: string
          assigned_user_id?: string | null
          chat_id?: string | null
          chat_phone?: string | null
          contact_name?: string | null
          id?: string
          inactivity_minutes?: number
          last_message_at?: string | null
          last_message_from_me?: boolean | null
          metadata?: Json
          recipient_name?: string
          recipient_user_id?: string
          triggered_at?: string
        }
        Relationships: []
      }
      chat_inactivity_alert_settings: {
        Row: {
          alert_message: string
          cooldown_minutes: number
          id: string
          inactivity_minutes: number
          is_enabled: boolean
          only_business_hours: boolean
          requires_acknowledge: boolean
          sound_enabled: boolean
          target_sector_ids: Json
          target_type: string
          target_user_ids: Json
          updated_at: string
          updated_by: string | null
        }
        Insert: {
          alert_message?: string
          cooldown_minutes?: number
          id?: string
          inactivity_minutes?: number
          is_enabled?: boolean
          only_business_hours?: boolean
          requires_acknowledge?: boolean
          sound_enabled?: boolean
          target_sector_ids?: Json
          target_type?: string
          target_user_ids?: Json
          updated_at?: string
          updated_by?: string | null
        }
        Update: {
          alert_message?: string
          cooldown_minutes?: number
          id?: string
          inactivity_minutes?: number
          is_enabled?: boolean
          only_business_hours?: boolean
          requires_acknowledge?: boolean
          sound_enabled?: boolean
          target_sector_ids?: Json
          target_type?: string
          target_user_ids?: Json
          updated_at?: string
          updated_by?: string | null
        }
        Relationships: []
      }
      companies: {
        Row: {
          cnpj: string | null
          contacts: Json | null
          contract_end: string | null
          contract_recurrence: string | null
          contract_start: string | null
          contract_value: number | null
          created_at: string
          emails: string[] | null
          id: string
          installation_script: string
          instructions: string | null
          maintenance_script: string
          name: string
          notes: string | null
          phone: string | null
          updated_at: string
        }
        Insert: {
          cnpj?: string | null
          contacts?: Json | null
          contract_end?: string | null
          contract_recurrence?: string | null
          contract_start?: string | null
          contract_value?: number | null
          created_at?: string
          emails?: string[] | null
          id?: string
          installation_script?: string
          instructions?: string | null
          maintenance_script?: string
          name: string
          notes?: string | null
          phone?: string | null
          updated_at?: string
        }
        Update: {
          cnpj?: string | null
          contacts?: Json | null
          contract_end?: string | null
          contract_recurrence?: string | null
          contract_start?: string | null
          contract_value?: number | null
          created_at?: string
          emails?: string[] | null
          id?: string
          installation_script?: string
          instructions?: string | null
          maintenance_script?: string
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
      company_service_templates: {
        Row: {
          company_id: string
          created_at: string
          description: string
          id: string
          name: string
          position: number
          updated_at: string
        }
        Insert: {
          company_id: string
          created_at?: string
          description?: string
          id?: string
          name: string
          position?: number
          updated_at?: string
        }
        Update: {
          company_id?: string
          created_at?: string
          description?: string
          id?: string
          name?: string
          position?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "company_service_templates_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
        ]
      }
      compra_equipamento_items: {
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
          activation_total: number
          birth_date: string | null
          category_id: string | null
          company_id: string | null
          contact_role: string
          contact_source: string | null
          contact_type: string
          contract_items: Json
          created_at: string
          created_by: string | null
          email: string | null
          id: string
          last_interaction_at: string | null
          monthly_total: number
          name: string
          notes: string | null
          phone: string
          referral_id: string | null
          referred_by_contact_id: string | null
          rfm_segment: string | null
          supplier_category: string | null
          updated_at: string
        }
        Insert: {
          activation_total?: number
          birth_date?: string | null
          category_id?: string | null
          company_id?: string | null
          contact_role?: string
          contact_source?: string | null
          contact_type?: string
          contract_items?: Json
          created_at?: string
          created_by?: string | null
          email?: string | null
          id?: string
          last_interaction_at?: string | null
          monthly_total?: number
          name: string
          notes?: string | null
          phone: string
          referral_id?: string | null
          referred_by_contact_id?: string | null
          rfm_segment?: string | null
          supplier_category?: string | null
          updated_at?: string
        }
        Update: {
          activation_total?: number
          birth_date?: string | null
          category_id?: string | null
          company_id?: string | null
          contact_role?: string
          contact_source?: string | null
          contact_type?: string
          contract_items?: Json
          created_at?: string
          created_by?: string | null
          email?: string | null
          id?: string
          last_interaction_at?: string | null
          monthly_total?: number
          name?: string
          notes?: string | null
          phone?: string
          referral_id?: string | null
          referred_by_contact_id?: string | null
          rfm_segment?: string | null
          supplier_category?: string | null
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
          {
            foreignKeyName: "crm_contacts_referral_id_fkey"
            columns: ["referral_id"]
            isOneToOne: false
            referencedRelation: "crm_referrals"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "crm_contacts_referred_by_contact_id_fkey"
            columns: ["referred_by_contact_id"]
            isOneToOne: false
            referencedRelation: "crm_contacts"
            referencedColumns: ["id"]
          },
        ]
      }
      crm_message_templates: {
        Row: {
          body: string
          channel: string
          created_at: string
          event_type: string
          id: string
          is_active: boolean
          name: string
          subject: string | null
          updated_at: string
        }
        Insert: {
          body: string
          channel?: string
          created_at?: string
          event_type?: string
          id?: string
          is_active?: boolean
          name: string
          subject?: string | null
          updated_at?: string
        }
        Update: {
          body?: string
          channel?: string
          created_at?: string
          event_type?: string
          id?: string
          is_active?: boolean
          name?: string
          subject?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      crm_nps_responses: {
        Row: {
          category: string | null
          comment: string | null
          contact_id: string | null
          created_at: string
          id: string
          score: number
          source: string | null
          ticket_id: string | null
        }
        Insert: {
          category?: string | null
          comment?: string | null
          contact_id?: string | null
          created_at?: string
          id?: string
          score: number
          source?: string | null
          ticket_id?: string | null
        }
        Update: {
          category?: string | null
          comment?: string | null
          contact_id?: string | null
          created_at?: string
          id?: string
          score?: number
          source?: string | null
          ticket_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "crm_nps_responses_contact_id_fkey"
            columns: ["contact_id"]
            isOneToOne: false
            referencedRelation: "crm_contacts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "crm_nps_responses_ticket_id_fkey"
            columns: ["ticket_id"]
            isOneToOne: false
            referencedRelation: "service_tickets"
            referencedColumns: ["id"]
          },
        ]
      }
      crm_opportunities: {
        Row: {
          category_id: string | null
          closed_at: string | null
          cnpj: string | null
          company_id: string | null
          company_name: string | null
          contact_email: string | null
          contact_id: string | null
          contact_name: string | null
          contact_phone: string | null
          contract_items: Json
          created_at: string
          created_by: string | null
          expected_close_date: string | null
          expected_value: number | null
          id: string
          loss_reason: string | null
          notes: string | null
          opportunity_type: string
          owner_id: string | null
          probability: number
          referral_id: string | null
          source: string | null
          stage_id: string | null
          status: string
          title: string
          updated_at: string
        }
        Insert: {
          category_id?: string | null
          closed_at?: string | null
          cnpj?: string | null
          company_id?: string | null
          company_name?: string | null
          contact_email?: string | null
          contact_id?: string | null
          contact_name?: string | null
          contact_phone?: string | null
          contract_items?: Json
          created_at?: string
          created_by?: string | null
          expected_close_date?: string | null
          expected_value?: number | null
          id?: string
          loss_reason?: string | null
          notes?: string | null
          opportunity_type?: string
          owner_id?: string | null
          probability?: number
          referral_id?: string | null
          source?: string | null
          stage_id?: string | null
          status?: string
          title: string
          updated_at?: string
        }
        Update: {
          category_id?: string | null
          closed_at?: string | null
          cnpj?: string | null
          company_id?: string | null
          company_name?: string | null
          contact_email?: string | null
          contact_id?: string | null
          contact_name?: string | null
          contact_phone?: string | null
          contract_items?: Json
          created_at?: string
          created_by?: string | null
          expected_close_date?: string | null
          expected_value?: number | null
          id?: string
          loss_reason?: string | null
          notes?: string | null
          opportunity_type?: string
          owner_id?: string | null
          probability?: number
          referral_id?: string | null
          source?: string | null
          stage_id?: string | null
          status?: string
          title?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "crm_opportunities_category_id_fkey"
            columns: ["category_id"]
            isOneToOne: false
            referencedRelation: "crm_categories"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "crm_opportunities_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "crm_opportunities_contact_id_fkey"
            columns: ["contact_id"]
            isOneToOne: false
            referencedRelation: "crm_contacts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "crm_opportunities_referral_id_fkey"
            columns: ["referral_id"]
            isOneToOne: false
            referencedRelation: "crm_referrals"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "crm_opportunities_stage_id_fkey"
            columns: ["stage_id"]
            isOneToOne: false
            referencedRelation: "crm_pipeline_stages"
            referencedColumns: ["id"]
          },
        ]
      }
      crm_pipeline_stages: {
        Row: {
          color: string | null
          created_at: string
          default_probability: number
          id: string
          is_active: boolean
          is_lost: boolean
          is_won: boolean
          name: string
          position: number
          updated_at: string
        }
        Insert: {
          color?: string | null
          created_at?: string
          default_probability?: number
          id?: string
          is_active?: boolean
          is_lost?: boolean
          is_won?: boolean
          name: string
          position?: number
          updated_at?: string
        }
        Update: {
          color?: string | null
          created_at?: string
          default_probability?: number
          id?: string
          is_active?: boolean
          is_lost?: boolean
          is_won?: boolean
          name?: string
          position?: number
          updated_at?: string
        }
        Relationships: []
      }
      crm_postsale_queue: {
        Row: {
          contact_id: string | null
          contact_phone: string | null
          created_at: string
          error: string | null
          executed_at: string | null
          id: string
          opportunity_id: string | null
          rule_id: string | null
          scheduled_for: string
          status: string
          step_id: string | null
          task_id: string | null
          ticket_id: string | null
        }
        Insert: {
          contact_id?: string | null
          contact_phone?: string | null
          created_at?: string
          error?: string | null
          executed_at?: string | null
          id?: string
          opportunity_id?: string | null
          rule_id?: string | null
          scheduled_for: string
          status?: string
          step_id?: string | null
          task_id?: string | null
          ticket_id?: string | null
        }
        Update: {
          contact_id?: string | null
          contact_phone?: string | null
          created_at?: string
          error?: string | null
          executed_at?: string | null
          id?: string
          opportunity_id?: string | null
          rule_id?: string | null
          scheduled_for?: string
          status?: string
          step_id?: string | null
          task_id?: string | null
          ticket_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "crm_postsale_queue_contact_id_fkey"
            columns: ["contact_id"]
            isOneToOne: false
            referencedRelation: "crm_contacts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "crm_postsale_queue_opportunity_id_fkey"
            columns: ["opportunity_id"]
            isOneToOne: false
            referencedRelation: "crm_opportunities"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "crm_postsale_queue_rule_id_fkey"
            columns: ["rule_id"]
            isOneToOne: false
            referencedRelation: "crm_postsale_rules"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "crm_postsale_queue_step_id_fkey"
            columns: ["step_id"]
            isOneToOne: false
            referencedRelation: "crm_postsale_steps"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "crm_postsale_queue_task_id_fkey"
            columns: ["task_id"]
            isOneToOne: false
            referencedRelation: "crm_tasks"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "crm_postsale_queue_ticket_id_fkey"
            columns: ["ticket_id"]
            isOneToOne: false
            referencedRelation: "service_tickets"
            referencedColumns: ["id"]
          },
        ]
      }
      crm_postsale_rules: {
        Row: {
          created_at: string
          final_category_id: string | null
          final_stage_id: string | null
          id: string
          is_active: boolean
          name: string
          trigger_category: string | null
          trigger_category_id: string | null
          trigger_sector: string | null
          trigger_stage_id: string | null
          trigger_type: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          final_category_id?: string | null
          final_stage_id?: string | null
          id?: string
          is_active?: boolean
          name: string
          trigger_category?: string | null
          trigger_category_id?: string | null
          trigger_sector?: string | null
          trigger_stage_id?: string | null
          trigger_type?: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          final_category_id?: string | null
          final_stage_id?: string | null
          id?: string
          is_active?: boolean
          name?: string
          trigger_category?: string | null
          trigger_category_id?: string | null
          trigger_sector?: string | null
          trigger_stage_id?: string | null
          trigger_type?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "crm_postsale_rules_final_category_id_fkey"
            columns: ["final_category_id"]
            isOneToOne: false
            referencedRelation: "crm_categories"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "crm_postsale_rules_final_stage_id_fkey"
            columns: ["final_stage_id"]
            isOneToOne: false
            referencedRelation: "crm_pipeline_stages"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "crm_postsale_rules_trigger_category_id_fkey"
            columns: ["trigger_category_id"]
            isOneToOne: false
            referencedRelation: "crm_categories"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "crm_postsale_rules_trigger_stage_id_fkey"
            columns: ["trigger_stage_id"]
            isOneToOne: false
            referencedRelation: "crm_pipeline_stages"
            referencedColumns: ["id"]
          },
        ]
      }
      crm_postsale_steps: {
        Row: {
          action_type: string
          created_at: string
          delay_days: number
          description: string | null
          id: string
          move_to_category_id: string | null
          move_to_stage_id: string | null
          position: number
          rule_id: string
          template_id: string | null
          title: string
        }
        Insert: {
          action_type?: string
          created_at?: string
          delay_days?: number
          description?: string | null
          id?: string
          move_to_category_id?: string | null
          move_to_stage_id?: string | null
          position?: number
          rule_id: string
          template_id?: string | null
          title: string
        }
        Update: {
          action_type?: string
          created_at?: string
          delay_days?: number
          description?: string | null
          id?: string
          move_to_category_id?: string | null
          move_to_stage_id?: string | null
          position?: number
          rule_id?: string
          template_id?: string | null
          title?: string
        }
        Relationships: [
          {
            foreignKeyName: "crm_postsale_steps_move_to_category_id_fkey"
            columns: ["move_to_category_id"]
            isOneToOne: false
            referencedRelation: "crm_categories"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "crm_postsale_steps_move_to_stage_id_fkey"
            columns: ["move_to_stage_id"]
            isOneToOne: false
            referencedRelation: "crm_pipeline_stages"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "crm_postsale_steps_rule_id_fkey"
            columns: ["rule_id"]
            isOneToOne: false
            referencedRelation: "crm_postsale_rules"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "crm_postsale_steps_template_id_fkey"
            columns: ["template_id"]
            isOneToOne: false
            referencedRelation: "crm_message_templates"
            referencedColumns: ["id"]
          },
        ]
      }
      crm_recurring_contacts: {
        Row: {
          cadence: string
          channel: string
          contact_id: string
          created_at: string
          created_by: string | null
          id: string
          is_active: boolean
          next_run_at: string
          notes: string | null
          owner_id: string | null
          template_id: string | null
          updated_at: string
        }
        Insert: {
          cadence?: string
          channel?: string
          contact_id: string
          created_at?: string
          created_by?: string | null
          id?: string
          is_active?: boolean
          next_run_at?: string
          notes?: string | null
          owner_id?: string | null
          template_id?: string | null
          updated_at?: string
        }
        Update: {
          cadence?: string
          channel?: string
          contact_id?: string
          created_at?: string
          created_by?: string | null
          id?: string
          is_active?: boolean
          next_run_at?: string
          notes?: string | null
          owner_id?: string | null
          template_id?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "crm_recurring_contacts_contact_id_fkey"
            columns: ["contact_id"]
            isOneToOne: false
            referencedRelation: "crm_contacts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "crm_recurring_contacts_template_id_fkey"
            columns: ["template_id"]
            isOneToOne: false
            referencedRelation: "crm_message_templates"
            referencedColumns: ["id"]
          },
        ]
      }
      crm_referrals: {
        Row: {
          created_at: string
          created_by: string | null
          description: string | null
          id: string
          is_active: boolean
          name: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          description?: string | null
          id?: string
          is_active?: boolean
          name: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          created_by?: string | null
          description?: string | null
          id?: string
          is_active?: boolean
          name?: string
          updated_at?: string
        }
        Relationships: []
      }
      crm_tasks: {
        Row: {
          assigned_to: string | null
          company_id: string | null
          completed_at: string | null
          completion_note: string | null
          contact_id: string | null
          created_at: string
          created_by: string | null
          description: string | null
          due_date: string | null
          id: string
          metadata: Json | null
          priority: string
          source_id: string | null
          source_type: string | null
          status: string
          task_type: string
          title: string
          updated_at: string
        }
        Insert: {
          assigned_to?: string | null
          company_id?: string | null
          completed_at?: string | null
          completion_note?: string | null
          contact_id?: string | null
          created_at?: string
          created_by?: string | null
          description?: string | null
          due_date?: string | null
          id?: string
          metadata?: Json | null
          priority?: string
          source_id?: string | null
          source_type?: string | null
          status?: string
          task_type?: string
          title: string
          updated_at?: string
        }
        Update: {
          assigned_to?: string | null
          company_id?: string | null
          completed_at?: string | null
          completion_note?: string | null
          contact_id?: string | null
          created_at?: string
          created_by?: string | null
          description?: string | null
          due_date?: string | null
          id?: string
          metadata?: Json | null
          priority?: string
          source_id?: string | null
          source_type?: string | null
          status?: string
          task_type?: string
          title?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "crm_tasks_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "crm_tasks_contact_id_fkey"
            columns: ["contact_id"]
            isOneToOne: false
            referencedRelation: "crm_contacts"
            referencedColumns: ["id"]
          },
        ]
      }
      csat_pending: {
        Row: {
          channel_id: string
          chat_id: string
          contact_name: string | null
          created_at: string
          expires_at: string
          id: string
          operator_name: string | null
          operator_user_id: string | null
          phone: string
          protocol: string | null
          ticket_id: string | null
        }
        Insert: {
          channel_id: string
          chat_id: string
          contact_name?: string | null
          created_at?: string
          expires_at?: string
          id?: string
          operator_name?: string | null
          operator_user_id?: string | null
          phone: string
          protocol?: string | null
          ticket_id?: string | null
        }
        Update: {
          channel_id?: string
          chat_id?: string
          contact_name?: string | null
          created_at?: string
          expires_at?: string
          id?: string
          operator_name?: string | null
          operator_user_id?: string | null
          phone?: string
          protocol?: string | null
          ticket_id?: string | null
        }
        Relationships: []
      }
      csat_responses: {
        Row: {
          channel_id: string | null
          chat_id: string | null
          contact_name: string | null
          created_at: string
          id: string
          operator_name: string | null
          operator_user_id: string | null
          phone: string | null
          protocol: string | null
          raw_response: string | null
          score: number
          score_label: string
          ticket_id: string | null
        }
        Insert: {
          channel_id?: string | null
          chat_id?: string | null
          contact_name?: string | null
          created_at?: string
          id?: string
          operator_name?: string | null
          operator_user_id?: string | null
          phone?: string | null
          protocol?: string | null
          raw_response?: string | null
          score: number
          score_label: string
          ticket_id?: string | null
        }
        Update: {
          channel_id?: string | null
          chat_id?: string | null
          contact_name?: string | null
          created_at?: string
          id?: string
          operator_name?: string | null
          operator_user_id?: string | null
          phone?: string | null
          protocol?: string | null
          raw_response?: string | null
          score?: number
          score_label?: string
          ticket_id?: string | null
        }
        Relationships: []
      }
      csat_settings: {
        Row: {
          id: string
          is_enabled: boolean
          message: string
          thanks_message: string
          updated_at: string
          updated_by: string | null
        }
        Insert: {
          id?: string
          is_enabled?: boolean
          message?: string
          thanks_message?: string
          updated_at?: string
          updated_by?: string | null
        }
        Update: {
          id?: string
          is_enabled?: boolean
          message?: string
          thanks_message?: string
          updated_at?: string
          updated_by?: string | null
        }
        Relationships: []
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
      escalation_gestao_settings: {
        Row: {
          default_category: string
          default_notes: string
          id: string
          is_enabled: boolean
          notify_on_escalation: boolean
          target_sector_id: string | null
          target_sector_name: string
          updated_at: string
          updated_by: string | null
        }
        Insert: {
          default_category?: string
          default_notes?: string
          id?: string
          is_enabled?: boolean
          notify_on_escalation?: boolean
          target_sector_id?: string | null
          target_sector_name?: string
          updated_at?: string
          updated_by?: string | null
        }
        Update: {
          default_category?: string
          default_notes?: string
          id?: string
          is_enabled?: boolean
          notify_on_escalation?: boolean
          target_sector_id?: string | null
          target_sector_name?: string
          updated_at?: string
          updated_by?: string | null
        }
        Relationships: []
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
      message_trigger_logs: {
        Row: {
          acknowledged_at: string | null
          action_taken: Json
          channel_id: string | null
          chat_id: string | null
          contact_name: string | null
          id: string
          matched_keyword: string
          message_excerpt: string
          message_id: string | null
          phone: string | null
          recipient_name: string
          recipient_user_id: string | null
          rule_id: string | null
          rule_name: string
          triggered_at: string
        }
        Insert: {
          acknowledged_at?: string | null
          action_taken?: Json
          channel_id?: string | null
          chat_id?: string | null
          contact_name?: string | null
          id?: string
          matched_keyword?: string
          message_excerpt?: string
          message_id?: string | null
          phone?: string | null
          recipient_name?: string
          recipient_user_id?: string | null
          rule_id?: string | null
          rule_name?: string
          triggered_at?: string
        }
        Update: {
          acknowledged_at?: string | null
          action_taken?: Json
          channel_id?: string | null
          chat_id?: string | null
          contact_name?: string | null
          id?: string
          matched_keyword?: string
          message_excerpt?: string
          message_id?: string | null
          phone?: string | null
          recipient_name?: string
          recipient_user_id?: string | null
          rule_id?: string | null
          rule_name?: string
          triggered_at?: string
        }
        Relationships: []
      }
      message_trigger_rules: {
        Row: {
          action_type: string
          alert_message: string
          alert_target_sector_ids: Json
          alert_target_type: string
          alert_target_user_ids: Json
          case_sensitive: boolean
          cooldown_minutes: number
          create_ticket: boolean
          created_at: string
          created_by: string | null
          id: string
          is_enabled: boolean
          keywords: Json
          match_type: string
          name: string
          priority: number
          sound_enabled: boolean
          ticket_note: string | null
          ticket_priority: string
          ticket_sector: string | null
          transfer_note: string
          transfer_sector_id: string | null
          transfer_sector_name: string | null
          updated_at: string
        }
        Insert: {
          action_type?: string
          alert_message?: string
          alert_target_sector_ids?: Json
          alert_target_type?: string
          alert_target_user_ids?: Json
          case_sensitive?: boolean
          cooldown_minutes?: number
          create_ticket?: boolean
          created_at?: string
          created_by?: string | null
          id?: string
          is_enabled?: boolean
          keywords?: Json
          match_type?: string
          name: string
          priority?: number
          sound_enabled?: boolean
          ticket_note?: string | null
          ticket_priority?: string
          ticket_sector?: string | null
          transfer_note?: string
          transfer_sector_id?: string | null
          transfer_sector_name?: string | null
          updated_at?: string
        }
        Update: {
          action_type?: string
          alert_message?: string
          alert_target_sector_ids?: Json
          alert_target_type?: string
          alert_target_user_ids?: Json
          case_sensitive?: boolean
          cooldown_minutes?: number
          create_ticket?: boolean
          created_at?: string
          created_by?: string | null
          id?: string
          is_enabled?: boolean
          keywords?: Json
          match_type?: string
          name?: string
          priority?: number
          sound_enabled?: boolean
          ticket_note?: string | null
          ticket_priority?: string
          ticket_sector?: string | null
          transfer_note?: string
          transfer_sector_id?: string | null
          transfer_sector_name?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      no_comm_automation_log: {
        Row: {
          chat_id: string | null
          direction: string
          id: string
          matched_keyword: string | null
          message_excerpt: string | null
          message_id: string | null
          protocol_number: number | null
          ticket_id: string | null
          triggered_at: string
          triggered_by: string | null
        }
        Insert: {
          chat_id?: string | null
          direction: string
          id?: string
          matched_keyword?: string | null
          message_excerpt?: string | null
          message_id?: string | null
          protocol_number?: number | null
          ticket_id?: string | null
          triggered_at?: string
          triggered_by?: string | null
        }
        Update: {
          chat_id?: string | null
          direction?: string
          id?: string
          matched_keyword?: string | null
          message_excerpt?: string | null
          message_id?: string | null
          protocol_number?: number | null
          ticket_id?: string | null
          triggered_at?: string
          triggered_by?: string | null
        }
        Relationships: []
      }
      no_comm_automation_settings: {
        Row: {
          auto_close: boolean
          category: string
          direction: string
          final_status: string
          footer_template: string
          id: string
          is_enabled: boolean
          keywords: string[]
          match_mode: string
          singleton: boolean
          updated_at: string
          updated_by: string | null
        }
        Insert: {
          auto_close?: boolean
          category?: string
          direction?: string
          final_status?: string
          footer_template?: string
          id?: string
          is_enabled?: boolean
          keywords?: string[]
          match_mode?: string
          singleton?: boolean
          updated_at?: string
          updated_by?: string | null
        }
        Update: {
          auto_close?: boolean
          category?: string
          direction?: string
          final_status?: string
          footer_template?: string
          id?: string
          is_enabled?: boolean
          keywords?: string[]
          match_mode?: string
          singleton?: boolean
          updated_at?: string
          updated_by?: string | null
        }
        Relationships: []
      }
      notification_campaigns: {
        Row: {
          created_at: string
          created_by: string | null
          created_by_name: string
          id: string
          message: string
          recipients_count: number
          show_as_popup: boolean
          target_id: string | null
          target_label: string
          target_type: string
          title: string
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          created_by_name?: string
          id?: string
          message?: string
          recipients_count?: number
          show_as_popup?: boolean
          target_id?: string | null
          target_label?: string
          target_type: string
          title: string
        }
        Update: {
          created_at?: string
          created_by?: string | null
          created_by_name?: string
          id?: string
          message?: string
          recipients_count?: number
          show_as_popup?: boolean
          target_id?: string | null
          target_label?: string
          target_type?: string
          title?: string
        }
        Relationships: []
      }
      notifications: {
        Row: {
          campaign_id: string | null
          created_at: string
          id: string
          is_read: boolean
          message: string
          metadata: Json | null
          popup_dismissed_at: string | null
          read_at: string | null
          show_as_popup: boolean
          ticket_id: string | null
          title: string
          type: string
          user_id: string
        }
        Insert: {
          campaign_id?: string | null
          created_at?: string
          id?: string
          is_read?: boolean
          message?: string
          metadata?: Json | null
          popup_dismissed_at?: string | null
          read_at?: string | null
          show_as_popup?: boolean
          ticket_id?: string | null
          title: string
          type: string
          user_id: string
        }
        Update: {
          campaign_id?: string | null
          created_at?: string
          id?: string
          is_read?: boolean
          message?: string
          metadata?: Json | null
          popup_dismissed_at?: string | null
          read_at?: string | null
          show_as_popup?: boolean
          ticket_id?: string | null
          title?: string
          type?: string
          user_id?: string
        }
        Relationships: []
      }
      okr_alert_settings: {
        Row: {
          alert_cycle_ending_days: number
          alert_no_checkin_days: number
          alert_red_confidence_days: number
          alert_regression_threshold_pct: number
          id: string
          is_enabled: boolean
          updated_at: string
        }
        Insert: {
          alert_cycle_ending_days?: number
          alert_no_checkin_days?: number
          alert_red_confidence_days?: number
          alert_regression_threshold_pct?: number
          id?: string
          is_enabled?: boolean
          updated_at?: string
        }
        Update: {
          alert_cycle_ending_days?: number
          alert_no_checkin_days?: number
          alert_red_confidence_days?: number
          alert_regression_threshold_pct?: number
          id?: string
          is_enabled?: boolean
          updated_at?: string
        }
        Relationships: []
      }
      okr_checkins: {
        Row: {
          comment: string
          confidence: string
          created_at: string
          created_by: string | null
          id: string
          key_result_id: string
          new_value: number
          previous_value: number | null
          source: string
        }
        Insert: {
          comment?: string
          confidence: string
          created_at?: string
          created_by?: string | null
          id?: string
          key_result_id: string
          new_value: number
          previous_value?: number | null
          source?: string
        }
        Update: {
          comment?: string
          confidence?: string
          created_at?: string
          created_by?: string | null
          id?: string
          key_result_id?: string
          new_value?: number
          previous_value?: number | null
          source?: string
        }
        Relationships: [
          {
            foreignKeyName: "okr_checkins_key_result_id_fkey"
            columns: ["key_result_id"]
            isOneToOne: false
            referencedRelation: "okr_key_results"
            referencedColumns: ["id"]
          },
        ]
      }
      okr_cycles: {
        Row: {
          created_at: string
          created_by: string | null
          end_date: string
          id: string
          is_active: boolean
          name: string
          start_date: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          end_date: string
          id?: string
          is_active?: boolean
          name: string
          start_date: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          created_by?: string | null
          end_date?: string
          id?: string
          is_active?: boolean
          name?: string
          start_date?: string
          updated_at?: string
        }
        Relationships: []
      }
      okr_key_results: {
        Row: {
          confidence: string
          created_at: string
          current_value: number
          direction: string
          display_order: number
          id: string
          initial_value: number
          kr_type: string
          last_auto_update_at: string | null
          metric_filter: Json
          metric_key: string | null
          objective_id: string
          responsible_user_id: string | null
          target_value: number
          title: string
          unit: string
          updated_at: string
        }
        Insert: {
          confidence?: string
          created_at?: string
          current_value?: number
          direction?: string
          display_order?: number
          id?: string
          initial_value?: number
          kr_type?: string
          last_auto_update_at?: string | null
          metric_filter?: Json
          metric_key?: string | null
          objective_id: string
          responsible_user_id?: string | null
          target_value: number
          title: string
          unit?: string
          updated_at?: string
        }
        Update: {
          confidence?: string
          created_at?: string
          current_value?: number
          direction?: string
          display_order?: number
          id?: string
          initial_value?: number
          kr_type?: string
          last_auto_update_at?: string | null
          metric_filter?: Json
          metric_key?: string | null
          objective_id?: string
          responsible_user_id?: string | null
          target_value?: number
          title?: string
          unit?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "okr_key_results_objective_id_fkey"
            columns: ["objective_id"]
            isOneToOne: false
            referencedRelation: "okr_objectives"
            referencedColumns: ["id"]
          },
        ]
      }
      okr_objectives: {
        Row: {
          created_at: string
          created_by: string | null
          cycle_id: string
          description: string
          id: string
          level: string
          owner_user_id: string | null
          parent_objective_id: string | null
          sector_id: string | null
          status: string
          title: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          cycle_id: string
          description?: string
          id?: string
          level: string
          owner_user_id?: string | null
          parent_objective_id?: string | null
          sector_id?: string | null
          status?: string
          title: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          created_by?: string | null
          cycle_id?: string
          description?: string
          id?: string
          level?: string
          owner_user_id?: string | null
          parent_objective_id?: string | null
          sector_id?: string | null
          status?: string
          title?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "okr_objectives_cycle_id_fkey"
            columns: ["cycle_id"]
            isOneToOne: false
            referencedRelation: "okr_cycles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "okr_objectives_parent_objective_id_fkey"
            columns: ["parent_objective_id"]
            isOneToOne: false
            referencedRelation: "okr_objectives"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "okr_objectives_sector_id_fkey"
            columns: ["sector_id"]
            isOneToOne: false
            referencedRelation: "sectors"
            referencedColumns: ["id"]
          },
        ]
      }
      operator_chat_messages: {
        Row: {
          body: string
          chat_id: string
          created_at: string
          id: string
          read_at: string | null
          sender_name: string | null
          sender_user_id: string
        }
        Insert: {
          body: string
          chat_id: string
          created_at?: string
          id?: string
          read_at?: string | null
          sender_name?: string | null
          sender_user_id: string
        }
        Update: {
          body?: string
          chat_id?: string
          created_at?: string
          id?: string
          read_at?: string | null
          sender_name?: string | null
          sender_user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "operator_chat_messages_chat_id_fkey"
            columns: ["chat_id"]
            isOneToOne: false
            referencedRelation: "operator_chats"
            referencedColumns: ["id"]
          },
        ]
      }
      operator_chats: {
        Row: {
          campaign_id: string | null
          closed_at: string | null
          created_at: string
          created_by: string
          created_by_name: string | null
          id: string
          is_locked: boolean
          last_message_at: string
          lock_until_reply: boolean
          recipient_user_id: string
          subject: string
          updated_at: string
        }
        Insert: {
          campaign_id?: string | null
          closed_at?: string | null
          created_at?: string
          created_by: string
          created_by_name?: string | null
          id?: string
          is_locked?: boolean
          last_message_at?: string
          lock_until_reply?: boolean
          recipient_user_id: string
          subject: string
          updated_at?: string
        }
        Update: {
          campaign_id?: string | null
          closed_at?: string | null
          created_at?: string
          created_by?: string
          created_by_name?: string | null
          id?: string
          is_locked?: boolean
          last_message_at?: string
          lock_until_reply?: boolean
          recipient_user_id?: string
          subject?: string
          updated_at?: string
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
      pending_reminder_dispatch_log: {
        Row: {
          acknowledged_at: string | null
          dispatch_id: string | null
          id: string
          metadata: Json
          shown_at: string
          total_pending: number
          trigger_type: string
          user_id: string
        }
        Insert: {
          acknowledged_at?: string | null
          dispatch_id?: string | null
          id?: string
          metadata?: Json
          shown_at?: string
          total_pending?: number
          trigger_type?: string
          user_id: string
        }
        Update: {
          acknowledged_at?: string | null
          dispatch_id?: string | null
          id?: string
          metadata?: Json
          shown_at?: string
          total_pending?: number
          trigger_type?: string
          user_id?: string
        }
        Relationships: []
      }
      pending_reminder_dispatches: {
        Row: {
          created_at: string
          created_by: string | null
          id: string
          note: string
          target_sector_ids: string[]
          target_type: string
          target_user_ids: string[]
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          id?: string
          note?: string
          target_sector_ids?: string[]
          target_type?: string
          target_user_ids?: string[]
        }
        Update: {
          created_at?: string
          created_by?: string | null
          id?: string
          note?: string
          target_sector_ids?: string[]
          target_type?: string
          target_user_ids?: string[]
        }
        Relationships: []
      }
      pending_reminder_settings: {
        Row: {
          id: string
          interval_hours: number
          is_enabled: boolean
          min_total_to_show: number
          quiet_end: string
          quiet_start: string
          requires_acknowledge: boolean
          show_my_tickets: boolean
          show_open_chats: boolean
          show_sector_tickets: boolean
          sound_enabled: boolean
          target_sector_ids: string[]
          target_type: string
          target_user_ids: string[]
          updated_at: string
          updated_by: string | null
          weekdays: number[]
        }
        Insert: {
          id?: string
          interval_hours?: number
          is_enabled?: boolean
          min_total_to_show?: number
          quiet_end?: string
          quiet_start?: string
          requires_acknowledge?: boolean
          show_my_tickets?: boolean
          show_open_chats?: boolean
          show_sector_tickets?: boolean
          sound_enabled?: boolean
          target_sector_ids?: string[]
          target_type?: string
          target_user_ids?: string[]
          updated_at?: string
          updated_by?: string | null
          weekdays?: number[]
        }
        Update: {
          id?: string
          interval_hours?: number
          is_enabled?: boolean
          min_total_to_show?: number
          quiet_end?: string
          quiet_start?: string
          requires_acknowledge?: boolean
          show_my_tickets?: boolean
          show_open_chats?: boolean
          show_sector_tickets?: boolean
          sound_enabled?: boolean
          target_sector_ids?: string[]
          target_type?: string
          target_user_ids?: string[]
          updated_at?: string
          updated_by?: string | null
          weekdays?: number[]
        }
        Relationships: []
      }
      perdidos_items: {
        Row: {
          created_at: string
          default_quantity: number
          default_unit_value: number
          id: string
          is_active: boolean
          name: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          default_quantity?: number
          default_unit_value?: number
          id?: string
          is_active?: boolean
          name: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          default_quantity?: number
          default_unit_value?: number
          id?: string
          is_active?: boolean
          name?: string
          updated_at?: string
        }
        Relationships: []
      }
      profiles: {
        Row: {
          attendance_target_minutes: number | null
          avatar_url: string | null
          birth_date: string | null
          can_access_ai_manager: boolean
          created_at: string
          group_id: string | null
          id: string
          is_chat_available: boolean
          last_seen_at: string | null
          name: string
          updated_at: string
          user_id: string
        }
        Insert: {
          attendance_target_minutes?: number | null
          avatar_url?: string | null
          birth_date?: string | null
          can_access_ai_manager?: boolean
          created_at?: string
          group_id?: string | null
          id?: string
          is_chat_available?: boolean
          last_seen_at?: string | null
          name?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          attendance_target_minutes?: number | null
          avatar_url?: string | null
          birth_date?: string | null
          can_access_ai_manager?: boolean
          created_at?: string
          group_id?: string | null
          id?: string
          is_chat_available?: boolean
          last_seen_at?: string | null
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
      purchase_flow_config: {
        Row: {
          id: string
          price_variation_threshold: number
          require_expected_delivery: boolean
          require_supplier: boolean
          require_tracking: boolean
          require_unit_price: boolean
          show_expected_delivery: boolean
          show_freight: boolean
          show_seller_contact: boolean
          show_supplier: boolean
          show_tracking: boolean
          show_unit_price: boolean
          updated_at: string
        }
        Insert: {
          id?: string
          price_variation_threshold?: number
          require_expected_delivery?: boolean
          require_supplier?: boolean
          require_tracking?: boolean
          require_unit_price?: boolean
          show_expected_delivery?: boolean
          show_freight?: boolean
          show_seller_contact?: boolean
          show_supplier?: boolean
          show_tracking?: boolean
          show_unit_price?: boolean
          updated_at?: string
        }
        Update: {
          id?: string
          price_variation_threshold?: number
          require_expected_delivery?: boolean
          require_supplier?: boolean
          require_tracking?: boolean
          require_unit_price?: boolean
          show_expected_delivery?: boolean
          show_freight?: boolean
          show_seller_contact?: boolean
          show_supplier?: boolean
          show_tracking?: boolean
          show_unit_price?: boolean
          updated_at?: string
        }
        Relationships: []
      }
      purchase_item_types: {
        Row: {
          created_at: string
          id: string
          is_active: boolean
          name: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          id?: string
          is_active?: boolean
          name: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          id?: string
          is_active?: boolean
          name?: string
          updated_at?: string
        }
        Relationships: []
      }
      purchase_items: {
        Row: {
          created_at: string
          default_quantity: number
          id: string
          is_active: boolean
          item_type: string | null
          name: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          default_quantity?: number
          id?: string
          is_active?: boolean
          item_type?: string | null
          name: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          default_quantity?: number
          id?: string
          is_active?: boolean
          item_type?: string | null
          name?: string
          updated_at?: string
        }
        Relationships: []
      }
      purchase_supplier_contacts: {
        Row: {
          created_at: string
          email: string | null
          id: string
          name: string
          phone: string | null
          role: string | null
          supplier_id: string
        }
        Insert: {
          created_at?: string
          email?: string | null
          id?: string
          name: string
          phone?: string | null
          role?: string | null
          supplier_id: string
        }
        Update: {
          created_at?: string
          email?: string | null
          id?: string
          name?: string
          phone?: string | null
          role?: string | null
          supplier_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "purchase_supplier_contacts_supplier_id_fkey"
            columns: ["supplier_id"]
            isOneToOne: false
            referencedRelation: "purchase_suppliers"
            referencedColumns: ["id"]
          },
        ]
      }
      purchase_suppliers: {
        Row: {
          cnpj: string | null
          created_at: string
          id: string
          is_active: boolean
          name: string
          notes: string | null
          updated_at: string
        }
        Insert: {
          cnpj?: string | null
          created_at?: string
          id?: string
          is_active?: boolean
          name: string
          notes?: string | null
          updated_at?: string
        }
        Update: {
          cnpj?: string | null
          created_at?: string
          id?: string
          is_active?: boolean
          name?: string
          notes?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      sector_groups: {
        Row: {
          allowed_menus: string[] | null
          can_finalize_without_message: boolean
          created_at: string
          description: string | null
          id: string
          is_active: boolean
          name: string
          updated_at: string
        }
        Insert: {
          allowed_menus?: string[] | null
          can_finalize_without_message?: boolean
          created_at?: string
          description?: string | null
          id?: string
          is_active?: boolean
          name: string
          updated_at?: string
        }
        Update: {
          allowed_menus?: string[] | null
          can_finalize_without_message?: boolean
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
          closed_by: string | null
          company_id: string | null
          contact_name: string | null
          contact_phone: string | null
          created_at: string
          equipment_model_id: string | null
          equipment_model_name: string | null
          escalated_from_ticket_id: string | null
          escalated_to_gestao: boolean
          id: string
          liberacao_date: string | null
          notes: string | null
          opened_by: string | null
          pendencia_key: string | null
          plate: string | null
          priority: Database["public"]["Enums"]["ticket_priority"]
          protocol_number: number
          reminder_date: string | null
          reminder_note: string | null
          reopened_at: string | null
          sector: string | null
          status: Database["public"]["Enums"]["service_ticket_status"]
          subcategory_id: string | null
          subcategory_name: string | null
          tracking_code: string | null
          updated_at: string
        }
        Insert: {
          assigned_to?: string | null
          attendance_id: string
          category?: string | null
          channel_id?: string | null
          closed_at?: string | null
          closed_by?: string | null
          company_id?: string | null
          contact_name?: string | null
          contact_phone?: string | null
          created_at?: string
          equipment_model_id?: string | null
          equipment_model_name?: string | null
          escalated_from_ticket_id?: string | null
          escalated_to_gestao?: boolean
          id?: string
          liberacao_date?: string | null
          notes?: string | null
          opened_by?: string | null
          pendencia_key?: string | null
          plate?: string | null
          priority?: Database["public"]["Enums"]["ticket_priority"]
          protocol_number?: number
          reminder_date?: string | null
          reminder_note?: string | null
          reopened_at?: string | null
          sector?: string | null
          status?: Database["public"]["Enums"]["service_ticket_status"]
          subcategory_id?: string | null
          subcategory_name?: string | null
          tracking_code?: string | null
          updated_at?: string
        }
        Update: {
          assigned_to?: string | null
          attendance_id?: string
          category?: string | null
          channel_id?: string | null
          closed_at?: string | null
          closed_by?: string | null
          company_id?: string | null
          contact_name?: string | null
          contact_phone?: string | null
          created_at?: string
          equipment_model_id?: string | null
          equipment_model_name?: string | null
          escalated_from_ticket_id?: string | null
          escalated_to_gestao?: boolean
          id?: string
          liberacao_date?: string | null
          notes?: string | null
          opened_by?: string | null
          pendencia_key?: string | null
          plate?: string | null
          priority?: Database["public"]["Enums"]["ticket_priority"]
          protocol_number?: number
          reminder_date?: string | null
          reminder_note?: string | null
          reopened_at?: string | null
          sector?: string | null
          status?: Database["public"]["Enums"]["service_ticket_status"]
          subcategory_id?: string | null
          subcategory_name?: string | null
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
          {
            foreignKeyName: "service_tickets_equipment_model_id_fkey"
            columns: ["equipment_model_id"]
            isOneToOne: false
            referencedRelation: "liberacao_equipamento_items"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "service_tickets_subcategory_id_fkey"
            columns: ["subcategory_id"]
            isOneToOne: false
            referencedRelation: "ticket_subcategories"
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
      task_completion_history: {
        Row: {
          comment: string
          completed_at: string
          completed_by: string
          created_at: string
          id: string
          next_scheduled_for: string | null
          recurrence_type: string | null
          scheduled_for: string | null
          task_id: string
        }
        Insert: {
          comment: string
          completed_at?: string
          completed_by: string
          created_at?: string
          id?: string
          next_scheduled_for?: string | null
          recurrence_type?: string | null
          scheduled_for?: string | null
          task_id: string
        }
        Update: {
          comment?: string
          completed_at?: string
          completed_by?: string
          created_at?: string
          id?: string
          next_scheduled_for?: string | null
          recurrence_type?: string | null
          scheduled_for?: string | null
          task_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "task_completion_history_task_id_fkey"
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
          admin_only_complete: boolean
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
          recurrence_day_of_month: number | null
          recurrence_day_of_week: number | null
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
          admin_only_complete?: boolean
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
          recurrence_day_of_month?: number | null
          recurrence_day_of_week?: number | null
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
          admin_only_complete?: boolean
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
          recurrence_day_of_month?: number | null
          recurrence_day_of_week?: number | null
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
      ticket_activities: {
        Row: {
          added_by: string | null
          catalog_id: string | null
          completed_at: string | null
          completed_by: string | null
          completion_note: string | null
          created_at: string
          description_snapshot: string | null
          id: string
          is_completed: boolean
          name_snapshot: string
          ticket_id: string
          updated_at: string
        }
        Insert: {
          added_by?: string | null
          catalog_id?: string | null
          completed_at?: string | null
          completed_by?: string | null
          completion_note?: string | null
          created_at?: string
          description_snapshot?: string | null
          id?: string
          is_completed?: boolean
          name_snapshot: string
          ticket_id: string
          updated_at?: string
        }
        Update: {
          added_by?: string | null
          catalog_id?: string | null
          completed_at?: string | null
          completed_by?: string | null
          completion_note?: string | null
          created_at?: string
          description_snapshot?: string | null
          id?: string
          is_completed?: boolean
          name_snapshot?: string
          ticket_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "ticket_activities_catalog_id_fkey"
            columns: ["catalog_id"]
            isOneToOne: false
            referencedRelation: "ticket_activity_catalog"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ticket_activities_ticket_id_fkey"
            columns: ["ticket_id"]
            isOneToOne: false
            referencedRelation: "service_tickets"
            referencedColumns: ["id"]
          },
        ]
      }
      ticket_activity_catalog: {
        Row: {
          created_at: string
          created_by: string | null
          description: string | null
          id: string
          is_active: boolean
          name: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          description?: string | null
          id?: string
          is_active?: boolean
          name: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          created_by?: string | null
          description?: string | null
          id?: string
          is_active?: boolean
          name?: string
          updated_at?: string
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
      ticket_compra_equipamento_items: {
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
      ticket_perdidos_items: {
        Row: {
          created_at: string
          created_by: string | null
          id: string
          item_id: string | null
          item_name: string
          quantity: number
          ticket_id: string
          total_value: number | null
          unit_value: number
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          id?: string
          item_id?: string | null
          item_name: string
          quantity?: number
          ticket_id: string
          total_value?: number | null
          unit_value?: number
        }
        Update: {
          created_at?: string
          created_by?: string | null
          id?: string
          item_id?: string | null
          item_name?: string
          quantity?: number
          ticket_id?: string
          total_value?: number | null
          unit_value?: number
        }
        Relationships: [
          {
            foreignKeyName: "ticket_perdidos_items_item_id_fkey"
            columns: ["item_id"]
            isOneToOne: false
            referencedRelation: "perdidos_items"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ticket_perdidos_items_ticket_id_fkey"
            columns: ["ticket_id"]
            isOneToOne: false
            referencedRelation: "service_tickets"
            referencedColumns: ["id"]
          },
        ]
      }
      ticket_purchase_items: {
        Row: {
          created_at: string
          delivered_at: string | null
          delivered_by: string | null
          id: string
          item_id: string | null
          item_name: string
          quantity: number
          request_id: string | null
          status: string
          ticket_id: string
          unit_price: number
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
          request_id?: string | null
          status?: string
          ticket_id: string
          unit_price?: number
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
          request_id?: string | null
          status?: string
          ticket_id?: string
          unit_price?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "ticket_purchase_items_request_id_fkey"
            columns: ["request_id"]
            isOneToOne: false
            referencedRelation: "ticket_purchase_requests"
            referencedColumns: ["id"]
          },
        ]
      }
      ticket_purchase_requests: {
        Row: {
          created_at: string
          created_by: string | null
          expected_delivery: string | null
          freight: number
          id: string
          seller_contact: string | null
          status: string
          supplier_contact_id: string | null
          supplier_id: string | null
          ticket_id: string
          tracking_code: string | null
          updated_at: string
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          expected_delivery?: string | null
          freight?: number
          id?: string
          seller_contact?: string | null
          status?: string
          supplier_contact_id?: string | null
          supplier_id?: string | null
          ticket_id: string
          tracking_code?: string | null
          updated_at?: string
        }
        Update: {
          created_at?: string
          created_by?: string | null
          expected_delivery?: string | null
          freight?: number
          id?: string
          seller_contact?: string | null
          status?: string
          supplier_contact_id?: string | null
          supplier_id?: string | null
          ticket_id?: string
          tracking_code?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "ticket_purchase_requests_supplier_contact_id_fkey"
            columns: ["supplier_contact_id"]
            isOneToOne: false
            referencedRelation: "purchase_supplier_contacts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ticket_purchase_requests_supplier_id_fkey"
            columns: ["supplier_id"]
            isOneToOne: false
            referencedRelation: "purchase_suppliers"
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
      ticket_subcategories: {
        Row: {
          category_key: string
          category_label: string | null
          created_at: string
          created_by: string | null
          description: string | null
          id: string
          is_active: boolean
          name: string
          updated_at: string
        }
        Insert: {
          category_key: string
          category_label?: string | null
          created_at?: string
          created_by?: string | null
          description?: string | null
          id?: string
          is_active?: boolean
          name: string
          updated_at?: string
        }
        Update: {
          category_key?: string
          category_label?: string | null
          created_at?: string
          created_by?: string | null
          description?: string | null
          id?: string
          is_active?: boolean
          name?: string
          updated_at?: string
        }
        Relationships: []
      }
      ticket_subcategory_equipment_models: {
        Row: {
          created_at: string
          equipment_item_id: string
          position: number
          subcategory_id: string
        }
        Insert: {
          created_at?: string
          equipment_item_id: string
          position?: number
          subcategory_id: string
        }
        Update: {
          created_at?: string
          equipment_item_id?: string
          position?: number
          subcategory_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "ticket_subcategory_equipment_models_equipment_item_id_fkey"
            columns: ["equipment_item_id"]
            isOneToOne: false
            referencedRelation: "liberacao_equipamento_items"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ticket_subcategory_equipment_models_subcategory_id_fkey"
            columns: ["subcategory_id"]
            isOneToOne: false
            referencedRelation: "ticket_subcategories"
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
      tratativas: {
        Row: {
          alarmes: Json
          categoria: string
          cliente: string | null
          created_at: string
          created_by: string | null
          data_tratativa: string | null
          id: string
          identificador: string | null
          imei: string | null
          motorista_nome: string | null
          motorista_observacoes: string | null
          motorista_situacao: string | null
          numero_ocorrencia: string
          primeiro_alarme: string | null
          responsavel_email: string | null
          situacao: string | null
          tipo: string | null
          ultimo_alarme: string | null
          updated_at: string
        }
        Insert: {
          alarmes?: Json
          categoria: string
          cliente?: string | null
          created_at?: string
          created_by?: string | null
          data_tratativa?: string | null
          id?: string
          identificador?: string | null
          imei?: string | null
          motorista_nome?: string | null
          motorista_observacoes?: string | null
          motorista_situacao?: string | null
          numero_ocorrencia: string
          primeiro_alarme?: string | null
          responsavel_email?: string | null
          situacao?: string | null
          tipo?: string | null
          ultimo_alarme?: string | null
          updated_at?: string
        }
        Update: {
          alarmes?: Json
          categoria?: string
          cliente?: string | null
          created_at?: string
          created_by?: string | null
          data_tratativa?: string | null
          id?: string
          identificador?: string | null
          imei?: string | null
          motorista_nome?: string | null
          motorista_observacoes?: string | null
          motorista_situacao?: string | null
          numero_ocorrencia?: string
          primeiro_alarme?: string | null
          responsavel_email?: string | null
          situacao?: string | null
          tipo?: string | null
          ultimo_alarme?: string | null
          updated_at?: string
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
          closed_at: string | null
          closed_by_user_id: string | null
          contact_avatar: string | null
          contact_name: string | null
          created_at: string
          id: string
          last_message_at: string | null
          last_message_preview: string | null
          lid: string | null
          lid_aliases: string[] | null
          pending_resolve_at: string | null
          pending_resolve_ticket_id: string | null
          pending_resolve_user_id: string | null
          phone: string
          phone_normalized: string | null
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
          closed_at?: string | null
          closed_by_user_id?: string | null
          contact_avatar?: string | null
          contact_name?: string | null
          created_at?: string
          id?: string
          last_message_at?: string | null
          last_message_preview?: string | null
          lid?: string | null
          lid_aliases?: string[] | null
          pending_resolve_at?: string | null
          pending_resolve_ticket_id?: string | null
          pending_resolve_user_id?: string | null
          phone: string
          phone_normalized?: string | null
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
          closed_at?: string | null
          closed_by_user_id?: string | null
          contact_avatar?: string | null
          contact_name?: string | null
          created_at?: string
          id?: string
          last_message_at?: string | null
          last_message_preview?: string | null
          lid?: string | null
          lid_aliases?: string[] | null
          pending_resolve_at?: string | null
          pending_resolve_ticket_id?: string | null
          pending_resolve_user_id?: string | null
          phone?: string
          phone_normalized?: string | null
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
          participant_name: string | null
          participant_phone: string | null
          reply_to_author: string | null
          reply_to_message_id: string | null
          reply_to_text: string | null
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
          participant_name?: string | null
          participant_phone?: string | null
          reply_to_author?: string | null
          reply_to_message_id?: string | null
          reply_to_text?: string | null
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
          participant_name?: string | null
          participant_phone?: string | null
          reply_to_author?: string | null
          reply_to_message_id?: string | null
          reply_to_text?: string | null
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
          {
            foreignKeyName: "zapi_messages_reply_to_message_id_fkey"
            columns: ["reply_to_message_id"]
            isOneToOne: false
            referencedRelation: "zapi_messages"
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
      v_purchase_item_history: {
        Row: {
          created_at: string | null
          id: string | null
          item_id: string | null
          item_name: string | null
          quantity: number | null
          status: string | null
          supplier_id: string | null
          supplier_name: string | null
          ticket_id: string | null
          unit_price: number | null
        }
        Relationships: [
          {
            foreignKeyName: "ticket_purchase_requests_supplier_id_fkey"
            columns: ["supplier_id"]
            isOneToOne: false
            referencedRelation: "purchase_suppliers"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Functions: {
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
      is_operator_chat_participant: {
        Args: { _chat_id: string; _user_id: string }
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
      list_channels_safe: {
        Args: never
        Returns: {
          created_at: string
          id: string
          is_active: boolean
          name: string
          platform: string
          updated_at: string
        }[]
      }
      normalize_zapi_phone: { Args: { raw: string }; Returns: string }
      pick_least_loaded_agent: { Args: { _sector: string }; Returns: string }
      pick_least_loaded_agent_any: {
        Args: { _sector: string }
        Returns: string
      }
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
