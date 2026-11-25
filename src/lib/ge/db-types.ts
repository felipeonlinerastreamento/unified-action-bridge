// Tipos das tabelas ge_ (Gestão de eventos), derivados do projeto antigo com o prefixo ge_.
// Mantidos à parte até o Lovable regenerar os tipos do banco com a migração aplicada.
export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type GeDatabase = {
  // Allows to automatically instantiate createClient with right options
  // instead of createClient<GeDatabase, { PostgrestVersion: 'XX' }>(URL, KEY)
  __InternalSupabase: {
    PostgrestVersion: "14.5"
  }
  public: {
    Tables: {
      ge_api_configurations: {
        Row: {
          api_key_encrypted: string | null
          api_type: GeDatabase["public"]["Enums"]["ge_api_type"]
          auto_sync_enabled: boolean
          base_url: string
          bearer_token_encrypted: string | null
          client_id: string | null
          connection_status: GeDatabase["public"]["Enums"]["ge_api_connection_status"]
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
          api_type: GeDatabase["public"]["Enums"]["ge_api_type"]
          auto_sync_enabled?: boolean
          base_url: string
          bearer_token_encrypted?: string | null
          client_id?: string | null
          connection_status?: GeDatabase["public"]["Enums"]["ge_api_connection_status"]
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
          api_type?: GeDatabase["public"]["Enums"]["ge_api_type"]
          auto_sync_enabled?: boolean
          base_url?: string
          bearer_token_encrypted?: string | null
          client_id?: string | null
          connection_status?: GeDatabase["public"]["Enums"]["ge_api_connection_status"]
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
            foreignKeyName: "api_configurations_client_id_fkey"
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
            foreignKeyName: "audit_logs_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "ge_clients"
            referencedColumns: ["id"]
          },
        ]
      }
      ge_client_event_type_settings: {
        Row: {
          api_source: GeDatabase["public"]["Enums"]["ge_api_type"]
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
          api_source: GeDatabase["public"]["Enums"]["ge_api_type"]
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
          api_source?: GeDatabase["public"]["Enums"]["ge_api_type"]
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
          api_type: GeDatabase["public"]["Enums"]["ge_api_type"]
          client_id: string
          created_at: string
          external_account_id: string
          id: string
          updated_at: string
        }
        Insert: {
          api_type: GeDatabase["public"]["Enums"]["ge_api_type"]
          client_id: string
          created_at?: string
          external_account_id: string
          id?: string
          updated_at?: string
        }
        Update: {
          api_type?: GeDatabase["public"]["Enums"]["ge_api_type"]
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
            foreignKeyName: "client_features_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "ge_clients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "client_features_feature_key_fkey"
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
          created_at: string
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
          created_at?: string
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
          created_at?: string
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
            foreignKeyName: "clients_group_id_fkey"
            columns: ["group_id"]
            isOneToOne: false
            referencedRelation: "ge_client_groups"
            referencedColumns: ["id"]
          },
        ]
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
            foreignKeyName: "event_analyses_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "ge_clients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "event_analyses_event_id_fkey"
            columns: ["event_id"]
            isOneToOne: false
            referencedRelation: "ge_events"
            referencedColumns: ["id"]
          },
        ]
      }
      ge_events: {
        Row: {
          api_source: GeDatabase["public"]["Enums"]["ge_api_type"]
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
          risk_level: GeDatabase["public"]["Enums"]["ge_risk_level"]
          status: GeDatabase["public"]["Enums"]["ge_event_status"]
          updated_at: string
          vehicle_id: string | null
        }
        Insert: {
          api_source: GeDatabase["public"]["Enums"]["ge_api_type"]
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
          risk_level?: GeDatabase["public"]["Enums"]["ge_risk_level"]
          status?: GeDatabase["public"]["Enums"]["ge_event_status"]
          updated_at?: string
          vehicle_id?: string | null
        }
        Update: {
          api_source?: GeDatabase["public"]["Enums"]["ge_api_type"]
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
          risk_level?: GeDatabase["public"]["Enums"]["ge_risk_level"]
          status?: GeDatabase["public"]["Enums"]["ge_event_status"]
          updated_at?: string
          vehicle_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "events_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "ge_clients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "events_driver_ref_id_fkey"
            columns: ["driver_ref_id"]
            isOneToOne: false
            referencedRelation: "ge_drivers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "events_fleet_id_fkey"
            columns: ["fleet_id"]
            isOneToOne: false
            referencedRelation: "ge_fleets"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "events_vehicle_id_fkey"
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
            foreignKeyName: "feature_catalog_parent_key_fkey"
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
            foreignKeyName: "fleet_responsibles_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "ge_clients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "fleet_responsibles_fleet_id_fkey"
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
            foreignKeyName: "fleets_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "ge_clients"
            referencedColumns: ["id"]
          },
        ]
      }
      ge_notification_configurations: {
        Row: {
          client_id: string
          created_at: string
          id: string
          is_active: boolean
          min_risk_level: GeDatabase["public"]["Enums"]["ge_risk_level"]
          notification_type: GeDatabase["public"]["Enums"]["ge_notification_type"]
          recipient_emails: Json
          recipient_phones: Json
          trigger_time: string | null
          trigger_type: GeDatabase["public"]["Enums"]["ge_notification_trigger"]
          updated_at: string
        }
        Insert: {
          client_id: string
          created_at?: string
          id?: string
          is_active?: boolean
          min_risk_level?: GeDatabase["public"]["Enums"]["ge_risk_level"]
          notification_type: GeDatabase["public"]["Enums"]["ge_notification_type"]
          recipient_emails?: Json
          recipient_phones?: Json
          trigger_time?: string | null
          trigger_type: GeDatabase["public"]["Enums"]["ge_notification_trigger"]
          updated_at?: string
        }
        Update: {
          client_id?: string
          created_at?: string
          id?: string
          is_active?: boolean
          min_risk_level?: GeDatabase["public"]["Enums"]["ge_risk_level"]
          notification_type?: GeDatabase["public"]["Enums"]["ge_notification_type"]
          recipient_emails?: Json
          recipient_phones?: Json
          trigger_time?: string | null
          trigger_type?: GeDatabase["public"]["Enums"]["ge_notification_trigger"]
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "notification_configurations_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "ge_clients"
            referencedColumns: ["id"]
          },
        ]
      }
      ge_notification_logs: {
        Row: {
          channel: GeDatabase["public"]["Enums"]["ge_notification_type"]
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
          channel: GeDatabase["public"]["Enums"]["ge_notification_type"]
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
          channel?: GeDatabase["public"]["Enums"]["ge_notification_type"]
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
            foreignKeyName: "notification_logs_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "ge_clients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "notification_logs_event_id_fkey"
            columns: ["event_id"]
            isOneToOne: false
            referencedRelation: "ge_events"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "notification_logs_notification_config_id_fkey"
            columns: ["notification_config_id"]
            isOneToOne: false
            referencedRelation: "ge_notification_configurations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "notification_logs_treatment_id_fkey"
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
            foreignKeyName: "profiles_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "ge_clients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "profiles_group_id_fkey"
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
          risk_level: GeDatabase["public"]["Enums"]["ge_risk_level"] | null
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
          risk_level?: GeDatabase["public"]["Enums"]["ge_risk_level"] | null
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
          risk_level?: GeDatabase["public"]["Enums"]["ge_risk_level"] | null
          rule_type?: string | null
          threshold_high?: number | null
          threshold_low?: number | null
          threshold_medium?: number | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "risk_configurations_client_id_fkey"
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
            foreignKeyName: "treatment_history_treatment_id_fkey"
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
          treatment_status: GeDatabase["public"]["Enums"]["ge_treatment_status"]
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
          treatment_status?: GeDatabase["public"]["Enums"]["ge_treatment_status"]
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
          treatment_status?: GeDatabase["public"]["Enums"]["ge_treatment_status"]
          updated_at?: string
          vehicle_id?: string | null
          vehicle_identifier?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "treatments_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "ge_clients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "treatments_event_id_fkey"
            columns: ["event_id"]
            isOneToOne: false
            referencedRelation: "ge_events"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "treatments_fleet_id_fkey"
            columns: ["fleet_id"]
            isOneToOne: false
            referencedRelation: "ge_fleets"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "treatments_vehicle_id_fkey"
            columns: ["vehicle_id"]
            isOneToOne: false
            referencedRelation: "ge_vehicles"
            referencedColumns: ["id"]
          },
        ]
      }
      ge_unmatched_event_type_settings: {
        Row: {
          api_source: GeDatabase["public"]["Enums"]["ge_api_type"]
          created_at: string
          event_type: string
          first_seen_at: string
          is_enabled: boolean
          last_seen_at: string
          occurrences: number
          updated_at: string
        }
        Insert: {
          api_source: GeDatabase["public"]["Enums"]["ge_api_type"]
          created_at?: string
          event_type: string
          first_seen_at?: string
          is_enabled?: boolean
          last_seen_at?: string
          occurrences?: number
          updated_at?: string
        }
        Update: {
          api_source?: GeDatabase["public"]["Enums"]["ge_api_type"]
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
          api_source: GeDatabase["public"]["Enums"]["ge_api_type"]
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
          api_source: GeDatabase["public"]["Enums"]["ge_api_type"]
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
          api_source?: GeDatabase["public"]["Enums"]["ge_api_type"]
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
          role: GeDatabase["public"]["Enums"]["ge_app_role"]
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          role: GeDatabase["public"]["Enums"]["ge_app_role"]
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          role?: GeDatabase["public"]["Enums"]["ge_app_role"]
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
            foreignKeyName: "vehicle_equipments_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "ge_clients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "vehicle_equipments_vehicle_id_fkey"
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
            foreignKeyName: "vehicle_fleet_transfers_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "ge_clients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "vehicle_fleet_transfers_from_fleet_id_fkey"
            columns: ["from_fleet_id"]
            isOneToOne: false
            referencedRelation: "ge_fleets"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "vehicle_fleet_transfers_to_fleet_id_fkey"
            columns: ["to_fleet_id"]
            isOneToOne: false
            referencedRelation: "ge_fleets"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "vehicle_fleet_transfers_vehicle_id_fkey"
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
            foreignKeyName: "vehicles_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "ge_clients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "vehicles_fleet_id_fkey"
            columns: ["fleet_id"]
            isOneToOne: false
            referencedRelation: "ge_fleets"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      ge_client_feature_enabled: {
        Args: { _client_id: string; _feature_key: string }
        Returns: boolean
      }
      ge_get_user_client_id: { Args: { _user_id: string }; Returns: string }
      ge_get_user_group_id: { Args: { _user_id: string }; Returns: string }
      ge_has_role: {
        Args: {
          _role: GeDatabase["public"]["Enums"]["ge_app_role"]
          _user_id: string
        }
        Returns: boolean
      }
      ge_is_platform_admin: { Args: { _user_id: string }; Returns: boolean }
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
      ge_user_is_fleet_restricted: { Args: { _user_id: string }; Returns: boolean }
    }
    Enums: {
      ge_api_connection_status: "active" | "inactive" | "error" | "never_synced"
      ge_api_type: "movias" | "yuv"
      ge_app_role: "admin_platform" | "admin_client" | "operator" | "admin_group"
      ge_event_status: "pending" | "in_treatment" | "treated" | "closed"
      ge_notification_trigger: "immediate" | "after_treatment" | "daily_summary"
      ge_notification_type: "email" | "whatsapp"
      ge_risk_level: "none" | "low" | "medium" | "high" | "critical"
      ge_treatment_status: "pending" | "in_progress" | "completed"
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}

type DatabaseWithoutInternals = Omit<GeDatabase, "__InternalSupabase">

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof GeDatabase, "public">]

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
      ge_api_connection_status: ["active", "inactive", "error", "never_synced"],
      ge_api_type: ["movias", "yuv"],
      ge_app_role: ["admin_platform", "admin_client", "operator", "admin_group"],
      ge_event_status: ["pending", "in_treatment", "treated", "closed"],
      ge_notification_trigger: ["immediate", "after_treatment", "daily_summary"],
      ge_notification_type: ["email", "whatsapp"],
      ge_risk_level: ["none", "low", "medium", "high", "critical"],
      ge_treatment_status: ["pending", "in_progress", "completed"],
    },
  },
} as const
