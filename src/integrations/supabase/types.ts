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
      accessory_catalog: {
        Row: {
          ativo: boolean
          created_at: string
          created_by: string | null
          estoque_minimo: number
          id: string
          modelo: string | null
          name: string
          saldo: number
          tipo: string | null
          updated_at: string
        }
        Insert: {
          ativo?: boolean
          created_at?: string
          created_by?: string | null
          estoque_minimo?: number
          id?: string
          modelo?: string | null
          name: string
          saldo?: number
          tipo?: string | null
          updated_at?: string
        }
        Update: {
          ativo?: boolean
          created_at?: string
          created_by?: string | null
          estoque_minimo?: number
          id?: string
          modelo?: string | null
          name?: string
          saldo?: number
          tipo?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      ai_assistant_config: {
        Row: {
          auto_summary_enabled: boolean
          fallback_message: string
          forbidden_topics: string
          ia_oportunidades_ativo: boolean
          ia_oportunidades_confianca: number
          id: string
          is_enabled: boolean
          response_format: string
          suggest_reply_enabled: boolean
          system_prompt: string
          temperature: number
          tone: string
          updated_at: string
          updated_by: string | null
        }
        Insert: {
          auto_summary_enabled?: boolean
          fallback_message?: string
          forbidden_topics?: string
          ia_oportunidades_ativo?: boolean
          ia_oportunidades_confianca?: number
          id?: string
          is_enabled?: boolean
          response_format?: string
          suggest_reply_enabled?: boolean
          system_prompt?: string
          temperature?: number
          tone?: string
          updated_at?: string
          updated_by?: string | null
        }
        Update: {
          auto_summary_enabled?: boolean
          fallback_message?: string
          forbidden_topics?: string
          ia_oportunidades_ativo?: boolean
          ia_oportunidades_confianca?: number
          id?: string
          is_enabled?: boolean
          response_format?: string
          suggest_reply_enabled?: boolean
          system_prompt?: string
          temperature?: number
          tone?: string
          updated_at?: string
          updated_by?: string | null
        }
        Relationships: []
      }
      ai_assistant_files: {
        Row: {
          created_at: string
          description: string | null
          file_name: string
          file_path: string
          file_size: number | null
          id: string
          mime_type: string | null
          uploaded_by: string | null
        }
        Insert: {
          created_at?: string
          description?: string | null
          file_name: string
          file_path: string
          file_size?: number | null
          id?: string
          mime_type?: string | null
          uploaded_by?: string | null
        }
        Update: {
          created_at?: string
          description?: string | null
          file_name?: string
          file_path?: string
          file_size?: number | null
          id?: string
          mime_type?: string | null
          uploaded_by?: string | null
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
      bot_auto_reply_log: {
        Row: {
          channel_id: string | null
          chat_id: string | null
          collected_data: Json
          confidence: number | null
          created_at: string
          detected_intent: string | null
          id: string
          incoming_text: string | null
          message_id: string | null
          outcome: string
          reply_text: string | null
          rule_id: string | null
          rule_name: string | null
        }
        Insert: {
          channel_id?: string | null
          chat_id?: string | null
          collected_data?: Json
          confidence?: number | null
          created_at?: string
          detected_intent?: string | null
          id?: string
          incoming_text?: string | null
          message_id?: string | null
          outcome?: string
          reply_text?: string | null
          rule_id?: string | null
          rule_name?: string | null
        }
        Update: {
          channel_id?: string | null
          chat_id?: string | null
          collected_data?: Json
          confidence?: number | null
          created_at?: string
          detected_intent?: string | null
          id?: string
          incoming_text?: string | null
          message_id?: string | null
          outcome?: string
          reply_text?: string | null
          rule_id?: string | null
          rule_name?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "bot_auto_reply_log_rule_id_fkey"
            columns: ["rule_id"]
            isOneToOne: false
            referencedRelation: "bot_auto_reply_rules"
            referencedColumns: ["id"]
          },
        ]
      }
      bot_auto_reply_rules: {
        Row: {
          catalog_key: string | null
          create_ticket: boolean
          created_at: string
          created_by: string | null
          from_catalog: boolean
          id: string
          is_enabled: boolean
          is_greeting: boolean
          keywords: string[]
          name: string
          priority: number
          reply_text: string
          reply_text_complete: string | null
          required_fields: string[]
          target_sector: string | null
          ticket_priority: string
          updated_at: string
          updated_by: string | null
        }
        Insert: {
          catalog_key?: string | null
          create_ticket?: boolean
          created_at?: string
          created_by?: string | null
          from_catalog?: boolean
          id?: string
          is_enabled?: boolean
          is_greeting?: boolean
          keywords?: string[]
          name: string
          priority?: number
          reply_text?: string
          reply_text_complete?: string | null
          required_fields?: string[]
          target_sector?: string | null
          ticket_priority?: string
          updated_at?: string
          updated_by?: string | null
        }
        Update: {
          catalog_key?: string | null
          create_ticket?: boolean
          created_at?: string
          created_by?: string | null
          from_catalog?: boolean
          id?: string
          is_enabled?: boolean
          is_greeting?: boolean
          keywords?: string[]
          name?: string
          priority?: number
          reply_text?: string
          reply_text_complete?: string | null
          required_fields?: string[]
          target_sector?: string | null
          ticket_priority?: string
          updated_at?: string
          updated_by?: string | null
        }
        Relationships: []
      }
      bot_auto_reply_settings: {
        Row: {
          ai_enabled: boolean
          ai_min_confidence: number
          channel_id: string | null
          created_at: string
          end_hour: string
          fallback_enabled: boolean
          fallback_text: string
          follow_up_minutes: number
          greeting_seconds: number
          id: string
          is_enabled: boolean
          max_replies_per_chat: number
          observe_only: boolean
          skip_when_ticket_open: boolean
          start_hour: string
          updated_at: string
          updated_by: string | null
        }
        Insert: {
          ai_enabled?: boolean
          ai_min_confidence?: number
          channel_id?: string | null
          created_at?: string
          end_hour?: string
          fallback_enabled?: boolean
          fallback_text?: string
          follow_up_minutes?: number
          greeting_seconds?: number
          id?: string
          is_enabled?: boolean
          max_replies_per_chat?: number
          observe_only?: boolean
          skip_when_ticket_open?: boolean
          start_hour?: string
          updated_at?: string
          updated_by?: string | null
        }
        Update: {
          ai_enabled?: boolean
          ai_min_confidence?: number
          channel_id?: string | null
          created_at?: string
          end_hour?: string
          fallback_enabled?: boolean
          fallback_text?: string
          follow_up_minutes?: number
          greeting_seconds?: number
          id?: string
          is_enabled?: boolean
          max_replies_per_chat?: number
          observe_only?: boolean
          skip_when_ticket_open?: boolean
          start_hour?: string
          updated_at?: string
          updated_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "bot_auto_reply_settings_channel_id_fkey"
            columns: ["channel_id"]
            isOneToOne: false
            referencedRelation: "channels"
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
      chat_tag_catalog: {
        Row: {
          color: string
          created_at: string
          created_by: string | null
          description: string | null
          id: string
          is_active: boolean
          name: string
          updated_at: string
        }
        Insert: {
          color?: string
          created_at?: string
          created_by?: string | null
          description?: string | null
          id?: string
          is_active?: boolean
          name: string
          updated_at?: string
        }
        Update: {
          color?: string
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
      chat_technicians: {
        Row: {
          address: string | null
          city_state: string | null
          contact_phone: string
          created_at: string
          created_by: string | null
          created_by_name: string | null
          id: string
          is_city_default: boolean
          name: string
          notes: string | null
          phone: string | null
          updated_at: string
          updated_by: string | null
          updated_by_name: string | null
        }
        Insert: {
          address?: string | null
          city_state?: string | null
          contact_phone: string
          created_at?: string
          created_by?: string | null
          created_by_name?: string | null
          id?: string
          is_city_default?: boolean
          name: string
          notes?: string | null
          phone?: string | null
          updated_at?: string
          updated_by?: string | null
          updated_by_name?: string | null
        }
        Update: {
          address?: string | null
          city_state?: string | null
          contact_phone?: string
          created_at?: string
          created_by?: string | null
          created_by_name?: string | null
          id?: string
          is_city_default?: boolean
          name?: string
          notes?: string | null
          phone?: string | null
          updated_at?: string
          updated_by?: string | null
          updated_by_name?: string | null
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
          plan_tier: string | null
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
          plan_tier?: string | null
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
          plan_tier?: string | null
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
          contact_name: string | null
          created_at: string
          id: string
          phone_number: string
        }
        Insert: {
          company_id: string
          contact_name?: string | null
          created_at?: string
          id?: string
          phone_number: string
        }
        Update: {
          company_id?: string
          contact_name?: string | null
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
      company_platforms: {
        Row: {
          company_id: string
          created_at: string
          id: string
          notes: string
          platform_id: string
          updated_at: string
        }
        Insert: {
          company_id: string
          created_at?: string
          id?: string
          notes?: string
          platform_id: string
          updated_at?: string
        }
        Update: {
          company_id?: string
          created_at?: string
          id?: string
          notes?: string
          platform_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "company_platforms_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "company_platforms_platform_id_fkey"
            columns: ["platform_id"]
            isOneToOne: false
            referencedRelation: "platforms"
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
      company_shared_notes: {
        Row: {
          company_id: string
          content: string
          created_at: string
          updated_at: string
          updated_by: string | null
          updated_by_name: string
        }
        Insert: {
          company_id: string
          content?: string
          created_at?: string
          updated_at?: string
          updated_by?: string | null
          updated_by_name?: string
        }
        Update: {
          company_id?: string
          content?: string
          created_at?: string
          updated_at?: string
          updated_by?: string | null
          updated_by_name?: string
        }
        Relationships: [
          {
            foreignKeyName: "company_shared_notes_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: true
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
      contratos: {
        Row: {
          arquivo_assinado_url: string | null
          assinado_em: string | null
          assinatura_canal: string | null
          assinatura_geo: string | null
          assinatura_ip: string | null
          assinatura_nome: string | null
          assinatura_user_agent: string | null
          avisos_enviados: Json
          cancelado_motivo: string | null
          categoria: string
          cliente_documento: string
          cliente_nome: string
          conteudo_html: string | null
          contratada_assinado_em: string | null
          contratada_assinado_nome: string | null
          contratada_assinado_por: string | null
          contratada_ip: string | null
          created_at: string
          created_by: string | null
          dados: Json
          enviado_em: string | null
          hash_sha256: string | null
          id: string
          is_teste: boolean
          lembretes_enviados: number
          modelos_versao: Json | null
          numero: number
          pasta: string | null
          proposta_link_id: string | null
          provedor: string
          provedor_documento_id: string | null
          provedor_link: string | null
          provedor_pasta_id: string | null
          provedor_sandbox: boolean
          provedor_signatarios: Json
          provedor_verificacao: string | null
          reajustes: Json
          renovacao_automatica: boolean
          signatario_cpf: string | null
          signatario_email: string | null
          signatario_nome: string | null
          signatario_telefone: string | null
          status: string
          testemunhas: Json
          token: string
          ultimo_lembrete_em: string | null
          updated_at: string
          valor_implantacao: number | null
          valor_mensal: number | null
          valor_mensal_atual: number | null
          vigencia_inicio: string | null
          vigencia_meses: number
          visualizado_em: string | null
        }
        Insert: {
          arquivo_assinado_url?: string | null
          assinado_em?: string | null
          assinatura_canal?: string | null
          assinatura_geo?: string | null
          assinatura_ip?: string | null
          assinatura_nome?: string | null
          assinatura_user_agent?: string | null
          avisos_enviados?: Json
          cancelado_motivo?: string | null
          categoria?: string
          cliente_documento: string
          cliente_nome: string
          conteudo_html?: string | null
          contratada_assinado_em?: string | null
          contratada_assinado_nome?: string | null
          contratada_assinado_por?: string | null
          contratada_ip?: string | null
          created_at?: string
          created_by?: string | null
          dados?: Json
          enviado_em?: string | null
          hash_sha256?: string | null
          id?: string
          is_teste?: boolean
          lembretes_enviados?: number
          modelos_versao?: Json | null
          numero?: number
          pasta?: string | null
          proposta_link_id?: string | null
          provedor?: string
          provedor_documento_id?: string | null
          provedor_link?: string | null
          provedor_pasta_id?: string | null
          provedor_sandbox?: boolean
          provedor_signatarios?: Json
          provedor_verificacao?: string | null
          reajustes?: Json
          renovacao_automatica?: boolean
          signatario_cpf?: string | null
          signatario_email?: string | null
          signatario_nome?: string | null
          signatario_telefone?: string | null
          status?: string
          testemunhas?: Json
          token?: string
          ultimo_lembrete_em?: string | null
          updated_at?: string
          valor_implantacao?: number | null
          valor_mensal?: number | null
          valor_mensal_atual?: number | null
          vigencia_inicio?: string | null
          vigencia_meses?: number
          visualizado_em?: string | null
        }
        Update: {
          arquivo_assinado_url?: string | null
          assinado_em?: string | null
          assinatura_canal?: string | null
          assinatura_geo?: string | null
          assinatura_ip?: string | null
          assinatura_nome?: string | null
          assinatura_user_agent?: string | null
          avisos_enviados?: Json
          cancelado_motivo?: string | null
          categoria?: string
          cliente_documento?: string
          cliente_nome?: string
          conteudo_html?: string | null
          contratada_assinado_em?: string | null
          contratada_assinado_nome?: string | null
          contratada_assinado_por?: string | null
          contratada_ip?: string | null
          created_at?: string
          created_by?: string | null
          dados?: Json
          enviado_em?: string | null
          hash_sha256?: string | null
          id?: string
          is_teste?: boolean
          lembretes_enviados?: number
          modelos_versao?: Json | null
          numero?: number
          pasta?: string | null
          proposta_link_id?: string | null
          provedor?: string
          provedor_documento_id?: string | null
          provedor_link?: string | null
          provedor_pasta_id?: string | null
          provedor_sandbox?: boolean
          provedor_signatarios?: Json
          provedor_verificacao?: string | null
          reajustes?: Json
          renovacao_automatica?: boolean
          signatario_cpf?: string | null
          signatario_email?: string | null
          signatario_nome?: string | null
          signatario_telefone?: string | null
          status?: string
          testemunhas?: Json
          token?: string
          ultimo_lembrete_em?: string | null
          updated_at?: string
          valor_implantacao?: number | null
          valor_mensal?: number | null
          valor_mensal_atual?: number | null
          vigencia_inicio?: string | null
          vigencia_meses?: number
          visualizado_em?: string | null
        }
        Relationships: []
      }
      contratos_codigos: {
        Row: {
          canal: string
          codigo_hash: string
          contrato_id: string
          created_at: string
          destino: string
          enviados_ultima_hora: number
          expira_em: string
          janela_inicio: string
          tentativas: number
        }
        Insert: {
          canal: string
          codigo_hash: string
          contrato_id: string
          created_at?: string
          destino: string
          enviados_ultima_hora?: number
          expira_em: string
          janela_inicio?: string
          tentativas?: number
        }
        Update: {
          canal?: string
          codigo_hash?: string
          contrato_id?: string
          created_at?: string
          destino?: string
          enviados_ultima_hora?: number
          expira_em?: string
          janela_inicio?: string
          tentativas?: number
        }
        Relationships: [
          {
            foreignKeyName: "contratos_codigos_contrato_id_fkey"
            columns: ["contrato_id"]
            isOneToOne: true
            referencedRelation: "contratos"
            referencedColumns: ["id"]
          },
        ]
      }
      contratos_config: {
        Row: {
          financeiro_tolerancia_pct: number
          id: number
          indices: Json
          lembrete_ativo: boolean
          lembrete_avisar_responsavel: boolean
          lembrete_avisar_setores: string[]
          lembrete_dias: number[]
          lembrete_modo: string
          proposta_avisar_setores: string[]
          proposta_cria_rascunho: boolean
          reajuste_ativo: boolean
          reajuste_avisar_setores: string[]
          reajuste_aviso_dias: number
          reajuste_fixo_pct: number
          reajuste_indice: string
          reajuste_mensagem: string
          ultima_rotina_em: string | null
          ultima_rotina_resumo: Json | null
          updated_at: string
          updated_by: string | null
          vencimento_ativo: boolean
          vencimento_avisar_responsavel: boolean
          vencimento_avisar_setores: string[]
          vencimento_avisar_usuarios: string[]
          vencimento_dias: number[]
          vencimento_fornecedores: boolean
        }
        Insert: {
          financeiro_tolerancia_pct?: number
          id?: number
          indices?: Json
          lembrete_ativo?: boolean
          lembrete_avisar_responsavel?: boolean
          lembrete_avisar_setores?: string[]
          lembrete_dias?: number[]
          lembrete_modo?: string
          proposta_avisar_setores?: string[]
          proposta_cria_rascunho?: boolean
          reajuste_ativo?: boolean
          reajuste_avisar_setores?: string[]
          reajuste_aviso_dias?: number
          reajuste_fixo_pct?: number
          reajuste_indice?: string
          reajuste_mensagem?: string
          ultima_rotina_em?: string | null
          ultima_rotina_resumo?: Json | null
          updated_at?: string
          updated_by?: string | null
          vencimento_ativo?: boolean
          vencimento_avisar_responsavel?: boolean
          vencimento_avisar_setores?: string[]
          vencimento_avisar_usuarios?: string[]
          vencimento_dias?: number[]
          vencimento_fornecedores?: boolean
        }
        Update: {
          financeiro_tolerancia_pct?: number
          id?: number
          indices?: Json
          lembrete_ativo?: boolean
          lembrete_avisar_responsavel?: boolean
          lembrete_avisar_setores?: string[]
          lembrete_dias?: number[]
          lembrete_modo?: string
          proposta_avisar_setores?: string[]
          proposta_cria_rascunho?: boolean
          reajuste_ativo?: boolean
          reajuste_avisar_setores?: string[]
          reajuste_aviso_dias?: number
          reajuste_fixo_pct?: number
          reajuste_indice?: string
          reajuste_mensagem?: string
          ultima_rotina_em?: string | null
          ultima_rotina_resumo?: Json | null
          updated_at?: string
          updated_by?: string | null
          vencimento_ativo?: boolean
          vencimento_avisar_responsavel?: boolean
          vencimento_avisar_setores?: string[]
          vencimento_avisar_usuarios?: string[]
          vencimento_dias?: number[]
          vencimento_fornecedores?: boolean
        }
        Relationships: []
      }
      contratos_cron_token: {
        Row: {
          created_at: string
          id: number
          token: string
        }
        Insert: {
          created_at?: string
          id?: number
          token: string
        }
        Update: {
          created_at?: string
          id?: number
          token?: string
        }
        Relationships: []
      }
      contratos_eventos: {
        Row: {
          contrato_id: string
          created_at: string
          descricao: string | null
          id: string
          ip: string | null
          tipo: string
          user_agent: string | null
          user_id: string | null
        }
        Insert: {
          contrato_id: string
          created_at?: string
          descricao?: string | null
          id?: string
          ip?: string | null
          tipo: string
          user_agent?: string | null
          user_id?: string | null
        }
        Update: {
          contrato_id?: string
          created_at?: string
          descricao?: string | null
          id?: string
          ip?: string | null
          tipo?: string
          user_agent?: string | null
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "contratos_eventos_contrato_id_fkey"
            columns: ["contrato_id"]
            isOneToOne: false
            referencedRelation: "contratos"
            referencedColumns: ["id"]
          },
        ]
      }
      contratos_modelos: {
        Row: {
          chave: string
          conteudo: string
          created_at: string
          id: string
          nome: string
          updated_at: string
          updated_by: string | null
          versao: number
        }
        Insert: {
          chave: string
          conteudo: string
          created_at?: string
          id?: string
          nome: string
          updated_at?: string
          updated_by?: string | null
          versao?: number
        }
        Update: {
          chave?: string
          conteudo?: string
          created_at?: string
          id?: string
          nome?: string
          updated_at?: string
          updated_by?: string | null
          versao?: number
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
          is_teste: boolean
          loss_reason: string | null
          notes: string | null
          opportunity_type: string
          owner_id: string | null
          probability: number
          referral_id: string | null
          source: string | null
          stage_entered_at: string
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
          is_teste?: boolean
          loss_reason?: string | null
          notes?: string | null
          opportunity_type?: string
          owner_id?: string | null
          probability?: number
          referral_id?: string | null
          source?: string | null
          stage_entered_at?: string
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
          is_teste?: boolean
          loss_reason?: string | null
          notes?: string | null
          opportunity_type?: string
          owner_id?: string | null
          probability?: number
          referral_id?: string | null
          source?: string | null
          stage_entered_at?: string
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
      crm_opportunity_quotes: {
        Row: {
          created_at: string
          created_by: string | null
          id: string
          items: Json
          notes: string | null
          opportunity_id: string
          quote_number: number
          total_activation: number
          total_monthly: number
          updated_at: string
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          id?: string
          items?: Json
          notes?: string | null
          opportunity_id: string
          quote_number: number
          total_activation?: number
          total_monthly?: number
          updated_at?: string
        }
        Update: {
          created_at?: string
          created_by?: string | null
          id?: string
          items?: Json
          notes?: string | null
          opportunity_id?: string
          quote_number?: number
          total_activation?: number
          total_monthly?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "crm_opportunity_quotes_opportunity_id_fkey"
            columns: ["opportunity_id"]
            isOneToOne: false
            referencedRelation: "crm_opportunities"
            referencedColumns: ["id"]
          },
        ]
      }
      crm_opportunity_types: {
        Row: {
          created_at: string
          id: string
          name: string
          position: number
          updated_at: string
        }
        Insert: {
          created_at?: string
          id?: string
          name: string
          position?: number
          updated_at?: string
        }
        Update: {
          created_at?: string
          id?: string
          name?: string
          position?: number
          updated_at?: string
        }
        Relationships: []
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
          sla_days: number
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
          sla_days?: number
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
          sla_days?: number
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
      crm_posvenda_carteira: {
        Row: {
          ativo: boolean
          atualizado_em: string
          chamados_90d: number | null
          chamados_atrasados: number | null
          classe: string
          classe_manual: string | null
          created_at: string
          decisor_nome: string | null
          decisor_telefone: string | null
          diagnostico_em: string | null
          documento: string
          frota_total: number | null
          gsystem_cliente_key: string | null
          id: string
          interesses: string[]
          nome: string
          observacoes: string | null
          primeira_fatura_em: string | null
          proximo_contato_em: string | null
          rc_atualizado_em: string | null
          rc_dias_max: number
          rc_notificadas: number
          rc_placas_paradas: number
          receita_mensal: number
          responsavel_id: string | null
          risco_em: string | null
          risco_motivos: Json | null
          risco_nivel: string | null
          risco_nota: number | null
          ultimo_contato_em: string | null
          ultimo_nps: number | null
          ultimo_sentimento: string | null
          vencidas_dias: number | null
          vencidas_qtd: number
          vencidas_valor: number
        }
        Insert: {
          ativo?: boolean
          atualizado_em?: string
          chamados_90d?: number | null
          chamados_atrasados?: number | null
          classe?: string
          classe_manual?: string | null
          created_at?: string
          decisor_nome?: string | null
          decisor_telefone?: string | null
          diagnostico_em?: string | null
          documento: string
          frota_total?: number | null
          gsystem_cliente_key?: string | null
          id?: string
          interesses?: string[]
          nome: string
          observacoes?: string | null
          primeira_fatura_em?: string | null
          proximo_contato_em?: string | null
          rc_atualizado_em?: string | null
          rc_dias_max?: number
          rc_notificadas?: number
          rc_placas_paradas?: number
          receita_mensal?: number
          responsavel_id?: string | null
          risco_em?: string | null
          risco_motivos?: Json | null
          risco_nivel?: string | null
          risco_nota?: number | null
          ultimo_contato_em?: string | null
          ultimo_nps?: number | null
          ultimo_sentimento?: string | null
          vencidas_dias?: number | null
          vencidas_qtd?: number
          vencidas_valor?: number
        }
        Update: {
          ativo?: boolean
          atualizado_em?: string
          chamados_90d?: number | null
          chamados_atrasados?: number | null
          classe?: string
          classe_manual?: string | null
          created_at?: string
          decisor_nome?: string | null
          decisor_telefone?: string | null
          diagnostico_em?: string | null
          documento?: string
          frota_total?: number | null
          gsystem_cliente_key?: string | null
          id?: string
          interesses?: string[]
          nome?: string
          observacoes?: string | null
          primeira_fatura_em?: string | null
          proximo_contato_em?: string | null
          rc_atualizado_em?: string | null
          rc_dias_max?: number
          rc_notificadas?: number
          rc_placas_paradas?: number
          receita_mensal?: number
          responsavel_id?: string | null
          risco_em?: string | null
          risco_motivos?: Json | null
          risco_nivel?: string | null
          risco_nota?: number | null
          ultimo_contato_em?: string | null
          ultimo_nps?: number | null
          ultimo_sentimento?: string | null
          vencidas_dias?: number | null
          vencidas_qtd?: number
          vencidas_valor?: number
        }
        Relationships: []
      }
      crm_posvenda_contatos: {
        Row: {
          canal: string
          carteira_id: string
          created_at: string
          data: string
          decisor_nome: string | null
          decisor_telefone: string | null
          frota_total: number | null
          id: string
          interesses: string[] | null
          nps: number | null
          oportunidade: string | null
          oportunidade_valor: number | null
          proximo_contato_em: string | null
          proximo_passo: string | null
          resultado: string
          resumo: string
          roteiro: string
          sentimento: string | null
          user_id: string | null
        }
        Insert: {
          canal?: string
          carteira_id: string
          created_at?: string
          data?: string
          decisor_nome?: string | null
          decisor_telefone?: string | null
          frota_total?: number | null
          id?: string
          interesses?: string[] | null
          nps?: number | null
          oportunidade?: string | null
          oportunidade_valor?: number | null
          proximo_contato_em?: string | null
          proximo_passo?: string | null
          resultado?: string
          resumo?: string
          roteiro?: string
          sentimento?: string | null
          user_id?: string | null
        }
        Update: {
          canal?: string
          carteira_id?: string
          created_at?: string
          data?: string
          decisor_nome?: string | null
          decisor_telefone?: string | null
          frota_total?: number | null
          id?: string
          interesses?: string[] | null
          nps?: number | null
          oportunidade?: string | null
          oportunidade_valor?: number | null
          proximo_contato_em?: string | null
          proximo_passo?: string | null
          resultado?: string
          resumo?: string
          roteiro?: string
          sentimento?: string | null
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "crm_posvenda_contatos_carteira_id_fkey"
            columns: ["carteira_id"]
            isOneToOne: false
            referencedRelation: "crm_posvenda_carteira"
            referencedColumns: ["id"]
          },
        ]
      }
      crm_proposal_links: {
        Row: {
          cpf_verified_at: string | null
          created_at: string
          created_by: string | null
          expires_at: string | null
          first_viewed_at: string | null
          id: string
          is_teste: boolean
          last_viewed_at: string | null
          opportunity_id: string
          quote_id: string | null
          responded_at: string | null
          responder_cpf: string | null
          responder_ip: string | null
          responder_name: string | null
          responder_note: string | null
          responder_user_agent: string | null
          send_errors: Json
          sent_channels: string[]
          sent_to_email: string | null
          sent_to_phone: string | null
          snapshot: Json
          status: string
          token: string
          view_count: number
          viewer_cpf: string | null
        }
        Insert: {
          cpf_verified_at?: string | null
          created_at?: string
          created_by?: string | null
          expires_at?: string | null
          first_viewed_at?: string | null
          id?: string
          is_teste?: boolean
          last_viewed_at?: string | null
          opportunity_id: string
          quote_id?: string | null
          responded_at?: string | null
          responder_cpf?: string | null
          responder_ip?: string | null
          responder_name?: string | null
          responder_note?: string | null
          responder_user_agent?: string | null
          send_errors?: Json
          sent_channels?: string[]
          sent_to_email?: string | null
          sent_to_phone?: string | null
          snapshot: Json
          status?: string
          token?: string
          view_count?: number
          viewer_cpf?: string | null
        }
        Update: {
          cpf_verified_at?: string | null
          created_at?: string
          created_by?: string | null
          expires_at?: string | null
          first_viewed_at?: string | null
          id?: string
          is_teste?: boolean
          last_viewed_at?: string | null
          opportunity_id?: string
          quote_id?: string | null
          responded_at?: string | null
          responder_cpf?: string | null
          responder_ip?: string | null
          responder_name?: string | null
          responder_note?: string | null
          responder_user_agent?: string | null
          send_errors?: Json
          sent_channels?: string[]
          sent_to_email?: string | null
          sent_to_phone?: string | null
          snapshot?: Json
          status?: string
          token?: string
          view_count?: number
          viewer_cpf?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "crm_proposal_links_opportunity_id_fkey"
            columns: ["opportunity_id"]
            isOneToOne: false
            referencedRelation: "crm_opportunities"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "crm_proposal_links_quote_id_fkey"
            columns: ["quote_id"]
            isOneToOne: false
            referencedRelation: "crm_opportunity_quotes"
            referencedColumns: ["id"]
          },
        ]
      }
      crm_proposal_settings: {
        Row: {
          accepted_stage_id: string | null
          company_address: string
          company_cnpj: string
          company_email: string
          company_name: string
          company_phone: string
          company_website: string
          email_channel_id: string | null
          email_subject: string
          email_template: string
          footer_text: string
          id: string
          intro_text: string
          logo_url: string
          notify_owner: boolean
          primary_color: string
          public_base_url: string
          rejected_stage_id: string | null
          require_reject_reason: boolean
          sent_stage_id: string | null
          terms_text: string
          updated_at: string
          updated_by: string | null
          validity_days: number
          whatsapp_channel_id: string | null
          whatsapp_template: string
        }
        Insert: {
          accepted_stage_id?: string | null
          company_address?: string
          company_cnpj?: string
          company_email?: string
          company_name?: string
          company_phone?: string
          company_website?: string
          email_channel_id?: string | null
          email_subject?: string
          email_template?: string
          footer_text?: string
          id?: string
          intro_text?: string
          logo_url?: string
          notify_owner?: boolean
          primary_color?: string
          public_base_url?: string
          rejected_stage_id?: string | null
          require_reject_reason?: boolean
          sent_stage_id?: string | null
          terms_text?: string
          updated_at?: string
          updated_by?: string | null
          validity_days?: number
          whatsapp_channel_id?: string | null
          whatsapp_template?: string
        }
        Update: {
          accepted_stage_id?: string | null
          company_address?: string
          company_cnpj?: string
          company_email?: string
          company_name?: string
          company_phone?: string
          company_website?: string
          email_channel_id?: string | null
          email_subject?: string
          email_template?: string
          footer_text?: string
          id?: string
          intro_text?: string
          logo_url?: string
          notify_owner?: boolean
          primary_color?: string
          public_base_url?: string
          rejected_stage_id?: string | null
          require_reject_reason?: boolean
          sent_stage_id?: string | null
          terms_text?: string
          updated_at?: string
          updated_by?: string | null
          validity_days?: number
          whatsapp_channel_id?: string | null
          whatsapp_template?: string
        }
        Relationships: [
          {
            foreignKeyName: "crm_proposal_settings_accepted_stage_id_fkey"
            columns: ["accepted_stage_id"]
            isOneToOne: false
            referencedRelation: "crm_pipeline_stages"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "crm_proposal_settings_email_channel_id_fkey"
            columns: ["email_channel_id"]
            isOneToOne: false
            referencedRelation: "email_channels"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "crm_proposal_settings_rejected_stage_id_fkey"
            columns: ["rejected_stage_id"]
            isOneToOne: false
            referencedRelation: "crm_pipeline_stages"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "crm_proposal_settings_sent_stage_id_fkey"
            columns: ["sent_stage_id"]
            isOneToOne: false
            referencedRelation: "crm_pipeline_stages"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "crm_proposal_settings_whatsapp_channel_id_fkey"
            columns: ["whatsapp_channel_id"]
            isOneToOne: false
            referencedRelation: "channels"
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
      crm_service_catalog: {
        Row: {
          category_id: string | null
          created_at: string
          default_activation: number
          default_monthly: number
          description: string
          id: string
          is_active: boolean
          is_default: boolean
          name: string
          position: number
          unit: string
          updated_at: string
        }
        Insert: {
          category_id?: string | null
          created_at?: string
          default_activation?: number
          default_monthly?: number
          description?: string
          id?: string
          is_active?: boolean
          is_default?: boolean
          name: string
          position?: number
          unit?: string
          updated_at?: string
        }
        Update: {
          category_id?: string | null
          created_at?: string
          default_activation?: number
          default_monthly?: number
          description?: string
          id?: string
          is_active?: boolean
          is_default?: boolean
          name?: string
          position?: number
          unit?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "crm_service_catalog_category_id_fkey"
            columns: ["category_id"]
            isOneToOne: false
            referencedRelation: "crm_categories"
            referencedColumns: ["id"]
          },
        ]
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
          is_teste: boolean
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
          is_teste?: boolean
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
          is_teste?: boolean
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
          connection_key: string
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
          connection_key?: string
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
          connection_key?: string
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
          conversation_id: string | null
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
          conversation_id?: string | null
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
          conversation_id?: string | null
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
      equipment_kit_items: {
        Row: {
          accessory_id: string
          equipamento_codigo: string
          id: string
          quantidade: number
          updated_at: string
          updated_by: string | null
        }
        Insert: {
          accessory_id: string
          equipamento_codigo: string
          id?: string
          quantidade?: number
          updated_at?: string
          updated_by?: string | null
        }
        Update: {
          accessory_id?: string
          equipamento_codigo?: string
          id?: string
          quantidade?: number
          updated_at?: string
          updated_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "equipment_kit_items_accessory_id_fkey"
            columns: ["accessory_id"]
            isOneToOne: false
            referencedRelation: "accessory_catalog"
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
      fin_acesso: {
        Row: {
          created_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          user_id?: string
        }
        Relationships: []
      }
      fin_bomcontrole_importacoes: {
        Row: {
          ate: string
          atualizados: number
          created_at: string
          created_by: string | null
          de: string
          id: string
          ignorados_gsystem: number
          ignorados_outros: number
          novos: number
          total_pagar: number
          total_receber: number
        }
        Insert: {
          ate: string
          atualizados?: number
          created_at?: string
          created_by?: string | null
          de: string
          id?: string
          ignorados_gsystem?: number
          ignorados_outros?: number
          novos?: number
          total_pagar?: number
          total_receber?: number
        }
        Update: {
          ate?: string
          atualizados?: number
          created_at?: string
          created_by?: string | null
          de?: string
          id?: string
          ignorados_gsystem?: number
          ignorados_outros?: number
          novos?: number
          total_pagar?: number
          total_receber?: number
        }
        Relationships: []
      }
      fin_bomcontrole_sync: {
        Row: {
          ativo: boolean
          atualizado_em: string | null
          concluido_em: string | null
          id: number
          idx: number
          incluir_clientes_gsystem: boolean
          iniciado_em: string | null
          janelas: Json
          pagina: number
          proximo_em: string | null
          totais: Json
          ultimo_erro: string | null
          user_id: string | null
        }
        Insert: {
          ativo?: boolean
          atualizado_em?: string | null
          concluido_em?: string | null
          id?: number
          idx?: number
          incluir_clientes_gsystem?: boolean
          iniciado_em?: string | null
          janelas?: Json
          pagina?: number
          proximo_em?: string | null
          totais?: Json
          ultimo_erro?: string | null
          user_id?: string | null
        }
        Update: {
          ativo?: boolean
          atualizado_em?: string | null
          concluido_em?: string | null
          id?: number
          idx?: number
          incluir_clientes_gsystem?: boolean
          iniciado_em?: string | null
          janelas?: Json
          pagina?: number
          proximo_em?: string | null
          totais?: Json
          ultimo_erro?: string | null
          user_id?: string | null
        }
        Relationships: []
      }
      fin_categorias: {
        Row: {
          ativo: boolean
          created_at: string
          grupo_dre: string
          id: string
          nome: string
          ordem: number
          tipo: string
        }
        Insert: {
          ativo?: boolean
          created_at?: string
          grupo_dre?: string
          id?: string
          nome: string
          ordem?: number
          tipo?: string
        }
        Update: {
          ativo?: boolean
          created_at?: string
          grupo_dre?: string
          id?: string
          nome?: string
          ordem?: number
          tipo?: string
        }
        Relationships: []
      }
      fin_clientes: {
        Row: {
          ativo_gsystem: boolean | null
          atualizado_gsystem_em: string | null
          documento: string
          email: string | null
          email_cobranca: string | null
          gsystem_key: string | null
          nome: string | null
          observacao: string | null
          regua_pausada: boolean
          situacao_gsystem: string | null
          telefone: string | null
          telefone_cobranca: string | null
          updated_at: string
        }
        Insert: {
          ativo_gsystem?: boolean | null
          atualizado_gsystem_em?: string | null
          documento: string
          email?: string | null
          email_cobranca?: string | null
          gsystem_key?: string | null
          nome?: string | null
          observacao?: string | null
          regua_pausada?: boolean
          situacao_gsystem?: string | null
          telefone?: string | null
          telefone_cobranca?: string | null
          updated_at?: string
        }
        Update: {
          ativo_gsystem?: boolean | null
          atualizado_gsystem_em?: string | null
          documento?: string
          email?: string | null
          email_cobranca?: string | null
          gsystem_key?: string | null
          nome?: string | null
          observacao?: string | null
          regua_pausada?: boolean
          situacao_gsystem?: string | null
          telefone?: string | null
          telefone_cobranca?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      fin_cobranca_acoes: {
        Row: {
          canal: string | null
          cliente_nome: string | null
          created_at: string
          created_by: string | null
          data_promessa: string | null
          documento: string
          id: string
          lancamento_ids: string[]
          observacao: string | null
          parcelas: number | null
          primeiro_vencimento: string | null
          resultado: string | null
          tipo: string
          valor: number | null
        }
        Insert: {
          canal?: string | null
          cliente_nome?: string | null
          created_at?: string
          created_by?: string | null
          data_promessa?: string | null
          documento: string
          id?: string
          lancamento_ids?: string[]
          observacao?: string | null
          parcelas?: number | null
          primeiro_vencimento?: string | null
          resultado?: string | null
          tipo: string
          valor?: number | null
        }
        Update: {
          canal?: string | null
          cliente_nome?: string | null
          created_at?: string
          created_by?: string | null
          data_promessa?: string | null
          documento?: string
          id?: string
          lancamento_ids?: string[]
          observacao?: string | null
          parcelas?: number | null
          primeiro_vencimento?: string | null
          resultado?: string | null
          tipo?: string
          valor?: number | null
        }
        Relationships: []
      }
      fin_cobranca_config: {
        Row: {
          ativo: boolean
          dias_bloqueio: number
          dias_perda: number
          email_channel_id: string | null
          id: number
          mensagem_antes: string | null
          mensagem_atraso: string | null
          neg_dias_minimo: number
          neg_valor_minimo: number
          passos: Json
          prazo_baixa_dias_uteis: number
          so_ativos: boolean
          ultima_execucao: Json | null
          ultima_execucao_em: string | null
          updated_at: string
          updated_by: string | null
          valor_minimo: number
          whatsapp_channel_id: string | null
        }
        Insert: {
          ativo?: boolean
          dias_bloqueio?: number
          dias_perda?: number
          email_channel_id?: string | null
          id?: number
          mensagem_antes?: string | null
          mensagem_atraso?: string | null
          neg_dias_minimo?: number
          neg_valor_minimo?: number
          passos?: Json
          prazo_baixa_dias_uteis?: number
          so_ativos?: boolean
          ultima_execucao?: Json | null
          ultima_execucao_em?: string | null
          updated_at?: string
          updated_by?: string | null
          valor_minimo?: number
          whatsapp_channel_id?: string | null
        }
        Update: {
          ativo?: boolean
          dias_bloqueio?: number
          dias_perda?: number
          email_channel_id?: string | null
          id?: number
          mensagem_antes?: string | null
          mensagem_atraso?: string | null
          neg_dias_minimo?: number
          neg_valor_minimo?: number
          passos?: Json
          prazo_baixa_dias_uteis?: number
          so_ativos?: boolean
          ultima_execucao?: Json | null
          ultima_execucao_em?: string | null
          updated_at?: string
          updated_by?: string | null
          valor_minimo?: number
          whatsapp_channel_id?: string | null
        }
        Relationships: []
      }
      fin_cobranca_envios: {
        Row: {
          canal: string
          created_at: string
          destino: string | null
          documento: string | null
          erro: string | null
          id: string
          lancamento_id: string
          passo: string
          status: string
        }
        Insert: {
          canal: string
          created_at?: string
          destino?: string | null
          documento?: string | null
          erro?: string | null
          id?: string
          lancamento_id: string
          passo: string
          status: string
        }
        Update: {
          canal?: string
          created_at?: string
          destino?: string | null
          documento?: string | null
          erro?: string | null
          id?: string
          lancamento_id?: string
          passo?: string
          status?: string
        }
        Relationships: [
          {
            foreignKeyName: "fin_cobranca_envios_lancamento_id_fkey"
            columns: ["lancamento_id"]
            isOneToOne: false
            referencedRelation: "fin_lancamentos"
            referencedColumns: ["id"]
          },
        ]
      }
      fin_contas_bancarias: {
        Row: {
          agencia: string | null
          ativo: boolean
          banco: string | null
          conta: string | null
          created_at: string
          empresa_id: string | null
          id: string
          nome: string
          saldo_inicial: number
          saldo_inicial_data: string | null
        }
        Insert: {
          agencia?: string | null
          ativo?: boolean
          banco?: string | null
          conta?: string | null
          created_at?: string
          empresa_id?: string | null
          id?: string
          nome: string
          saldo_inicial?: number
          saldo_inicial_data?: string | null
        }
        Update: {
          agencia?: string | null
          ativo?: boolean
          banco?: string | null
          conta?: string | null
          created_at?: string
          empresa_id?: string | null
          id?: string
          nome?: string
          saldo_inicial?: number
          saldo_inicial_data?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "fin_contas_bancarias_empresa_id_fkey"
            columns: ["empresa_id"]
            isOneToOne: false
            referencedRelation: "fin_empresas"
            referencedColumns: ["id"]
          },
        ]
      }
      fin_cron_token: {
        Row: {
          created_at: string
          id: number
          token: string
        }
        Insert: {
          created_at?: string
          id?: number
          token: string
        }
        Update: {
          created_at?: string
          id?: number
          token?: string
        }
        Relationships: []
      }
      fin_email_config: {
        Row: {
          ativo: boolean
          connection_key: string
          id: number
          ler_desde: string
          mailbox: string
          ultima_leitura_em: string | null
          ultimo_resumo: Json | null
          updated_at: string
          updated_by: string | null
        }
        Insert: {
          ativo?: boolean
          connection_key?: string
          id?: number
          ler_desde?: string
          mailbox?: string
          ultima_leitura_em?: string | null
          ultimo_resumo?: Json | null
          updated_at?: string
          updated_by?: string | null
        }
        Update: {
          ativo?: boolean
          connection_key?: string
          id?: number
          ler_desde?: string
          mailbox?: string
          ultima_leitura_em?: string | null
          ultimo_resumo?: Json | null
          updated_at?: string
          updated_by?: string | null
        }
        Relationships: []
      }
      fin_email_mensagens: {
        Row: {
          anexos: number
          assunto: string | null
          created_at: string
          id: string
          lancamento_id: string | null
          message_id: string
          motivo: string | null
          recebido_em: string | null
          remetente: string | null
          status: string
        }
        Insert: {
          anexos?: number
          assunto?: string | null
          created_at?: string
          id?: string
          lancamento_id?: string | null
          message_id: string
          motivo?: string | null
          recebido_em?: string | null
          remetente?: string | null
          status: string
        }
        Update: {
          anexos?: number
          assunto?: string | null
          created_at?: string
          id?: string
          lancamento_id?: string | null
          message_id?: string
          motivo?: string | null
          recebido_em?: string | null
          remetente?: string | null
          status?: string
        }
        Relationships: [
          {
            foreignKeyName: "fin_email_mensagens_lancamento_id_fkey"
            columns: ["lancamento_id"]
            isOneToOne: false
            referencedRelation: "fin_lancamentos"
            referencedColumns: ["id"]
          },
        ]
      }
      fin_empresas: {
        Row: {
          ativo: boolean
          cnpj: string | null
          codigo: string
          created_at: string
          id: string
          nome: string
        }
        Insert: {
          ativo?: boolean
          cnpj?: string | null
          codigo: string
          created_at?: string
          id?: string
          nome: string
        }
        Update: {
          ativo?: boolean
          cnpj?: string | null
          codigo?: string
          created_at?: string
          id?: string
          nome?: string
        }
        Relationships: []
      }
      fin_evidencias: {
        Row: {
          created_at: string
          dados: Json
          descricao: string | null
          fornecedor_id: string | null
          id: string
          lancamento_id: string | null
          tipo: string
          titulo: string
          user_id: string | null
        }
        Insert: {
          created_at?: string
          dados?: Json
          descricao?: string | null
          fornecedor_id?: string | null
          id?: string
          lancamento_id?: string | null
          tipo: string
          titulo: string
          user_id?: string | null
        }
        Update: {
          created_at?: string
          dados?: Json
          descricao?: string | null
          fornecedor_id?: string | null
          id?: string
          lancamento_id?: string | null
          tipo?: string
          titulo?: string
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "fin_evidencias_fornecedor_id_fkey"
            columns: ["fornecedor_id"]
            isOneToOne: false
            referencedRelation: "fin_fornecedores"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "fin_evidencias_lancamento_id_fkey"
            columns: ["lancamento_id"]
            isOneToOne: false
            referencedRelation: "fin_lancamentos"
            referencedColumns: ["id"]
          },
        ]
      }
      fin_extrato_itens: {
        Row: {
          conciliado_em: string | null
          conciliado_por: string | null
          conta_bancaria_id: string
          created_at: string
          data: string
          descricao: string | null
          documento: string | null
          fit_id: string | null
          id: string
          lancamento_id: string | null
          valor: number
        }
        Insert: {
          conciliado_em?: string | null
          conciliado_por?: string | null
          conta_bancaria_id: string
          created_at?: string
          data: string
          descricao?: string | null
          documento?: string | null
          fit_id?: string | null
          id?: string
          lancamento_id?: string | null
          valor: number
        }
        Update: {
          conciliado_em?: string | null
          conciliado_por?: string | null
          conta_bancaria_id?: string
          created_at?: string
          data?: string
          descricao?: string | null
          documento?: string | null
          fit_id?: string | null
          id?: string
          lancamento_id?: string | null
          valor?: number
        }
        Relationships: [
          {
            foreignKeyName: "fin_extrato_itens_conta_bancaria_id_fkey"
            columns: ["conta_bancaria_id"]
            isOneToOne: false
            referencedRelation: "fin_contas_bancarias"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "fin_extrato_itens_lancamento_id_fkey"
            columns: ["lancamento_id"]
            isOneToOne: false
            referencedRelation: "fin_lancamentos"
            referencedColumns: ["id"]
          },
        ]
      }
      fin_fornecedores: {
        Row: {
          ativo: boolean
          categoria_id: string | null
          competencia_ref: string
          created_at: string
          created_by: string | null
          dia_vencimento: number | null
          documento: string | null
          emails: string[]
          empresa_id: string | null
          exige_aprovacao: boolean
          explicacao: string | null
          id: string
          nome: string
          regras: Json
          tolerancia_pct: number
          updated_at: string
          updated_by: string | null
        }
        Insert: {
          ativo?: boolean
          categoria_id?: string | null
          competencia_ref?: string
          created_at?: string
          created_by?: string | null
          dia_vencimento?: number | null
          documento?: string | null
          emails?: string[]
          empresa_id?: string | null
          exige_aprovacao?: boolean
          explicacao?: string | null
          id?: string
          nome: string
          regras?: Json
          tolerancia_pct?: number
          updated_at?: string
          updated_by?: string | null
        }
        Update: {
          ativo?: boolean
          categoria_id?: string | null
          competencia_ref?: string
          created_at?: string
          created_by?: string | null
          dia_vencimento?: number | null
          documento?: string | null
          emails?: string[]
          empresa_id?: string | null
          exige_aprovacao?: boolean
          explicacao?: string | null
          id?: string
          nome?: string
          regras?: Json
          tolerancia_pct?: number
          updated_at?: string
          updated_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "fin_fornecedores_categoria_id_fkey"
            columns: ["categoria_id"]
            isOneToOne: false
            referencedRelation: "fin_categorias"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "fin_fornecedores_empresa_id_fkey"
            columns: ["empresa_id"]
            isOneToOne: false
            referencedRelation: "fin_empresas"
            referencedColumns: ["id"]
          },
        ]
      }
      fin_gsystem_sync: {
        Row: {
          erros: number
          faturas_atualizadas: number
          faturas_novas: number
          id: string
          proximo_indice: number
          rodada_iniciada_em: string | null
          total_clientes: number | null
          ultima_execucao_em: string | null
          ultima_rodada_concluida_em: string | null
          ultimo_erro: string | null
          updated_at: string
        }
        Insert: {
          erros?: number
          faturas_atualizadas?: number
          faturas_novas?: number
          id: string
          proximo_indice?: number
          rodada_iniciada_em?: string | null
          total_clientes?: number | null
          ultima_execucao_em?: string | null
          ultima_rodada_concluida_em?: string | null
          ultimo_erro?: string | null
          updated_at?: string
        }
        Update: {
          erros?: number
          faturas_atualizadas?: number
          faturas_novas?: number
          id?: string
          proximo_indice?: number
          rodada_iniciada_em?: string | null
          total_clientes?: number | null
          ultima_execucao_em?: string | null
          ultima_rodada_concluida_em?: string | null
          ultimo_erro?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      fin_lancamentos: {
        Row: {
          aprovacao: string | null
          aprovacao_obs: string | null
          aprovado_em: string | null
          aprovado_por: string | null
          arquivo_nome: string | null
          arquivo_path: string | null
          arquivo_url: string | null
          bomcontrole_parcela_id: string | null
          categoria_id: string | null
          cbs_valor: number | null
          competencia: string | null
          conferencia: Json | null
          conta_bancaria_id: string | null
          contraparte: string | null
          created_at: string
          created_by: string | null
          data_emissao: string | null
          data_pagamento: string | null
          data_programada: string | null
          dda_chave: string | null
          descricao: string | null
          documento_contraparte: string | null
          drive_file_id: string | null
          email_message_id: string | null
          empresa_id: string | null
          forma_pagamento: string | null
          fornecedor_id: string | null
          gsystem_cliente_key: string | null
          gsystem_fatura_key: string | null
          ia_confianca: number | null
          ibs_valor: number | null
          id: string
          linha_digitavel: string | null
          nota_chave: string | null
          numero_documento: string | null
          observacao: string | null
          origem: string
          perda_marcada_em: string | null
          perda_provavel: boolean
          programado_em: string | null
          programado_por: string | null
          promessa_pagamento: string | null
          revisado: boolean
          rtc_base: number | null
          rtc_dados: Json | null
          status: string
          tipo: string
          tipo_documento: string | null
          updated_at: string
          valor: number
          valor_esperado: number | null
          valor_pago: number | null
          vencimento: string | null
        }
        Insert: {
          aprovacao?: string | null
          aprovacao_obs?: string | null
          aprovado_em?: string | null
          aprovado_por?: string | null
          arquivo_nome?: string | null
          arquivo_path?: string | null
          arquivo_url?: string | null
          bomcontrole_parcela_id?: string | null
          categoria_id?: string | null
          cbs_valor?: number | null
          competencia?: string | null
          conferencia?: Json | null
          conta_bancaria_id?: string | null
          contraparte?: string | null
          created_at?: string
          created_by?: string | null
          data_emissao?: string | null
          data_pagamento?: string | null
          data_programada?: string | null
          dda_chave?: string | null
          descricao?: string | null
          documento_contraparte?: string | null
          drive_file_id?: string | null
          email_message_id?: string | null
          empresa_id?: string | null
          forma_pagamento?: string | null
          fornecedor_id?: string | null
          gsystem_cliente_key?: string | null
          gsystem_fatura_key?: string | null
          ia_confianca?: number | null
          ibs_valor?: number | null
          id?: string
          linha_digitavel?: string | null
          nota_chave?: string | null
          numero_documento?: string | null
          observacao?: string | null
          origem?: string
          perda_marcada_em?: string | null
          perda_provavel?: boolean
          programado_em?: string | null
          programado_por?: string | null
          promessa_pagamento?: string | null
          revisado?: boolean
          rtc_base?: number | null
          rtc_dados?: Json | null
          status?: string
          tipo?: string
          tipo_documento?: string | null
          updated_at?: string
          valor?: number
          valor_esperado?: number | null
          valor_pago?: number | null
          vencimento?: string | null
        }
        Update: {
          aprovacao?: string | null
          aprovacao_obs?: string | null
          aprovado_em?: string | null
          aprovado_por?: string | null
          arquivo_nome?: string | null
          arquivo_path?: string | null
          arquivo_url?: string | null
          bomcontrole_parcela_id?: string | null
          categoria_id?: string | null
          cbs_valor?: number | null
          competencia?: string | null
          conferencia?: Json | null
          conta_bancaria_id?: string | null
          contraparte?: string | null
          created_at?: string
          created_by?: string | null
          data_emissao?: string | null
          data_pagamento?: string | null
          data_programada?: string | null
          dda_chave?: string | null
          descricao?: string | null
          documento_contraparte?: string | null
          drive_file_id?: string | null
          email_message_id?: string | null
          empresa_id?: string | null
          forma_pagamento?: string | null
          fornecedor_id?: string | null
          gsystem_cliente_key?: string | null
          gsystem_fatura_key?: string | null
          ia_confianca?: number | null
          ibs_valor?: number | null
          id?: string
          linha_digitavel?: string | null
          nota_chave?: string | null
          numero_documento?: string | null
          observacao?: string | null
          origem?: string
          perda_marcada_em?: string | null
          perda_provavel?: boolean
          programado_em?: string | null
          programado_por?: string | null
          promessa_pagamento?: string | null
          revisado?: boolean
          rtc_base?: number | null
          rtc_dados?: Json | null
          status?: string
          tipo?: string
          tipo_documento?: string | null
          updated_at?: string
          valor?: number
          valor_esperado?: number | null
          valor_pago?: number | null
          vencimento?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "fin_lancamentos_categoria_id_fkey"
            columns: ["categoria_id"]
            isOneToOne: false
            referencedRelation: "fin_categorias"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "fin_lancamentos_conta_bancaria_id_fkey"
            columns: ["conta_bancaria_id"]
            isOneToOne: false
            referencedRelation: "fin_contas_bancarias"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "fin_lancamentos_empresa_id_fkey"
            columns: ["empresa_id"]
            isOneToOne: false
            referencedRelation: "fin_empresas"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "fin_lancamentos_fornecedor_id_fkey"
            columns: ["fornecedor_id"]
            isOneToOne: false
            referencedRelation: "fin_fornecedores"
            referencedColumns: ["id"]
          },
        ]
      }
      fin_negativacoes: {
        Row: {
          anuencia_emitida_em: string | null
          cartorio: string | null
          cidade_uf: string | null
          cliente_nome: string | null
          created_at: string
          created_by: string | null
          custo: number | null
          data_baixa: string | null
          data_envio: string | null
          data_inclusao: string | null
          data_quitacao: string | null
          documento: string
          id: string
          lancamento_ids: string[]
          motivo_cancelamento: string | null
          observacao: string | null
          orgao: string
          protocolo: string | null
          situacao: string
          updated_at: string
          updated_by: string | null
          valor: number
        }
        Insert: {
          anuencia_emitida_em?: string | null
          cartorio?: string | null
          cidade_uf?: string | null
          cliente_nome?: string | null
          created_at?: string
          created_by?: string | null
          custo?: number | null
          data_baixa?: string | null
          data_envio?: string | null
          data_inclusao?: string | null
          data_quitacao?: string | null
          documento: string
          id?: string
          lancamento_ids?: string[]
          motivo_cancelamento?: string | null
          observacao?: string | null
          orgao: string
          protocolo?: string | null
          situacao?: string
          updated_at?: string
          updated_by?: string | null
          valor?: number
        }
        Update: {
          anuencia_emitida_em?: string | null
          cartorio?: string | null
          cidade_uf?: string | null
          cliente_nome?: string | null
          created_at?: string
          created_by?: string | null
          custo?: number | null
          data_baixa?: string | null
          data_envio?: string | null
          data_inclusao?: string | null
          data_quitacao?: string | null
          documento?: string
          id?: string
          lancamento_ids?: string[]
          motivo_cancelamento?: string | null
          observacao?: string | null
          orgao?: string
          protocolo?: string | null
          situacao?: string
          updated_at?: string
          updated_by?: string | null
          valor?: number
        }
        Relationships: []
      }
      gamif_activity_checklist: {
        Row: {
          created_at: string
          data: Json
          id: string
          sector_id: string | null
          title: string
        }
        Insert: {
          created_at?: string
          data?: Json
          id?: string
          sector_id?: string | null
          title: string
        }
        Update: {
          created_at?: string
          data?: Json
          id?: string
          sector_id?: string | null
          title?: string
        }
        Relationships: [
          {
            foreignKeyName: "gamif_activity_checklist_sector_id_fkey"
            columns: ["sector_id"]
            isOneToOne: false
            referencedRelation: "sectors"
            referencedColumns: ["id"]
          },
        ]
      }
      gamif_audit_logs: {
        Row: {
          action: string
          actor_id: string | null
          created_at: string
          details: Json
          entity: string | null
          entity_id: string | null
          id: string
        }
        Insert: {
          action: string
          actor_id?: string | null
          created_at?: string
          details?: Json
          entity?: string | null
          entity_id?: string | null
          id?: string
        }
        Update: {
          action?: string
          actor_id?: string | null
          created_at?: string
          details?: Json
          entity?: string | null
          entity_id?: string | null
          id?: string
        }
        Relationships: []
      }
      gamif_auto_rules: {
        Row: {
          created_at: string
          id: string
          is_active: boolean
          metric_id: string | null
          sector_id: string | null
          weekdays: number[]
        }
        Insert: {
          created_at?: string
          id?: string
          is_active?: boolean
          metric_id?: string | null
          sector_id?: string | null
          weekdays?: number[]
        }
        Update: {
          created_at?: string
          id?: string
          is_active?: boolean
          metric_id?: string | null
          sector_id?: string | null
          weekdays?: number[]
        }
        Relationships: [
          {
            foreignKeyName: "gamif_auto_rules_metric_id_fkey"
            columns: ["metric_id"]
            isOneToOne: false
            referencedRelation: "gamif_metrics"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "gamif_auto_rules_sector_id_fkey"
            columns: ["sector_id"]
            isOneToOne: false
            referencedRelation: "sectors"
            referencedColumns: ["id"]
          },
        ]
      }
      gamif_badges: {
        Row: {
          created_at: string
          criteria: Json
          description: string | null
          icon: string | null
          id: string
          name: string
        }
        Insert: {
          created_at?: string
          criteria?: Json
          description?: string | null
          icon?: string | null
          id?: string
          name: string
        }
        Update: {
          created_at?: string
          criteria?: Json
          description?: string | null
          icon?: string | null
          id?: string
          name?: string
        }
        Relationships: []
      }
      gamif_complementary_activities: {
        Row: {
          created_at: string
          data: Json
          id: string
          legacy_user_id: string | null
          title: string
          user_id: string | null
        }
        Insert: {
          created_at?: string
          data?: Json
          id?: string
          legacy_user_id?: string | null
          title: string
          user_id?: string | null
        }
        Update: {
          created_at?: string
          data?: Json
          id?: string
          legacy_user_id?: string | null
          title?: string
          user_id?: string | null
        }
        Relationships: []
      }
      gamif_daily_performance: {
        Row: {
          created_at: string
          data: Json
          id: string
          legacy_user_id: string | null
          perf_date: string
          user_id: string | null
        }
        Insert: {
          created_at?: string
          data?: Json
          id?: string
          legacy_user_id?: string | null
          perf_date: string
          user_id?: string | null
        }
        Update: {
          created_at?: string
          data?: Json
          id?: string
          legacy_user_id?: string | null
          perf_date?: string
          user_id?: string | null
        }
        Relationships: []
      }
      gamif_entries: {
        Row: {
          acknowledged: boolean
          auto_rule_id: string | null
          coins: number
          created_at: string
          created_by: string | null
          entry_date: string
          id: string
          legacy_user_id: string | null
          metric_id: string | null
          metric_name: string | null
          notes: string | null
          source: string
          user_id: string | null
          xp: number
        }
        Insert: {
          acknowledged?: boolean
          auto_rule_id?: string | null
          coins?: number
          created_at?: string
          created_by?: string | null
          entry_date?: string
          id?: string
          legacy_user_id?: string | null
          metric_id?: string | null
          metric_name?: string | null
          notes?: string | null
          source?: string
          user_id?: string | null
          xp?: number
        }
        Update: {
          acknowledged?: boolean
          auto_rule_id?: string | null
          coins?: number
          created_at?: string
          created_by?: string | null
          entry_date?: string
          id?: string
          legacy_user_id?: string | null
          metric_id?: string | null
          metric_name?: string | null
          notes?: string | null
          source?: string
          user_id?: string | null
          xp?: number
        }
        Relationships: [
          {
            foreignKeyName: "gamif_entries_metric_id_fkey"
            columns: ["metric_id"]
            isOneToOne: false
            referencedRelation: "gamif_metrics"
            referencedColumns: ["id"]
          },
        ]
      }
      gamif_import_exclusions: {
        Row: {
          created_at: string
          email: string | null
          excluded_by: string | null
          legacy_id: string
          name: string | null
          reason: string | null
        }
        Insert: {
          created_at?: string
          email?: string | null
          excluded_by?: string | null
          legacy_id: string
          name?: string | null
          reason?: string | null
        }
        Update: {
          created_at?: string
          email?: string | null
          excluded_by?: string | null
          legacy_id?: string
          name?: string | null
          reason?: string | null
        }
        Relationships: []
      }
      gamif_import_runs: {
        Row: {
          created_at: string
          exported_at: string | null
          id: string
          ran_by: string | null
          report: Json
        }
        Insert: {
          created_at?: string
          exported_at?: string | null
          id?: string
          ran_by?: string | null
          report?: Json
        }
        Update: {
          created_at?: string
          exported_at?: string | null
          id?: string
          ran_by?: string | null
          report?: Json
        }
        Relationships: []
      }
      gamif_legacy_users: {
        Row: {
          coins: number
          created_at: string
          email: string | null
          legacy_id: string
          name: string | null
          raw: Json
          status: string
          user_id: string | null
          xp: number
        }
        Insert: {
          coins?: number
          created_at?: string
          email?: string | null
          legacy_id: string
          name?: string | null
          raw?: Json
          status?: string
          user_id?: string | null
          xp?: number
        }
        Update: {
          coins?: number
          created_at?: string
          email?: string | null
          legacy_id?: string
          name?: string | null
          raw?: Json
          status?: string
          user_id?: string | null
          xp?: number
        }
        Relationships: []
      }
      gamif_metric_categories: {
        Row: {
          color: string | null
          created_at: string
          id: string
          name: string
          position: number
        }
        Insert: {
          color?: string | null
          created_at?: string
          id?: string
          name: string
          position?: number
        }
        Update: {
          color?: string | null
          created_at?: string
          id?: string
          name?: string
          position?: number
        }
        Relationships: []
      }
      gamif_metrics: {
        Row: {
          category_id: string | null
          coins: number
          created_at: string
          description: string | null
          id: string
          is_active: boolean
          metric_type: string
          name: string
          xp: number
        }
        Insert: {
          category_id?: string | null
          coins?: number
          created_at?: string
          description?: string | null
          id?: string
          is_active?: boolean
          metric_type?: string
          name: string
          xp?: number
        }
        Update: {
          category_id?: string | null
          coins?: number
          created_at?: string
          description?: string | null
          id?: string
          is_active?: boolean
          metric_type?: string
          name?: string
          xp?: number
        }
        Relationships: [
          {
            foreignKeyName: "gamif_metrics_category_id_fkey"
            columns: ["category_id"]
            isOneToOne: false
            referencedRelation: "gamif_metric_categories"
            referencedColumns: ["id"]
          },
        ]
      }
      gamif_missions: {
        Row: {
          category: string | null
          created_at: string
          created_by: string | null
          description: string | null
          expires_at: string | null
          id: string
          mission_type: string | null
          reward_coins: number
          reward_xp: number
          starts_at: string | null
          status: string
          target: number | null
          target_sector_id: string | null
          title: string
        }
        Insert: {
          category?: string | null
          created_at?: string
          created_by?: string | null
          description?: string | null
          expires_at?: string | null
          id?: string
          mission_type?: string | null
          reward_coins?: number
          reward_xp?: number
          starts_at?: string | null
          status?: string
          target?: number | null
          target_sector_id?: string | null
          title: string
        }
        Update: {
          category?: string | null
          created_at?: string
          created_by?: string | null
          description?: string | null
          expires_at?: string | null
          id?: string
          mission_type?: string | null
          reward_coins?: number
          reward_xp?: number
          starts_at?: string | null
          status?: string
          target?: number | null
          target_sector_id?: string | null
          title?: string
        }
        Relationships: [
          {
            foreignKeyName: "gamif_missions_target_sector_id_fkey"
            columns: ["target_sector_id"]
            isOneToOne: false
            referencedRelation: "sectors"
            referencedColumns: ["id"]
          },
        ]
      }
      gamif_notifications: {
        Row: {
          body: string | null
          created_at: string
          created_by: string | null
          id: string
          scheduled_at: string | null
          sent_at: string | null
          target_sector_id: string | null
          title: string
        }
        Insert: {
          body?: string | null
          created_at?: string
          created_by?: string | null
          id?: string
          scheduled_at?: string | null
          sent_at?: string | null
          target_sector_id?: string | null
          title: string
        }
        Update: {
          body?: string | null
          created_at?: string
          created_by?: string | null
          id?: string
          scheduled_at?: string | null
          sent_at?: string | null
          target_sector_id?: string | null
          title?: string
        }
        Relationships: [
          {
            foreignKeyName: "gamif_notifications_target_sector_id_fkey"
            columns: ["target_sector_id"]
            isOneToOne: false
            referencedRelation: "sectors"
            referencedColumns: ["id"]
          },
        ]
      }
      gamif_process_changelog: {
        Row: {
          changed_by: string | null
          created_at: string
          id: string
          process_id: string | null
          summary: string | null
          version: number | null
        }
        Insert: {
          changed_by?: string | null
          created_at?: string
          id?: string
          process_id?: string | null
          summary?: string | null
          version?: number | null
        }
        Update: {
          changed_by?: string | null
          created_at?: string
          id?: string
          process_id?: string | null
          summary?: string | null
          version?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "gamif_process_changelog_process_id_fkey"
            columns: ["process_id"]
            isOneToOne: false
            referencedRelation: "gamif_processes"
            referencedColumns: ["id"]
          },
        ]
      }
      gamif_process_suggestions: {
        Row: {
          content: string
          created_at: string
          id: string
          process_id: string | null
          status: string
          user_id: string | null
        }
        Insert: {
          content: string
          created_at?: string
          id?: string
          process_id?: string | null
          status?: string
          user_id?: string | null
        }
        Update: {
          content?: string
          created_at?: string
          id?: string
          process_id?: string | null
          status?: string
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "gamif_process_suggestions_process_id_fkey"
            columns: ["process_id"]
            isOneToOne: false
            referencedRelation: "gamif_processes"
            referencedColumns: ["id"]
          },
        ]
      }
      gamif_processes: {
        Row: {
          content: string | null
          created_at: string
          created_by: string | null
          id: string
          sector_id: string | null
          title: string
          updated_at: string
          version: number
        }
        Insert: {
          content?: string | null
          created_at?: string
          created_by?: string | null
          id?: string
          sector_id?: string | null
          title: string
          updated_at?: string
          version?: number
        }
        Update: {
          content?: string | null
          created_at?: string
          created_by?: string | null
          id?: string
          sector_id?: string | null
          title?: string
          updated_at?: string
          version?: number
        }
        Relationships: [
          {
            foreignKeyName: "gamif_processes_sector_id_fkey"
            columns: ["sector_id"]
            isOneToOne: false
            referencedRelation: "sectors"
            referencedColumns: ["id"]
          },
        ]
      }
      gamif_pvp_challenges: {
        Row: {
          challenger_id: string | null
          challenger_note: string | null
          challenger_vote: string | null
          created_at: string
          description: string | null
          ends_at: string | null
          id: string
          metric_id: string | null
          opponent_id: string | null
          opponent_note: string | null
          opponent_vote: string | null
          resolved_at: string | null
          stake_coins: number
          starts_at: string | null
          status: string
          title: string | null
          winner_id: string | null
        }
        Insert: {
          challenger_id?: string | null
          challenger_note?: string | null
          challenger_vote?: string | null
          created_at?: string
          description?: string | null
          ends_at?: string | null
          id?: string
          metric_id?: string | null
          opponent_id?: string | null
          opponent_note?: string | null
          opponent_vote?: string | null
          resolved_at?: string | null
          stake_coins?: number
          starts_at?: string | null
          status?: string
          title?: string | null
          winner_id?: string | null
        }
        Update: {
          challenger_id?: string | null
          challenger_note?: string | null
          challenger_vote?: string | null
          created_at?: string
          description?: string | null
          ends_at?: string | null
          id?: string
          metric_id?: string | null
          opponent_id?: string | null
          opponent_note?: string | null
          opponent_vote?: string | null
          resolved_at?: string | null
          stake_coins?: number
          starts_at?: string | null
          status?: string
          title?: string | null
          winner_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "gamif_pvp_challenges_metric_id_fkey"
            columns: ["metric_id"]
            isOneToOne: false
            referencedRelation: "gamif_metrics"
            referencedColumns: ["id"]
          },
        ]
      }
      gamif_reading_confirmations: {
        Row: {
          confirmed_at: string
          id: string
          process_id: string | null
          user_id: string | null
          version: number | null
        }
        Insert: {
          confirmed_at?: string
          id?: string
          process_id?: string | null
          user_id?: string | null
          version?: number | null
        }
        Update: {
          confirmed_at?: string
          id?: string
          process_id?: string | null
          user_id?: string | null
          version?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "gamif_reading_confirmations_process_id_fkey"
            columns: ["process_id"]
            isOneToOne: false
            referencedRelation: "gamif_processes"
            referencedColumns: ["id"]
          },
        ]
      }
      gamif_redemptions: {
        Row: {
          cost_coins: number
          created_at: string
          decided_at: string | null
          decided_by: string | null
          id: string
          item_id: string | null
          item_name: string | null
          legacy_user_id: string | null
          notes: string | null
          status: string
          user_id: string | null
        }
        Insert: {
          cost_coins?: number
          created_at?: string
          decided_at?: string | null
          decided_by?: string | null
          id?: string
          item_id?: string | null
          item_name?: string | null
          legacy_user_id?: string | null
          notes?: string | null
          status?: string
          user_id?: string | null
        }
        Update: {
          cost_coins?: number
          created_at?: string
          decided_at?: string | null
          decided_by?: string | null
          id?: string
          item_id?: string | null
          item_name?: string | null
          legacy_user_id?: string | null
          notes?: string | null
          status?: string
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "gamif_redemptions_item_id_fkey"
            columns: ["item_id"]
            isOneToOne: false
            referencedRelation: "gamif_store_items"
            referencedColumns: ["id"]
          },
        ]
      }
      gamif_role_functions: {
        Row: {
          created_at: string
          data: Json
          id: string
          sector_id: string | null
          title: string
        }
        Insert: {
          created_at?: string
          data?: Json
          id?: string
          sector_id?: string | null
          title: string
        }
        Update: {
          created_at?: string
          data?: Json
          id?: string
          sector_id?: string | null
          title?: string
        }
        Relationships: [
          {
            foreignKeyName: "gamif_role_functions_sector_id_fkey"
            columns: ["sector_id"]
            isOneToOne: false
            referencedRelation: "sectors"
            referencedColumns: ["id"]
          },
        ]
      }
      gamif_settings: {
        Row: {
          data: Json
          id: string
          updated_at: string
        }
        Insert: {
          data?: Json
          id?: string
          updated_at?: string
        }
        Update: {
          data?: Json
          id?: string
          updated_at?: string
        }
        Relationships: []
      }
      gamif_store_items: {
        Row: {
          cost_coins: number
          created_at: string
          description: string | null
          id: string
          image_url: string | null
          is_active: boolean
          name: string
          stock: number | null
        }
        Insert: {
          cost_coins: number
          created_at?: string
          description?: string | null
          id?: string
          image_url?: string | null
          is_active?: boolean
          name: string
          stock?: number | null
        }
        Update: {
          cost_coins?: number
          created_at?: string
          description?: string | null
          id?: string
          image_url?: string | null
          is_active?: boolean
          name?: string
          stock?: number | null
        }
        Relationships: []
      }
      gamif_streaks: {
        Row: {
          best_streak: number
          current_streak: number
          last_date: string | null
          user_id: string
        }
        Insert: {
          best_streak?: number
          current_streak?: number
          last_date?: string | null
          user_id: string
        }
        Update: {
          best_streak?: number
          current_streak?: number
          last_date?: string | null
          user_id?: string
        }
        Relationships: []
      }
      gamif_suggestion_votes: {
        Row: {
          created_at: string
          suggestion_id: string
          user_id: string
        }
        Insert: {
          created_at?: string
          suggestion_id: string
          user_id: string
        }
        Update: {
          created_at?: string
          suggestion_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "gamif_suggestion_votes_suggestion_id_fkey"
            columns: ["suggestion_id"]
            isOneToOne: false
            referencedRelation: "gamif_suggestions"
            referencedColumns: ["id"]
          },
        ]
      }
      gamif_suggestions: {
        Row: {
          admin_response: string | null
          created_at: string
          description: string | null
          id: string
          legacy_user_id: string | null
          status: string
          title: string
          user_id: string | null
        }
        Insert: {
          admin_response?: string | null
          created_at?: string
          description?: string | null
          id?: string
          legacy_user_id?: string | null
          status?: string
          title: string
          user_id?: string | null
        }
        Update: {
          admin_response?: string | null
          created_at?: string
          description?: string | null
          id?: string
          legacy_user_id?: string | null
          status?: string
          title?: string
          user_id?: string | null
        }
        Relationships: []
      }
      gamif_user_badges: {
        Row: {
          awarded_at: string
          badge_id: string | null
          id: string
          legacy_user_id: string | null
          user_id: string | null
        }
        Insert: {
          awarded_at?: string
          badge_id?: string | null
          id?: string
          legacy_user_id?: string | null
          user_id?: string | null
        }
        Update: {
          awarded_at?: string
          badge_id?: string | null
          id?: string
          legacy_user_id?: string | null
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "gamif_user_badges_badge_id_fkey"
            columns: ["badge_id"]
            isOneToOne: false
            referencedRelation: "gamif_badges"
            referencedColumns: ["id"]
          },
        ]
      }
      gamif_user_missions: {
        Row: {
          completed_at: string | null
          created_at: string
          id: string
          legacy_user_id: string | null
          mission_id: string
          progress: number
          status: string
          user_id: string | null
        }
        Insert: {
          completed_at?: string | null
          created_at?: string
          id?: string
          legacy_user_id?: string | null
          mission_id: string
          progress?: number
          status?: string
          user_id?: string | null
        }
        Update: {
          completed_at?: string | null
          created_at?: string
          id?: string
          legacy_user_id?: string | null
          mission_id?: string
          progress?: number
          status?: string
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "gamif_user_missions_mission_id_fkey"
            columns: ["mission_id"]
            isOneToOne: false
            referencedRelation: "gamif_missions"
            referencedColumns: ["id"]
          },
        ]
      }
      gamif_user_notifications: {
        Row: {
          body: string | null
          created_at: string
          id: string
          legacy_user_id: string | null
          notification_id: string | null
          read_at: string | null
          title: string | null
          user_id: string | null
        }
        Insert: {
          body?: string | null
          created_at?: string
          id?: string
          legacy_user_id?: string | null
          notification_id?: string | null
          read_at?: string | null
          title?: string | null
          user_id?: string | null
        }
        Update: {
          body?: string | null
          created_at?: string
          id?: string
          legacy_user_id?: string | null
          notification_id?: string | null
          read_at?: string | null
          title?: string | null
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "gamif_user_notifications_notification_id_fkey"
            columns: ["notification_id"]
            isOneToOne: false
            referencedRelation: "gamif_notifications"
            referencedColumns: ["id"]
          },
        ]
      }
      gamif_wallets: {
        Row: {
          coins: number
          updated_at: string
          user_id: string
          xp: number
        }
        Insert: {
          coins?: number
          updated_at?: string
          user_id: string
          xp?: number
        }
        Update: {
          coins?: number
          updated_at?: string
          user_id?: string
          xp?: number
        }
        Relationships: []
      }
      ge_api_configurations: {
        Row: {
          api_key_encrypted: string | null
          api_type: Database["public"]["Enums"]["ge_api_type"]
          auto_sync_enabled: boolean
          base_url: string
          bearer_token_encrypted: string | null
          client_id: string | null
          connection_status: Database["public"]["Enums"]["ge_api_connection_status"]
          created_at: string
          error_message: string | null
          events_endpoint: string | null
          id: string
          is_active: boolean
          last_sync_at: string | null
          last_test_at: string | null
          last_test_status: string | null
          password_encrypted: string | null
          sync_device_cursor: number
          sync_devices_cache: Json
          sync_devices_cache_at: string | null
          sync_interval_minutes: number
          updated_at: string
          username: string | null
        }
        Insert: {
          api_key_encrypted?: string | null
          api_type: Database["public"]["Enums"]["ge_api_type"]
          auto_sync_enabled?: boolean
          base_url: string
          bearer_token_encrypted?: string | null
          client_id?: string | null
          connection_status?: Database["public"]["Enums"]["ge_api_connection_status"]
          created_at?: string
          error_message?: string | null
          events_endpoint?: string | null
          id?: string
          is_active?: boolean
          last_sync_at?: string | null
          last_test_at?: string | null
          last_test_status?: string | null
          password_encrypted?: string | null
          sync_device_cursor?: number
          sync_devices_cache?: Json
          sync_devices_cache_at?: string | null
          sync_interval_minutes?: number
          updated_at?: string
          username?: string | null
        }
        Update: {
          api_key_encrypted?: string | null
          api_type?: Database["public"]["Enums"]["ge_api_type"]
          auto_sync_enabled?: boolean
          base_url?: string
          bearer_token_encrypted?: string | null
          client_id?: string | null
          connection_status?: Database["public"]["Enums"]["ge_api_connection_status"]
          created_at?: string
          error_message?: string | null
          events_endpoint?: string | null
          id?: string
          is_active?: boolean
          last_sync_at?: string | null
          last_test_at?: string | null
          last_test_status?: string | null
          password_encrypted?: string | null
          sync_device_cursor?: number
          sync_devices_cache?: Json
          sync_devices_cache_at?: string | null
          sync_interval_minutes?: number
          updated_at?: string
          username?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "ge_api_configurations_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "ge_clients"
            referencedColumns: ["id"]
          },
        ]
      }
      ge_audit_logs: {
        Row: {
          action: string
          changes: Json | null
          client_id: string | null
          created_at: string
          id: string
          ip_address: string | null
          resource_id: string | null
          resource_type: string | null
          user_id: string | null
        }
        Insert: {
          action: string
          changes?: Json | null
          client_id?: string | null
          created_at?: string
          id?: string
          ip_address?: string | null
          resource_id?: string | null
          resource_type?: string | null
          user_id?: string | null
        }
        Update: {
          action?: string
          changes?: Json | null
          client_id?: string | null
          created_at?: string
          id?: string
          ip_address?: string | null
          resource_id?: string | null
          resource_type?: string | null
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "ge_audit_logs_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "ge_clients"
            referencedColumns: ["id"]
          },
        ]
      }
      ge_client_event_type_settings: {
        Row: {
          api_source: Database["public"]["Enums"]["ge_api_type"]
          client_id: string
          created_at: string
          event_type: string
          first_seen_at: string
          is_enabled: boolean
          last_seen_at: string
          occurrences: number
          updated_at: string
        }
        Insert: {
          api_source: Database["public"]["Enums"]["ge_api_type"]
          client_id: string
          created_at?: string
          event_type: string
          first_seen_at?: string
          is_enabled?: boolean
          last_seen_at?: string
          occurrences?: number
          updated_at?: string
        }
        Update: {
          api_source?: Database["public"]["Enums"]["ge_api_type"]
          client_id?: string
          created_at?: string
          event_type?: string
          first_seen_at?: string
          is_enabled?: boolean
          last_seen_at?: string
          occurrences?: number
          updated_at?: string
        }
        Relationships: []
      }
      ge_client_external_accounts: {
        Row: {
          api_type: Database["public"]["Enums"]["ge_api_type"]
          client_id: string
          created_at: string
          external_account_id: string
          id: string
          updated_at: string
        }
        Insert: {
          api_type: Database["public"]["Enums"]["ge_api_type"]
          client_id: string
          created_at?: string
          external_account_id: string
          id?: string
          updated_at?: string
        }
        Update: {
          api_type?: Database["public"]["Enums"]["ge_api_type"]
          client_id?: string
          created_at?: string
          external_account_id?: string
          id?: string
          updated_at?: string
        }
        Relationships: []
      }
      ge_client_features: {
        Row: {
          client_id: string
          created_at: string
          feature_key: string
          id: string
          is_enabled: boolean
          updated_at: string
        }
        Insert: {
          client_id: string
          created_at?: string
          feature_key: string
          id?: string
          is_enabled?: boolean
          updated_at?: string
        }
        Update: {
          client_id?: string
          created_at?: string
          feature_key?: string
          id?: string
          is_enabled?: boolean
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "ge_client_features_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "ge_clients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ge_client_features_feature_key_fkey"
            columns: ["feature_key"]
            isOneToOne: false
            referencedRelation: "ge_feature_catalog"
            referencedColumns: ["key"]
          },
        ]
      }
      ge_client_groups: {
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
      ge_clients: {
        Row: {
          company_id: string | null
          created_at: string
          documento: string | null
          email_contact: string | null
          group_id: string | null
          id: string
          is_active: boolean
          is_staging: boolean
          name: string
          phone: string | null
          updated_at: string
        }
        Insert: {
          company_id?: string | null
          created_at?: string
          documento?: string | null
          email_contact?: string | null
          group_id?: string | null
          id?: string
          is_active?: boolean
          is_staging?: boolean
          name: string
          phone?: string | null
          updated_at?: string
        }
        Update: {
          company_id?: string | null
          created_at?: string
          documento?: string | null
          email_contact?: string | null
          group_id?: string | null
          id?: string
          is_active?: boolean
          is_staging?: boolean
          name?: string
          phone?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "ge_clients_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ge_clients_group_id_fkey"
            columns: ["group_id"]
            isOneToOne: false
            referencedRelation: "ge_client_groups"
            referencedColumns: ["id"]
          },
        ]
      }
      ge_cron_token: {
        Row: {
          id: number
          token: string
        }
        Insert: {
          id?: number
          token: string
        }
        Update: {
          id?: number
          token?: string
        }
        Relationships: []
      }
      ge_drivers: {
        Row: {
          client_id: string
          cpf: string
          created_at: string
          full_name: string
          id: string
          is_active: boolean
          license_plate: string | null
          updated_at: string
        }
        Insert: {
          client_id: string
          cpf: string
          created_at?: string
          full_name: string
          id?: string
          is_active?: boolean
          license_plate?: string | null
          updated_at?: string
        }
        Update: {
          client_id?: string
          cpf?: string
          created_at?: string
          full_name?: string
          id?: string
          is_active?: boolean
          license_plate?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      ge_event_analyses: {
        Row: {
          analysis_description: string
          analyzed_by_user_id: string
          client_id: string
          created_at: string
          event_id: string
          id: string
          updated_at: string
        }
        Insert: {
          analysis_description?: string
          analyzed_by_user_id?: string
          client_id: string
          created_at?: string
          event_id: string
          id?: string
          updated_at?: string
        }
        Update: {
          analysis_description?: string
          analyzed_by_user_id?: string
          client_id?: string
          created_at?: string
          event_id?: string
          id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "ge_event_analyses_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "ge_clients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ge_event_analyses_event_id_fkey"
            columns: ["event_id"]
            isOneToOne: false
            referencedRelation: "ge_events"
            referencedColumns: ["id"]
          },
        ]
      }
      ge_events: {
        Row: {
          api_source: Database["public"]["Enums"]["ge_api_type"]
          client_id: string
          created_at: string
          device_imei: string | null
          driver_id: string | null
          driver_name: string | null
          driver_ref_id: string | null
          event_data: Json
          event_time: string
          event_type: string
          external_event_id: string | null
          fleet_id: string | null
          id: string
          latitude: number | null
          license_plate: string | null
          longitude: number | null
          risk_level: Database["public"]["Enums"]["ge_risk_level"]
          status: Database["public"]["Enums"]["ge_event_status"]
          updated_at: string
          vehicle_id: string | null
        }
        Insert: {
          api_source: Database["public"]["Enums"]["ge_api_type"]
          client_id: string
          created_at?: string
          device_imei?: string | null
          driver_id?: string | null
          driver_name?: string | null
          driver_ref_id?: string | null
          event_data?: Json
          event_time: string
          event_type: string
          external_event_id?: string | null
          fleet_id?: string | null
          id?: string
          latitude?: number | null
          license_plate?: string | null
          longitude?: number | null
          risk_level?: Database["public"]["Enums"]["ge_risk_level"]
          status?: Database["public"]["Enums"]["ge_event_status"]
          updated_at?: string
          vehicle_id?: string | null
        }
        Update: {
          api_source?: Database["public"]["Enums"]["ge_api_type"]
          client_id?: string
          created_at?: string
          device_imei?: string | null
          driver_id?: string | null
          driver_name?: string | null
          driver_ref_id?: string | null
          event_data?: Json
          event_time?: string
          event_type?: string
          external_event_id?: string | null
          fleet_id?: string | null
          id?: string
          latitude?: number | null
          license_plate?: string | null
          longitude?: number | null
          risk_level?: Database["public"]["Enums"]["ge_risk_level"]
          status?: Database["public"]["Enums"]["ge_event_status"]
          updated_at?: string
          vehicle_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "ge_events_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "ge_clients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ge_events_driver_ref_id_fkey"
            columns: ["driver_ref_id"]
            isOneToOne: false
            referencedRelation: "ge_drivers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ge_events_fleet_id_fkey"
            columns: ["fleet_id"]
            isOneToOne: false
            referencedRelation: "ge_fleets"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ge_events_vehicle_id_fkey"
            columns: ["vehicle_id"]
            isOneToOne: false
            referencedRelation: "ge_vehicles"
            referencedColumns: ["id"]
          },
        ]
      }
      ge_feature_catalog: {
        Row: {
          created_at: string
          description: string | null
          is_active: boolean
          key: string
          label: string
          parent_key: string | null
          sort_order: number
          updated_at: string
        }
        Insert: {
          created_at?: string
          description?: string | null
          is_active?: boolean
          key: string
          label: string
          parent_key?: string | null
          sort_order?: number
          updated_at?: string
        }
        Update: {
          created_at?: string
          description?: string | null
          is_active?: boolean
          key?: string
          label?: string
          parent_key?: string | null
          sort_order?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "ge_feature_catalog_parent_key_fkey"
            columns: ["parent_key"]
            isOneToOne: false
            referencedRelation: "ge_feature_catalog"
            referencedColumns: ["key"]
          },
        ]
      }
      ge_fleet_responsibles: {
        Row: {
          client_id: string
          created_at: string
          fleet_id: string
          id: string
          user_id: string
        }
        Insert: {
          client_id: string
          created_at?: string
          fleet_id: string
          id?: string
          user_id: string
        }
        Update: {
          client_id?: string
          created_at?: string
          fleet_id?: string
          id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "ge_fleet_responsibles_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "ge_clients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ge_fleet_responsibles_fleet_id_fkey"
            columns: ["fleet_id"]
            isOneToOne: false
            referencedRelation: "ge_fleets"
            referencedColumns: ["id"]
          },
        ]
      }
      ge_fleets: {
        Row: {
          city: string | null
          client_id: string
          code: string | null
          created_at: string
          id: string
          is_active: boolean
          location_name: string | null
          name: string
          state: string | null
          updated_at: string
        }
        Insert: {
          city?: string | null
          client_id: string
          code?: string | null
          created_at?: string
          id?: string
          is_active?: boolean
          location_name?: string | null
          name: string
          state?: string | null
          updated_at?: string
        }
        Update: {
          city?: string | null
          client_id?: string
          code?: string | null
          created_at?: string
          id?: string
          is_active?: boolean
          location_name?: string | null
          name?: string
          state?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "ge_fleets_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "ge_clients"
            referencedColumns: ["id"]
          },
        ]
      }
      ge_migracao: {
        Row: {
          atualizado_em: string | null
          concluido_em: string | null
          etapa: string | null
          id: number
          iniciado_em: string | null
          pagina: number
          sync_ativo: boolean
          tabela: string | null
          totais: Json
          ultimo_erro: string | null
          usuarios: Json
        }
        Insert: {
          atualizado_em?: string | null
          concluido_em?: string | null
          etapa?: string | null
          id?: number
          iniciado_em?: string | null
          pagina?: number
          sync_ativo?: boolean
          tabela?: string | null
          totais?: Json
          ultimo_erro?: string | null
          usuarios?: Json
        }
        Update: {
          atualizado_em?: string | null
          concluido_em?: string | null
          etapa?: string | null
          id?: number
          iniciado_em?: string | null
          pagina?: number
          sync_ativo?: boolean
          tabela?: string | null
          totais?: Json
          ultimo_erro?: string | null
          usuarios?: Json
        }
        Relationships: []
      }
      ge_notification_configurations: {
        Row: {
          client_id: string
          created_at: string
          id: string
          is_active: boolean
          min_risk_level: Database["public"]["Enums"]["ge_risk_level"]
          notification_type: Database["public"]["Enums"]["ge_notification_type"]
          recipient_emails: Json
          recipient_phones: Json
          trigger_time: string | null
          trigger_type: Database["public"]["Enums"]["ge_notification_trigger"]
          updated_at: string
        }
        Insert: {
          client_id: string
          created_at?: string
          id?: string
          is_active?: boolean
          min_risk_level?: Database["public"]["Enums"]["ge_risk_level"]
          notification_type: Database["public"]["Enums"]["ge_notification_type"]
          recipient_emails?: Json
          recipient_phones?: Json
          trigger_time?: string | null
          trigger_type: Database["public"]["Enums"]["ge_notification_trigger"]
          updated_at?: string
        }
        Update: {
          client_id?: string
          created_at?: string
          id?: string
          is_active?: boolean
          min_risk_level?: Database["public"]["Enums"]["ge_risk_level"]
          notification_type?: Database["public"]["Enums"]["ge_notification_type"]
          recipient_emails?: Json
          recipient_phones?: Json
          trigger_time?: string | null
          trigger_type?: Database["public"]["Enums"]["ge_notification_trigger"]
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "ge_notification_configurations_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "ge_clients"
            referencedColumns: ["id"]
          },
        ]
      }
      ge_notification_logs: {
        Row: {
          channel: Database["public"]["Enums"]["ge_notification_type"]
          client_id: string
          error_message: string | null
          event_id: string | null
          id: string
          message: string | null
          notification_config_id: string | null
          recipient: string
          sent_at: string
          status: string
          subject: string | null
          treatment_id: string | null
        }
        Insert: {
          channel: Database["public"]["Enums"]["ge_notification_type"]
          client_id: string
          error_message?: string | null
          event_id?: string | null
          id?: string
          message?: string | null
          notification_config_id?: string | null
          recipient: string
          sent_at?: string
          status: string
          subject?: string | null
          treatment_id?: string | null
        }
        Update: {
          channel?: Database["public"]["Enums"]["ge_notification_type"]
          client_id?: string
          error_message?: string | null
          event_id?: string | null
          id?: string
          message?: string | null
          notification_config_id?: string | null
          recipient?: string
          sent_at?: string
          status?: string
          subject?: string | null
          treatment_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "ge_notification_logs_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "ge_clients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ge_notification_logs_event_id_fkey"
            columns: ["event_id"]
            isOneToOne: false
            referencedRelation: "ge_events"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ge_notification_logs_notification_config_id_fkey"
            columns: ["notification_config_id"]
            isOneToOne: false
            referencedRelation: "ge_notification_configurations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ge_notification_logs_treatment_id_fkey"
            columns: ["treatment_id"]
            isOneToOne: false
            referencedRelation: "ge_treatments"
            referencedColumns: ["id"]
          },
        ]
      }
      ge_profiles: {
        Row: {
          client_id: string | null
          created_at: string
          email: string
          full_name: string | null
          group_id: string | null
          id: string
          is_active: boolean
          updated_at: string
        }
        Insert: {
          client_id?: string | null
          created_at?: string
          email: string
          full_name?: string | null
          group_id?: string | null
          id: string
          is_active?: boolean
          updated_at?: string
        }
        Update: {
          client_id?: string | null
          created_at?: string
          email?: string
          full_name?: string | null
          group_id?: string | null
          id?: string
          is_active?: boolean
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "ge_profiles_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "ge_clients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ge_profiles_group_id_fkey"
            columns: ["group_id"]
            isOneToOne: false
            referencedRelation: "ge_client_groups"
            referencedColumns: ["id"]
          },
        ]
      }
      ge_risk_configurations: {
        Row: {
          category: string | null
          client_id: string
          created_at: string
          description: string | null
          event_type: string
          id: string
          is_active: boolean
          max_count: number | null
          max_percent: number | null
          min_count: number | null
          min_duration_seconds: number | null
          min_percent: number | null
          priority: number
          risk_level: Database["public"]["Enums"]["ge_risk_level"] | null
          rule_type: string | null
          threshold_high: number | null
          threshold_low: number | null
          threshold_medium: number | null
          updated_at: string
        }
        Insert: {
          category?: string | null
          client_id: string
          created_at?: string
          description?: string | null
          event_type: string
          id?: string
          is_active?: boolean
          max_count?: number | null
          max_percent?: number | null
          min_count?: number | null
          min_duration_seconds?: number | null
          min_percent?: number | null
          priority?: number
          risk_level?: Database["public"]["Enums"]["ge_risk_level"] | null
          rule_type?: string | null
          threshold_high?: number | null
          threshold_low?: number | null
          threshold_medium?: number | null
          updated_at?: string
        }
        Update: {
          category?: string | null
          client_id?: string
          created_at?: string
          description?: string | null
          event_type?: string
          id?: string
          is_active?: boolean
          max_count?: number | null
          max_percent?: number | null
          min_count?: number | null
          min_duration_seconds?: number | null
          min_percent?: number | null
          priority?: number
          risk_level?: Database["public"]["Enums"]["ge_risk_level"] | null
          rule_type?: string | null
          threshold_high?: number | null
          threshold_low?: number | null
          threshold_medium?: number | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "ge_risk_configurations_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "ge_clients"
            referencedColumns: ["id"]
          },
        ]
      }
      ge_treatment_history: {
        Row: {
          change_type: string
          changed_at: string
          changed_by_user_id: string
          id: string
          new_value: Json | null
          old_value: Json | null
          treatment_id: string
        }
        Insert: {
          change_type: string
          changed_at?: string
          changed_by_user_id: string
          id?: string
          new_value?: Json | null
          old_value?: Json | null
          treatment_id: string
        }
        Update: {
          change_type?: string
          changed_at?: string
          changed_by_user_id?: string
          id?: string
          new_value?: Json | null
          old_value?: Json | null
          treatment_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "ge_treatment_history_treatment_id_fkey"
            columns: ["treatment_id"]
            isOneToOne: false
            referencedRelation: "ge_treatments"
            referencedColumns: ["id"]
          },
        ]
      }
      ge_treatments: {
        Row: {
          assigned_to_user_id: string | null
          attachments: Json
          client_id: string
          completed_at: string | null
          created_at: string
          created_by_user_id: string
          event_id: string
          fleet_id: string | null
          fleet_name: string | null
          fleet_responsibles_snapshot: Json
          id: string
          notes: string | null
          treatment_description: string
          treatment_status: Database["public"]["Enums"]["ge_treatment_status"]
          updated_at: string
          vehicle_id: string | null
          vehicle_identifier: string | null
        }
        Insert: {
          assigned_to_user_id?: string | null
          attachments?: Json
          client_id: string
          completed_at?: string | null
          created_at?: string
          created_by_user_id: string
          event_id: string
          fleet_id?: string | null
          fleet_name?: string | null
          fleet_responsibles_snapshot?: Json
          id?: string
          notes?: string | null
          treatment_description: string
          treatment_status?: Database["public"]["Enums"]["ge_treatment_status"]
          updated_at?: string
          vehicle_id?: string | null
          vehicle_identifier?: string | null
        }
        Update: {
          assigned_to_user_id?: string | null
          attachments?: Json
          client_id?: string
          completed_at?: string | null
          created_at?: string
          created_by_user_id?: string
          event_id?: string
          fleet_id?: string | null
          fleet_name?: string | null
          fleet_responsibles_snapshot?: Json
          id?: string
          notes?: string | null
          treatment_description?: string
          treatment_status?: Database["public"]["Enums"]["ge_treatment_status"]
          updated_at?: string
          vehicle_id?: string | null
          vehicle_identifier?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "ge_treatments_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "ge_clients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ge_treatments_event_id_fkey"
            columns: ["event_id"]
            isOneToOne: false
            referencedRelation: "ge_events"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ge_treatments_fleet_id_fkey"
            columns: ["fleet_id"]
            isOneToOne: false
            referencedRelation: "ge_fleets"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ge_treatments_vehicle_id_fkey"
            columns: ["vehicle_id"]
            isOneToOne: false
            referencedRelation: "ge_vehicles"
            referencedColumns: ["id"]
          },
        ]
      }
      ge_unmatched_event_type_settings: {
        Row: {
          api_source: Database["public"]["Enums"]["ge_api_type"]
          created_at: string
          event_type: string
          first_seen_at: string
          is_enabled: boolean
          last_seen_at: string
          occurrences: number
          updated_at: string
        }
        Insert: {
          api_source: Database["public"]["Enums"]["ge_api_type"]
          created_at?: string
          event_type: string
          first_seen_at?: string
          is_enabled?: boolean
          last_seen_at?: string
          occurrences?: number
          updated_at?: string
        }
        Update: {
          api_source?: Database["public"]["Enums"]["ge_api_type"]
          created_at?: string
          event_type?: string
          first_seen_at?: string
          is_enabled?: boolean
          last_seen_at?: string
          occurrences?: number
          updated_at?: string
        }
        Relationships: []
      }
      ge_unmatched_events: {
        Row: {
          api_source: Database["public"]["Enums"]["ge_api_type"]
          company_name: string | null
          created_at: string
          device_imei: string | null
          driver_id: string | null
          driver_name: string | null
          event_data: Json
          event_time: string
          event_type: string
          external_account_id: string | null
          external_event_id: string
          id: string
          latitude: number | null
          license_plate: string | null
          longitude: number | null
        }
        Insert: {
          api_source: Database["public"]["Enums"]["ge_api_type"]
          company_name?: string | null
          created_at?: string
          device_imei?: string | null
          driver_id?: string | null
          driver_name?: string | null
          event_data?: Json
          event_time: string
          event_type: string
          external_account_id?: string | null
          external_event_id: string
          id?: string
          latitude?: number | null
          license_plate?: string | null
          longitude?: number | null
        }
        Update: {
          api_source?: Database["public"]["Enums"]["ge_api_type"]
          company_name?: string | null
          created_at?: string
          device_imei?: string | null
          driver_id?: string | null
          driver_name?: string | null
          event_data?: Json
          event_time?: string
          event_type?: string
          external_account_id?: string | null
          external_event_id?: string
          id?: string
          latitude?: number | null
          license_plate?: string | null
          longitude?: number | null
        }
        Relationships: []
      }
      ge_user_roles: {
        Row: {
          created_at: string
          id: string
          role: Database["public"]["Enums"]["ge_app_role"]
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          role: Database["public"]["Enums"]["ge_app_role"]
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          role?: Database["public"]["Enums"]["ge_app_role"]
          user_id?: string
        }
        Relationships: []
      }
      ge_vehicle_equipments: {
        Row: {
          client_id: string
          created_at: string
          device_id: string | null
          id: string
          imei: string | null
          is_active: boolean
          serial_number: string | null
          tag: string | null
          updated_at: string
          vehicle_id: string
        }
        Insert: {
          client_id: string
          created_at?: string
          device_id?: string | null
          id?: string
          imei?: string | null
          is_active?: boolean
          serial_number?: string | null
          tag?: string | null
          updated_at?: string
          vehicle_id: string
        }
        Update: {
          client_id?: string
          created_at?: string
          device_id?: string | null
          id?: string
          imei?: string | null
          is_active?: boolean
          serial_number?: string | null
          tag?: string | null
          updated_at?: string
          vehicle_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "ge_vehicle_equipments_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "ge_clients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ge_vehicle_equipments_vehicle_id_fkey"
            columns: ["vehicle_id"]
            isOneToOne: false
            referencedRelation: "ge_vehicles"
            referencedColumns: ["id"]
          },
        ]
      }
      ge_vehicle_fleet_transfers: {
        Row: {
          client_id: string
          created_at: string
          from_fleet_id: string | null
          from_fleet_name: string | null
          id: string
          reason: string | null
          to_fleet_id: string | null
          to_fleet_name: string | null
          transferred_by_user_id: string | null
          vehicle_id: string
        }
        Insert: {
          client_id: string
          created_at?: string
          from_fleet_id?: string | null
          from_fleet_name?: string | null
          id?: string
          reason?: string | null
          to_fleet_id?: string | null
          to_fleet_name?: string | null
          transferred_by_user_id?: string | null
          vehicle_id: string
        }
        Update: {
          client_id?: string
          created_at?: string
          from_fleet_id?: string | null
          from_fleet_name?: string | null
          id?: string
          reason?: string | null
          to_fleet_id?: string | null
          to_fleet_name?: string | null
          transferred_by_user_id?: string | null
          vehicle_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "ge_vehicle_fleet_transfers_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "ge_clients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ge_vehicle_fleet_transfers_from_fleet_id_fkey"
            columns: ["from_fleet_id"]
            isOneToOne: false
            referencedRelation: "ge_fleets"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ge_vehicle_fleet_transfers_to_fleet_id_fkey"
            columns: ["to_fleet_id"]
            isOneToOne: false
            referencedRelation: "ge_fleets"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ge_vehicle_fleet_transfers_vehicle_id_fkey"
            columns: ["vehicle_id"]
            isOneToOne: false
            referencedRelation: "ge_vehicles"
            referencedColumns: ["id"]
          },
        ]
      }
      ge_vehicles: {
        Row: {
          chassis: string | null
          city: string | null
          client_id: string
          created_at: string
          fleet_id: string | null
          id: string
          internal_id: string | null
          is_active: boolean
          license_plate: string | null
          location_name: string | null
          state: string | null
          tag: string | null
          updated_at: string
        }
        Insert: {
          chassis?: string | null
          city?: string | null
          client_id: string
          created_at?: string
          fleet_id?: string | null
          id?: string
          internal_id?: string | null
          is_active?: boolean
          license_plate?: string | null
          location_name?: string | null
          state?: string | null
          tag?: string | null
          updated_at?: string
        }
        Update: {
          chassis?: string | null
          city?: string | null
          client_id?: string
          created_at?: string
          fleet_id?: string | null
          id?: string
          internal_id?: string | null
          is_active?: boolean
          license_plate?: string | null
          location_name?: string | null
          state?: string | null
          tag?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "ge_vehicles_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "ge_clients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ge_vehicles_fleet_id_fkey"
            columns: ["fleet_id"]
            isOneToOne: false
            referencedRelation: "ge_fleets"
            referencedColumns: ["id"]
          },
        ]
      }
      geocode_cache: {
        Row: {
          address: string
          address_key: string
          created_at: string
          id: string
          lat: number | null
          lng: number | null
          not_found: boolean
        }
        Insert: {
          address: string
          address_key: string
          created_at?: string
          id?: string
          lat?: number | null
          lng?: number | null
          not_found?: boolean
        }
        Update: {
          address?: string
          address_key?: string
          created_at?: string
          id?: string
          lat?: number | null
          lng?: number | null
          not_found?: boolean
        }
        Relationships: []
      }
      gsystem_equipamentos: {
        Row: {
          codigo: number
          comunicacao: string | null
          display_name: string | null
          empresa: Json | null
          equipamento: string | null
          observacao: string | null
          parametros: Json | null
          raw: Json | null
          serie: string | null
          synced_at: string
        }
        Insert: {
          codigo: number
          comunicacao?: string | null
          display_name?: string | null
          empresa?: Json | null
          equipamento?: string | null
          observacao?: string | null
          parametros?: Json | null
          raw?: Json | null
          serie?: string | null
          synced_at?: string
        }
        Update: {
          codigo?: number
          comunicacao?: string | null
          display_name?: string | null
          empresa?: Json | null
          equipamento?: string | null
          observacao?: string | null
          parametros?: Json | null
          raw?: Json | null
          serie?: string | null
          synced_at?: string
        }
        Relationships: []
      }
      gsystem_sync_status: {
        Row: {
          id: string
          items_count: number | null
          last_error: string | null
          last_finished_at: string | null
          last_started_at: string | null
          last_success_at: string | null
          updated_at: string
        }
        Insert: {
          id: string
          items_count?: number | null
          last_error?: string | null
          last_finished_at?: string | null
          last_started_at?: string | null
          last_success_at?: string | null
          updated_at?: string
        }
        Update: {
          id?: string
          items_count?: number | null
          last_error?: string | null
          last_finished_at?: string | null
          last_started_at?: string | null
          last_success_at?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      gsystem_vinculos_historico: {
        Row: {
          acessorios: Json | null
          chip: string | null
          created_at: string
          equipamento_codigo: string | null
          equipamento_modelo: string | null
          equipamento_serie: string | null
          erro: string | null
          id: string
          operacao: string
          placa: string | null
          sucesso: boolean
          user_id: string | null
          user_name: string | null
          veiculo_codigo: string | null
        }
        Insert: {
          acessorios?: Json | null
          chip?: string | null
          created_at?: string
          equipamento_codigo?: string | null
          equipamento_modelo?: string | null
          equipamento_serie?: string | null
          erro?: string | null
          id?: string
          operacao: string
          placa?: string | null
          sucesso?: boolean
          user_id?: string | null
          user_name?: string | null
          veiculo_codigo?: string | null
        }
        Update: {
          acessorios?: Json | null
          chip?: string | null
          created_at?: string
          equipamento_codigo?: string | null
          equipamento_modelo?: string | null
          equipamento_serie?: string | null
          erro?: string | null
          id?: string
          operacao?: string
          placa?: string | null
          sucesso?: boolean
          user_id?: string | null
          user_name?: string | null
          veiculo_codigo?: string | null
        }
        Relationships: []
      }
      inactivity_message_settings: {
        Row: {
          enabled_at: string | null
          id: string
          is_enabled: boolean
          message: string
          updated_at: string
          updated_by: string | null
        }
        Insert: {
          enabled_at?: string | null
          id?: string
          is_enabled?: boolean
          message?: string
          updated_at?: string
          updated_by?: string | null
        }
        Update: {
          enabled_at?: string | null
          id?: string
          is_enabled?: boolean
          message?: string
          updated_at?: string
          updated_by?: string | null
        }
        Relationships: []
      }
      integracoes_segredos: {
        Row: {
          chave: string
          updated_at: string
          updated_by: string | null
          valor: string
        }
        Insert: {
          chave: string
          updated_at?: string
          updated_by?: string | null
          valor: string
        }
        Update: {
          chave?: string
          updated_at?: string
          updated_by?: string | null
          valor?: string
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
      margem_config: {
        Row: {
          custo_chamado: number
          custo_chip_mensal: number
          custo_equipamento_padrao: number
          custo_visita: number
          id: number
          imposto_pct: number
          updated_at: string
          updated_by: string | null
          vida_util_meses: number
        }
        Insert: {
          custo_chamado?: number
          custo_chip_mensal?: number
          custo_equipamento_padrao?: number
          custo_visita?: number
          id?: number
          imposto_pct?: number
          updated_at?: string
          updated_by?: string | null
          vida_util_meses?: number
        }
        Update: {
          custo_chamado?: number
          custo_chip_mensal?: number
          custo_equipamento_padrao?: number
          custo_visita?: number
          id?: number
          imposto_pct?: number
          updated_at?: string
          updated_by?: string | null
          vida_util_meses?: number
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
          block_screen: boolean
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
          block_screen?: boolean
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
          block_screen?: boolean
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
      modo_teste: {
        Row: {
          ativo: boolean
          desde: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          ativo?: boolean
          desde?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          ativo?: boolean
          desde?: string | null
          updated_at?: string
          user_id?: string
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
      offline_routing_settings: {
        Row: {
          id: string
          is_enabled: boolean
          target_sector_id: string | null
          target_sector_name: string | null
          updated_at: string
          updated_by: string | null
        }
        Insert: {
          id?: string
          is_enabled?: boolean
          target_sector_id?: string | null
          target_sector_name?: string | null
          updated_at?: string
          updated_by?: string | null
        }
        Update: {
          id?: string
          is_enabled?: boolean
          target_sector_id?: string | null
          target_sector_name?: string | null
          updated_at?: string
          updated_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "offline_routing_settings_target_sector_id_fkey"
            columns: ["target_sector_id"]
            isOneToOne: false
            referencedRelation: "sectors"
            referencedColumns: ["id"]
          },
        ]
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
      operator_chat_participants: {
        Row: {
          chat_id: string
          created_at: string
          id: string
          is_locked: boolean
          user_id: string
          user_name: string | null
        }
        Insert: {
          chat_id: string
          created_at?: string
          id?: string
          is_locked?: boolean
          user_id: string
          user_name?: string | null
        }
        Update: {
          chat_id?: string
          created_at?: string
          id?: string
          is_locked?: boolean
          user_id?: string
          user_name?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "operator_chat_participants_chat_id_fkey"
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
          is_group: boolean
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
          is_group?: boolean
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
          is_group?: boolean
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
      platforms: {
        Row: {
          created_at: string
          description: string
          id: string
          is_active: boolean
          name: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          description?: string
          id?: string
          is_active?: boolean
          name: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          description?: string
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
          is_active: boolean
          is_chat_available: boolean
          last_seen_at: string | null
          name: string
          panel_only: boolean
          signature_image_url: string | null
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
          is_active?: boolean
          is_chat_available?: boolean
          last_seen_at?: string | null
          name?: string
          panel_only?: boolean
          signature_image_url?: string | null
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
          is_active?: boolean
          is_chat_available?: boolean
          last_seen_at?: string | null
          name?: string
          panel_only?: boolean
          signature_image_url?: string | null
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
      rc_activity_logs: {
        Row: {
          action: string
          created_at: string
          details: Json
          id: string
          legacy_user_id: string | null
          user_email: string
          user_id: string | null
        }
        Insert: {
          action: string
          created_at?: string
          details?: Json
          id?: string
          legacy_user_id?: string | null
          user_email?: string
          user_id?: string | null
        }
        Update: {
          action?: string
          created_at?: string
          details?: Json
          id?: string
          legacy_user_id?: string | null
          user_email?: string
          user_id?: string | null
        }
        Relationships: []
      }
      rc_bulk_send_logs: {
        Row: {
          batch_id: string
          channels: Json
          client_id: string
          client_name: string
          created_at: string
          error_message: string
          id: string
          plates: Json
          sent_by: string
          status: string
          template_name: string
        }
        Insert: {
          batch_id?: string
          channels?: Json
          client_id: string
          client_name: string
          created_at?: string
          error_message?: string
          id?: string
          plates?: Json
          sent_by?: string
          status?: string
          template_name?: string
        }
        Update: {
          batch_id?: string
          channels?: Json
          client_id?: string
          client_name?: string
          created_at?: string
          error_message?: string
          id?: string
          plates?: Json
          sent_by?: string
          status?: string
          template_name?: string
        }
        Relationships: []
      }
      rc_clients: {
        Row: {
          company_id: string | null
          created_at: string
          emails: Json
          id: string
          name: string
          name_key: string
          phones: Json
          updated_at: string
          vehicle_count: number
        }
        Insert: {
          company_id?: string | null
          created_at?: string
          emails?: Json
          id?: string
          name: string
          name_key: string
          phones?: Json
          updated_at?: string
          vehicle_count?: number
        }
        Update: {
          company_id?: string | null
          created_at?: string
          emails?: Json
          id?: string
          name?: string
          name_key?: string
          phones?: Json
          updated_at?: string
          vehicle_count?: number
        }
        Relationships: [
          {
            foreignKeyName: "rc_clients_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
        ]
      }
      rc_import_history: {
        Row: {
          id: string
          imported_at: string
          imported_by: string
          new_vehicles: number
          recovered_count: number
          skipped_count: number
          skipped_details: Json
          total_rows: number
          updated_vehicles: number
          user_id: string | null
          warning_count: number
          warning_details: Json
        }
        Insert: {
          id?: string
          imported_at?: string
          imported_by?: string
          new_vehicles?: number
          recovered_count?: number
          skipped_count?: number
          skipped_details?: Json
          total_rows?: number
          updated_vehicles?: number
          user_id?: string | null
          warning_count?: number
          warning_details?: Json
        }
        Update: {
          id?: string
          imported_at?: string
          imported_by?: string
          new_vehicles?: number
          recovered_count?: number
          skipped_count?: number
          skipped_details?: Json
          total_rows?: number
          updated_vehicles?: number
          user_id?: string | null
          warning_count?: number
          warning_details?: Json
        }
        Relationships: []
      }
      rc_import_templates: {
        Row: {
          created_at: string
          id: string
          mapping: Json
          name: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          id?: string
          mapping?: Json
          name: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          id?: string
          mapping?: Json
          name?: string
          updated_at?: string
        }
        Relationships: []
      }
      rc_legacy_chats: {
        Row: {
          assigned_to: string | null
          contact_name: string
          created_at: string
          id: string
          last_message_at: string | null
          messages: Json
          phone: string
          status: string
        }
        Insert: {
          assigned_to?: string | null
          contact_name?: string
          created_at?: string
          id: string
          last_message_at?: string | null
          messages?: Json
          phone: string
          status?: string
        }
        Update: {
          assigned_to?: string | null
          contact_name?: string
          created_at?: string
          id?: string
          last_message_at?: string | null
          messages?: Json
          phone?: string
          status?: string
        }
        Relationships: []
      }
      rc_message_templates: {
        Row: {
          body: string
          created_at: string
          created_by: string | null
          id: string
          is_closing_template: boolean
          name: string
          subject: string
          updated_at: string
        }
        Insert: {
          body?: string
          created_at?: string
          created_by?: string | null
          id?: string
          is_closing_template?: boolean
          name: string
          subject?: string
          updated_at?: string
        }
        Update: {
          body?: string
          created_at?: string
          created_by?: string | null
          id?: string
          is_closing_template?: boolean
          name?: string
          subject?: string
          updated_at?: string
        }
        Relationships: []
      }
      rc_notification_logs: {
        Row: {
          batch_id: string
          channels: Json
          client_id: string
          client_name: string
          created_at: string
          error_message: string
          id: string
          plates: Json
          sent_at: string
          sent_by: string
          status: string
          template_name: string
        }
        Insert: {
          batch_id?: string
          channels?: Json
          client_id: string
          client_name: string
          created_at?: string
          error_message?: string
          id?: string
          plates?: Json
          sent_at?: string
          sent_by: string
          status?: string
          template_name?: string
        }
        Update: {
          batch_id?: string
          channels?: Json
          client_id?: string
          client_name?: string
          created_at?: string
          error_message?: string
          id?: string
          plates?: Json
          sent_at?: string
          sent_by?: string
          status?: string
          template_name?: string
        }
        Relationships: []
      }
      rc_recovered_vehicles: {
        Row: {
          client_id: string | null
          client_name: string
          created_at: string
          id: string
          last_days_offline: number
          plate: string
          recovered_at: string
        }
        Insert: {
          client_id?: string | null
          client_name: string
          created_at?: string
          id?: string
          last_days_offline?: number
          plate: string
          recovered_at?: string
        }
        Update: {
          client_id?: string | null
          client_name?: string
          created_at?: string
          id?: string
          last_days_offline?: number
          plate?: string
          recovered_at?: string
        }
        Relationships: []
      }
      rc_settings: {
        Row: {
          email_channel_id: string | null
          id: number
          legacy_import_counts: Json
          legacy_imported_at: string | null
          updated_at: string
          whatsapp_channel_id: string | null
        }
        Insert: {
          email_channel_id?: string | null
          id?: number
          legacy_import_counts?: Json
          legacy_imported_at?: string | null
          updated_at?: string
          whatsapp_channel_id?: string | null
        }
        Update: {
          email_channel_id?: string | null
          id?: number
          legacy_import_counts?: Json
          legacy_imported_at?: string | null
          updated_at?: string
          whatsapp_channel_id?: string | null
        }
        Relationships: []
      }
      rc_skipped_rows: {
        Row: {
          created_at: string
          id: string
          imported_at: string
          raw_client: string
          raw_plate: string
          reason: string
          row_number: number
        }
        Insert: {
          created_at?: string
          id?: string
          imported_at?: string
          raw_client?: string
          raw_plate?: string
          reason?: string
          row_number: number
        }
        Update: {
          created_at?: string
          id?: string
          imported_at?: string
          raw_client?: string
          raw_plate?: string
          reason?: string
          row_number?: number
        }
        Relationships: []
      }
      rc_vehicle_annotations: {
        Row: {
          client_id: string | null
          client_name: string
          created_at: string
          created_by: string | null
          created_by_email: string
          id: string
          observation: string
          plate: string
        }
        Insert: {
          client_id?: string | null
          client_name?: string
          created_at?: string
          created_by?: string | null
          created_by_email?: string
          id?: string
          observation: string
          plate: string
        }
        Update: {
          client_id?: string | null
          client_name?: string
          created_at?: string
          created_by?: string | null
          created_by_email?: string
          id?: string
          observation?: string
          plate?: string
        }
        Relationships: []
      }
      rc_vehicles: {
        Row: {
          battery_voltage: string
          client_id: string
          client_name: string
          created_at: string
          days_offline: number
          id: string
          import_date: string
          imported_at: string
          incidences: number
          last_communication: string | null
          notifications: number
          observation: string
          plate: string
          recovery_count: number
          status: string
          was_recovered: boolean
        }
        Insert: {
          battery_voltage?: string
          client_id: string
          client_name: string
          created_at?: string
          days_offline?: number
          id?: string
          import_date?: string
          imported_at?: string
          incidences?: number
          last_communication?: string | null
          notifications?: number
          observation?: string
          plate: string
          recovery_count?: number
          status?: string
          was_recovered?: boolean
        }
        Update: {
          battery_voltage?: string
          client_id?: string
          client_name?: string
          created_at?: string
          days_offline?: number
          id?: string
          import_date?: string
          imported_at?: string
          incidences?: number
          last_communication?: string | null
          notifications?: number
          observation?: string
          plate?: string
          recovery_count?: number
          status?: string
          was_recovered?: boolean
        }
        Relationships: []
      }
      rh_ausencias: {
        Row: {
          arquivo_nome: string | null
          arquivo_path: string | null
          colaborador_id: string
          created_at: string
          created_by: string | null
          data_fim: string
          data_inicio: string
          desconta: boolean
          id: string
          minutos: number | null
          observacao: string | null
          situacao: string
          tipo: string
        }
        Insert: {
          arquivo_nome?: string | null
          arquivo_path?: string | null
          colaborador_id: string
          created_at?: string
          created_by?: string | null
          data_fim: string
          data_inicio: string
          desconta?: boolean
          id?: string
          minutos?: number | null
          observacao?: string | null
          situacao?: string
          tipo: string
        }
        Update: {
          arquivo_nome?: string | null
          arquivo_path?: string | null
          colaborador_id?: string
          created_at?: string
          created_by?: string | null
          data_fim?: string
          data_inicio?: string
          desconta?: boolean
          id?: string
          minutos?: number | null
          observacao?: string | null
          situacao?: string
          tipo?: string
        }
        Relationships: [
          {
            foreignKeyName: "rh_ausencias_colaborador_id_fkey"
            columns: ["colaborador_id"]
            isOneToOne: false
            referencedRelation: "rh_colaboradores"
            referencedColumns: ["id"]
          },
        ]
      }
      rh_banco_horas: {
        Row: {
          colaborador_id: string
          created_at: string
          created_by: string | null
          data: string
          id: string
          minutos: number
          observacao: string | null
          tipo: string
        }
        Insert: {
          colaborador_id: string
          created_at?: string
          created_by?: string | null
          data: string
          id?: string
          minutos: number
          observacao?: string | null
          tipo?: string
        }
        Update: {
          colaborador_id?: string
          created_at?: string
          created_by?: string | null
          data?: string
          id?: string
          minutos?: number
          observacao?: string | null
          tipo?: string
        }
        Relationships: [
          {
            foreignKeyName: "rh_banco_horas_colaborador_id_fkey"
            columns: ["colaborador_id"]
            isOneToOne: false
            referencedRelation: "rh_colaboradores"
            referencedColumns: ["id"]
          },
        ]
      }
      rh_checklists: {
        Row: {
          colaborador_id: string
          concluido_em: string | null
          created_at: string
          created_by: string | null
          id: string
          itens: Json
          tipo: string
        }
        Insert: {
          colaborador_id: string
          concluido_em?: string | null
          created_at?: string
          created_by?: string | null
          id?: string
          itens?: Json
          tipo: string
        }
        Update: {
          colaborador_id?: string
          concluido_em?: string | null
          created_at?: string
          created_by?: string | null
          id?: string
          itens?: Json
          tipo?: string
        }
        Relationships: [
          {
            foreignKeyName: "rh_checklists_colaborador_id_fkey"
            columns: ["colaborador_id"]
            isOneToOne: false
            referencedRelation: "rh_colaboradores"
            referencedColumns: ["id"]
          },
        ]
      }
      rh_colaboradores: {
        Row: {
          cargo: string | null
          contato_emergencia: string | null
          cpf: string | null
          created_at: string
          created_by: string | null
          data_admissao: string | null
          data_desligamento: string | null
          data_nascimento: string | null
          email: string | null
          endereco: string | null
          gestor_user_id: string | null
          id: string
          jornada: string | null
          motivo_desligamento: string | null
          nome: string
          observacao: string | null
          salario: number | null
          setor_id: string | null
          situacao: string
          telefone: string | null
          tipo_contrato: string
          updated_at: string
          user_id: string | null
        }
        Insert: {
          cargo?: string | null
          contato_emergencia?: string | null
          cpf?: string | null
          created_at?: string
          created_by?: string | null
          data_admissao?: string | null
          data_desligamento?: string | null
          data_nascimento?: string | null
          email?: string | null
          endereco?: string | null
          gestor_user_id?: string | null
          id?: string
          jornada?: string | null
          motivo_desligamento?: string | null
          nome: string
          observacao?: string | null
          salario?: number | null
          setor_id?: string | null
          situacao?: string
          telefone?: string | null
          tipo_contrato?: string
          updated_at?: string
          user_id?: string | null
        }
        Update: {
          cargo?: string | null
          contato_emergencia?: string | null
          cpf?: string | null
          created_at?: string
          created_by?: string | null
          data_admissao?: string | null
          data_desligamento?: string | null
          data_nascimento?: string | null
          email?: string | null
          endereco?: string | null
          gestor_user_id?: string | null
          id?: string
          jornada?: string | null
          motivo_desligamento?: string | null
          nome?: string
          observacao?: string | null
          salario?: number | null
          setor_id?: string | null
          situacao?: string
          telefone?: string | null
          tipo_contrato?: string
          updated_at?: string
          user_id?: string | null
        }
        Relationships: []
      }
      rh_config: {
        Row: {
          aviso_email: string | null
          aviso_whatsapp: string | null
          avisos_ativos: boolean
          banco_horas_alerta_min: number
          dias_aviso_documento: number
          dias_aviso_ferias: number
          faltas_alerta_dias: number
          faltas_alerta_qtd: number
          id: number
          itens_admissao: Json
          itens_desligamento: Json
          ultima_execucao_em: string | null
          updated_at: string
        }
        Insert: {
          aviso_email?: string | null
          aviso_whatsapp?: string | null
          avisos_ativos?: boolean
          banco_horas_alerta_min?: number
          dias_aviso_documento?: number
          dias_aviso_ferias?: number
          faltas_alerta_dias?: number
          faltas_alerta_qtd?: number
          id?: number
          itens_admissao?: Json
          itens_desligamento?: Json
          ultima_execucao_em?: string | null
          updated_at?: string
        }
        Update: {
          aviso_email?: string | null
          aviso_whatsapp?: string | null
          avisos_ativos?: boolean
          banco_horas_alerta_min?: number
          dias_aviso_documento?: number
          dias_aviso_ferias?: number
          faltas_alerta_dias?: number
          faltas_alerta_qtd?: number
          id?: number
          itens_admissao?: Json
          itens_desligamento?: Json
          ultima_execucao_em?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      rh_cron_token: {
        Row: {
          created_at: string
          id: number
          token: string
        }
        Insert: {
          created_at?: string
          id?: number
          token: string
        }
        Update: {
          created_at?: string
          id?: number
          token?: string
        }
        Relationships: []
      }
      rh_documentos: {
        Row: {
          arquivo_nome: string | null
          arquivo_path: string | null
          colaborador_id: string
          created_at: string
          created_by: string | null
          emissao: string | null
          id: string
          numero: string | null
          observacao: string | null
          tipo: string
          validade: string | null
        }
        Insert: {
          arquivo_nome?: string | null
          arquivo_path?: string | null
          colaborador_id: string
          created_at?: string
          created_by?: string | null
          emissao?: string | null
          id?: string
          numero?: string | null
          observacao?: string | null
          tipo: string
          validade?: string | null
        }
        Update: {
          arquivo_nome?: string | null
          arquivo_path?: string | null
          colaborador_id?: string
          created_at?: string
          created_by?: string | null
          emissao?: string | null
          id?: string
          numero?: string | null
          observacao?: string | null
          tipo?: string
          validade?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "rh_documentos_colaborador_id_fkey"
            columns: ["colaborador_id"]
            isOneToOne: false
            referencedRelation: "rh_colaboradores"
            referencedColumns: ["id"]
          },
        ]
      }
      rh_ferias: {
        Row: {
          abono_dias: number
          aquisitivo_inicio: string
          colaborador_id: string
          created_at: string
          created_by: string | null
          data_fim: string
          data_inicio: string
          id: string
          observacao: string | null
          situacao: string
        }
        Insert: {
          abono_dias?: number
          aquisitivo_inicio: string
          colaborador_id: string
          created_at?: string
          created_by?: string | null
          data_fim: string
          data_inicio: string
          id?: string
          observacao?: string | null
          situacao?: string
        }
        Update: {
          abono_dias?: number
          aquisitivo_inicio?: string
          colaborador_id?: string
          created_at?: string
          created_by?: string | null
          data_fim?: string
          data_inicio?: string
          id?: string
          observacao?: string | null
          situacao?: string
        }
        Relationships: [
          {
            foreignKeyName: "rh_ferias_colaborador_id_fkey"
            columns: ["colaborador_id"]
            isOneToOne: false
            referencedRelation: "rh_colaboradores"
            referencedColumns: ["id"]
          },
        ]
      }
      rh_ocorrencias: {
        Row: {
          arquivo_nome: string | null
          arquivo_path: string | null
          ciente_em: string | null
          colaborador_id: string
          created_at: string
          created_by: string | null
          data: string
          descricao: string | null
          dias_suspensao: number | null
          id: string
          motivo: string
          tipo: string
        }
        Insert: {
          arquivo_nome?: string | null
          arquivo_path?: string | null
          ciente_em?: string | null
          colaborador_id: string
          created_at?: string
          created_by?: string | null
          data: string
          descricao?: string | null
          dias_suspensao?: number | null
          id?: string
          motivo: string
          tipo: string
        }
        Update: {
          arquivo_nome?: string | null
          arquivo_path?: string | null
          ciente_em?: string | null
          colaborador_id?: string
          created_at?: string
          created_by?: string | null
          data?: string
          descricao?: string | null
          dias_suspensao?: number | null
          id?: string
          motivo?: string
          tipo?: string
        }
        Relationships: [
          {
            foreignKeyName: "rh_ocorrencias_colaborador_id_fkey"
            columns: ["colaborador_id"]
            isOneToOne: false
            referencedRelation: "rh_colaboradores"
            referencedColumns: ["id"]
          },
        ]
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
          email_reply_at: string | null
          email_reply_pending: boolean
          equipment_model_id: string | null
          equipment_model_name: string | null
          escalated_from_ticket_id: string | null
          escalated_to_gestao: boolean
          financial_done_at: string | null
          financial_done_by: string | null
          financial_notes: string | null
          financial_pending: boolean
          financial_requested_at: string | null
          financial_requested_by: string | null
          hide_service_templates: boolean
          id: string
          is_teste: boolean
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
          tech_protocol_id: string | null
          tech_stage: string | null
          technical_term_override_by: string | null
          technical_term_override_reason: string | null
          test_result: string | null
          teste_sem_protocolo_em: string | null
          teste_sem_protocolo_justificativa: string | null
          teste_sem_protocolo_por: string | null
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
          email_reply_at?: string | null
          email_reply_pending?: boolean
          equipment_model_id?: string | null
          equipment_model_name?: string | null
          escalated_from_ticket_id?: string | null
          escalated_to_gestao?: boolean
          financial_done_at?: string | null
          financial_done_by?: string | null
          financial_notes?: string | null
          financial_pending?: boolean
          financial_requested_at?: string | null
          financial_requested_by?: string | null
          hide_service_templates?: boolean
          id?: string
          is_teste?: boolean
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
          tech_protocol_id?: string | null
          tech_stage?: string | null
          technical_term_override_by?: string | null
          technical_term_override_reason?: string | null
          test_result?: string | null
          teste_sem_protocolo_em?: string | null
          teste_sem_protocolo_justificativa?: string | null
          teste_sem_protocolo_por?: string | null
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
          email_reply_at?: string | null
          email_reply_pending?: boolean
          equipment_model_id?: string | null
          equipment_model_name?: string | null
          escalated_from_ticket_id?: string | null
          escalated_to_gestao?: boolean
          financial_done_at?: string | null
          financial_done_by?: string | null
          financial_notes?: string | null
          financial_pending?: boolean
          financial_requested_at?: string | null
          financial_requested_by?: string | null
          hide_service_templates?: boolean
          id?: string
          is_teste?: boolean
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
          tech_protocol_id?: string | null
          tech_stage?: string | null
          technical_term_override_by?: string | null
          technical_term_override_reason?: string | null
          test_result?: string | null
          teste_sem_protocolo_em?: string | null
          teste_sem_protocolo_justificativa?: string | null
          teste_sem_protocolo_por?: string | null
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
          {
            foreignKeyName: "service_tickets_tech_protocol_id_fkey"
            columns: ["tech_protocol_id"]
            isOneToOne: false
            referencedRelation: "service_tickets"
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
          instructions: string | null
          name: string
          notes: string | null
          phone: string | null
          updated_at: string
        }
        Insert: {
          company_id: string
          created_at?: string
          created_by?: string | null
          email?: string | null
          id?: string
          instructions?: string | null
          name: string
          notes?: string | null
          phone?: string | null
          updated_at?: string
        }
        Update: {
          company_id?: string
          created_at?: string
          created_by?: string | null
          email?: string | null
          id?: string
          instructions?: string | null
          name?: string
          notes?: string | null
          phone?: string | null
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
      system_health_alert_log: {
        Row: {
          alert_key: string
          id: string
          is_open: boolean
          last_seen_at: string
          message: string
          metadata: Json
          opened_at: string
          resolved_at: string | null
          severity: string
          title: string
        }
        Insert: {
          alert_key: string
          id?: string
          is_open?: boolean
          last_seen_at?: string
          message?: string
          metadata?: Json
          opened_at?: string
          resolved_at?: string | null
          severity?: string
          title: string
        }
        Update: {
          alert_key?: string
          id?: string
          is_open?: boolean
          last_seen_at?: string
          message?: string
          metadata?: Json
          opened_at?: string
          resolved_at?: string | null
          severity?: string
          title?: string
        }
        Relationships: []
      }
      system_health_settings: {
        Row: {
          alerts_enabled: boolean
          cache_hit_min_pct: number
          connections_pct_warn: number
          created_at: string
          cron_stale_minutes: number
          db_growth_limit_mb: number
          id: string
          integration_errors_per_hour: number
          integration_fail_threshold: number
          muted_until: string | null
          updated_at: string
        }
        Insert: {
          alerts_enabled?: boolean
          cache_hit_min_pct?: number
          connections_pct_warn?: number
          created_at?: string
          cron_stale_minutes?: number
          db_growth_limit_mb?: number
          id?: string
          integration_errors_per_hour?: number
          integration_fail_threshold?: number
          muted_until?: string | null
          updated_at?: string
        }
        Update: {
          alerts_enabled?: boolean
          cache_hit_min_pct?: number
          connections_pct_warn?: number
          created_at?: string
          cron_stale_minutes?: number
          db_growth_limit_mb?: number
          id?: string
          integration_errors_per_hour?: number
          integration_fail_threshold?: number
          muted_until?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      system_health_snapshots: {
        Row: {
          cache_hit_pct: number
          captured_at: string
          connections: number
          db_size_bytes: number
          id: string
          max_connections: number
          metrics: Json
        }
        Insert: {
          cache_hit_pct?: number
          captured_at?: string
          connections?: number
          db_size_bytes?: number
          id?: string
          max_connections?: number
          metrics?: Json
        }
        Update: {
          cache_hit_pct?: number
          captured_at?: string
          connections?: number
          db_size_bytes?: number
          id?: string
          max_connections?: number
          metrics?: Json
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
      technical_service_terms: {
        Row: {
          address: string | null
          cancelled_at: string | null
          cancelled_by: string | null
          checklist: Json
          client_name: string | null
          company_id: string | null
          cpf_verified_at: string | null
          created_at: string
          created_by: string
          description: string | null
          equipment_id: string | null
          first_viewed_at: string | null
          id: string
          is_teste: boolean
          last_viewed_at: string | null
          no_response_notified_at: string | null
          plate: string | null
          responded_at: string | null
          responder_cpf: string | null
          responder_ip: string | null
          responder_name: string | null
          responder_note: string | null
          responder_user_agent: string | null
          responsible_email: string | null
          responsible_name: string
          responsible_phone: string | null
          schedule_kind: string | null
          schedule_reference: string | null
          scheduled_at: string | null
          scheduled_by: string | null
          send_errors: Json
          sent_at: string | null
          sent_channels: string[]
          seq: number
          service_label: string | null
          service_type: string
          status: string
          superseded_by: string | null
          term_label: string | null
          term_text: string
          term_title: string
          term_type: string | null
          ticket_id: string | null
          token: string
          updated_at: string
          view_count: number
          viewer_cpf: string | null
        }
        Insert: {
          address?: string | null
          cancelled_at?: string | null
          cancelled_by?: string | null
          checklist?: Json
          client_name?: string | null
          company_id?: string | null
          cpf_verified_at?: string | null
          created_at?: string
          created_by: string
          description?: string | null
          equipment_id?: string | null
          first_viewed_at?: string | null
          id?: string
          is_teste?: boolean
          last_viewed_at?: string | null
          no_response_notified_at?: string | null
          plate?: string | null
          responded_at?: string | null
          responder_cpf?: string | null
          responder_ip?: string | null
          responder_name?: string | null
          responder_note?: string | null
          responder_user_agent?: string | null
          responsible_email?: string | null
          responsible_name: string
          responsible_phone?: string | null
          schedule_kind?: string | null
          schedule_reference?: string | null
          scheduled_at?: string | null
          scheduled_by?: string | null
          send_errors?: Json
          sent_at?: string | null
          sent_channels?: string[]
          seq?: never
          service_label?: string | null
          service_type: string
          status?: string
          superseded_by?: string | null
          term_label?: string | null
          term_text: string
          term_title: string
          term_type?: string | null
          ticket_id?: string | null
          token?: string
          updated_at?: string
          view_count?: number
          viewer_cpf?: string | null
        }
        Update: {
          address?: string | null
          cancelled_at?: string | null
          cancelled_by?: string | null
          checklist?: Json
          client_name?: string | null
          company_id?: string | null
          cpf_verified_at?: string | null
          created_at?: string
          created_by?: string
          description?: string | null
          equipment_id?: string | null
          first_viewed_at?: string | null
          id?: string
          is_teste?: boolean
          last_viewed_at?: string | null
          no_response_notified_at?: string | null
          plate?: string | null
          responded_at?: string | null
          responder_cpf?: string | null
          responder_ip?: string | null
          responder_name?: string | null
          responder_note?: string | null
          responder_user_agent?: string | null
          responsible_email?: string | null
          responsible_name?: string
          responsible_phone?: string | null
          schedule_kind?: string | null
          schedule_reference?: string | null
          scheduled_at?: string | null
          scheduled_by?: string | null
          send_errors?: Json
          sent_at?: string | null
          sent_channels?: string[]
          seq?: never
          service_label?: string | null
          service_type?: string
          status?: string
          superseded_by?: string | null
          term_label?: string | null
          term_text?: string
          term_title?: string
          term_type?: string | null
          ticket_id?: string | null
          token?: string
          updated_at?: string
          view_count?: number
          viewer_cpf?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "technical_service_terms_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "technical_service_terms_ticket_id_fkey"
            columns: ["ticket_id"]
            isOneToOne: false
            referencedRelation: "service_tickets"
            referencedColumns: ["id"]
          },
        ]
      }
      technical_term_settings: {
        Row: {
          email_subject: string
          email_template: string
          id: string
          instalacao_checklist: Json
          instalacao_text: string
          instalacao_title: string
          manutencao_checklist: Json
          manutencao_text: string
          manutencao_title: string
          notify_creator: boolean
          require_reject_reason: boolean
          retirada_checklist: Json
          retirada_text: string
          retirada_title: string
          updated_at: string
          updated_by: string | null
          whatsapp_template: string
        }
        Insert: {
          email_subject?: string
          email_template?: string
          id?: string
          instalacao_checklist?: Json
          instalacao_text?: string
          instalacao_title?: string
          manutencao_checklist?: Json
          manutencao_text?: string
          manutencao_title?: string
          notify_creator?: boolean
          require_reject_reason?: boolean
          retirada_checklist?: Json
          retirada_text?: string
          retirada_title?: string
          updated_at?: string
          updated_by?: string | null
          whatsapp_template?: string
        }
        Update: {
          email_subject?: string
          email_template?: string
          id?: string
          instalacao_checklist?: Json
          instalacao_text?: string
          instalacao_title?: string
          manutencao_checklist?: Json
          manutencao_text?: string
          manutencao_title?: string
          notify_creator?: boolean
          require_reject_reason?: boolean
          retirada_checklist?: Json
          retirada_text?: string
          retirada_title?: string
          updated_at?: string
          updated_by?: string | null
          whatsapp_template?: string
        }
        Relationships: []
      }
      technical_term_types: {
        Row: {
          body: string
          checklist: Json
          created_at: string
          default_service_type: string | null
          email_subject: string
          email_template: string
          id: string
          is_active: boolean
          key: string
          label: string
          position: number
          requires_equipment_id: boolean
          title: string
          updated_at: string
          updated_by: string | null
          whatsapp_template: string
        }
        Insert: {
          body: string
          checklist?: Json
          created_at?: string
          default_service_type?: string | null
          email_subject?: string
          email_template?: string
          id?: string
          is_active?: boolean
          key: string
          label: string
          position?: number
          requires_equipment_id?: boolean
          title: string
          updated_at?: string
          updated_by?: string | null
          whatsapp_template?: string
        }
        Update: {
          body?: string
          checklist?: Json
          created_at?: string
          default_service_type?: string | null
          email_subject?: string
          email_template?: string
          id?: string
          is_active?: boolean
          key?: string
          label?: string
          position?: number
          requires_equipment_id?: boolean
          title?: string
          updated_at?: string
          updated_by?: string | null
          whatsapp_template?: string
        }
        Relationships: []
      }
      technician_notes: {
        Row: {
          created_at: string
          created_by: string | null
          created_by_name: string | null
          id: string
          note: string
          technician_id: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          created_by_name?: string | null
          id?: string
          note: string
          technician_id: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          created_by?: string | null
          created_by_name?: string | null
          id?: string
          note?: string
          technician_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "technician_notes_technician_id_fkey"
            columns: ["technician_id"]
            isOneToOne: false
            referencedRelation: "chat_technicians"
            referencedColumns: ["id"]
          },
        ]
      }
      teste_envios: {
        Row: {
          bloqueado: boolean
          canal: string
          conteudo: string | null
          created_at: string
          destino: string | null
          detalhe: Json | null
          id: string
          resumo: string | null
          user_id: string | null
        }
        Insert: {
          bloqueado?: boolean
          canal: string
          conteudo?: string | null
          created_at?: string
          destino?: string | null
          detalhe?: Json | null
          id?: string
          resumo?: string | null
          user_id?: string | null
        }
        Update: {
          bloqueado?: boolean
          canal?: string
          conteudo?: string | null
          created_at?: string
          destino?: string | null
          detalhe?: Json | null
          id?: string
          resumo?: string | null
          user_id?: string | null
        }
        Relationships: []
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
      ticket_assignment_alert_settings: {
        Row: {
          enabled: boolean
          id: number
          on_created: boolean
          on_email: boolean
          on_reassigned: boolean
          scope: string
          sound_enabled: boolean
          updated_at: string
          user_ids: string[]
        }
        Insert: {
          enabled?: boolean
          id?: number
          on_created?: boolean
          on_email?: boolean
          on_reassigned?: boolean
          scope?: string
          sound_enabled?: boolean
          updated_at?: string
          user_ids?: string[]
        }
        Update: {
          enabled?: boolean
          id?: number
          on_created?: boolean
          on_email?: boolean
          on_reassigned?: boolean
          scope?: string
          sound_enabled?: boolean
          updated_at?: string
          user_ids?: string[]
        }
        Relationships: []
      }
      ticket_assignment_alerts: {
        Row: {
          acknowledged_at: string | null
          client_name: string | null
          created_at: string
          event_type: string
          id: string
          protocol: string | null
          subject: string | null
          target_user_id: string
          ticket_id: string
          triggered_by: string | null
          triggered_by_name: string | null
        }
        Insert: {
          acknowledged_at?: string | null
          client_name?: string | null
          created_at?: string
          event_type: string
          id?: string
          protocol?: string | null
          subject?: string | null
          target_user_id: string
          ticket_id: string
          triggered_by?: string | null
          triggered_by_name?: string | null
        }
        Update: {
          acknowledged_at?: string | null
          client_name?: string | null
          created_at?: string
          event_type?: string
          id?: string
          protocol?: string | null
          subject?: string | null
          target_user_id?: string
          ticket_id?: string
          triggered_by?: string | null
          triggered_by_name?: string | null
        }
        Relationships: []
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
      ticket_categories: {
        Row: {
          created_at: string
          gsystem_key: string | null
          id: string
          is_active: boolean
          key: string
          label: string
          last_synced_at: string | null
          position: number
          source: string
          technical_term_type: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          gsystem_key?: string | null
          id?: string
          is_active?: boolean
          key: string
          label: string
          last_synced_at?: string | null
          position?: number
          source?: string
          technical_term_type?: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          gsystem_key?: string | null
          id?: string
          is_active?: boolean
          key?: string
          label?: string
          last_synced_at?: string | null
          position?: number
          source?: string
          technical_term_type?: string
          updated_at?: string
        }
        Relationships: []
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
      ticket_error_entries: {
        Row: {
          amount: number
          created_at: string
          created_by: string | null
          description: string | null
          id: string
          operator_name: string
          operator_user_id: string | null
          ticket_id: string
          updated_at: string
        }
        Insert: {
          amount?: number
          created_at?: string
          created_by?: string | null
          description?: string | null
          id?: string
          operator_name?: string
          operator_user_id?: string | null
          ticket_id: string
          updated_at?: string
        }
        Update: {
          amount?: number
          created_at?: string
          created_by?: string | null
          description?: string | null
          id?: string
          operator_name?: string
          operator_user_id?: string | null
          ticket_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "ticket_error_entries_ticket_id_fkey"
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
      topgamific_ai_messages: {
        Row: {
          attachment_ids: string[]
          content: string
          created_at: string
          id: string
          rated_at: string | null
          rating: number | null
          rating_comment: string | null
          remote_conversation_id: string | null
          remote_message_id: string | null
          role: string
          user_id: string
        }
        Insert: {
          attachment_ids?: string[]
          content: string
          created_at?: string
          id?: string
          rated_at?: string | null
          rating?: number | null
          rating_comment?: string | null
          remote_conversation_id?: string | null
          remote_message_id?: string | null
          role: string
          user_id: string
        }
        Update: {
          attachment_ids?: string[]
          content?: string
          created_at?: string
          id?: string
          rated_at?: string | null
          rating?: number | null
          rating_comment?: string | null
          remote_conversation_id?: string | null
          remote_message_id?: string | null
          role?: string
          user_id?: string
        }
        Relationships: []
      }
      topgamific_entry_acks: {
        Row: {
          acked_at: string
          entry_id: string
          id: string
          user_id: string
        }
        Insert: {
          acked_at?: string
          entry_id: string
          id?: string
          user_id: string
        }
        Update: {
          acked_at?: string
          entry_id?: string
          id?: string
          user_id?: string
        }
        Relationships: []
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
      user_presence_sessions: {
        Row: {
          ended_at: string | null
          id: string
          last_ping_at: string
          started_at: string
          user_id: string
        }
        Insert: {
          ended_at?: string | null
          id?: string
          last_ping_at?: string
          started_at?: string
          user_id: string
        }
        Update: {
          ended_at?: string | null
          id?: string
          last_ping_at?: string
          started_at?: string
          user_id?: string
        }
        Relationships: []
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
          inactivity_message_sent_at: string | null
          last_message_at: string | null
          last_message_from_me: boolean | null
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
          inactivity_message_sent_at?: string | null
          last_message_at?: string | null
          last_message_from_me?: boolean | null
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
          inactivity_message_sent_at?: string | null
          last_message_at?: string | null
          last_message_from_me?: boolean | null
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
          is_bot_message: boolean
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
          signed_as_name: string | null
          signed_as_user_id: string | null
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
          is_bot_message?: boolean
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
          signed_as_name?: string | null
          signed_as_user_id?: string | null
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
          is_bot_message?: boolean
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
          signed_as_name?: string | null
          signed_as_user_id?: string | null
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
      _gamif_fanout_notification: { Args: { _id: string }; Returns: number }
      _gamif_importing: { Args: never; Returns: boolean }
      _gamif_notify_user: {
        Args: { _body: string; _title: string; _user: string }
        Returns: undefined
      }
      _gamif_settle_duel: {
        Args: { _id: string; _winner: string }
        Returns: undefined
      }
      can_access_finance: { Args: never; Returns: boolean }
      chamado_eh_servico_tecnico: {
        Args: { _category: string; _tech_stage: string }
        Returns: boolean
      }
      contratos_allowed: { Args: never; Returns: boolean }
      crm_tab_allowed: { Args: { _tab: string }; Returns: boolean }
      delete_technical_term_type: { Args: { _id: string }; Returns: string }
      em_modo_teste: { Args: { _user?: string }; Returns: boolean }
      gamif_apply_auto_rules: { Args: { _day?: string }; Returns: number }
      gamif_cancel_duel: { Args: { _id: string }; Returns: undefined }
      gamif_decide_redemption: {
        Args: { _id: string; _notes?: string; _status: string }
        Returns: undefined
      }
      gamif_dispatch_scheduled_notifications: { Args: never; Returns: number }
      gamif_feed: {
        Args: { _limit?: number }
        Returns: {
          at: string
          coins: number
          kind: string
          title: string
          user_id: string
          user_name: string
        }[]
      }
      gamif_is_manager: { Args: never; Returns: boolean }
      gamif_link_legacy_user: {
        Args: { _legacy_id: string; _user_id: string }
        Returns: undefined
      }
      gamif_ranking: {
        Args: never
        Returns: {
          avatar_url: string
          coins: number
          name: string
          sector_id: string
          sector_name: string
          user_id: string
          xp: number
        }[]
      }
      gamif_redeem: { Args: { _item_id: string }; Returns: string }
      gamif_resolve_duel: {
        Args: { _id: string; _winner?: string }
        Returns: undefined
      }
      gamif_respond_duel: {
        Args: { _accept: boolean; _id: string }
        Returns: undefined
      }
      gamif_save_process: {
        Args: {
          _content: string
          _id: string
          _sector_id: string
          _summary: string
          _title: string
        }
        Returns: string
      }
      gamif_send_notification: { Args: { _id: string }; Returns: number }
      gamif_setting_on: { Args: { _key: string }; Returns: boolean }
      gamif_vote_duel: {
        Args: { _claim: string; _id: string; _note?: string }
        Returns: string
      }
      ge_client_feature_enabled: {
        Args: { _client_id: string; _feature_key: string }
        Returns: boolean
      }
      ge_get_user_client_id: { Args: { _user_id: string }; Returns: string }
      ge_get_user_group_id: { Args: { _user_id: string }; Returns: string }
      ge_has_role: {
        Args: {
          _role: Database["public"]["Enums"]["ge_app_role"]
          _user_id: string
        }
        Returns: boolean
      }
      ge_is_member: { Args: never; Returns: boolean }
      ge_is_platform_admin: { Args: { _user_id: string }; Returns: boolean }
      ge_registrar_equipe: { Args: never; Returns: undefined }
      ge_staff_allowed: { Args: never; Returns: boolean }
      ge_staff_allowed_for: { Args: { _uid: string }; Returns: boolean }
      ge_user_can_access_client: {
        Args: { _client_id: string; _user_id: string }
        Returns: boolean
      }
      ge_user_can_use_feature: {
        Args: { _client_id: string; _feature_key: string; _user_id: string }
        Returns: boolean
      }
      ge_user_can_view_fleet: {
        Args: { _fleet_id: string; _user_id: string }
        Returns: boolean
      }
      ge_user_is_fleet_restricted: {
        Args: { _user_id: string }
        Returns: boolean
      }
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
      is_active_staff: { Args: never; Returns: boolean }
      is_operator_chat_creator: {
        Args: { _chat_id: string; _user_id: string }
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
      limpar_dados_teste: { Args: never; Returns: Json }
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
      pick_least_loaded_ticket_agent: {
        Args: { _sector: string }
        Returns: string
      }
      presence_end_session: { Args: never; Returns: undefined }
      presence_heartbeat: { Args: never; Returns: undefined }
      reconnect_allowed: { Args: never; Returns: boolean }
      rh_allowed: { Args: never; Returns: boolean }
      salvar_observacao_contato: {
        Args: {
          _company_id: string
          _email: string
          _indice: number
          _nome: string
          _observacao: string
          _telefone: string
        }
        Returns: undefined
      }
      set_equipment_kit_item: {
        Args: { _accessory: string; _codigo: string; _qtd: number }
        Returns: undefined
      }
      setor_principal_do_usuario: { Args: { _user: string }; Returns: string }
      sidebar_counters: { Args: never; Returns: Json }
      sys_can_monitor: { Args: never; Returns: boolean }
      sys_cron_runs: { Args: never; Returns: Json }
      sys_db_health: { Args: never; Returns: Json }
      sys_slow_queries: { Args: never; Returns: Json }
      sys_table_sizes: { Args: never; Returns: Json }
      tech_term_no_response_scan: { Args: never; Returns: number }
      zapi_net_request: {
        Args: {
          _body: Json
          _headers: Json
          _method: string
          _timeout_ms?: number
          _url: string
        }
        Returns: number
      }
      zapi_net_result: { Args: { _id: number }; Returns: Json }
    }
    Enums: {
      app_role: "admin" | "gestor" | "atendente"
      flow_instance_status: "em_andamento" | "pausado" | "finalizado"
      ge_api_connection_status: "active" | "inactive" | "error" | "never_synced"
      ge_api_type: "movias" | "yuv"
      ge_app_role:
        | "admin_platform"
        | "admin_client"
        | "operator"
        | "admin_group"
      ge_event_status: "pending" | "in_treatment" | "treated" | "closed"
      ge_notification_trigger: "immediate" | "after_treatment" | "daily_summary"
      ge_notification_type: "email" | "whatsapp"
      ge_risk_level: "none" | "low" | "medium" | "high" | "critical"
      ge_treatment_status: "pending" | "in_progress" | "completed"
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
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never) = never,
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
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
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
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
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
  EnumName extends (DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never) = never,
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
  CompositeTypeName extends (PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never) = never,
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
      ge_api_connection_status: ["active", "inactive", "error", "never_synced"],
      ge_api_type: ["movias", "yuv"],
      ge_app_role: [
        "admin_platform",
        "admin_client",
        "operator",
        "admin_group",
      ],
      ge_event_status: ["pending", "in_treatment", "treated", "closed"],
      ge_notification_trigger: [
        "immediate",
        "after_treatment",
        "daily_summary",
      ],
      ge_notification_type: ["email", "whatsapp"],
      ge_risk_level: ["none", "low", "medium", "high", "critical"],
      ge_treatment_status: ["pending", "in_progress", "completed"],
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
