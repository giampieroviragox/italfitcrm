export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[];

export type Database = {
  // Allows to automatically instantiate createClient with right options
  // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
  __InternalSupabase: {
    PostgrestVersion: "14.18";
  };
  public: {
    Tables: {
      crm_access: {
        Row: {
          accepted_at: string | null;
          active: boolean;
          invited_at: string;
          record_id: string;
          role: string;
          user_id: string;
        };
        Insert: {
          accepted_at?: string | null;
          active?: boolean;
          invited_at?: string;
          record_id: string;
          role: string;
          user_id: string;
        };
        Update: {
          accepted_at?: string | null;
          active?: boolean;
          invited_at?: string;
          record_id?: string;
          role?: string;
          user_id?: string;
        };
        Relationships: [];
      };
      crm_activities: {
        Row: {
          id: string;
          payload: Json;
          student_id: string;
        };
        Insert: {
          id: string;
          payload: Json;
          student_id: string;
        };
        Update: {
          id?: string;
          payload?: Json;
          student_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "crm_activities_student_id_fkey";
            columns: ["student_id"];
            isOneToOne: false;
            referencedRelation: "crm_students";
            referencedColumns: ["id"];
          },
        ];
      };
      crm_admins: {
        Row: {
          id: string;
          payload: Json;
        };
        Insert: {
          id: string;
          payload: Json;
        };
        Update: {
          id?: string;
          payload?: Json;
        };
        Relationships: [];
      };
      crm_assignments: {
        Row: {
          id: string;
          month: string;
          payload: Json;
          plan_id: string;
          student_id: string;
        };
        Insert: {
          id: string;
          month?: string;
          payload: Json;
          plan_id?: string;
          student_id?: string;
        };
        Update: {
          id?: string;
          month?: string;
          payload?: Json;
          plan_id?: string;
          student_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "crm_assignments_plan_id_fkey";
            columns: ["plan_id"];
            isOneToOne: false;
            referencedRelation: "crm_plans";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "crm_assignments_student_id_fkey";
            columns: ["student_id"];
            isOneToOne: false;
            referencedRelation: "crm_students";
            referencedColumns: ["id"];
          },
        ];
      };
      crm_bookings: {
        Row: {
          id: string;
          lesson_id: string;
          payload: Json;
          student_id: string;
        };
        Insert: {
          id: string;
          lesson_id?: string;
          payload: Json;
          student_id?: string;
        };
        Update: {
          id?: string;
          lesson_id?: string;
          payload?: Json;
          student_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "crm_bookings_lesson_id_fkey";
            columns: ["lesson_id"];
            isOneToOne: false;
            referencedRelation: "crm_lessons";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "crm_bookings_student_id_fkey";
            columns: ["student_id"];
            isOneToOne: false;
            referencedRelation: "crm_students";
            referencedColumns: ["id"];
          },
        ];
      };
      crm_lessons: {
        Row: {
          id: string;
          payload: Json;
        };
        Insert: {
          id: string;
          payload: Json;
        };
        Update: {
          id?: string;
          payload?: Json;
        };
        Relationships: [];
      };
      crm_meta: {
        Row: {
          id: number;
          revision: number;
          updated_at: string;
        };
        Insert: {
          id: number;
          revision?: number;
          updated_at?: string;
        };
        Update: {
          id?: number;
          revision?: number;
          updated_at?: string;
        };
        Relationships: [];
      };
      crm_notes: {
        Row: {
          id: string;
          payload: Json;
          student_id: string;
        };
        Insert: {
          id: string;
          payload: Json;
          student_id: string;
        };
        Update: {
          id?: string;
          payload?: Json;
          student_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "crm_notes_student_id_fkey";
            columns: ["student_id"];
            isOneToOne: false;
            referencedRelation: "crm_students";
            referencedColumns: ["id"];
          },
        ];
      };
      crm_plans: {
        Row: {
          id: string;
          payload: Json;
        };
        Insert: {
          id: string;
          payload: Json;
        };
        Update: {
          id?: string;
          payload?: Json;
        };
        Relationships: [];
      };
      crm_preferences: {
        Row: {
          payload: Json;
          user_id: string;
        };
        Insert: {
          payload?: Json;
          user_id: string;
        };
        Update: {
          payload?: Json;
          user_id?: string;
        };
        Relationships: [];
      };
      crm_properties: {
        Row: {
          id: string;
          payload: Json;
        };
        Insert: {
          id: string;
          payload: Json;
        };
        Update: {
          id?: string;
          payload?: Json;
        };
        Relationships: [];
      };
      crm_property_values: {
        Row: {
          property_id: string;
          student_id: string;
          value: Json;
        };
        Insert: {
          property_id: string;
          student_id: string;
          value: Json;
        };
        Update: {
          property_id?: string;
          student_id?: string;
          value?: Json;
        };
        Relationships: [
          {
            foreignKeyName: "crm_property_values_property_id_fkey";
            columns: ["property_id"];
            isOneToOne: false;
            referencedRelation: "crm_properties";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "crm_property_values_student_id_fkey";
            columns: ["student_id"];
            isOneToOne: false;
            referencedRelation: "crm_students";
            referencedColumns: ["id"];
          },
        ];
      };
      crm_students: {
        Row: {
          email: string;
          id: string;
          payload: Json;
          tier_id: string;
        };
        Insert: {
          email?: string;
          id: string;
          payload: Json;
          tier_id?: string;
        };
        Update: {
          email?: string;
          id?: string;
          payload?: Json;
          tier_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "crm_students_tier_id_fkey";
            columns: ["tier_id"];
            isOneToOne: false;
            referencedRelation: "crm_tiers";
            referencedColumns: ["id"];
          },
        ];
      };
      crm_tiers: {
        Row: {
          id: string;
          payload: Json;
        };
        Insert: {
          id: string;
          payload: Json;
        };
        Update: {
          id?: string;
          payload?: Json;
        };
        Relationships: [];
      };
    };
    Views: {
      [_ in never]: never;
    };
    Functions: {
      crm_link_access: {
        Args: {
          p_actor: string;
          p_email: string;
          p_record: string;
          p_role: string;
          p_user: string;
        };
        Returns: Json;
      };
      crm_read: { Args: { p_actor: string }; Returns: Json };
      crm_write: {
        Args: { p_actor: string; p_expected: number; p_state: Json };
        Returns: Json;
      };
    };
    Enums: {
      [_ in never]: never;
    };
    CompositeTypes: {
      [_ in never]: never;
    };
  };
};

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">;

type DefaultSchema = DatabaseWithoutInternals[Extract<
  keyof Database,
  "public"
>];

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals;
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R;
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] &
        DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] &
        DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R;
      }
      ? R
      : never
    : never;

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    keyof DefaultSchema["Tables"] | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals;
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I;
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I;
      }
      ? I
      : never
    : never;

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    keyof DefaultSchema["Tables"] | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals;
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U;
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U;
      }
      ? U
      : never
    : never;

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    keyof DefaultSchema["Enums"] | { schema: keyof DatabaseWithoutInternals },
  EnumName extends (DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never) = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals;
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never;

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends (PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never) = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals;
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never;

export const Constants = {
  public: {
    Enums: {},
  },
} as const;
