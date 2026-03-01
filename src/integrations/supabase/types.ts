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
        }
        Insert: {
          action_type: string
          created_at?: string
          id?: string
          item_key: string
          item_name: string
          period_key: string
          reason?: string | null
        }
        Update: {
          action_type?: string
          created_at?: string
          id?: string
          item_key?: string
          item_name?: string
          period_key?: string
          reason?: string | null
        }
        Relationships: []
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
        }
        Relationships: []
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
        }
        Relationships: []
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
        }
        Relationships: []
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
