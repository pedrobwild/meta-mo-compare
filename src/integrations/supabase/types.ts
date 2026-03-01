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
    PostgrestVersion: "14.1"
  }
  public: {
    Tables: {
      ad_accounts: {
        Row: {
          created_at: string
          currency: string | null
          external_account_id: string
          id: string
          name: string | null
          provider: string
          timezone: string | null
          workspace_id: string
        }
        Insert: {
          created_at?: string
          currency?: string | null
          external_account_id: string
          id?: string
          name?: string | null
          provider?: string
          timezone?: string | null
          workspace_id: string
        }
        Update: {
          created_at?: string
          currency?: string | null
          external_account_id?: string
          id?: string
          name?: string | null
          provider?: string
          timezone?: string | null
          workspace_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "ad_accounts_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      alert_events: {
        Row: {
          context_json: Json | null
          id: string
          resolved_at: string | null
          rule_id: string | null
          status: string
          triggered_at: string
          workspace_id: string
        }
        Insert: {
          context_json?: Json | null
          id?: string
          resolved_at?: string | null
          rule_id?: string | null
          status?: string
          triggered_at?: string
          workspace_id: string
        }
        Update: {
          context_json?: Json | null
          id?: string
          resolved_at?: string | null
          rule_id?: string | null
          status?: string
          triggered_at?: string
          workspace_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "alert_events_rule_id_fkey"
            columns: ["rule_id"]
            isOneToOne: false
            referencedRelation: "alert_rules"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "alert_events_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      alert_rules: {
        Row: {
          created_at: string
          enabled: boolean
          filters_json: Json | null
          id: string
          metric: string
          min_spend: number | null
          name: string
          notification_channels_json: Json | null
          operator: string
          scope: string
          severity: string
          threshold: number
          window_days: number
          workspace_id: string
        }
        Insert: {
          created_at?: string
          enabled?: boolean
          filters_json?: Json | null
          id?: string
          metric: string
          min_spend?: number | null
          name: string
          notification_channels_json?: Json | null
          operator?: string
          scope?: string
          severity?: string
          threshold: number
          window_days?: number
          workspace_id: string
        }
        Update: {
          created_at?: string
          enabled?: boolean
          filters_json?: Json | null
          id?: string
          metric?: string
          min_spend?: number | null
          name?: string
          notification_channels_json?: Json | null
          operator?: string
          scope?: string
          severity?: string
          threshold?: number
          window_days?: number
          workspace_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "alert_rules_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      annotations: {
        Row: {
          author_user_id: string | null
          created_at: string
          date: string | null
          entity_ref: string | null
          id: string
          note: string
          tags_json: Json | null
          workspace_id: string
        }
        Insert: {
          author_user_id?: string | null
          created_at?: string
          date?: string | null
          entity_ref?: string | null
          id?: string
          note: string
          tags_json?: Json | null
          workspace_id: string
        }
        Update: {
          author_user_id?: string | null
          created_at?: string
          date?: string | null
          entity_ref?: string | null
          id?: string
          note?: string
          tags_json?: Json | null
          workspace_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "annotations_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      audit_log: {
        Row: {
          action: string
          created_at: string
          id: string
          payload_json: Json | null
          user_id: string | null
          workspace_id: string
        }
        Insert: {
          action: string
          created_at?: string
          id?: string
          payload_json?: Json | null
          user_id?: string | null
          workspace_id: string
        }
        Update: {
          action?: string
          created_at?: string
          id?: string
          payload_json?: Json | null
          user_id?: string | null
          workspace_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "audit_log_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      connectors: {
        Row: {
          config_json: Json | null
          created_at: string
          id: string
          last_successful_sync: string | null
          provider: string
          status: string
          updated_at: string
          workspace_id: string
        }
        Insert: {
          config_json?: Json | null
          created_at?: string
          id?: string
          last_successful_sync?: string | null
          provider?: string
          status?: string
          updated_at?: string
          workspace_id: string
        }
        Update: {
          config_json?: Json | null
          created_at?: string
          id?: string
          last_successful_sync?: string | null
          provider?: string
          status?: string
          updated_at?: string
          workspace_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "connectors_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      decisions_log: {
        Row: {
          action_type: string
          created_at: string
          id: string
          item_key: string
          item_name: string
          period_key: string
          reason: string | null
          workspace_id: string | null
        }
        Insert: {
          action_type: string
          created_at?: string
          id?: string
          item_key: string
          item_name: string
          period_key: string
          reason?: string | null
          workspace_id?: string | null
        }
        Update: {
          action_type?: string
          created_at?: string
          id?: string
          item_key?: string
          item_name?: string
          period_key?: string
          reason?: string | null
          workspace_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "decisions_log_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      facts_funnel_daily: {
        Row: {
          created_at: string
          date: string
          id: string
          mql: number
          receita: number
          source: string | null
          sql_count: number
          vendas: number
          workspace_id: string
        }
        Insert: {
          created_at?: string
          date: string
          id?: string
          mql?: number
          receita?: number
          source?: string | null
          sql_count?: number
          vendas?: number
          workspace_id: string
        }
        Update: {
          created_at?: string
          date?: string
          id?: string
          mql?: number
          receita?: number
          source?: string | null
          sql_count?: number
          vendas?: number
          workspace_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "facts_funnel_daily_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      funnel_data: {
        Row: {
          created_at: string
          granularity: string
          id: string
          month_key: string
          mql: number
          period_key: string | null
          receita: number
          sql_count: number
          updated_at: string
          vendas: number
          workspace_id: string | null
        }
        Insert: {
          created_at?: string
          granularity?: string
          id?: string
          month_key: string
          mql?: number
          period_key?: string | null
          receita?: number
          sql_count?: number
          updated_at?: string
          vendas?: number
          workspace_id?: string | null
        }
        Update: {
          created_at?: string
          granularity?: string
          id?: string
          month_key?: string
          mql?: number
          period_key?: string | null
          receita?: number
          sql_count?: number
          updated_at?: string
          vendas?: number
          workspace_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "funnel_data_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      meta_ads: {
        Row: {
          ad_account_id: string
          ad_id: string
          adset_id: string
          campaign_id: string
          creative_id: string | null
          effective_status: string | null
          id: string
          name: string
          status: string | null
          updated_at: string
          workspace_id: string
        }
        Insert: {
          ad_account_id: string
          ad_id: string
          adset_id: string
          campaign_id: string
          creative_id?: string | null
          effective_status?: string | null
          id?: string
          name: string
          status?: string | null
          updated_at?: string
          workspace_id: string
        }
        Update: {
          ad_account_id?: string
          ad_id?: string
          adset_id?: string
          campaign_id?: string
          creative_id?: string | null
          effective_status?: string | null
          id?: string
          name?: string
          status?: string | null
          updated_at?: string
          workspace_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "meta_ads_ad_account_id_fkey"
            columns: ["ad_account_id"]
            isOneToOne: false
            referencedRelation: "ad_accounts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "meta_ads_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      meta_adsets: {
        Row: {
          ad_account_id: string
          adset_id: string
          billing_event: string | null
          campaign_id: string
          effective_status: string | null
          id: string
          name: string
          optimization_goal: string | null
          status: string | null
          updated_at: string
          workspace_id: string
        }
        Insert: {
          ad_account_id: string
          adset_id: string
          billing_event?: string | null
          campaign_id: string
          effective_status?: string | null
          id?: string
          name: string
          optimization_goal?: string | null
          status?: string | null
          updated_at?: string
          workspace_id: string
        }
        Update: {
          ad_account_id?: string
          adset_id?: string
          billing_event?: string | null
          campaign_id?: string
          effective_status?: string | null
          id?: string
          name?: string
          optimization_goal?: string | null
          status?: string | null
          updated_at?: string
          workspace_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "meta_adsets_ad_account_id_fkey"
            columns: ["ad_account_id"]
            isOneToOne: false
            referencedRelation: "ad_accounts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "meta_adsets_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      meta_campaigns: {
        Row: {
          ad_account_id: string
          campaign_id: string
          effective_status: string | null
          id: string
          name: string
          objective: string | null
          status: string | null
          updated_at: string
          workspace_id: string
        }
        Insert: {
          ad_account_id: string
          campaign_id: string
          effective_status?: string | null
          id?: string
          name: string
          objective?: string | null
          status?: string | null
          updated_at?: string
          workspace_id: string
        }
        Update: {
          ad_account_id?: string
          campaign_id?: string
          effective_status?: string | null
          id?: string
          name?: string
          objective?: string | null
          status?: string | null
          updated_at?: string
          workspace_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "meta_campaigns_ad_account_id_fkey"
            columns: ["ad_account_id"]
            isOneToOne: false
            referencedRelation: "ad_accounts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "meta_campaigns_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      meta_creatives: {
        Row: {
          ad_account_id: string
          asset_spec_json: Json | null
          creative_id: string
          id: string
          name: string | null
          thumbnail_url: string | null
          updated_at: string
          workspace_id: string
        }
        Insert: {
          ad_account_id: string
          asset_spec_json?: Json | null
          creative_id: string
          id?: string
          name?: string | null
          thumbnail_url?: string | null
          updated_at?: string
          workspace_id: string
        }
        Update: {
          ad_account_id?: string
          asset_spec_json?: Json | null
          creative_id?: string
          id?: string
          name?: string | null
          thumbnail_url?: string | null
          updated_at?: string
          workspace_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "meta_creatives_ad_account_id_fkey"
            columns: ["ad_account_id"]
            isOneToOne: false
            referencedRelation: "ad_accounts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "meta_creatives_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      meta_records: {
        Row: {
          ad_key: string
          ad_name: string
          adset_key: string | null
          adset_name: string | null
          campaign_key: string | null
          campaign_name: string | null
          clicks_all: number
          cost_per_lpv: number
          cost_per_result: number
          cpc_all: number
          cpc_link: number
          cpm: number
          created_at: string
          ctr_all: number
          ctr_link: number
          delivery_level: string | null
          delivery_status: string | null
          frequency: number
          granularity: string
          id: string
          impressions: number
          landing_page_views: number
          link_clicks: number
          month_key: string
          period_end: string | null
          period_key: string | null
          period_start: string | null
          reach: number
          report_end: string | null
          report_start: string | null
          result_type: string | null
          results: number
          source_type: string
          spend_brl: number
          unique_key: string
          workspace_id: string | null
        }
        Insert: {
          ad_key: string
          ad_name: string
          adset_key?: string | null
          adset_name?: string | null
          campaign_key?: string | null
          campaign_name?: string | null
          clicks_all?: number
          cost_per_lpv?: number
          cost_per_result?: number
          cpc_all?: number
          cpc_link?: number
          cpm?: number
          created_at?: string
          ctr_all?: number
          ctr_link?: number
          delivery_level?: string | null
          delivery_status?: string | null
          frequency?: number
          granularity?: string
          id?: string
          impressions?: number
          landing_page_views?: number
          link_clicks?: number
          month_key: string
          period_end?: string | null
          period_key?: string | null
          period_start?: string | null
          reach?: number
          report_end?: string | null
          report_start?: string | null
          result_type?: string | null
          results?: number
          source_type?: string
          spend_brl?: number
          unique_key: string
          workspace_id?: string | null
        }
        Update: {
          ad_key?: string
          ad_name?: string
          adset_key?: string | null
          adset_name?: string | null
          campaign_key?: string | null
          campaign_name?: string | null
          clicks_all?: number
          cost_per_lpv?: number
          cost_per_result?: number
          cpc_all?: number
          cpc_link?: number
          cpm?: number
          created_at?: string
          ctr_all?: number
          ctr_link?: number
          delivery_level?: string | null
          delivery_status?: string | null
          frequency?: number
          granularity?: string
          id?: string
          impressions?: number
          landing_page_views?: number
          link_clicks?: number
          month_key?: string
          period_end?: string | null
          period_key?: string | null
          period_start?: string | null
          reach?: number
          report_end?: string | null
          report_start?: string | null
          result_type?: string | null
          results?: number
          source_type?: string
          spend_brl?: number
          unique_key?: string
          workspace_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "meta_records_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      monthly_targets: {
        Row: {
          cost_per_lpv: number | null
          cost_per_result: number | null
          cpc_link: number | null
          cpm: number | null
          created_at: string
          ctr_link: number | null
          granularity: string
          id: string
          lpv: number | null
          month_key: string
          mql: number | null
          period_key: string | null
          receita: number | null
          results: number | null
          roas: number | null
          spend: number | null
          sql_target: number | null
          updated_at: string
          vendas: number | null
          workspace_id: string | null
        }
        Insert: {
          cost_per_lpv?: number | null
          cost_per_result?: number | null
          cpc_link?: number | null
          cpm?: number | null
          created_at?: string
          ctr_link?: number | null
          granularity?: string
          id?: string
          lpv?: number | null
          month_key: string
          mql?: number | null
          period_key?: string | null
          receita?: number | null
          results?: number | null
          roas?: number | null
          spend?: number | null
          sql_target?: number | null
          updated_at?: string
          vendas?: number | null
          workspace_id?: string | null
        }
        Update: {
          cost_per_lpv?: number | null
          cost_per_result?: number | null
          cpc_link?: number | null
          cpm?: number | null
          created_at?: string
          ctr_link?: number | null
          granularity?: string
          id?: string
          lpv?: number | null
          month_key?: string
          mql?: number | null
          period_key?: string | null
          receita?: number | null
          results?: number | null
          roas?: number | null
          spend?: number | null
          sql_target?: number | null
          updated_at?: string
          vendas?: number | null
          workspace_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "monthly_targets_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      recommendations: {
        Row: {
          confidence: number | null
          created_at: string
          entity_id: string | null
          entity_level: string | null
          evidence_json: Json | null
          expected_impact_json: Json | null
          id: string
          priority: number
          related_alert_event_id: string | null
          status: string
          title: string
          what_to_do: string | null
          why: string | null
          workspace_id: string
        }
        Insert: {
          confidence?: number | null
          created_at?: string
          entity_id?: string | null
          entity_level?: string | null
          evidence_json?: Json | null
          expected_impact_json?: Json | null
          id?: string
          priority?: number
          related_alert_event_id?: string | null
          status?: string
          title: string
          what_to_do?: string | null
          why?: string | null
          workspace_id: string
        }
        Update: {
          confidence?: number | null
          created_at?: string
          entity_id?: string | null
          entity_level?: string | null
          evidence_json?: Json | null
          expected_impact_json?: Json | null
          id?: string
          priority?: number
          related_alert_event_id?: string | null
          status?: string
          title?: string
          what_to_do?: string | null
          why?: string | null
          workspace_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "recommendations_related_alert_event_id_fkey"
            columns: ["related_alert_event_id"]
            isOneToOne: false
            referencedRelation: "alert_events"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "recommendations_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      sync_runs: {
        Row: {
          ad_account_id: string | null
          error: string | null
          finished_at: string | null
          id: string
          params_json: Json | null
          provider: string
          records_fetched: number | null
          records_upserted: number | null
          started_at: string
          status: string
          workspace_id: string
        }
        Insert: {
          ad_account_id?: string | null
          error?: string | null
          finished_at?: string | null
          id?: string
          params_json?: Json | null
          provider?: string
          records_fetched?: number | null
          records_upserted?: number | null
          started_at?: string
          status?: string
          workspace_id: string
        }
        Update: {
          ad_account_id?: string | null
          error?: string | null
          finished_at?: string | null
          id?: string
          params_json?: Json | null
          provider?: string
          records_fetched?: number | null
          records_upserted?: number | null
          started_at?: string
          status?: string
          workspace_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "sync_runs_ad_account_id_fkey"
            columns: ["ad_account_id"]
            isOneToOne: false
            referencedRelation: "ad_accounts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sync_runs_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      targets_monthly: {
        Row: {
          cpa_target: number | null
          cpm_target: number | null
          created_at: string
          ctr_target: number | null
          id: string
          leads: number | null
          month_key: string
          receita: number | null
          roas_target: number | null
          spend: number | null
          updated_at: string
          workspace_id: string
        }
        Insert: {
          cpa_target?: number | null
          cpm_target?: number | null
          created_at?: string
          ctr_target?: number | null
          id?: string
          leads?: number | null
          month_key: string
          receita?: number | null
          roas_target?: number | null
          spend?: number | null
          updated_at?: string
          workspace_id: string
        }
        Update: {
          cpa_target?: number | null
          cpm_target?: number | null
          created_at?: string
          ctr_target?: number | null
          id?: string
          leads?: number | null
          month_key?: string
          receita?: number | null
          roas_target?: number | null
          spend?: number | null
          updated_at?: string
          workspace_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "targets_monthly_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      workspace_memberships: {
        Row: {
          created_at: string
          id: string
          role: Database["public"]["Enums"]["workspace_role"]
          user_id: string
          workspace_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          role?: Database["public"]["Enums"]["workspace_role"]
          user_id: string
          workspace_id: string
        }
        Update: {
          created_at?: string
          id?: string
          role?: Database["public"]["Enums"]["workspace_role"]
          user_id?: string
          workspace_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "workspace_memberships_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      workspaces: {
        Row: {
          created_at: string
          id: string
          name: string
          owner_user_id: string | null
        }
        Insert: {
          created_at?: string
          id?: string
          name: string
          owner_user_id?: string | null
        }
        Update: {
          created_at?: string
          id?: string
          name?: string
          owner_user_id?: string | null
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      get_user_workspace_ids: { Args: { _user_id: string }; Returns: string[] }
      is_workspace_member: {
        Args: { _user_id: string; _workspace_id: string }
        Returns: boolean
      }
    }
    Enums: {
      workspace_role: "owner" | "admin" | "analyst" | "viewer"
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
      workspace_role: ["owner", "admin", "analyst", "viewer"],
    },
  },
} as const
