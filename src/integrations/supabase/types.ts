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
      ad_creatives: {
        Row: {
          ad_id: string
          ad_name: string
          adset_id: string | null
          angle: string | null
          campaign_id: string | null
          created_at: string | null
          creative_type: string | null
          cta: string | null
          first_seen_at: string | null
          hook: string | null
          id: string
          lifecycle_stage: string | null
          lifecycle_updated_at: string | null
          status: string | null
          thumbnail_url: string | null
          workspace_id: string
        }
        Insert: {
          ad_id: string
          ad_name: string
          adset_id?: string | null
          angle?: string | null
          campaign_id?: string | null
          created_at?: string | null
          creative_type?: string | null
          cta?: string | null
          first_seen_at?: string | null
          hook?: string | null
          id?: string
          lifecycle_stage?: string | null
          lifecycle_updated_at?: string | null
          status?: string | null
          thumbnail_url?: string | null
          workspace_id: string
        }
        Update: {
          ad_id?: string
          ad_name?: string
          adset_id?: string | null
          angle?: string | null
          campaign_id?: string | null
          created_at?: string | null
          creative_type?: string | null
          cta?: string | null
          first_seen_at?: string | null
          hook?: string | null
          id?: string
          lifecycle_stage?: string | null
          lifecycle_updated_at?: string | null
          status?: string | null
          thumbnail_url?: string | null
          workspace_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "ad_creatives_workspace_id_fkey"
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
      anomaly_events: {
        Row: {
          detected_at: string
          deviation_pct: number
          entity_id: string
          entity_name: string | null
          entity_type: string
          id: string
          metric: string
          resolved_at: string | null
          severity: string
          status: string
          value_current: number
          value_expected: number
          workspace_id: string
        }
        Insert: {
          detected_at?: string
          deviation_pct?: number
          entity_id?: string
          entity_name?: string | null
          entity_type?: string
          id?: string
          metric: string
          resolved_at?: string | null
          severity?: string
          status?: string
          value_current?: number
          value_expected?: number
          workspace_id: string
        }
        Update: {
          detected_at?: string
          deviation_pct?: number
          entity_id?: string
          entity_name?: string | null
          entity_type?: string
          id?: string
          metric?: string
          resolved_at?: string | null
          severity?: string
          status?: string
          value_current?: number
          value_expected?: number
          workspace_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "anomaly_events_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      audience_demographics: {
        Row: {
          age_range: string
          campaign_id: string
          city: string
          clicks: number
          conversions: number
          country: string
          created_at: string
          date: string
          gender: string
          id: string
          impressions: number
          leads: number
          mql: number
          region: string
          revenue: number
          source: string
          spend: number
          sql_count: number
          workspace_id: string
        }
        Insert: {
          age_range?: string
          campaign_id?: string
          city?: string
          clicks?: number
          conversions?: number
          country?: string
          created_at?: string
          date: string
          gender?: string
          id?: string
          impressions?: number
          leads?: number
          mql?: number
          region?: string
          revenue?: number
          source?: string
          spend?: number
          sql_count?: number
          workspace_id: string
        }
        Update: {
          age_range?: string
          campaign_id?: string
          city?: string
          clicks?: number
          conversions?: number
          country?: string
          created_at?: string
          date?: string
          gender?: string
          id?: string
          impressions?: number
          leads?: number
          mql?: number
          region?: string
          revenue?: number
          source?: string
          spend?: number
          sql_count?: number
          workspace_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "audience_demographics_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      audience_device_data: {
        Row: {
          clicks: number
          cpl: number
          created_at: string
          ctr: number
          date: string
          device_type: string
          id: string
          impressions: number
          leads: number
          placement: string
          platform: string
          workspace_id: string
        }
        Insert: {
          clicks?: number
          cpl?: number
          created_at?: string
          ctr?: number
          date: string
          device_type?: string
          id?: string
          impressions?: number
          leads?: number
          placement?: string
          platform?: string
          workspace_id: string
        }
        Update: {
          clicks?: number
          cpl?: number
          created_at?: string
          ctr?: number
          date?: string
          device_type?: string
          id?: string
          impressions?: number
          leads?: number
          placement?: string
          platform?: string
          workspace_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "audience_device_data_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      audience_interests: {
        Row: {
          cpl: number
          created_at: string
          ctr: number
          date: string
          id: string
          interest_category: string
          interest_name: string
          mql_rate: number
          reach: number
          workspace_id: string
        }
        Insert: {
          cpl?: number
          created_at?: string
          ctr?: number
          date: string
          id?: string
          interest_category?: string
          interest_name?: string
          mql_rate?: number
          reach?: number
          workspace_id: string
        }
        Update: {
          cpl?: number
          created_at?: string
          ctr?: number
          date?: string
          id?: string
          interest_category?: string
          interest_name?: string
          mql_rate?: number
          reach?: number
          workspace_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "audience_interests_workspace_id_fkey"
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
      benchmarks: {
        Row: {
          id: string
          metric: string
          platform: string
          segment: string
          source: string | null
          unit: string
          updated_at: string
          value_high: number
          value_low: number
          value_mid: number
        }
        Insert: {
          id?: string
          metric?: string
          platform?: string
          segment?: string
          source?: string | null
          unit?: string
          updated_at?: string
          value_high?: number
          value_low?: number
          value_mid?: number
        }
        Update: {
          id?: string
          metric?: string
          platform?: string
          segment?: string
          source?: string | null
          unit?: string
          updated_at?: string
          value_high?: number
          value_low?: number
          value_mid?: number
        }
        Relationships: []
      }
      budget_simulations: {
        Row: {
          analise_claude_json: Json | null
          budget_atual: number
          budget_simulado: number
          cenario_recomendado: string | null
          cenarios_json: Json
          created_at: string
          id: string
          metricas_historicas_json: Json | null
          objetivo: string
          periodo_dias: number
          resultado_real_json: Json | null
          user_id: string | null
          valor_objetivo: number | null
          workspace_id: string
        }
        Insert: {
          analise_claude_json?: Json | null
          budget_atual?: number
          budget_simulado?: number
          cenario_recomendado?: string | null
          cenarios_json?: Json
          created_at?: string
          id?: string
          metricas_historicas_json?: Json | null
          objetivo?: string
          periodo_dias?: number
          resultado_real_json?: Json | null
          user_id?: string | null
          valor_objetivo?: number | null
          workspace_id: string
        }
        Update: {
          analise_claude_json?: Json | null
          budget_atual?: number
          budget_simulado?: number
          cenario_recomendado?: string | null
          cenarios_json?: Json
          created_at?: string
          id?: string
          metricas_historicas_json?: Json | null
          objetivo?: string
          periodo_dias?: number
          resultado_real_json?: Json | null
          user_id?: string | null
          valor_objetivo?: number | null
          workspace_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "budget_simulations_workspace_id_fkey"
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
      creative_daily_metrics: {
        Row: {
          ad_id: string
          clicks: number | null
          cpc: number | null
          cpl: number | null
          cpm: number | null
          created_at: string | null
          ctr: number | null
          date: string
          frequency: number | null
          id: string
          impressions: number | null
          leads: number | null
          reach: number | null
          spend: number | null
          workspace_id: string
        }
        Insert: {
          ad_id: string
          clicks?: number | null
          cpc?: number | null
          cpl?: number | null
          cpm?: number | null
          created_at?: string | null
          ctr?: number | null
          date: string
          frequency?: number | null
          id?: string
          impressions?: number | null
          leads?: number | null
          reach?: number | null
          spend?: number | null
          workspace_id: string
        }
        Update: {
          ad_id?: string
          clicks?: number | null
          cpc?: number | null
          cpl?: number | null
          cpm?: number | null
          created_at?: string | null
          ctr?: number | null
          date?: string
          frequency?: number | null
          id?: string
          impressions?: number | null
          leads?: number | null
          reach?: number | null
          spend?: number | null
          workspace_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "creative_daily_metrics_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      creative_lifecycle: {
        Row: {
          activated_at: string | null
          ad_key: string
          ad_name: string
          adset_key: string | null
          campaign_key: string | null
          created_at: string | null
          current_ctr: number | null
          days_active: number | null
          degradation_pct: number | null
          format: string | null
          hook_type: string | null
          id: string
          peak_ctr: number | null
          peak_ctr_date: string | null
          status: string | null
          updated_at: string | null
          workspace_id: string
        }
        Insert: {
          activated_at?: string | null
          ad_key: string
          ad_name: string
          adset_key?: string | null
          campaign_key?: string | null
          created_at?: string | null
          current_ctr?: number | null
          days_active?: number | null
          degradation_pct?: number | null
          format?: string | null
          hook_type?: string | null
          id?: string
          peak_ctr?: number | null
          peak_ctr_date?: string | null
          status?: string | null
          updated_at?: string | null
          workspace_id: string
        }
        Update: {
          activated_at?: string | null
          ad_key?: string
          ad_name?: string
          adset_key?: string | null
          campaign_key?: string | null
          created_at?: string | null
          current_ctr?: number | null
          days_active?: number | null
          degradation_pct?: number | null
          format?: string | null
          hook_type?: string | null
          id?: string
          peak_ctr?: number | null
          peak_ctr_date?: string | null
          status?: string | null
          updated_at?: string | null
          workspace_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "creative_lifecycle_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      data_gaps: {
        Row: {
          affected_records: number
          campaign_id: string | null
          campaign_name: string | null
          date_from: string | null
          date_to: string | null
          detected_at: string
          gap_type: string
          id: string
          notes: string | null
          severity: string
          status: string
          workspace_id: string
        }
        Insert: {
          affected_records?: number
          campaign_id?: string | null
          campaign_name?: string | null
          date_from?: string | null
          date_to?: string | null
          detected_at?: string
          gap_type?: string
          id?: string
          notes?: string | null
          severity?: string
          status?: string
          workspace_id: string
        }
        Update: {
          affected_records?: number
          campaign_id?: string | null
          campaign_name?: string | null
          date_from?: string | null
          date_to?: string | null
          detected_at?: string
          gap_type?: string
          id?: string
          notes?: string | null
          severity?: string
          status?: string
          workspace_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "data_gaps_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      data_health_checks: {
        Row: {
          auto_resolved: boolean
          check_type: string
          checked_at: string
          entity: string
          id: string
          issue_description: string
          recommendation: string
          resolved_at: string | null
          status: string
          workspace_id: string
        }
        Insert: {
          auto_resolved?: boolean
          check_type?: string
          checked_at?: string
          entity?: string
          id?: string
          issue_description?: string
          recommendation?: string
          resolved_at?: string | null
          status?: string
          workspace_id: string
        }
        Update: {
          auto_resolved?: boolean
          check_type?: string
          checked_at?: string
          entity?: string
          id?: string
          issue_description?: string
          recommendation?: string
          resolved_at?: string | null
          status?: string
          workspace_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "data_health_checks_workspace_id_fkey"
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
          expected_result: string | null
          id: string
          item_key: string
          item_name: string
          notes: string | null
          period_key: string
          reason: string | null
          user_id: string | null
          workspace_id: string | null
        }
        Insert: {
          action_type: string
          created_at?: string
          expected_result?: string | null
          id?: string
          item_key: string
          item_name: string
          notes?: string | null
          period_key: string
          reason?: string | null
          user_id?: string | null
          workspace_id?: string | null
        }
        Update: {
          action_type?: string
          created_at?: string
          expected_result?: string | null
          id?: string
          item_key?: string
          item_name?: string
          notes?: string | null
          period_key?: string
          reason?: string | null
          user_id?: string | null
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
      experiments: {
        Row: {
          campaign_id: string | null
          control_ad_id: string | null
          control_description: string
          created_at: string
          created_by: string | null
          decision: string | null
          delta_pct: number | null
          ended_at: string | null
          hypothesis: string
          id: string
          learning: string | null
          min_sample_spend: number
          name: string
          platform: string
          primary_metric: string
          result_control: Json | null
          result_variation: Json | null
          secondary_metrics: string[] | null
          started_at: string | null
          status: string
          success_threshold: number
          variable_tested: string
          variation_ad_id: string | null
          variation_description: string
          winner: string | null
          workspace_id: string
        }
        Insert: {
          campaign_id?: string | null
          control_ad_id?: string | null
          control_description?: string
          created_at?: string
          created_by?: string | null
          decision?: string | null
          delta_pct?: number | null
          ended_at?: string | null
          hypothesis?: string
          id?: string
          learning?: string | null
          min_sample_spend?: number
          name?: string
          platform?: string
          primary_metric?: string
          result_control?: Json | null
          result_variation?: Json | null
          secondary_metrics?: string[] | null
          started_at?: string | null
          status?: string
          success_threshold?: number
          variable_tested?: string
          variation_ad_id?: string | null
          variation_description?: string
          winner?: string | null
          workspace_id: string
        }
        Update: {
          campaign_id?: string | null
          control_ad_id?: string | null
          control_description?: string
          created_at?: string
          created_by?: string | null
          decision?: string | null
          delta_pct?: number | null
          ended_at?: string | null
          hypothesis?: string
          id?: string
          learning?: string | null
          min_sample_spend?: number
          name?: string
          platform?: string
          primary_metric?: string
          result_control?: Json | null
          result_variation?: Json | null
          secondary_metrics?: string[] | null
          started_at?: string | null
          status?: string
          success_threshold?: number
          variable_tested?: string
          variation_ad_id?: string | null
          variation_description?: string
          winner?: string | null
          workspace_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "experiments_workspace_id_fkey"
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
      facts_meta_insights_daily: {
        Row: {
          actions_json: Json | null
          ad_account_id: string
          ad_id: string
          add_to_cart: number
          adset_id: string
          age: string
          attribution_setting: string
          campaign_id: string
          clicks: number
          country: string
          cpa_lead: number | null
          cpc_link: number | null
          cpm: number | null
          created_at: string
          creative_id: string | null
          ctr_link: number | null
          date: string
          device_platform: string
          frequency: number | null
          gender: string
          id: string
          impressions: number
          initiate_checkout: number
          inline_link_clicks: number
          landing_page_views: number
          level: string
          placement: string
          publisher_platform: string
          purchase_value: number
          purchases: number
          reach: number
          results_leads: number
          roas: number | null
          spend: number
          workspace_id: string
        }
        Insert: {
          actions_json?: Json | null
          ad_account_id: string
          ad_id?: string
          add_to_cart?: number
          adset_id?: string
          age?: string
          attribution_setting?: string
          campaign_id?: string
          clicks?: number
          country?: string
          cpa_lead?: number | null
          cpc_link?: number | null
          cpm?: number | null
          created_at?: string
          creative_id?: string | null
          ctr_link?: number | null
          date: string
          device_platform?: string
          frequency?: number | null
          gender?: string
          id?: string
          impressions?: number
          initiate_checkout?: number
          inline_link_clicks?: number
          landing_page_views?: number
          level?: string
          placement?: string
          publisher_platform?: string
          purchase_value?: number
          purchases?: number
          reach?: number
          results_leads?: number
          roas?: number | null
          spend?: number
          workspace_id: string
        }
        Update: {
          actions_json?: Json | null
          ad_account_id?: string
          ad_id?: string
          add_to_cart?: number
          adset_id?: string
          age?: string
          attribution_setting?: string
          campaign_id?: string
          clicks?: number
          country?: string
          cpa_lead?: number | null
          cpc_link?: number | null
          cpm?: number | null
          created_at?: string
          creative_id?: string | null
          ctr_link?: number | null
          date?: string
          device_platform?: string
          frequency?: number | null
          gender?: string
          id?: string
          impressions?: number
          initiate_checkout?: number
          inline_link_clicks?: number
          landing_page_views?: number
          level?: string
          placement?: string
          publisher_platform?: string
          purchase_value?: number
          purchases?: number
          reach?: number
          results_leads?: number
          roas?: number | null
          spend?: number
          workspace_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "facts_meta_insights_daily_ad_account_id_fkey"
            columns: ["ad_account_id"]
            isOneToOne: false
            referencedRelation: "ad_accounts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "facts_meta_insights_daily_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      funnel_daily_snapshot: {
        Row: {
          avg_time_to_contact_minutes: number | null
          campaign_id: string | null
          close_rate_pct: number | null
          closed_lost: number | null
          closed_won: number | null
          contact_rate_pct: number | null
          contacted: number | null
          cost_per_mql: number | null
          cost_per_sql: number | null
          created_at: string | null
          date: string
          id: string
          mql_count: number | null
          mql_rate_pct: number | null
          roas_real: number | null
          scheduled: number | null
          source: string | null
          sql_count: number | null
          sql_rate_pct: number | null
          total_leads: number | null
          total_revenue: number | null
          workspace_id: string
        }
        Insert: {
          avg_time_to_contact_minutes?: number | null
          campaign_id?: string | null
          close_rate_pct?: number | null
          closed_lost?: number | null
          closed_won?: number | null
          contact_rate_pct?: number | null
          contacted?: number | null
          cost_per_mql?: number | null
          cost_per_sql?: number | null
          created_at?: string | null
          date: string
          id?: string
          mql_count?: number | null
          mql_rate_pct?: number | null
          roas_real?: number | null
          scheduled?: number | null
          source?: string | null
          sql_count?: number | null
          sql_rate_pct?: number | null
          total_leads?: number | null
          total_revenue?: number | null
          workspace_id: string
        }
        Update: {
          avg_time_to_contact_minutes?: number | null
          campaign_id?: string | null
          close_rate_pct?: number | null
          closed_lost?: number | null
          closed_won?: number | null
          contact_rate_pct?: number | null
          contacted?: number | null
          cost_per_mql?: number | null
          cost_per_sql?: number | null
          created_at?: string | null
          date?: string
          id?: string
          mql_count?: number | null
          mql_rate_pct?: number | null
          roas_real?: number | null
          scheduled?: number | null
          source?: string | null
          sql_count?: number | null
          sql_rate_pct?: number | null
          total_leads?: number | null
          total_revenue?: number | null
          workspace_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "funnel_daily_snapshot_workspace_id_fkey"
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
      funnel_leads: {
        Row: {
          ad_id: string | null
          adset_id: string | null
          campaign_id: string | null
          contact_attempts: number | null
          created_at: string | null
          deal_value: number | null
          email: string | null
          first_contact_at: string | null
          id: string
          is_mql: boolean | null
          is_sql: boolean | null
          is_valid_contact: boolean | null
          lead_id: string
          lost_reason: string | null
          name: string | null
          phone: string | null
          qualification_notes: string | null
          source: string | null
          stage: string | null
          stage_updated_at: string | null
          time_to_first_contact_minutes: number | null
          utm_campaign: string | null
          utm_content: string | null
          utm_medium: string | null
          utm_source: string | null
          utm_term: string | null
          workspace_id: string
        }
        Insert: {
          ad_id?: string | null
          adset_id?: string | null
          campaign_id?: string | null
          contact_attempts?: number | null
          created_at?: string | null
          deal_value?: number | null
          email?: string | null
          first_contact_at?: string | null
          id?: string
          is_mql?: boolean | null
          is_sql?: boolean | null
          is_valid_contact?: boolean | null
          lead_id: string
          lost_reason?: string | null
          name?: string | null
          phone?: string | null
          qualification_notes?: string | null
          source?: string | null
          stage?: string | null
          stage_updated_at?: string | null
          time_to_first_contact_minutes?: number | null
          utm_campaign?: string | null
          utm_content?: string | null
          utm_medium?: string | null
          utm_source?: string | null
          utm_term?: string | null
          workspace_id: string
        }
        Update: {
          ad_id?: string | null
          adset_id?: string | null
          campaign_id?: string | null
          contact_attempts?: number | null
          created_at?: string | null
          deal_value?: number | null
          email?: string | null
          first_contact_at?: string | null
          id?: string
          is_mql?: boolean | null
          is_sql?: boolean | null
          is_valid_contact?: boolean | null
          lead_id?: string
          lost_reason?: string | null
          name?: string | null
          phone?: string | null
          qualification_notes?: string | null
          source?: string | null
          stage?: string | null
          stage_updated_at?: string | null
          time_to_first_contact_minutes?: number | null
          utm_campaign?: string | null
          utm_content?: string | null
          utm_medium?: string | null
          utm_source?: string | null
          utm_term?: string | null
          workspace_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "funnel_leads_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      funnel_stage_history: {
        Row: {
          changed_at: string | null
          changed_by: string | null
          from_stage: string | null
          id: string
          lead_id: string
          notes: string | null
          time_in_previous_stage_hours: number | null
          to_stage: string
          workspace_id: string
        }
        Insert: {
          changed_at?: string | null
          changed_by?: string | null
          from_stage?: string | null
          id?: string
          lead_id: string
          notes?: string | null
          time_in_previous_stage_hours?: number | null
          to_stage: string
          workspace_id: string
        }
        Update: {
          changed_at?: string | null
          changed_by?: string | null
          from_stage?: string | null
          id?: string
          lead_id?: string
          notes?: string | null
          time_in_previous_stage_hours?: number | null
          to_stage?: string
          workspace_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "funnel_stage_history_lead_id_fkey"
            columns: ["lead_id"]
            isOneToOne: false
            referencedRelation: "funnel_leads"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "funnel_stage_history_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      ig_conversations: {
        Row: {
          conversation_id: string
          id: string
          participant_id: string | null
          participant_name: string | null
          participant_username: string | null
          updated_at: string
          updated_time: string | null
          workspace_id: string
        }
        Insert: {
          conversation_id: string
          id?: string
          participant_id?: string | null
          participant_name?: string | null
          participant_username?: string | null
          updated_at?: string
          updated_time?: string | null
          workspace_id: string
        }
        Update: {
          conversation_id?: string
          id?: string
          participant_id?: string | null
          participant_name?: string | null
          participant_username?: string | null
          updated_at?: string
          updated_time?: string | null
          workspace_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "ig_conversations_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      ig_media: {
        Row: {
          caption: string | null
          comments_count: number | null
          id: string
          ig_user_id: string
          like_count: number | null
          media_id: string
          media_type: string | null
          media_url: string | null
          permalink: string | null
          thumbnail_url: string | null
          timestamp: string | null
          updated_at: string
          workspace_id: string
        }
        Insert: {
          caption?: string | null
          comments_count?: number | null
          id?: string
          ig_user_id: string
          like_count?: number | null
          media_id: string
          media_type?: string | null
          media_url?: string | null
          permalink?: string | null
          thumbnail_url?: string | null
          timestamp?: string | null
          updated_at?: string
          workspace_id: string
        }
        Update: {
          caption?: string | null
          comments_count?: number | null
          id?: string
          ig_user_id?: string
          like_count?: number | null
          media_id?: string
          media_type?: string | null
          media_url?: string | null
          permalink?: string | null
          thumbnail_url?: string | null
          timestamp?: string | null
          updated_at?: string
          workspace_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "ig_media_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      ig_media_insights: {
        Row: {
          engagement: number | null
          id: string
          impressions: number | null
          media_id: string
          reach: number | null
          saved: number | null
          shares: number | null
          updated_at: string
          video_views: number | null
          workspace_id: string
        }
        Insert: {
          engagement?: number | null
          id?: string
          impressions?: number | null
          media_id: string
          reach?: number | null
          saved?: number | null
          shares?: number | null
          updated_at?: string
          video_views?: number | null
          workspace_id: string
        }
        Update: {
          engagement?: number | null
          id?: string
          impressions?: number | null
          media_id?: string
          reach?: number | null
          saved?: number | null
          shares?: number | null
          updated_at?: string
          video_views?: number | null
          workspace_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "ig_media_insights_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      ig_messages: {
        Row: {
          conversation_id: string
          created_time: string | null
          id: string
          is_from_page: boolean | null
          message_id: string
          message_text: string | null
          sender_id: string | null
          updated_at: string
          workspace_id: string
        }
        Insert: {
          conversation_id: string
          created_time?: string | null
          id?: string
          is_from_page?: boolean | null
          message_id: string
          message_text?: string | null
          sender_id?: string | null
          updated_at?: string
          workspace_id: string
        }
        Update: {
          conversation_id?: string
          created_time?: string | null
          id?: string
          is_from_page?: boolean | null
          message_id?: string
          message_text?: string | null
          sender_id?: string | null
          updated_at?: string
          workspace_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "ig_messages_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      lead_quality: {
        Row: {
          ad_key: string | null
          adset_key: string | null
          campaign_key: string
          contratos_fechados: number | null
          created_at: string | null
          date: string
          id: string
          leads_atendidos: number | null
          leads_qualificados: number | null
          leads_total: number | null
          notes: string | null
          propostas_enviadas: number | null
          receita_brl: number | null
          updated_at: string | null
          visitas_agendadas: number | null
          workspace_id: string
        }
        Insert: {
          ad_key?: string | null
          adset_key?: string | null
          campaign_key: string
          contratos_fechados?: number | null
          created_at?: string | null
          date: string
          id?: string
          leads_atendidos?: number | null
          leads_qualificados?: number | null
          leads_total?: number | null
          notes?: string | null
          propostas_enviadas?: number | null
          receita_brl?: number | null
          updated_at?: string | null
          visitas_agendadas?: number | null
          workspace_id: string
        }
        Update: {
          ad_key?: string | null
          adset_key?: string | null
          campaign_key?: string
          contratos_fechados?: number | null
          created_at?: string | null
          date?: string
          id?: string
          leads_atendidos?: number | null
          leads_qualificados?: number | null
          leads_total?: number | null
          notes?: string | null
          propostas_enviadas?: number | null
          receita_brl?: number | null
          updated_at?: string | null
          visitas_agendadas?: number | null
          workspace_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "lead_quality_workspace_id_fkey"
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
      meta_lead_forms: {
        Row: {
          ad_account_id: string | null
          created_time: string | null
          form_id: string
          id: string
          name: string | null
          page_id: string | null
          status: string | null
          updated_at: string
          workspace_id: string
        }
        Insert: {
          ad_account_id?: string | null
          created_time?: string | null
          form_id: string
          id?: string
          name?: string | null
          page_id?: string | null
          status?: string | null
          updated_at?: string
          workspace_id: string
        }
        Update: {
          ad_account_id?: string | null
          created_time?: string | null
          form_id?: string
          id?: string
          name?: string | null
          page_id?: string | null
          status?: string | null
          updated_at?: string
          workspace_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "meta_lead_forms_ad_account_id_fkey"
            columns: ["ad_account_id"]
            isOneToOne: false
            referencedRelation: "ad_accounts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "meta_lead_forms_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      meta_leads: {
        Row: {
          ad_id: string | null
          adset_id: string | null
          campaign_id: string | null
          created_time: string
          field_data: Json
          form_id: string
          id: string
          is_organic: boolean | null
          lead_email: string | null
          lead_id: string
          lead_name: string | null
          lead_phone: string | null
          platform: string | null
          raw_json: Json | null
          synced_at: string
          workspace_id: string
        }
        Insert: {
          ad_id?: string | null
          adset_id?: string | null
          campaign_id?: string | null
          created_time: string
          field_data?: Json
          form_id: string
          id?: string
          is_organic?: boolean | null
          lead_email?: string | null
          lead_id: string
          lead_name?: string | null
          lead_phone?: string | null
          platform?: string | null
          raw_json?: Json | null
          synced_at?: string
          workspace_id: string
        }
        Update: {
          ad_id?: string | null
          adset_id?: string | null
          campaign_id?: string | null
          created_time?: string
          field_data?: Json
          form_id?: string
          id?: string
          is_organic?: boolean | null
          lead_email?: string | null
          lead_id?: string
          lead_name?: string | null
          lead_phone?: string | null
          platform?: string | null
          raw_json?: Json | null
          synced_at?: string
          workspace_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "meta_leads_workspace_id_fkey"
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
      optimization_log: {
        Row: {
          action_center_id: string | null
          action_taken: string
          actual_impact: string | null
          alert_id: string | null
          created_at: string
          created_by: string | null
          decision_type: string
          entity_id: string
          entity_name: string
          entity_type: string
          expected_impact: string | null
          id: string
          impact_confirmed_at: string | null
          metric_after: Json | null
          metric_before: Json | null
          notes: string | null
          reason: string
          status: string
          tags: string[] | null
          workspace_id: string
        }
        Insert: {
          action_center_id?: string | null
          action_taken?: string
          actual_impact?: string | null
          alert_id?: string | null
          created_at?: string
          created_by?: string | null
          decision_type?: string
          entity_id?: string
          entity_name?: string
          entity_type?: string
          expected_impact?: string | null
          id?: string
          impact_confirmed_at?: string | null
          metric_after?: Json | null
          metric_before?: Json | null
          notes?: string | null
          reason?: string
          status?: string
          tags?: string[] | null
          workspace_id: string
        }
        Update: {
          action_center_id?: string | null
          action_taken?: string
          actual_impact?: string | null
          alert_id?: string | null
          created_at?: string
          created_by?: string | null
          decision_type?: string
          entity_id?: string
          entity_name?: string
          entity_type?: string
          expected_impact?: string | null
          id?: string
          impact_confirmed_at?: string | null
          metric_after?: Json | null
          metric_before?: Json | null
          notes?: string | null
          reason?: string
          status?: string
          tags?: string[] | null
          workspace_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "optimization_log_action_center_id_fkey"
            columns: ["action_center_id"]
            isOneToOne: false
            referencedRelation: "recommendations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "optimization_log_alert_id_fkey"
            columns: ["alert_id"]
            isOneToOne: false
            referencedRelation: "alert_events"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "optimization_log_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      persona_profiles: {
        Row: {
          age_range: string
          avg_close_rate: number
          avg_cpl: number
          avg_deal_value: number
          avg_mql_rate: number
          avg_sql_rate: number
          best_day_of_week: string | null
          best_hour_of_day: number | null
          best_performing_creative_angle: string | null
          best_performing_placement: string | null
          created_at: string
          description: string
          gender: string
          id: string
          name: string
          roas_real: number
          top_cities: string[]
          top_interests: string[]
          total_leads: number
          total_revenue: number
          updated_at: string
          workspace_id: string
        }
        Insert: {
          age_range?: string
          avg_close_rate?: number
          avg_cpl?: number
          avg_deal_value?: number
          avg_mql_rate?: number
          avg_sql_rate?: number
          best_day_of_week?: string | null
          best_hour_of_day?: number | null
          best_performing_creative_angle?: string | null
          best_performing_placement?: string | null
          created_at?: string
          description?: string
          gender?: string
          id?: string
          name: string
          roas_real?: number
          top_cities?: string[]
          top_interests?: string[]
          total_leads?: number
          total_revenue?: number
          updated_at?: string
          workspace_id: string
        }
        Update: {
          age_range?: string
          avg_close_rate?: number
          avg_cpl?: number
          avg_deal_value?: number
          avg_mql_rate?: number
          avg_sql_rate?: number
          best_day_of_week?: string | null
          best_hour_of_day?: number | null
          best_performing_creative_angle?: string | null
          best_performing_placement?: string | null
          created_at?: string
          description?: string
          gender?: string
          id?: string
          name?: string
          roas_real?: number
          top_cities?: string[]
          top_interests?: string[]
          total_leads?: number
          total_revenue?: number
          updated_at?: string
          workspace_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "persona_profiles_workspace_id_fkey"
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
      utm_links: {
        Row: {
          base_url: string
          conjunto: string | null
          created_at: string
          created_by: string | null
          full_url: string
          funil: string
          id: string
          mes_ano: string | null
          nome_anuncio: string | null
          objetivo: string
          pais: string
          platform: string
          produto: string | null
          publico: string | null
          utm_campaign: string
          utm_content: string | null
          utm_medium: string
          utm_source: string
          utm_term: string | null
          workspace_id: string
        }
        Insert: {
          base_url?: string
          conjunto?: string | null
          created_at?: string
          created_by?: string | null
          full_url?: string
          funil?: string
          id?: string
          mes_ano?: string | null
          nome_anuncio?: string | null
          objetivo?: string
          pais?: string
          platform?: string
          produto?: string | null
          publico?: string | null
          utm_campaign?: string
          utm_content?: string | null
          utm_medium?: string
          utm_source?: string
          utm_term?: string | null
          workspace_id: string
        }
        Update: {
          base_url?: string
          conjunto?: string | null
          created_at?: string
          created_by?: string | null
          full_url?: string
          funil?: string
          id?: string
          mes_ano?: string | null
          nome_anuncio?: string | null
          objetivo?: string
          pais?: string
          platform?: string
          produto?: string | null
          publico?: string | null
          utm_campaign?: string
          utm_content?: string | null
          utm_medium?: string
          utm_source?: string
          utm_term?: string | null
          workspace_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "utm_links_workspace_id_fkey"
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
      workspace_settings: {
        Row: {
          ciclo_vendas_dias: number | null
          id: string
          segment: string
          ticket_medio: number | null
          updated_at: string
          workspace_id: string
        }
        Insert: {
          ciclo_vendas_dias?: number | null
          id?: string
          segment?: string
          ticket_medio?: number | null
          updated_at?: string
          workspace_id: string
        }
        Update: {
          ciclo_vendas_dias?: number | null
          id?: string
          segment?: string
          ticket_medio?: number | null
          updated_at?: string
          workspace_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "workspace_settings_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: true
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
