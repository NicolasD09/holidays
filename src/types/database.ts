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
      availabilities: {
        Row: {
          category_id: string
          day: string
          id: string
          participant_id: string
          status: Database["public"]["Enums"]["availability_status"]
          trip_id: string
          updated_at: string
        }
        Insert: {
          category_id: string
          day: string
          id?: string
          participant_id: string
          status: Database["public"]["Enums"]["availability_status"]
          trip_id: string
          updated_at?: string
        }
        Update: {
          category_id?: string
          day?: string
          id?: string
          participant_id?: string
          status?: Database["public"]["Enums"]["availability_status"]
          trip_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "availabilities_category_id_fkey"
            columns: ["category_id"]
            isOneToOne: false
            referencedRelation: "categories"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "availabilities_participant_id_fkey"
            columns: ["participant_id"]
            isOneToOne: false
            referencedRelation: "participants"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "availabilities_trip_id_fkey"
            columns: ["trip_id"]
            isOneToOne: false
            referencedRelation: "trips"
            referencedColumns: ["id"]
          },
        ]
      }
      categories: {
        Row: {
          allow_participant_options: boolean
          created_at: string
          currency: string
          description: string | null
          id: string
          kind: Database["public"]["Enums"]["category_kind"]
          label: string
          max_choices: number | null
          nights: number | null
          position: number
          status: Database["public"]["Enums"]["category_status"]
          trip_id: string
          vote_mode: Database["public"]["Enums"]["vote_mode"]
          window_end: string | null
          window_start: string | null
        }
        Insert: {
          allow_participant_options?: boolean
          created_at?: string
          currency?: string
          description?: string | null
          id?: string
          kind: Database["public"]["Enums"]["category_kind"]
          label: string
          max_choices?: number | null
          nights?: number | null
          position?: number
          status?: Database["public"]["Enums"]["category_status"]
          trip_id: string
          vote_mode: Database["public"]["Enums"]["vote_mode"]
          window_end?: string | null
          window_start?: string | null
        }
        Update: {
          allow_participant_options?: boolean
          created_at?: string
          currency?: string
          description?: string | null
          id?: string
          kind?: Database["public"]["Enums"]["category_kind"]
          label?: string
          max_choices?: number | null
          nights?: number | null
          position?: number
          status?: Database["public"]["Enums"]["category_status"]
          trip_id?: string
          vote_mode?: Database["public"]["Enums"]["vote_mode"]
          window_end?: string | null
          window_start?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "categories_trip_id_fkey"
            columns: ["trip_id"]
            isOneToOne: false
            referencedRelation: "trips"
            referencedColumns: ["id"]
          },
        ]
      }
      options: {
        Row: {
          category_id: string
          created_at: string
          created_by: string | null
          description: string | null
          id: string
          image_url: string | null
          meta: Json
          position: number
          title: string
          trip_id: string
          url: string | null
        }
        Insert: {
          category_id: string
          created_at?: string
          created_by?: string | null
          description?: string | null
          id?: string
          image_url?: string | null
          meta?: Json
          position?: number
          title: string
          trip_id: string
          url?: string | null
        }
        Update: {
          category_id?: string
          created_at?: string
          created_by?: string | null
          description?: string | null
          id?: string
          image_url?: string | null
          meta?: Json
          position?: number
          title?: string
          trip_id?: string
          url?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "options_category_id_fkey"
            columns: ["category_id"]
            isOneToOne: false
            referencedRelation: "categories"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "options_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "participants"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "options_trip_id_fkey"
            columns: ["trip_id"]
            isOneToOne: false
            referencedRelation: "trips"
            referencedColumns: ["id"]
          },
        ]
      }
      participants: {
        Row: {
          auth_uid: string | null
          avatar_color: string | null
          avatar_emoji: string | null
          created_at: string
          display_name: string
          id: string
          is_organizer: boolean
          last_seen_at: string
          trip_id: string
        }
        Insert: {
          auth_uid?: string | null
          avatar_color?: string | null
          avatar_emoji?: string | null
          created_at?: string
          display_name: string
          id?: string
          is_organizer?: boolean
          last_seen_at?: string
          trip_id: string
        }
        Update: {
          auth_uid?: string | null
          avatar_color?: string | null
          avatar_emoji?: string | null
          created_at?: string
          display_name?: string
          id?: string
          is_organizer?: boolean
          last_seen_at?: string
          trip_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "participants_trip_id_fkey"
            columns: ["trip_id"]
            isOneToOne: false
            referencedRelation: "trips"
            referencedColumns: ["id"]
          },
        ]
      }
      trips: {
        Row: {
          blind_mode: boolean
          cover_emoji: string | null
          created_at: string
          description: string | null
          id: string
          last_activity_at: string
          slug: string
          status: Database["public"]["Enums"]["trip_status"]
          title: string
          updated_at: string
        }
        Insert: {
          blind_mode?: boolean
          cover_emoji?: string | null
          created_at?: string
          description?: string | null
          id?: string
          last_activity_at?: string
          slug: string
          status?: Database["public"]["Enums"]["trip_status"]
          title: string
          updated_at?: string
        }
        Update: {
          blind_mode?: boolean
          cover_emoji?: string | null
          created_at?: string
          description?: string | null
          id?: string
          last_activity_at?: string
          slug?: string
          status?: Database["public"]["Enums"]["trip_status"]
          title?: string
          updated_at?: string
        }
        Relationships: []
      }
      votes: {
        Row: {
          category_id: string
          created_at: string
          id: string
          option_id: string
          participant_id: string
          trip_id: string
          updated_at: string
          value: number
        }
        Insert: {
          category_id: string
          created_at?: string
          id?: string
          option_id: string
          participant_id: string
          trip_id: string
          updated_at?: string
          value: number
        }
        Update: {
          category_id?: string
          created_at?: string
          id?: string
          option_id?: string
          participant_id?: string
          trip_id?: string
          updated_at?: string
          value?: number
        }
        Relationships: [
          {
            foreignKeyName: "votes_category_id_fkey"
            columns: ["category_id"]
            isOneToOne: false
            referencedRelation: "categories"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "votes_option_id_fkey"
            columns: ["option_id"]
            isOneToOne: false
            referencedRelation: "option_scores"
            referencedColumns: ["option_id"]
          },
          {
            foreignKeyName: "votes_option_id_fkey"
            columns: ["option_id"]
            isOneToOne: false
            referencedRelation: "options"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "votes_participant_id_fkey"
            columns: ["participant_id"]
            isOneToOne: false
            referencedRelation: "participants"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "votes_trip_id_fkey"
            columns: ["trip_id"]
            isOneToOne: false
            referencedRelation: "trips"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      option_scores: {
        Row: {
          category_id: string | null
          maybe_count: number | null
          no_count: number | null
          option_id: string | null
          score: number | null
          trip_id: string | null
          yes_count: number | null
        }
        Relationships: [
          {
            foreignKeyName: "options_category_id_fkey"
            columns: ["category_id"]
            isOneToOne: false
            referencedRelation: "categories"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "options_trip_id_fkey"
            columns: ["trip_id"]
            isOneToOne: false
            referencedRelation: "trips"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Functions: {
      app_can_see_votes: { Args: { p_category: string }; Returns: boolean }
      app_cast_vote: {
        Args: { p_option_id: string; p_value: number }
        Returns: Json
      }
      app_category_results: { Args: { p_category: string }; Returns: Json }
      app_create_trip: {
        Args: {
          p_categories?: Json
          p_display_name?: string
          p_emoji?: string
          p_title: string
        }
        Returns: Json
      }
      app_current_participant: { Args: { p_trip: string }; Returns: string }
      app_is_organizer: { Args: { p_trip: string }; Returns: boolean }
      app_is_participant: { Args: { p_trip: string }; Returns: boolean }
      app_join_trip: {
        Args: { p_display_name: string; p_slug: string }
        Returns: Json
      }
      app_retract_vote: { Args: { p_option_id: string }; Returns: undefined }
      app_set_availability: {
        Args: { p_category: string; p_days: Json }
        Returns: Json
      }
      app_slug_candidate: { Args: never; Returns: string }
      app_trip_preview: { Args: { p_slug: string }; Returns: Json }
    }
    Enums: {
      availability_status: "yes" | "maybe" | "no"
      category_kind:
        | "destination"
        | "dates"
        | "budget"
        | "lodging"
        | "activity"
        | "custom"
      category_status: "open" | "closed"
      trip_status: "draft" | "open" | "closed" | "archived"
      vote_mode: "approval" | "single" | "multiple" | "availability" | "amount"
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
      availability_status: ["yes", "maybe", "no"],
      category_kind: [
        "destination",
        "dates",
        "budget",
        "lodging",
        "activity",
        "custom",
      ],
      category_status: ["open", "closed"],
      trip_status: ["draft", "open", "closed", "archived"],
      vote_mode: ["approval", "single", "multiple", "availability", "amount"],
    },
  },
} as const
