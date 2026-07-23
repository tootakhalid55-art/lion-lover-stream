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
      audit_logs: {
        Row: {
          action: string
          actor_id: string | null
          created_at: string
          id: string
          ip: string | null
          meta: Json | null
          target_user_id: string | null
        }
        Insert: {
          action: string
          actor_id?: string | null
          created_at?: string
          id?: string
          ip?: string | null
          meta?: Json | null
          target_user_id?: string | null
        }
        Update: {
          action?: string
          actor_id?: string | null
          created_at?: string
          id?: string
          ip?: string | null
          meta?: Json | null
          target_user_id?: string | null
        }
        Relationships: []
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
          last_seen: string
          name: string | null
          os: string | null
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
          last_seen?: string
          name?: string | null
          os?: string | null
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
          last_seen?: string
          name?: string | null
          os?: string | null
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
          user_agent?: string | null
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
      is_admin: { Args: { _user_id: string }; Returns: boolean }
      is_staff: { Args: { _user_id: string }; Returns: boolean }
    }
    Enums: {
      account_status: "active" | "suspended" | "expired" | "disabled" | "locked"
      app_role: "super_admin" | "admin" | "moderator"
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
      app_role: ["super_admin", "admin", "moderator"],
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
