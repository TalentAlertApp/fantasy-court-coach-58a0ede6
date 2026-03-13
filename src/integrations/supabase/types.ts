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
      games: {
        Row: {
          away_pts: number | null
          away_team: string | null
          away_team_abbr: string | null
          balldontlie_game_id: number | null
          date_utc: string | null
          game_date: string | null
          game_id: string
          home_pts: number | null
          home_team: string | null
          home_team_abbr: string | null
          nba_game_url: string | null
          season: number | null
          status: string
          updated_at: string
        }
        Insert: {
          away_pts?: number | null
          away_team?: string | null
          away_team_abbr?: string | null
          balldontlie_game_id?: number | null
          date_utc?: string | null
          game_date?: string | null
          game_id: string
          home_pts?: number | null
          home_team?: string | null
          home_team_abbr?: string | null
          nba_game_url?: string | null
          season?: number | null
          status?: string
          updated_at?: string
        }
        Update: {
          away_pts?: number | null
          away_team?: string | null
          away_team_abbr?: string | null
          balldontlie_game_id?: number | null
          date_utc?: string | null
          game_date?: string | null
          game_id?: string
          home_pts?: number | null
          home_team?: string | null
          home_team_abbr?: string | null
          nba_game_url?: string | null
          season?: number | null
          status?: string
          updated_at?: string
        }
        Relationships: []
      }
      player_game_logs: {
        Row: {
          ast: number
          balldontlie_game_id: number | null
          blk: number
          created_at: string
          fp: number
          game_date: string | null
          game_id: string
          home_away: string | null
          id: string
          matchup: string | null
          mp: number
          nba_game_url: string | null
          opp: string | null
          player_id: number
          pts: number
          reb: number
          stl: number
          updated_at: string
        }
        Insert: {
          ast?: number
          balldontlie_game_id?: number | null
          blk?: number
          created_at?: string
          fp?: number
          game_date?: string | null
          game_id: string
          home_away?: string | null
          id?: string
          matchup?: string | null
          mp?: number
          nba_game_url?: string | null
          opp?: string | null
          player_id: number
          pts?: number
          reb?: number
          stl?: number
          updated_at?: string
        }
        Update: {
          ast?: number
          balldontlie_game_id?: number | null
          blk?: number
          created_at?: string
          fp?: number
          game_date?: string | null
          game_id?: string
          home_away?: string | null
          id?: string
          matchup?: string | null
          mp?: number
          nba_game_url?: string | null
          opp?: string | null
          player_id?: number
          pts?: number
          reb?: number
          stl?: number
          updated_at?: string
        }
        Relationships: []
      }
      player_last_game: {
        Row: {
          a_pts: number
          ast: number
          blk: number
          fp: number
          game_date: string | null
          game_recap_url: string | null
          game_boxscore_url: string | null
          game_charts_url: string | null
          game_playbyplay_url: string | null
          h_pts: number
          home_away: string | null
          id: string
          mp: number
          nba_game_url: string | null
          opp: string | null
          player_id: number
          pts: number
          reb: number
          result: string | null
          stl: number
          updated_at: string
        }
        Insert: {
          a_pts?: number
          ast?: number
          blk?: number
          fp?: number
          game_date?: string | null
          game_recap_url?: string | null
          game_boxscore_url?: string | null
          game_charts_url?: string | null
          game_playbyplay_url?: string | null
          h_pts?: number
          home_away?: string | null
          id?: string
          mp?: number
          nba_game_url?: string | null
          opp?: string | null
          player_id: number
          pts?: number
          reb?: number
          result?: string | null
          stl?: number
          updated_at?: string
        }
        Update: {
          a_pts?: number
          ast?: number
          blk?: number
          fp?: number
          game_date?: string | null
          game_recap_url?: string | null
          game_boxscore_url?: string | null
          game_charts_url?: string | null
          game_playbyplay_url?: string | null
          h_pts?: number
          home_away?: string | null
          id?: string
          mp?: number
          nba_game_url?: string | null
          opp?: string | null
          player_id?: number
          pts?: number
          reb?: number
          result?: string | null
          stl?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "player_last_game_player_id_fkey"
            columns: ["player_id"]
            isOneToOne: true
            referencedRelation: "players"
            referencedColumns: ["id"]
          },
        ]
      }
      players: {
        Row: {
          age: number
          ast: number
          ast5: number
          blk: number
          blk5: number
          college: string | null
          delta_fp: number
          delta_mpg: number
          dob: string | null
          exp: number
          fc_bc: string
          fp_pg_t: number
          fp_pg5: number
          gp: number
          height: string | null
          id: number
          injury: string | null
          jersey: number
          mpg: number
          mpg5: number
          name: string
          note: string | null
          photo: string | null
          pos: string | null
          pts: number
          pts5: number
          reb: number
          reb5: number
          salary: number
          stl: number
          stl5: number
          stocks: number
          stocks5: number
          team: string
          updated_at: string
          value_t: number
          value5: number
          weight: number
        }
        Insert: {
          age?: number
          ast?: number
          ast5?: number
          blk?: number
          blk5?: number
          college?: string | null
          delta_fp?: number
          delta_mpg?: number
          dob?: string | null
          exp?: number
          fc_bc: string
          fp_pg_t?: number
          fp_pg5?: number
          gp?: number
          height?: string | null
          id: number
          injury?: string | null
          jersey?: number
          mpg?: number
          mpg5?: number
          name: string
          note?: string | null
          photo?: string | null
          pos?: string | null
          pts?: number
          pts5?: number
          reb?: number
          reb5?: number
          salary?: number
          stl?: number
          stl5?: number
          stocks?: number
          stocks5?: number
          team: string
          updated_at?: string
          value_t?: number
          value5?: number
          weight?: number
        }
        Update: {
          age?: number
          ast?: number
          ast5?: number
          blk?: number
          blk5?: number
          college?: string | null
          delta_fp?: number
          delta_mpg?: number
          dob?: string | null
          exp?: number
          fc_bc?: string
          fp_pg_t?: number
          fp_pg5?: number
          gp?: number
          height?: string | null
          id?: number
          injury?: string | null
          jersey?: number
          mpg?: number
          mpg5?: number
          name?: string
          note?: string | null
          photo?: string | null
          pos?: string | null
          pts?: number
          pts5?: number
          reb?: number
          reb5?: number
          salary?: number
          stl?: number
          stl5?: number
          stocks?: number
          stocks5?: number
          team?: string
          updated_at?: string
          value_t?: number
          value5?: number
          weight?: number
        }
        Relationships: []
      }
      roster: {
        Row: {
          created_at: string
          day: number
          gw: number
          id: string
          is_captain: boolean
          player_id: number
          slot: string
          team_id: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          day?: number
          gw?: number
          id?: string
          is_captain?: boolean
          player_id: number
          slot: string
          team_id: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          day?: number
          gw?: number
          id?: string
          is_captain?: boolean
          player_id?: number
          slot?: string
          team_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "roster_player_id_fkey"
            columns: ["player_id"]
            isOneToOne: false
            referencedRelation: "players"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "roster_team_id_fkey"
            columns: ["team_id"]
            isOneToOne: false
            referencedRelation: "teams"
            referencedColumns: ["id"]
          },
        ]
      }
      schedule_games: {
        Row: {
          away_pts: number
          away_team: string
          day: number
          game_id: string
          gw: number
          home_pts: number
          home_team: string
          nba_game_url: string | null
          status: string
          tipoff_utc: string | null
        }
        Insert: {
          away_pts?: number
          away_team: string
          day?: number
          game_id: string
          gw?: number
          home_pts?: number
          home_team: string
          nba_game_url?: string | null
          status?: string
          tipoff_utc?: string | null
        }
        Update: {
          away_pts?: number
          away_team?: string
          day?: number
          game_id?: string
          gw?: number
          home_pts?: number
          home_team?: string
          nba_game_url?: string | null
          status?: string
          tipoff_utc?: string | null
        }
        Relationships: []
      }
      sync_runs: {
        Row: {
          created_at: string
          details: Json | null
          finished_at: string | null
          id: string
          started_at: string
          status: string
          type: string
        }
        Insert: {
          created_at?: string
          details?: Json | null
          finished_at?: string | null
          id?: string
          started_at?: string
          status?: string
          type: string
        }
        Update: {
          created_at?: string
          details?: Json | null
          finished_at?: string | null
          id?: string
          started_at?: string
          status?: string
          type?: string
        }
        Relationships: []
      }
      team_settings: {
        Row: {
          created_at: string
          salary_cap: number | null
          starter_bc_min: number | null
          starter_fc_min: number | null
          team_id: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          salary_cap?: number | null
          starter_bc_min?: number | null
          starter_fc_min?: number | null
          team_id: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          salary_cap?: number | null
          starter_bc_min?: number | null
          starter_fc_min?: number | null
          team_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "team_settings_team_id_fkey"
            columns: ["team_id"]
            isOneToOne: true
            referencedRelation: "teams"
            referencedColumns: ["id"]
          },
        ]
      }
      teams: {
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
      transactions: {
        Row: {
          cost_points: number
          created_at: string
          id: string
          notes: string | null
          player_in_id: number
          player_out_id: number
          team_id: string
          type: string
        }
        Insert: {
          cost_points?: number
          created_at?: string
          id?: string
          notes?: string | null
          player_in_id?: number
          player_out_id?: number
          team_id: string
          type: string
        }
        Update: {
          cost_points?: number
          created_at?: string
          id?: string
          notes?: string | null
          player_in_id?: number
          player_out_id?: number
          team_id?: string
          type?: string
        }
        Relationships: [
          {
            foreignKeyName: "transactions_team_id_fkey"
            columns: ["team_id"]
            isOneToOne: false
            referencedRelation: "teams"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      [_ in never]: never
    }
    Enums: {
      [_ in never]: never
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
    Enums: {},
  },
} as const
