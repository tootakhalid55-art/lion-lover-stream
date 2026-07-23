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
      activation_codes: {
        Row: {
          code: string
          created_at: string
          created_by: string | null
          duration_override_days: number | null
          expires_at: string | null
          id: string
          notes: string | null
          package_id: string
          redeemed_at: string | null
          redeemed_by: string | null
          updated_at: string
          uses_allowed: number
          uses_count: number
        }
        Insert: {
          code: string
          created_at?: string
          created_by?: string | null
          duration_override_days?: number | null
          expires_at?: string | null
          id?: string
          notes?: string | null
          package_id: string
          redeemed_at?: string | null
          redeemed_by?: string | null
          updated_at?: string
          uses_allowed?: number
          uses_count?: number
        }
        Update: {
          code?: string
          created_at?: string
          created_by?: string | null
          duration_override_days?: number | null
          expires_at?: string | null
          id?: string
          notes?: string | null
          package_id?: string
          redeemed_at?: string | null
          redeemed_by?: string | null
          updated_at?: string
          uses_allowed?: number
          uses_count?: number
        }
        Relationships: [
          {
            foreignKeyName: "activation_codes_package_id_fkey"
            columns: ["package_id"]
            isOneToOne: false
            referencedRelation: "packages"
            referencedColumns: ["id"]
          },
        ]
      }
      api_keys: {
        Row: {
          allowed_ips: string[]
          created_at: string
          created_by: string | null
          description: string | null
          expires_at: string | null
          hash: string
          id: string
          last_used_at: string | null
          last_used_ip: string | null
          name: string
          org_id: string
          prefix: string
          revoked_at: string | null
          scopes: string[]
          status: string
          updated_at: string
        }
        Insert: {
          allowed_ips?: string[]
          created_at?: string
          created_by?: string | null
          description?: string | null
          expires_at?: string | null
          hash: string
          id?: string
          last_used_at?: string | null
          last_used_ip?: string | null
          name: string
          org_id: string
          prefix: string
          revoked_at?: string | null
          scopes?: string[]
          status?: string
          updated_at?: string
        }
        Update: {
          allowed_ips?: string[]
          created_at?: string
          created_by?: string | null
          description?: string | null
          expires_at?: string | null
          hash?: string
          id?: string
          last_used_at?: string | null
          last_used_ip?: string | null
          name?: string
          org_id?: string
          prefix?: string
          revoked_at?: string | null
          scopes?: string[]
          status?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "api_keys_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      api_request_log: {
        Row: {
          at: string
          id: number
          ip: string | null
          key_id: string | null
          method: string
          ms: number | null
          org_id: string | null
          path: string
          status: number
          user_agent: string | null
        }
        Insert: {
          at?: string
          id?: number
          ip?: string | null
          key_id?: string | null
          method: string
          ms?: number | null
          org_id?: string | null
          path: string
          status: number
          user_agent?: string | null
        }
        Update: {
          at?: string
          id?: number
          ip?: string | null
          key_id?: string | null
          method?: string
          ms?: number | null
          org_id?: string | null
          path?: string
          status?: number
          user_agent?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "api_request_log_key_id_fkey"
            columns: ["key_id"]
            isOneToOne: false
            referencedRelation: "api_keys"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "api_request_log_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      audit_logs: {
        Row: {
          action: string
          actor_id: string | null
          after_value: Json | null
          before_value: Json | null
          correlation_id: string | null
          created_at: string
          id: string
          ip: string | null
          meta: Json | null
          target_user_id: string | null
          user_agent: string | null
        }
        Insert: {
          action: string
          actor_id?: string | null
          after_value?: Json | null
          before_value?: Json | null
          correlation_id?: string | null
          created_at?: string
          id?: string
          ip?: string | null
          meta?: Json | null
          target_user_id?: string | null
          user_agent?: string | null
        }
        Update: {
          action?: string
          actor_id?: string | null
          after_value?: Json | null
          before_value?: Json | null
          correlation_id?: string | null
          created_at?: string
          id?: string
          ip?: string | null
          meta?: Json | null
          target_user_id?: string | null
          user_agent?: string | null
        }
        Relationships: []
      }
      billing_events: {
        Row: {
          actor_id: string | null
          correlation_id: string | null
          created_at: string
          event_type: string
          id: string
          org_id: string
          payload: Json
          processed_at: string | null
          ref_id: string
          ref_type: string
        }
        Insert: {
          actor_id?: string | null
          correlation_id?: string | null
          created_at?: string
          event_type: string
          id?: string
          org_id: string
          payload?: Json
          processed_at?: string | null
          ref_id: string
          ref_type: string
        }
        Update: {
          actor_id?: string | null
          correlation_id?: string | null
          created_at?: string
          event_type?: string
          id?: string
          org_id?: string
          payload?: Json
          processed_at?: string | null
          ref_id?: string
          ref_type?: string
        }
        Relationships: [
          {
            foreignKeyName: "billing_events_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      billing_idempotency: {
        Row: {
          attempts: number
          completed_at: string | null
          correlation_id: string | null
          created_at: string
          error: string | null
          expires_at: string
          id: string
          op_key: string
          op_type: string
          org_id: string
          result: Json | null
          status: string
        }
        Insert: {
          attempts?: number
          completed_at?: string | null
          correlation_id?: string | null
          created_at?: string
          error?: string | null
          expires_at?: string
          id?: string
          op_key: string
          op_type: string
          org_id: string
          result?: Json | null
          status?: string
        }
        Update: {
          attempts?: number
          completed_at?: string | null
          correlation_id?: string | null
          created_at?: string
          error?: string | null
          expires_at?: string
          id?: string
          op_key?: string
          op_type?: string
          org_id?: string
          result?: Json | null
          status?: string
        }
        Relationships: [
          {
            foreignKeyName: "billing_idempotency_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      billing_plans: {
        Row: {
          code: string
          created_at: string
          currency: string
          features: Json
          id: string
          interval: string
          name: string
          price_cents: number
          trial_days: number
          updated_at: string
          usage_components: Json
          visible: boolean
        }
        Insert: {
          code: string
          created_at?: string
          currency?: string
          features?: Json
          id?: string
          interval: string
          name: string
          price_cents?: number
          trial_days?: number
          updated_at?: string
          usage_components?: Json
          visible?: boolean
        }
        Update: {
          code?: string
          created_at?: string
          currency?: string
          features?: Json
          id?: string
          interval?: string
          name?: string
          price_cents?: number
          trial_days?: number
          updated_at?: string
          usage_components?: Json
          visible?: boolean
        }
        Relationships: []
      }
      coupons: {
        Row: {
          code: string
          created_at: string
          currency: string | null
          duration: string
          duration_months: number | null
          expires_at: string | null
          id: string
          kind: string
          max_redemptions: number | null
          plan_id: string | null
          redemptions: number
          value: number
        }
        Insert: {
          code: string
          created_at?: string
          currency?: string | null
          duration?: string
          duration_months?: number | null
          expires_at?: string | null
          id?: string
          kind: string
          max_redemptions?: number | null
          plan_id?: string | null
          redemptions?: number
          value: number
        }
        Update: {
          code?: string
          created_at?: string
          currency?: string | null
          duration?: string
          duration_months?: number | null
          expires_at?: string | null
          id?: string
          kind?: string
          max_redemptions?: number | null
          plan_id?: string | null
          redemptions?: number
          value?: number
        }
        Relationships: [
          {
            foreignKeyName: "coupons_plan_id_fkey"
            columns: ["plan_id"]
            isOneToOne: false
            referencedRelation: "billing_plans"
            referencedColumns: ["id"]
          },
        ]
      }
      dead_letter_queue: {
        Row: {
          attempts: number
          correlation_id: string | null
          created_at: string
          error: string
          event_type: string | null
          id: string
          payload: Json
          resolution_note: string | null
          resolved_at: string | null
          resolved_by: string | null
          source: string
          source_id: string | null
        }
        Insert: {
          attempts?: number
          correlation_id?: string | null
          created_at?: string
          error: string
          event_type?: string | null
          id?: string
          payload?: Json
          resolution_note?: string | null
          resolved_at?: string | null
          resolved_by?: string | null
          source: string
          source_id?: string | null
        }
        Update: {
          attempts?: number
          correlation_id?: string | null
          created_at?: string
          error?: string
          event_type?: string | null
          id?: string
          payload?: Json
          resolution_note?: string | null
          resolved_at?: string | null
          resolved_by?: string | null
          source?: string
          source_id?: string | null
        }
        Relationships: []
      }
      doc_number_sequences: {
        Row: {
          branch: string
          doc_type: string
          fiscal_year: number
          next_seq: number
          org_id: string
        }
        Insert: {
          branch?: string
          doc_type: string
          fiscal_year: number
          next_seq?: number
          org_id: string
        }
        Update: {
          branch?: string
          doc_type?: string
          fiscal_year?: number
          next_seq?: number
          org_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "doc_number_sequences_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      dunning_policies: {
        Row: {
          created_at: string
          description: string | null
          grace_days: number
          id: string
          is_default: boolean
          name: string
          org_id: string | null
          terminate_after_days: number
          updated_at: string
        }
        Insert: {
          created_at?: string
          description?: string | null
          grace_days?: number
          id?: string
          is_default?: boolean
          name: string
          org_id?: string | null
          terminate_after_days?: number
          updated_at?: string
        }
        Update: {
          created_at?: string
          description?: string | null
          grace_days?: number
          id?: string
          is_default?: boolean
          name?: string
          org_id?: string | null
          terminate_after_days?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "dunning_policies_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      dunning_policy_stages: {
        Row: {
          action: string
          channels: string[]
          id: string
          offset_days: number
          policy_id: string
          stage_index: number
          template_code: string | null
        }
        Insert: {
          action: string
          channels?: string[]
          id?: string
          offset_days: number
          policy_id: string
          stage_index: number
          template_code?: string | null
        }
        Update: {
          action?: string
          channels?: string[]
          id?: string
          offset_days?: number
          policy_id?: string
          stage_index?: number
          template_code?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "dunning_policy_stages_policy_id_fkey"
            columns: ["policy_id"]
            isOneToOne: false
            referencedRelation: "dunning_policies"
            referencedColumns: ["id"]
          },
        ]
      }
      feature_flag_overrides: {
        Row: {
          created_at: string
          enabled: boolean
          flag_key: string
          id: string
          reason: string | null
          scope: string
          scope_id: string | null
          updated_at: string
        }
        Insert: {
          created_at?: string
          enabled: boolean
          flag_key: string
          id?: string
          reason?: string | null
          scope: string
          scope_id?: string | null
          updated_at?: string
        }
        Update: {
          created_at?: string
          enabled?: boolean
          flag_key?: string
          id?: string
          reason?: string | null
          scope?: string
          scope_id?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "feature_flag_overrides_flag_key_fkey"
            columns: ["flag_key"]
            isOneToOne: false
            referencedRelation: "feature_flags"
            referencedColumns: ["key"]
          },
        ]
      }
      feature_flags: {
        Row: {
          category: string
          created_at: string
          default_enabled: boolean
          description: string | null
          id: string
          key: string
          updated_at: string
        }
        Insert: {
          category?: string
          created_at?: string
          default_enabled?: boolean
          description?: string | null
          id?: string
          key: string
          updated_at?: string
        }
        Update: {
          category?: string
          created_at?: string
          default_enabled?: boolean
          description?: string | null
          id?: string
          key?: string
          updated_at?: string
        }
        Relationships: []
      }
      fx_rates: {
        Row: {
          base_currency: string
          created_at: string
          effective_at: string
          id: string
          quote_currency: string
          rate: number
          source: string
        }
        Insert: {
          base_currency: string
          created_at?: string
          effective_at?: string
          id?: string
          quote_currency: string
          rate: number
          source?: string
        }
        Update: {
          base_currency?: string
          created_at?: string
          effective_at?: string
          id?: string
          quote_currency?: string
          rate?: number
          source?: string
        }
        Relationships: []
      }
      gateway_health_samples: {
        Row: {
          at: string
          correlation_id: string | null
          error_code: string | null
          id: number
          latency_ms: number
          mode: string
          op: string
          provider: string
          success: boolean
        }
        Insert: {
          at?: string
          correlation_id?: string | null
          error_code?: string | null
          id?: number
          latency_ms: number
          mode?: string
          op: string
          provider: string
          success: boolean
        }
        Update: {
          at?: string
          correlation_id?: string | null
          error_code?: string | null
          id?: number
          latency_ms?: number
          mode?: string
          op?: string
          provider?: string
          success?: boolean
        }
        Relationships: []
      }
      gateway_retry_policies: {
        Row: {
          backoff_seconds: Json
          circuit_breaker_threshold: number
          circuit_breaker_window_seconds: number
          max_attempts: number
          provider: string
          retry_on: Json
          updated_at: string
        }
        Insert: {
          backoff_seconds?: Json
          circuit_breaker_threshold?: number
          circuit_breaker_window_seconds?: number
          max_attempts?: number
          provider: string
          retry_on?: Json
          updated_at?: string
        }
        Update: {
          backoff_seconds?: Json
          circuit_breaker_threshold?: number
          circuit_breaker_window_seconds?: number
          max_attempts?: number
          provider?: string
          retry_on?: Json
          updated_at?: string
        }
        Relationships: []
      }
      gateway_webhook_events: {
        Row: {
          correlation_id: string | null
          event_type: string | null
          id: string
          org_id: string | null
          processed_at: string | null
          provider: string
          provider_event_id: string
          raw: Json | null
          received_at: string
          status: string
        }
        Insert: {
          correlation_id?: string | null
          event_type?: string | null
          id?: string
          org_id?: string | null
          processed_at?: string | null
          provider: string
          provider_event_id: string
          raw?: Json | null
          received_at?: string
          status?: string
        }
        Update: {
          correlation_id?: string | null
          event_type?: string | null
          id?: string
          org_id?: string | null
          processed_at?: string | null
          provider?: string
          provider_event_id?: string
          raw?: Json | null
          received_at?: string
          status?: string
        }
        Relationships: [
          {
            foreignKeyName: "gateway_webhook_events_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      idempotency_keys: {
        Row: {
          api_key_id: string | null
          correlation_id: string | null
          created_at: string
          expires_at: string
          id: string
          key: string
          method: string
          org_id: string | null
          path: string
          request_hash: string
          response_body: string | null
          response_status: number | null
        }
        Insert: {
          api_key_id?: string | null
          correlation_id?: string | null
          created_at?: string
          expires_at?: string
          id?: string
          key: string
          method: string
          org_id?: string | null
          path: string
          request_hash: string
          response_body?: string | null
          response_status?: number | null
        }
        Update: {
          api_key_id?: string | null
          correlation_id?: string | null
          created_at?: string
          expires_at?: string
          id?: string
          key?: string
          method?: string
          org_id?: string | null
          path?: string
          request_hash?: string
          response_body?: string | null
          response_status?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "idempotency_keys_api_key_id_fkey"
            columns: ["api_key_id"]
            isOneToOne: false
            referencedRelation: "api_keys"
            referencedColumns: ["id"]
          },
        ]
      }
      invoice_lines: {
        Row: {
          amount_cents: number
          created_at: string
          description: string
          id: string
          invoice_id: string
          kind: string
          qty: number
          ref: Json
          tax_amount_cents: number
          tax_kind: string
          tax_rate_bps: number
          unit_price_cents: number
        }
        Insert: {
          amount_cents: number
          created_at?: string
          description: string
          id?: string
          invoice_id: string
          kind: string
          qty?: number
          ref?: Json
          tax_amount_cents?: number
          tax_kind?: string
          tax_rate_bps?: number
          unit_price_cents: number
        }
        Update: {
          amount_cents?: number
          created_at?: string
          description?: string
          id?: string
          invoice_id?: string
          kind?: string
          qty?: number
          ref?: Json
          tax_amount_cents?: number
          tax_kind?: string
          tax_rate_bps?: number
          unit_price_cents?: number
        }
        Relationships: [
          {
            foreignKeyName: "invoice_lines_invoice_id_fkey"
            columns: ["invoice_id"]
            isOneToOne: false
            referencedRelation: "invoices"
            referencedColumns: ["id"]
          },
        ]
      }
      invoice_sequences: {
        Row: {
          next_seq: number
          org_id: string
        }
        Insert: {
          next_seq?: number
          org_id: string
        }
        Update: {
          next_seq?: number
          org_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "invoice_sequences_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: true
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      invoices: {
        Row: {
          amount_due_cents: number
          amount_paid_cents: number
          base_currency: string
          base_total_cents: number
          billing_strategy: string
          cancelled_at: string | null
          created_at: string
          currency: string
          discount_cents: number
          doc_type: string
          due_at: string | null
          fx_rate: number
          id: string
          issued_at: string | null
          meta: Json
          number: string
          org_id: string
          paid_at: string | null
          parent_invoice_id: string | null
          pdf_url: string | null
          sent_at: string | null
          snapshot: Json
          source_id: string | null
          source_type: string | null
          status: string
          subtotal_cents: number
          tax_cents: number
          total_cents: number
          updated_at: string
        }
        Insert: {
          amount_due_cents?: number
          amount_paid_cents?: number
          base_currency?: string
          base_total_cents?: number
          billing_strategy?: string
          cancelled_at?: string | null
          created_at?: string
          currency?: string
          discount_cents?: number
          doc_type?: string
          due_at?: string | null
          fx_rate?: number
          id?: string
          issued_at?: string | null
          meta?: Json
          number: string
          org_id: string
          paid_at?: string | null
          parent_invoice_id?: string | null
          pdf_url?: string | null
          sent_at?: string | null
          snapshot?: Json
          source_id?: string | null
          source_type?: string | null
          status?: string
          subtotal_cents?: number
          tax_cents?: number
          total_cents?: number
          updated_at?: string
        }
        Update: {
          amount_due_cents?: number
          amount_paid_cents?: number
          base_currency?: string
          base_total_cents?: number
          billing_strategy?: string
          cancelled_at?: string | null
          created_at?: string
          currency?: string
          discount_cents?: number
          doc_type?: string
          due_at?: string | null
          fx_rate?: number
          id?: string
          issued_at?: string | null
          meta?: Json
          number?: string
          org_id?: string
          paid_at?: string | null
          parent_invoice_id?: string | null
          pdf_url?: string | null
          sent_at?: string | null
          snapshot?: Json
          source_id?: string | null
          source_type?: string | null
          status?: string
          subtotal_cents?: number
          tax_cents?: number
          total_cents?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "invoices_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "invoices_parent_invoice_id_fkey"
            columns: ["parent_invoice_id"]
            isOneToOne: false
            referencedRelation: "invoices"
            referencedColumns: ["id"]
          },
        ]
      }
      job_definitions: {
        Row: {
          avg_runtime_ms: number | null
          code: string
          created_at: string
          description: string | null
          handler: string
          id: string
          is_enabled: boolean
          last_failure_at: string | null
          last_run_at: string | null
          last_success_at: string | null
          max_retries: number
          name: string
          schedule: string
          timeout_seconds: number
          updated_at: string
        }
        Insert: {
          avg_runtime_ms?: number | null
          code: string
          created_at?: string
          description?: string | null
          handler: string
          id?: string
          is_enabled?: boolean
          last_failure_at?: string | null
          last_run_at?: string | null
          last_success_at?: string | null
          max_retries?: number
          name: string
          schedule: string
          timeout_seconds?: number
          updated_at?: string
        }
        Update: {
          avg_runtime_ms?: number | null
          code?: string
          created_at?: string
          description?: string | null
          handler?: string
          id?: string
          is_enabled?: boolean
          last_failure_at?: string | null
          last_run_at?: string | null
          last_success_at?: string | null
          max_retries?: number
          name?: string
          schedule?: string
          timeout_seconds?: number
          updated_at?: string
        }
        Relationships: []
      }
      job_runs: {
        Row: {
          attempt: number
          correlation_id: string | null
          duration_ms: number | null
          error: string | null
          finished_at: string | null
          id: string
          job_id: string
          output: Json
          started_at: string
          status: string
          triggered_by: string
        }
        Insert: {
          attempt?: number
          correlation_id?: string | null
          duration_ms?: number | null
          error?: string | null
          finished_at?: string | null
          id?: string
          job_id: string
          output?: Json
          started_at?: string
          status?: string
          triggered_by?: string
        }
        Update: {
          attempt?: number
          correlation_id?: string | null
          duration_ms?: number | null
          error?: string | null
          finished_at?: string | null
          id?: string
          job_id?: string
          output?: Json
          started_at?: string
          status?: string
          triggered_by?: string
        }
        Relationships: [
          {
            foreignKeyName: "job_runs_job_id_fkey"
            columns: ["job_id"]
            isOneToOne: false
            referencedRelation: "job_definitions"
            referencedColumns: ["id"]
          },
        ]
      }
      journal_entries: {
        Row: {
          currency: string
          entry_no: number
          event_type: string
          id: string
          memo: string | null
          meta: Json
          org_id: string
          posted_at: string
          ref_id: string
          ref_type: string
          total_credit_cents: number
          total_debit_cents: number
        }
        Insert: {
          currency: string
          entry_no?: number
          event_type: string
          id?: string
          memo?: string | null
          meta?: Json
          org_id: string
          posted_at?: string
          ref_id: string
          ref_type: string
          total_credit_cents?: number
          total_debit_cents?: number
        }
        Update: {
          currency?: string
          entry_no?: number
          event_type?: string
          id?: string
          memo?: string | null
          meta?: Json
          org_id?: string
          posted_at?: string
          ref_id?: string
          ref_type?: string
          total_credit_cents?: number
          total_debit_cents?: number
        }
        Relationships: [
          {
            foreignKeyName: "journal_entries_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      journal_lines: {
        Row: {
          account: string
          amount_cents: number
          entry_id: string
          id: string
          memo: string | null
          meta: Json
          side: string
        }
        Insert: {
          account: string
          amount_cents: number
          entry_id: string
          id?: string
          memo?: string | null
          meta?: Json
          side: string
        }
        Update: {
          account?: string
          amount_cents?: number
          entry_id?: string
          id?: string
          memo?: string | null
          meta?: Json
          side?: string
        }
        Relationships: [
          {
            foreignKeyName: "journal_lines_entry_id_fkey"
            columns: ["entry_id"]
            isOneToOne: false
            referencedRelation: "journal_entries"
            referencedColumns: ["id"]
          },
        ]
      }
      license_orders: {
        Row: {
          cancelled_at: string | null
          created_at: string
          created_by: string | null
          currency: string
          discount_cents: number
          fulfilled_at: string | null
          id: string
          invoice_id: string | null
          meta: Json
          org_id: string
          package_id: string
          paid_at: string | null
          pricing_trace: Json
          qty: number
          status: string
          submitted_at: string | null
          tax_cents: number
          total_cents: number
          unit_price_cents: number
          updated_at: string
        }
        Insert: {
          cancelled_at?: string | null
          created_at?: string
          created_by?: string | null
          currency?: string
          discount_cents?: number
          fulfilled_at?: string | null
          id?: string
          invoice_id?: string | null
          meta?: Json
          org_id: string
          package_id: string
          paid_at?: string | null
          pricing_trace?: Json
          qty: number
          status?: string
          submitted_at?: string | null
          tax_cents?: number
          total_cents: number
          unit_price_cents: number
          updated_at?: string
        }
        Update: {
          cancelled_at?: string | null
          created_at?: string
          created_by?: string | null
          currency?: string
          discount_cents?: number
          fulfilled_at?: string | null
          id?: string
          invoice_id?: string | null
          meta?: Json
          org_id?: string
          package_id?: string
          paid_at?: string | null
          pricing_trace?: Json
          qty?: number
          status?: string
          submitted_at?: string | null
          tax_cents?: number
          total_cents?: number
          unit_price_cents?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "license_orders_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "license_orders_package_id_fkey"
            columns: ["package_id"]
            isOneToOne: false
            referencedRelation: "packages"
            referencedColumns: ["id"]
          },
        ]
      }
      licenses: {
        Row: {
          activated_at: string
          auto_renew: boolean
          created_at: string
          expires_at: string | null
          id: string
          issued_by: string | null
          license_key: string
          license_type: Database["public"]["Enums"]["license_type"]
          notes: string | null
          package_id: string | null
          status: Database["public"]["Enums"]["license_status"]
          updated_at: string
          user_id: string
        }
        Insert: {
          activated_at?: string
          auto_renew?: boolean
          created_at?: string
          expires_at?: string | null
          id?: string
          issued_by?: string | null
          license_key: string
          license_type?: Database["public"]["Enums"]["license_type"]
          notes?: string | null
          package_id?: string | null
          status?: Database["public"]["Enums"]["license_status"]
          updated_at?: string
          user_id: string
        }
        Update: {
          activated_at?: string
          auto_renew?: boolean
          created_at?: string
          expires_at?: string | null
          id?: string
          issued_by?: string | null
          license_key?: string
          license_type?: Database["public"]["Enums"]["license_type"]
          notes?: string | null
          package_id?: string | null
          status?: Database["public"]["Enums"]["license_status"]
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "licenses_package_id_fkey"
            columns: ["package_id"]
            isOneToOne: false
            referencedRelation: "packages"
            referencedColumns: ["id"]
          },
        ]
      }
      login_attempts: {
        Row: {
          created_at: string
          id: string
          ip: string | null
          reason: string | null
          success: boolean
          user_agent: string | null
          username: string | null
        }
        Insert: {
          created_at?: string
          id?: string
          ip?: string | null
          reason?: string | null
          success: boolean
          user_agent?: string | null
          username?: string | null
        }
        Update: {
          created_at?: string
          id?: string
          ip?: string | null
          reason?: string | null
          success?: boolean
          user_agent?: string | null
          username?: string | null
        }
        Relationships: []
      }
      notification_channels_config: {
        Row: {
          channel: string
          config: Json
          created_at: string
          id: string
          is_enabled: boolean
          org_id: string | null
          provider: string
          updated_at: string
        }
        Insert: {
          channel: string
          config?: Json
          created_at?: string
          id?: string
          is_enabled?: boolean
          org_id?: string | null
          provider: string
          updated_at?: string
        }
        Update: {
          channel?: string
          config?: Json
          created_at?: string
          id?: string
          is_enabled?: boolean
          org_id?: string | null
          provider?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "notification_channels_config_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      notification_deliveries: {
        Row: {
          attempts: number
          body: string
          channel: string
          correlation_id: string | null
          created_at: string
          error: string | null
          id: string
          last_attempt_at: string | null
          meta: Json
          next_attempt_at: string | null
          org_id: string | null
          provider: string | null
          provider_ref: string | null
          recipient: string
          status: string
          subject: string | null
          template_code: string
          updated_at: string
          user_id: string | null
        }
        Insert: {
          attempts?: number
          body: string
          channel: string
          correlation_id?: string | null
          created_at?: string
          error?: string | null
          id?: string
          last_attempt_at?: string | null
          meta?: Json
          next_attempt_at?: string | null
          org_id?: string | null
          provider?: string | null
          provider_ref?: string | null
          recipient: string
          status?: string
          subject?: string | null
          template_code: string
          updated_at?: string
          user_id?: string | null
        }
        Update: {
          attempts?: number
          body?: string
          channel?: string
          correlation_id?: string | null
          created_at?: string
          error?: string | null
          id?: string
          last_attempt_at?: string | null
          meta?: Json
          next_attempt_at?: string | null
          org_id?: string | null
          provider?: string | null
          provider_ref?: string | null
          recipient?: string
          status?: string
          subject?: string | null
          template_code?: string
          updated_at?: string
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "notification_deliveries_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      notification_templates: {
        Row: {
          body: string
          channel: string
          code: string
          created_at: string
          id: string
          is_enabled: boolean
          locale: string
          org_id: string | null
          subject: string | null
          updated_at: string
          variables: Json
        }
        Insert: {
          body: string
          channel: string
          code: string
          created_at?: string
          id?: string
          is_enabled?: boolean
          locale?: string
          org_id?: string | null
          subject?: string | null
          updated_at?: string
          variables?: Json
        }
        Update: {
          body?: string
          channel?: string
          code?: string
          created_at?: string
          id?: string
          is_enabled?: boolean
          locale?: string
          org_id?: string | null
          subject?: string | null
          updated_at?: string
          variables?: Json
        }
        Relationships: [
          {
            foreignKeyName: "notification_templates_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      notifications: {
        Row: {
          body: string | null
          created_at: string
          id: string
          kind: string
          meta: Json
          read_at: string | null
          severity: string
          title: string
          user_id: string | null
        }
        Insert: {
          body?: string | null
          created_at?: string
          id?: string
          kind: string
          meta?: Json
          read_at?: string | null
          severity?: string
          title: string
          user_id?: string | null
        }
        Update: {
          body?: string | null
          created_at?: string
          id?: string
          kind?: string
          meta?: Json
          read_at?: string | null
          severity?: string
          title?: string
          user_id?: string | null
        }
        Relationships: []
      }
      org_members: {
        Row: {
          created_at: string
          id: string
          org_id: string
          role: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          org_id: string
          role?: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          org_id?: string
          role?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "org_members_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      org_move_history: {
        Row: {
          actor_id: string | null
          created_at: string
          from_parent_id: string | null
          id: string
          org_id: string
          reason: string | null
          to_parent_id: string | null
        }
        Insert: {
          actor_id?: string | null
          created_at?: string
          from_parent_id?: string | null
          id?: string
          org_id: string
          reason?: string | null
          to_parent_id?: string | null
        }
        Update: {
          actor_id?: string | null
          created_at?: string
          from_parent_id?: string | null
          id?: string
          org_id?: string
          reason?: string | null
          to_parent_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "org_move_history_from_parent_id_fkey"
            columns: ["from_parent_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "org_move_history_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "org_move_history_to_parent_id_fkey"
            columns: ["to_parent_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      organizations: {
        Row: {
          brand: Json
          country: string | null
          created_at: string
          currency: string
          id: string
          meta: Json
          name: string
          parent_id: string | null
          slug: string
          status: string
          type: string
          updated_at: string
        }
        Insert: {
          brand?: Json
          country?: string | null
          created_at?: string
          currency?: string
          id?: string
          meta?: Json
          name: string
          parent_id?: string | null
          slug: string
          status?: string
          type: string
          updated_at?: string
        }
        Update: {
          brand?: Json
          country?: string | null
          created_at?: string
          currency?: string
          id?: string
          meta?: Json
          name?: string
          parent_id?: string | null
          slug?: string
          status?: string
          type?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "organizations_parent_id_fkey"
            columns: ["parent_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      outbox_events: {
        Row: {
          aggregate_id: string | null
          aggregate_type: string
          attempts: number
          correlation_id: string | null
          created_at: string
          delivered_at: string | null
          event_type: string
          id: string
          last_error: string | null
          next_attempt_at: string
          payload: Json
          status: string
          updated_at: string
        }
        Insert: {
          aggregate_id?: string | null
          aggregate_type: string
          attempts?: number
          correlation_id?: string | null
          created_at?: string
          delivered_at?: string | null
          event_type: string
          id?: string
          last_error?: string | null
          next_attempt_at?: string
          payload?: Json
          status?: string
          updated_at?: string
        }
        Update: {
          aggregate_id?: string | null
          aggregate_type?: string
          attempts?: number
          correlation_id?: string | null
          created_at?: string
          delivered_at?: string | null
          event_type?: string
          id?: string
          last_error?: string | null
          next_attempt_at?: string
          payload?: Json
          status?: string
          updated_at?: string
        }
        Relationships: []
      }
      package_pricing: {
        Row: {
          created_at: string
          currency: string
          discount_pct: number
          effective_from: string
          effective_to: string | null
          id: string
          margin_pct: number
          org_id: string | null
          package_id: string
          price_cents: number
          promo_ends_at: string | null
          promo_starts_at: string | null
          region: string | null
          updated_at: string
          visible: boolean
        }
        Insert: {
          created_at?: string
          currency?: string
          discount_pct?: number
          effective_from?: string
          effective_to?: string | null
          id?: string
          margin_pct?: number
          org_id?: string | null
          package_id: string
          price_cents: number
          promo_ends_at?: string | null
          promo_starts_at?: string | null
          region?: string | null
          updated_at?: string
          visible?: boolean
        }
        Update: {
          created_at?: string
          currency?: string
          discount_pct?: number
          effective_from?: string
          effective_to?: string | null
          id?: string
          margin_pct?: number
          org_id?: string | null
          package_id?: string
          price_cents?: number
          promo_ends_at?: string | null
          promo_starts_at?: string | null
          region?: string | null
          updated_at?: string
          visible?: boolean
        }
        Relationships: [
          {
            foreignKeyName: "package_pricing_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "package_pricing_package_id_fkey"
            columns: ["package_id"]
            isOneToOne: false
            referencedRelation: "packages"
            referencedColumns: ["id"]
          },
        ]
      }
      packages: {
        Row: {
          allow_download: boolean
          allow_recording: boolean
          allowed_categories: Json
          allowed_features: Json
          created_at: string
          currency: string
          duration_days: number | null
          id: string
          is_active: boolean
          max_devices: number
          max_sessions: number
          name: string
          notes: string | null
          price_cents: number
          simultaneous_streams: number
          sort_order: number
          tier: Database["public"]["Enums"]["package_tier"]
          updated_at: string
        }
        Insert: {
          allow_download?: boolean
          allow_recording?: boolean
          allowed_categories?: Json
          allowed_features?: Json
          created_at?: string
          currency?: string
          duration_days?: number | null
          id?: string
          is_active?: boolean
          max_devices?: number
          max_sessions?: number
          name: string
          notes?: string | null
          price_cents?: number
          simultaneous_streams?: number
          sort_order?: number
          tier: Database["public"]["Enums"]["package_tier"]
          updated_at?: string
        }
        Update: {
          allow_download?: boolean
          allow_recording?: boolean
          allowed_categories?: Json
          allowed_features?: Json
          created_at?: string
          currency?: string
          duration_days?: number | null
          id?: string
          is_active?: boolean
          max_devices?: number
          max_sessions?: number
          name?: string
          notes?: string | null
          price_cents?: number
          simultaneous_streams?: number
          sort_order?: number
          tier?: Database["public"]["Enums"]["package_tier"]
          updated_at?: string
        }
        Relationships: []
      }
      payment_gateway_configs: {
        Row: {
          capabilities: Json
          config: Json
          created_at: string
          display_name: string | null
          id: string
          is_default: boolean
          is_enabled: boolean
          merchant_id: string | null
          mode: string
          org_id: string | null
          provider: string
          publishable_key: string | null
          secret_key_ref: string | null
          updated_at: string
          webhook_secret_ref: string | null
        }
        Insert: {
          capabilities?: Json
          config?: Json
          created_at?: string
          display_name?: string | null
          id?: string
          is_default?: boolean
          is_enabled?: boolean
          merchant_id?: string | null
          mode?: string
          org_id?: string | null
          provider: string
          publishable_key?: string | null
          secret_key_ref?: string | null
          updated_at?: string
          webhook_secret_ref?: string | null
        }
        Update: {
          capabilities?: Json
          config?: Json
          created_at?: string
          display_name?: string | null
          id?: string
          is_default?: boolean
          is_enabled?: boolean
          merchant_id?: string | null
          mode?: string
          org_id?: string | null
          provider?: string
          publishable_key?: string | null
          secret_key_ref?: string | null
          updated_at?: string
          webhook_secret_ref?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "payment_gateway_configs_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      payment_intents: {
        Row: {
          amount_cents: number
          client_secret: string | null
          correlation_id: string | null
          created_at: string
          currency: string
          failure_code: string | null
          failure_message: string | null
          id: string
          invoice_id: string | null
          metadata: Json
          org_id: string
          provider: string
          provider_ref: string | null
          status: string
          subscription_id: string | null
          updated_at: string
        }
        Insert: {
          amount_cents: number
          client_secret?: string | null
          correlation_id?: string | null
          created_at?: string
          currency?: string
          failure_code?: string | null
          failure_message?: string | null
          id?: string
          invoice_id?: string | null
          metadata?: Json
          org_id: string
          provider: string
          provider_ref?: string | null
          status?: string
          subscription_id?: string | null
          updated_at?: string
        }
        Update: {
          amount_cents?: number
          client_secret?: string | null
          correlation_id?: string | null
          created_at?: string
          currency?: string
          failure_code?: string | null
          failure_message?: string | null
          id?: string
          invoice_id?: string | null
          metadata?: Json
          org_id?: string
          provider?: string
          provider_ref?: string | null
          status?: string
          subscription_id?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "payment_intents_invoice_id_fkey"
            columns: ["invoice_id"]
            isOneToOne: false
            referencedRelation: "invoices"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "payment_intents_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "payment_intents_subscription_id_fkey"
            columns: ["subscription_id"]
            isOneToOne: false
            referencedRelation: "subscriptions"
            referencedColumns: ["id"]
          },
        ]
      }
      payment_methods: {
        Row: {
          brand: string | null
          created_at: string
          exp_month: number | null
          exp_year: number | null
          gateway: string
          gateway_ref: string
          id: string
          is_default: boolean
          last4: string | null
          meta: Json
          org_id: string
        }
        Insert: {
          brand?: string | null
          created_at?: string
          exp_month?: number | null
          exp_year?: number | null
          gateway: string
          gateway_ref: string
          id?: string
          is_default?: boolean
          last4?: string | null
          meta?: Json
          org_id: string
        }
        Update: {
          brand?: string | null
          created_at?: string
          exp_month?: number | null
          exp_year?: number | null
          gateway?: string
          gateway_ref?: string
          id?: string
          is_default?: boolean
          last4?: string | null
          meta?: Json
          org_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "payment_methods_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      payment_refunds: {
        Row: {
          amount_cents: number
          correlation_id: string | null
          created_at: string
          currency: string
          id: string
          metadata: Json
          org_id: string
          payment_id: string | null
          payment_intent_id: string | null
          provider: string
          provider_ref: string | null
          reason: string | null
          status: string
          updated_at: string
        }
        Insert: {
          amount_cents: number
          correlation_id?: string | null
          created_at?: string
          currency: string
          id?: string
          metadata?: Json
          org_id: string
          payment_id?: string | null
          payment_intent_id?: string | null
          provider: string
          provider_ref?: string | null
          reason?: string | null
          status?: string
          updated_at?: string
        }
        Update: {
          amount_cents?: number
          correlation_id?: string | null
          created_at?: string
          currency?: string
          id?: string
          metadata?: Json
          org_id?: string
          payment_id?: string | null
          payment_intent_id?: string | null
          provider?: string
          provider_ref?: string | null
          reason?: string | null
          status?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "payment_refunds_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "payment_refunds_payment_id_fkey"
            columns: ["payment_id"]
            isOneToOne: false
            referencedRelation: "payments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "payment_refunds_payment_intent_id_fkey"
            columns: ["payment_intent_id"]
            isOneToOne: false
            referencedRelation: "payment_intents"
            referencedColumns: ["id"]
          },
        ]
      }
      payments: {
        Row: {
          amount_cents: number
          created_at: string
          currency: string
          error: string | null
          gateway: string
          gateway_ref: string | null
          id: string
          invoice_id: string | null
          method: Json
          org_id: string
          status: string
          updated_at: string
        }
        Insert: {
          amount_cents: number
          created_at?: string
          currency?: string
          error?: string | null
          gateway: string
          gateway_ref?: string | null
          id?: string
          invoice_id?: string | null
          method?: Json
          org_id: string
          status?: string
          updated_at?: string
        }
        Update: {
          amount_cents?: number
          created_at?: string
          currency?: string
          error?: string | null
          gateway?: string
          gateway_ref?: string | null
          id?: string
          invoice_id?: string | null
          method?: Json
          org_id?: string
          status?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "payments_invoice_id_fkey"
            columns: ["invoice_id"]
            isOneToOne: false
            referencedRelation: "invoices"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "payments_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          activated_at: string | null
          created_at: string
          display_name: string | null
          email: string | null
          expires_at: string | null
          failed_attempts: number
          id: string
          last_ip: string | null
          last_login_at: string | null
          locked_until: string | null
          notes: string | null
          package_id: string | null
          phone: string | null
          reauth_after: string | null
          status: Database["public"]["Enums"]["account_status"]
          updated_at: string
          username: string
        }
        Insert: {
          activated_at?: string | null
          created_at?: string
          display_name?: string | null
          email?: string | null
          expires_at?: string | null
          failed_attempts?: number
          id: string
          last_ip?: string | null
          last_login_at?: string | null
          locked_until?: string | null
          notes?: string | null
          package_id?: string | null
          phone?: string | null
          reauth_after?: string | null
          status?: Database["public"]["Enums"]["account_status"]
          updated_at?: string
          username: string
        }
        Update: {
          activated_at?: string | null
          created_at?: string
          display_name?: string | null
          email?: string | null
          expires_at?: string | null
          failed_attempts?: number
          id?: string
          last_ip?: string | null
          last_login_at?: string | null
          locked_until?: string | null
          notes?: string | null
          package_id?: string | null
          phone?: string | null
          reauth_after?: string | null
          status?: Database["public"]["Enums"]["account_status"]
          updated_at?: string
          username?: string
        }
        Relationships: [
          {
            foreignKeyName: "profiles_package_id_fkey"
            columns: ["package_id"]
            isOneToOne: false
            referencedRelation: "packages"
            referencedColumns: ["id"]
          },
        ]
      }
      promo_codes: {
        Row: {
          code: string
          created_at: string
          currency: string | null
          expires_at: string | null
          id: string
          kind: string
          max_uses: number | null
          org_id: string | null
          package_id: string | null
          updated_at: string
          used_count: number
          value: number
        }
        Insert: {
          code: string
          created_at?: string
          currency?: string | null
          expires_at?: string | null
          id?: string
          kind: string
          max_uses?: number | null
          org_id?: string | null
          package_id?: string | null
          updated_at?: string
          used_count?: number
          value: number
        }
        Update: {
          code?: string
          created_at?: string
          currency?: string | null
          expires_at?: string | null
          id?: string
          kind?: string
          max_uses?: number | null
          org_id?: string | null
          package_id?: string | null
          updated_at?: string
          used_count?: number
          value?: number
        }
        Relationships: [
          {
            foreignKeyName: "promo_codes_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "promo_codes_package_id_fkey"
            columns: ["package_id"]
            isOneToOne: false
            referencedRelation: "packages"
            referencedColumns: ["id"]
          },
        ]
      }
      reconciliation_batches: {
        Row: {
          created_at: string
          created_by: string | null
          currency: string
          id: string
          matched_count: number
          meta: Json
          org_id: string | null
          period_end: string | null
          period_start: string | null
          provider: string
          source: string
          status: string
          total_amount_cents: number
          unmatched_count: number
          updated_at: string
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          currency?: string
          id?: string
          matched_count?: number
          meta?: Json
          org_id?: string | null
          period_end?: string | null
          period_start?: string | null
          provider: string
          source?: string
          status?: string
          total_amount_cents?: number
          unmatched_count?: number
          updated_at?: string
        }
        Update: {
          created_at?: string
          created_by?: string | null
          currency?: string
          id?: string
          matched_count?: number
          meta?: Json
          org_id?: string | null
          period_end?: string | null
          period_start?: string | null
          provider?: string
          source?: string
          status?: string
          total_amount_cents?: number
          unmatched_count?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "reconciliation_batches_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      reconciliation_entries: {
        Row: {
          amount_cents: number
          batch_id: string
          created_at: string
          currency: string
          external_ref: string
          id: string
          matched_amount_cents: number
          matched_at: string | null
          matched_by: string | null
          note: string | null
          occurred_at: string | null
          payment_id: string | null
          payment_intent_id: string | null
          raw: Json
          status: string
          updated_at: string
        }
        Insert: {
          amount_cents: number
          batch_id: string
          created_at?: string
          currency: string
          external_ref: string
          id?: string
          matched_amount_cents?: number
          matched_at?: string | null
          matched_by?: string | null
          note?: string | null
          occurred_at?: string | null
          payment_id?: string | null
          payment_intent_id?: string | null
          raw?: Json
          status?: string
          updated_at?: string
        }
        Update: {
          amount_cents?: number
          batch_id?: string
          created_at?: string
          currency?: string
          external_ref?: string
          id?: string
          matched_amount_cents?: number
          matched_at?: string | null
          matched_by?: string | null
          note?: string | null
          occurred_at?: string | null
          payment_id?: string | null
          payment_intent_id?: string | null
          raw?: Json
          status?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "reconciliation_entries_batch_id_fkey"
            columns: ["batch_id"]
            isOneToOne: false
            referencedRelation: "reconciliation_batches"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "reconciliation_entries_payment_id_fkey"
            columns: ["payment_id"]
            isOneToOne: false
            referencedRelation: "payments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "reconciliation_entries_payment_intent_id_fkey"
            columns: ["payment_intent_id"]
            isOneToOne: false
            referencedRelation: "payment_intents"
            referencedColumns: ["id"]
          },
        ]
      }
      reseller_profiles: {
        Row: {
          address: Json
          balance_cents: number
          commission_model: Json
          company: string | null
          contact_name: string | null
          created_at: string
          credit_limit_cents: number
          email: string | null
          notes: string | null
          org_id: string
          phone: string | null
          price_level: string
          status: string
          tax_profile: Json
          territory: string | null
          updated_at: string
        }
        Insert: {
          address?: Json
          balance_cents?: number
          commission_model?: Json
          company?: string | null
          contact_name?: string | null
          created_at?: string
          credit_limit_cents?: number
          email?: string | null
          notes?: string | null
          org_id: string
          phone?: string | null
          price_level?: string
          status?: string
          tax_profile?: Json
          territory?: string | null
          updated_at?: string
        }
        Update: {
          address?: Json
          balance_cents?: number
          commission_model?: Json
          company?: string | null
          contact_name?: string | null
          created_at?: string
          credit_limit_cents?: number
          email?: string | null
          notes?: string | null
          org_id?: string
          phone?: string | null
          price_level?: string
          status?: string
          tax_profile?: Json
          territory?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "reseller_profiles_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: true
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      revenue_entries: {
        Row: {
          amount_cents: number
          id: string
          period: string
          recognized_at: string | null
          schedule_id: string
        }
        Insert: {
          amount_cents: number
          id?: string
          period: string
          recognized_at?: string | null
          schedule_id: string
        }
        Update: {
          amount_cents?: number
          id?: string
          period?: string
          recognized_at?: string | null
          schedule_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "revenue_entries_schedule_id_fkey"
            columns: ["schedule_id"]
            isOneToOne: false
            referencedRelation: "revenue_schedules"
            referencedColumns: ["id"]
          },
        ]
      }
      revenue_schedules: {
        Row: {
          created_at: string
          currency: string
          ends_on: string
          id: string
          invoice_id: string | null
          meta: Json
          method: string
          org_id: string
          starts_on: string
          subscription_id: string | null
          total_amount_cents: number
        }
        Insert: {
          created_at?: string
          currency: string
          ends_on: string
          id?: string
          invoice_id?: string | null
          meta?: Json
          method?: string
          org_id: string
          starts_on: string
          subscription_id?: string | null
          total_amount_cents: number
        }
        Update: {
          created_at?: string
          currency?: string
          ends_on?: string
          id?: string
          invoice_id?: string | null
          meta?: Json
          method?: string
          org_id?: string
          starts_on?: string
          subscription_id?: string | null
          total_amount_cents?: number
        }
        Relationships: [
          {
            foreignKeyName: "revenue_schedules_invoice_id_fkey"
            columns: ["invoice_id"]
            isOneToOne: false
            referencedRelation: "invoices"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "revenue_schedules_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "revenue_schedules_subscription_id_fkey"
            columns: ["subscription_id"]
            isOneToOne: false
            referencedRelation: "subscriptions"
            referencedColumns: ["id"]
          },
        ]
      }
      security_events: {
        Row: {
          country: string | null
          created_at: string
          id: string
          ip: string | null
          kind: string
          meta: Json
          severity: string
          user_agent: string | null
          user_id: string | null
        }
        Insert: {
          country?: string | null
          created_at?: string
          id?: string
          ip?: string | null
          kind: string
          meta?: Json
          severity?: string
          user_agent?: string | null
          user_id?: string | null
        }
        Update: {
          country?: string | null
          created_at?: string
          id?: string
          ip?: string | null
          kind?: string
          meta?: Json
          severity?: string
          user_agent?: string | null
          user_id?: string | null
        }
        Relationships: []
      }
      subscription_events: {
        Row: {
          actor_id: string | null
          correlation_id: string | null
          created_at: string
          event_type: string
          from_state: string | null
          id: string
          org_id: string
          payload: Json
          subscription_id: string
          to_state: string | null
        }
        Insert: {
          actor_id?: string | null
          correlation_id?: string | null
          created_at?: string
          event_type: string
          from_state?: string | null
          id?: string
          org_id: string
          payload?: Json
          subscription_id: string
          to_state?: string | null
        }
        Update: {
          actor_id?: string | null
          correlation_id?: string | null
          created_at?: string
          event_type?: string
          from_state?: string | null
          id?: string
          org_id?: string
          payload?: Json
          subscription_id?: string
          to_state?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "subscription_events_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "subscription_events_subscription_id_fkey"
            columns: ["subscription_id"]
            isOneToOne: false
            referencedRelation: "subscriptions"
            referencedColumns: ["id"]
          },
        ]
      }
      subscriptions: {
        Row: {
          cancel_at: string | null
          canceled_at: string | null
          collection_method: string
          created_at: string
          current_period_end: string | null
          current_period_start: string
          dunning_policy_id: string | null
          dunning_stage: number
          grace_period_ends_at: string | null
          id: string
          last_billing_at: string | null
          meta: Json
          next_billing_at: string | null
          org_id: string
          payment_method_id: string | null
          plan_id: string
          quantity: number
          status: string
          trial_ends_at: string | null
          updated_at: string
        }
        Insert: {
          cancel_at?: string | null
          canceled_at?: string | null
          collection_method?: string
          created_at?: string
          current_period_end?: string | null
          current_period_start?: string
          dunning_policy_id?: string | null
          dunning_stage?: number
          grace_period_ends_at?: string | null
          id?: string
          last_billing_at?: string | null
          meta?: Json
          next_billing_at?: string | null
          org_id: string
          payment_method_id?: string | null
          plan_id: string
          quantity?: number
          status?: string
          trial_ends_at?: string | null
          updated_at?: string
        }
        Update: {
          cancel_at?: string | null
          canceled_at?: string | null
          collection_method?: string
          created_at?: string
          current_period_end?: string | null
          current_period_start?: string
          dunning_policy_id?: string | null
          dunning_stage?: number
          grace_period_ends_at?: string | null
          id?: string
          last_billing_at?: string | null
          meta?: Json
          next_billing_at?: string | null
          org_id?: string
          payment_method_id?: string | null
          plan_id?: string
          quantity?: number
          status?: string
          trial_ends_at?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "subscriptions_dunning_policy_fk"
            columns: ["dunning_policy_id"]
            isOneToOne: false
            referencedRelation: "dunning_policies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "subscriptions_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "subscriptions_payment_method_id_fkey"
            columns: ["payment_method_id"]
            isOneToOne: false
            referencedRelation: "payment_methods"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "subscriptions_plan_id_fkey"
            columns: ["plan_id"]
            isOneToOne: false
            referencedRelation: "billing_plans"
            referencedColumns: ["id"]
          },
        ]
      }
      system_health_snapshots: {
        Row: {
          active_sessions: number | null
          api_latency_ms: number | null
          db_ok: boolean
          failed_jobs: number | null
          id: string
          meta: Json
          taken_at: string
        }
        Insert: {
          active_sessions?: number | null
          api_latency_ms?: number | null
          db_ok: boolean
          failed_jobs?: number | null
          id?: string
          meta?: Json
          taken_at?: string
        }
        Update: {
          active_sessions?: number | null
          api_latency_ms?: number | null
          db_ok?: boolean
          failed_jobs?: number | null
          id?: string
          meta?: Json
          taken_at?: string
        }
        Relationships: []
      }
      tax_rules: {
        Row: {
          country: string
          created_at: string
          id: string
          inclusive: boolean
          kind: string
          rate_bps: number
          region: string | null
          updated_at: string
        }
        Insert: {
          country: string
          created_at?: string
          id?: string
          inclusive?: boolean
          kind?: string
          rate_bps: number
          region?: string | null
          updated_at?: string
        }
        Update: {
          country?: string
          created_at?: string
          id?: string
          inclusive?: boolean
          kind?: string
          rate_bps?: number
          region?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      usage_daily: {
        Row: {
          day: string
          metric: string
          org_id: string
          quantity: number
        }
        Insert: {
          day: string
          metric: string
          org_id: string
          quantity?: number
        }
        Update: {
          day?: string
          metric?: string
          org_id?: string
          quantity?: number
        }
        Relationships: [
          {
            foreignKeyName: "usage_daily_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      usage_events: {
        Row: {
          created_at: string
          dedupe_key: string | null
          id: string
          meta: Json
          metric: string
          occurred_at: string
          org_id: string
          quantity: number
          source: string | null
        }
        Insert: {
          created_at?: string
          dedupe_key?: string | null
          id?: string
          meta?: Json
          metric: string
          occurred_at?: string
          org_id: string
          quantity?: number
          source?: string | null
        }
        Update: {
          created_at?: string
          dedupe_key?: string | null
          id?: string
          meta?: Json
          metric?: string
          occurred_at?: string
          org_id?: string
          quantity?: number
          source?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "usage_events_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      usage_meter_readings: {
        Row: {
          created_at: string
          id: string
          meta: Json
          meter_id: string
          org_id: string
          period_end: string
          period_start: string
          subscription_id: string | null
          value: number
        }
        Insert: {
          created_at?: string
          id?: string
          meta?: Json
          meter_id: string
          org_id: string
          period_end: string
          period_start: string
          subscription_id?: string | null
          value?: number
        }
        Update: {
          created_at?: string
          id?: string
          meta?: Json
          meter_id?: string
          org_id?: string
          period_end?: string
          period_start?: string
          subscription_id?: string | null
          value?: number
        }
        Relationships: [
          {
            foreignKeyName: "usage_meter_readings_meter_id_fkey"
            columns: ["meter_id"]
            isOneToOne: false
            referencedRelation: "usage_meters"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "usage_meter_readings_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "usage_meter_readings_subscription_id_fkey"
            columns: ["subscription_id"]
            isOneToOne: false
            referencedRelation: "subscriptions"
            referencedColumns: ["id"]
          },
        ]
      }
      usage_meters: {
        Row: {
          aggregation: string
          code: string
          created_at: string
          description: string | null
          id: string
          name: string
          unit: string
        }
        Insert: {
          aggregation?: string
          code: string
          created_at?: string
          description?: string | null
          id?: string
          name: string
          unit: string
        }
        Update: {
          aggregation?: string
          code?: string
          created_at?: string
          description?: string | null
          id?: string
          name?: string
          unit?: string
        }
        Relationships: []
      }
      user_devices: {
        Row: {
          app_version: string | null
          blocked_at: string | null
          bound_at: string
          browser: string | null
          country: string | null
          device_id: string
          device_name: string | null
          device_type: string | null
          first_login_at: string | null
          id: string
          ip: string | null
          last_activity_at: string | null
          last_seen: string
          name: string | null
          os: string | null
          region: string | null
          trusted_at: string | null
          user_id: string
        }
        Insert: {
          app_version?: string | null
          blocked_at?: string | null
          bound_at?: string
          browser?: string | null
          country?: string | null
          device_id: string
          device_name?: string | null
          device_type?: string | null
          first_login_at?: string | null
          id?: string
          ip?: string | null
          last_activity_at?: string | null
          last_seen?: string
          name?: string | null
          os?: string | null
          region?: string | null
          trusted_at?: string | null
          user_id: string
        }
        Update: {
          app_version?: string | null
          blocked_at?: string | null
          bound_at?: string
          browser?: string | null
          country?: string | null
          device_id?: string
          device_name?: string | null
          device_type?: string | null
          first_login_at?: string | null
          id?: string
          ip?: string | null
          last_activity_at?: string | null
          last_seen?: string
          name?: string | null
          os?: string | null
          region?: string | null
          trusted_at?: string | null
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
      user_sessions: {
        Row: {
          country: string | null
          created_at: string
          device_id: string | null
          id: string
          ip: string | null
          last_seen: string
          revoked_at: string | null
          revoked_by: string | null
          revoked_reason: string | null
          user_agent: string | null
          user_id: string
        }
        Insert: {
          country?: string | null
          created_at?: string
          device_id?: string | null
          id?: string
          ip?: string | null
          last_seen?: string
          revoked_at?: string | null
          revoked_by?: string | null
          revoked_reason?: string | null
          user_agent?: string | null
          user_id: string
        }
        Update: {
          country?: string | null
          created_at?: string
          device_id?: string | null
          id?: string
          ip?: string | null
          last_seen?: string
          revoked_at?: string | null
          revoked_by?: string | null
          revoked_reason?: string | null
          user_agent?: string | null
          user_id?: string
        }
        Relationships: []
      }
      wallet_ledger: {
        Row: {
          actor_id: string | null
          balance_after_cents: number
          created_at: string
          currency: string
          delta_cents: number
          id: string
          kind: string
          memo: string | null
          org_id: string
          ref_id: string | null
          ref_type: string | null
        }
        Insert: {
          actor_id?: string | null
          balance_after_cents: number
          created_at?: string
          currency?: string
          delta_cents: number
          id?: string
          kind: string
          memo?: string | null
          org_id: string
          ref_id?: string | null
          ref_type?: string | null
        }
        Update: {
          actor_id?: string | null
          balance_after_cents?: number
          created_at?: string
          currency?: string
          delta_cents?: number
          id?: string
          kind?: string
          memo?: string | null
          org_id?: string
          ref_id?: string | null
          ref_type?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "wallet_ledger_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      wallet_reservations: {
        Row: {
          amount_cents: number
          created_at: string
          currency: string
          id: string
          memo: string | null
          org_id: string
          ref_id: string
          ref_type: string
          status: string
          updated_at: string
        }
        Insert: {
          amount_cents: number
          created_at?: string
          currency?: string
          id?: string
          memo?: string | null
          org_id: string
          ref_id: string
          ref_type: string
          status?: string
          updated_at?: string
        }
        Update: {
          amount_cents?: number
          created_at?: string
          currency?: string
          id?: string
          memo?: string | null
          org_id?: string
          ref_id?: string
          ref_type?: string
          status?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "wallet_reservations_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      webhook_deliveries: {
        Row: {
          attempt: number
          correlation_id: string | null
          created_at: string
          dead: boolean
          delivered_at: string | null
          endpoint_id: string
          event_id: string
          id: string
          last_error: string | null
          next_attempt_at: string | null
          request_body: string | null
          request_headers: Json
          response_body: string | null
          response_headers: Json
          response_status: number | null
          status: string
          updated_at: string
        }
        Insert: {
          attempt?: number
          correlation_id?: string | null
          created_at?: string
          dead?: boolean
          delivered_at?: string | null
          endpoint_id: string
          event_id: string
          id?: string
          last_error?: string | null
          next_attempt_at?: string | null
          request_body?: string | null
          request_headers?: Json
          response_body?: string | null
          response_headers?: Json
          response_status?: number | null
          status?: string
          updated_at?: string
        }
        Update: {
          attempt?: number
          correlation_id?: string | null
          created_at?: string
          dead?: boolean
          delivered_at?: string | null
          endpoint_id?: string
          event_id?: string
          id?: string
          last_error?: string | null
          next_attempt_at?: string | null
          request_body?: string | null
          request_headers?: Json
          response_body?: string | null
          response_headers?: Json
          response_status?: number | null
          status?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "webhook_deliveries_endpoint_id_fkey"
            columns: ["endpoint_id"]
            isOneToOne: false
            referencedRelation: "webhook_endpoints"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "webhook_deliveries_event_id_fkey"
            columns: ["event_id"]
            isOneToOne: false
            referencedRelation: "webhook_events"
            referencedColumns: ["id"]
          },
        ]
      }
      webhook_endpoints: {
        Row: {
          active: boolean
          created_at: string
          created_by: string | null
          description: string | null
          events: string[]
          id: string
          org_id: string
          secret: string
          updated_at: string
          url: string
        }
        Insert: {
          active?: boolean
          created_at?: string
          created_by?: string | null
          description?: string | null
          events?: string[]
          id?: string
          org_id: string
          secret: string
          updated_at?: string
          url: string
        }
        Update: {
          active?: boolean
          created_at?: string
          created_by?: string | null
          description?: string | null
          events?: string[]
          id?: string
          org_id?: string
          secret?: string
          updated_at?: string
          url?: string
        }
        Relationships: [
          {
            foreignKeyName: "webhook_endpoints_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      webhook_events: {
        Row: {
          created_at: string
          id: string
          kind: string
          org_id: string | null
          payload: Json
        }
        Insert: {
          created_at?: string
          id?: string
          kind: string
          org_id?: string | null
          payload?: Json
        }
        Update: {
          created_at?: string
          id?: string
          kind?: string
          org_id?: string | null
          payload?: Json
        }
        Relationships: [
          {
            foreignKeyName: "webhook_events_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      billing_metrics_recent: {
        Row: {
          avg_retry_7d: number | null
          failed_24h: number | null
          failed_7d: number | null
          org_id: string | null
          renewed_24h: number | null
          renewed_7d: number | null
          success_rate_24h: number | null
          success_rate_7d: number | null
        }
        Relationships: [
          {
            foreignKeyName: "subscription_events_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Functions: {
      can_org_read: { Args: { _org: string; _user: string }; Returns: boolean }
      has_any_role: {
        Args: { _roles: string[]; _user_id: string }
        Returns: boolean
      }
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
      is_admin: { Args: { _user_id: string }; Returns: boolean }
      is_org_member: { Args: { _org: string; _user: string }; Returns: boolean }
      is_staff: { Args: { _user_id: string }; Returns: boolean }
      next_doc_number: {
        Args: {
          _branch: string
          _doc_type: string
          _fiscal_year: number
          _org: string
        }
        Returns: number
      }
      org_ancestors: { Args: { _org: string }; Returns: string[] }
      org_wallet_balances: {
        Args: { _org: string }
        Returns: {
          available_cents: number
          ledger_cents: number
          reserved_cents: number
        }[]
      }
      try_billing_lock: {
        Args: { _key: string; _scope: string }
        Returns: boolean
      }
    }
    Enums: {
      account_status: "active" | "suspended" | "expired" | "disabled" | "locked"
      app_role:
        | "super_admin"
        | "admin"
        | "moderator"
        | "support"
        | "auditor"
        | "readonly"
        | "reseller_owner"
        | "reseller_staff"
        | "billing_admin"
        | "api_client"
      license_status: "active" | "expired" | "revoked" | "pending"
      license_type: "trial" | "paid" | "lifetime" | "comp"
      package_tier:
        | "trial"
        | "monthly"
        | "quarterly"
        | "semi_annual"
        | "annual"
        | "lifetime"
        | "custom"
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
      account_status: ["active", "suspended", "expired", "disabled", "locked"],
      app_role: [
        "super_admin",
        "admin",
        "moderator",
        "support",
        "auditor",
        "readonly",
        "reseller_owner",
        "reseller_staff",
        "billing_admin",
        "api_client",
      ],
      license_status: ["active", "expired", "revoked", "pending"],
      license_type: ["trial", "paid", "lifetime", "comp"],
      package_tier: [
        "trial",
        "monthly",
        "quarterly",
        "semi_annual",
        "annual",
        "lifetime",
        "custom",
      ],
    },
  },
} as const
