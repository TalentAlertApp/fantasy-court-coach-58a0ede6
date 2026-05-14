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
      chip_rule_sets: {
        Row: {
          all_star_count: number
          all_star_enabled: boolean
          all_star_multiplier: number
          captain_enabled: boolean
          captain_multiplier: number
          created_at: string
          id: string
          is_template: boolean
          name: string
          owner_id: string | null
          reset_period: string
          wildcard_count: number
          wildcard_enabled: boolean
        }
        Insert: {
          all_star_count?: number
          all_star_enabled?: boolean
          all_star_multiplier?: number
          captain_enabled?: boolean
          captain_multiplier?: number
          created_at?: string
          id?: string
          is_template?: boolean
          name: string
          owner_id?: string | null
          reset_period?: string
          wildcard_count?: number
          wildcard_enabled?: boolean
        }
        Update: {
          all_star_count?: number
          all_star_enabled?: boolean
          all_star_multiplier?: number
          captain_enabled?: boolean
          captain_multiplier?: number
          created_at?: string
          id?: string
          is_template?: boolean
          name?: string
          owner_id?: string | null
          reset_period?: string
          wildcard_count?: number
          wildcard_enabled?: boolean
        }
        Relationships: []
      }
      commissioner_sync_schedules: {
        Row: {
          enabled: boolean
          include_recaps: boolean
          job_key: string
          last_error: string | null
          last_run_at: string | null
          last_status: string | null
          run_time_lisbon: string
          updated_at: string
        }
        Insert: {
          enabled?: boolean
          include_recaps?: boolean
          job_key: string
          last_error?: string | null
          last_run_at?: string | null
          last_status?: string | null
          run_time_lisbon?: string
          updated_at?: string
        }
        Update: {
          enabled?: boolean
          include_recaps?: boolean
          job_key?: string
          last_error?: string | null
          last_run_at?: string | null
          last_status?: string | null
          run_time_lisbon?: string
          updated_at?: string
        }
        Relationships: []
      }
      court_show_intelligence: {
        Row: {
          cards: Json
          day: number
          generated_at: string
          gw: number
          headline: string | null
          league_id: string
          mode: string
        }
        Insert: {
          cards?: Json
          day: number
          generated_at?: string
          gw: number
          headline?: string | null
          league_id: string
          mode: string
        }
        Update: {
          cards?: Json
          day?: number
          generated_at?: string
          gw?: number
          headline?: string | null
          league_id?: string
          mode?: string
        }
        Relationships: []
      }
      deadline_rule_sets: {
        Row: {
          created_at: string
          deadline_type: string
          fixed_time: string | null
          fixed_weekday: number | null
          id: string
          is_template: boolean
          minutes_before_game: number
          name: string
          owner_id: string | null
          timezone: string
        }
        Insert: {
          created_at?: string
          deadline_type?: string
          fixed_time?: string | null
          fixed_weekday?: number | null
          id?: string
          is_template?: boolean
          minutes_before_game?: number
          name: string
          owner_id?: string | null
          timezone?: string
        }
        Update: {
          created_at?: string
          deadline_type?: string
          fixed_time?: string | null
          fixed_weekday?: number | null
          id?: string
          is_template?: boolean
          minutes_before_game?: number
          name?: string
          owner_id?: string | null
          timezone?: string
        }
        Relationships: []
      }
      games: {
        Row: {
          away_pts: number | null
          away_team: string | null
          away_team_abbr: string | null
          balldontlie_game_id: number | null
          date_utc: string | null
          game_boxscore_url: string | null
          game_charts_url: string | null
          game_date: string | null
          game_id: string
          game_playbyplay_url: string | null
          game_recap_url: string | null
          home_pts: number | null
          home_team: string | null
          home_team_abbr: string | null
          league_id: string
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
          game_boxscore_url?: string | null
          game_charts_url?: string | null
          game_date?: string | null
          game_id: string
          game_playbyplay_url?: string | null
          game_recap_url?: string | null
          home_pts?: number | null
          home_team?: string | null
          home_team_abbr?: string | null
          league_id: string
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
          game_boxscore_url?: string | null
          game_charts_url?: string | null
          game_date?: string | null
          game_id?: string
          game_playbyplay_url?: string | null
          game_recap_url?: string | null
          home_pts?: number | null
          home_team?: string | null
          home_team_abbr?: string | null
          league_id?: string
          nba_game_url?: string | null
          season?: number | null
          status?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "games_league_fk"
            columns: ["league_id"]
            isOneToOne: false
            referencedRelation: "leagues"
            referencedColumns: ["id"]
          },
        ]
      }
      league_members: {
        Row: {
          id: string
          joined_at: string
          league_id: string
          role: string
          user_id: string
        }
        Insert: {
          id?: string
          joined_at?: string
          league_id: string
          role?: string
          user_id: string
        }
        Update: {
          id?: string
          joined_at?: string
          league_id?: string
          role?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "league_members_league_id_fkey"
            columns: ["league_id"]
            isOneToOne: false
            referencedRelation: "leagues"
            referencedColumns: ["id"]
          },
        ]
      }
      leagues: {
        Row: {
          chip_rule_set_id: string | null
          code: string
          created_at: string
          deadline_rule_set_id: string | null
          description: string | null
          id: string
          is_active: boolean
          join_code: string | null
          kind: string
          max_teams: number
          name: string
          owner_id: string | null
          roster_rule_set_id: string | null
          scoring_system_id: string
          sport: string | null
          sport_league_id: string | null
          status: string
          transfer_cap: number
          updated_at: string
          visibility: string
        }
        Insert: {
          chip_rule_set_id?: string | null
          code: string
          created_at?: string
          deadline_rule_set_id?: string | null
          description?: string | null
          id?: string
          is_active?: boolean
          join_code?: string | null
          kind?: string
          max_teams?: number
          name: string
          owner_id?: string | null
          roster_rule_set_id?: string | null
          scoring_system_id: string
          sport?: string | null
          sport_league_id?: string | null
          status?: string
          transfer_cap?: number
          updated_at?: string
          visibility?: string
        }
        Update: {
          chip_rule_set_id?: string | null
          code?: string
          created_at?: string
          deadline_rule_set_id?: string | null
          description?: string | null
          id?: string
          is_active?: boolean
          join_code?: string | null
          kind?: string
          max_teams?: number
          name?: string
          owner_id?: string | null
          roster_rule_set_id?: string | null
          scoring_system_id?: string
          sport?: string | null
          sport_league_id?: string | null
          status?: string
          transfer_cap?: number
          updated_at?: string
          visibility?: string
        }
        Relationships: [
          {
            foreignKeyName: "leagues_crs_fk"
            columns: ["chip_rule_set_id"]
            isOneToOne: false
            referencedRelation: "chip_rule_sets"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "leagues_drs_fk"
            columns: ["deadline_rule_set_id"]
            isOneToOne: false
            referencedRelation: "deadline_rule_sets"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "leagues_rrs_fk"
            columns: ["roster_rule_set_id"]
            isOneToOne: false
            referencedRelation: "roster_rule_sets"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "leagues_scoring_system_id_fkey"
            columns: ["scoring_system_id"]
            isOneToOne: false
            referencedRelation: "scoring_systems"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "leagues_sport_league_fk"
            columns: ["sport_league_id"]
            isOneToOne: false
            referencedRelation: "leagues"
            referencedColumns: ["id"]
          },
        ]
      }
      player_game_logs: {
        Row: {
          ast: number
          balldontlie_game_id: number | null
          blk: number
          created_at: string
          fp: number
          game_boxscore_url: string | null
          game_charts_url: string | null
          game_date: string | null
          game_id: string
          game_playbyplay_url: string | null
          game_recap_url: string | null
          home_away: string | null
          id: string
          league_id: string
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
          game_boxscore_url?: string | null
          game_charts_url?: string | null
          game_date?: string | null
          game_id: string
          game_playbyplay_url?: string | null
          game_recap_url?: string | null
          home_away?: string | null
          id?: string
          league_id: string
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
          game_boxscore_url?: string | null
          game_charts_url?: string | null
          game_date?: string | null
          game_id?: string
          game_playbyplay_url?: string | null
          game_recap_url?: string | null
          home_away?: string | null
          id?: string
          league_id?: string
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
        Relationships: [
          {
            foreignKeyName: "pgl_league_fk"
            columns: ["league_id"]
            isOneToOne: false
            referencedRelation: "leagues"
            referencedColumns: ["id"]
          },
        ]
      }
      player_last_game: {
        Row: {
          a_pts: number
          ast: number
          blk: number
          fp: number
          game_boxscore_url: string | null
          game_charts_url: string | null
          game_date: string | null
          game_playbyplay_url: string | null
          game_recap_url: string | null
          h_pts: number
          home_away: string | null
          id: string
          league_id: string
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
          game_boxscore_url?: string | null
          game_charts_url?: string | null
          game_date?: string | null
          game_playbyplay_url?: string | null
          game_recap_url?: string | null
          h_pts?: number
          home_away?: string | null
          id?: string
          league_id: string
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
          game_boxscore_url?: string | null
          game_charts_url?: string | null
          game_date?: string | null
          game_playbyplay_url?: string | null
          game_recap_url?: string | null
          h_pts?: number
          home_away?: string | null
          id?: string
          league_id?: string
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
          {
            foreignKeyName: "plg_league_fk"
            columns: ["league_id"]
            isOneToOne: false
            referencedRelation: "leagues"
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
          contract_end_year: number | null
          delta_fp: number
          delta_mpg: number
          dob: string | null
          dreb: number | null
          exp: number
          fc_bc: string
          fg_pct: number | null
          fga: number | null
          fgm: number | null
          fp_pg_t: number
          fp_pg5: number
          ft_pct: number | null
          fta: number | null
          ftm: number | null
          gp: number
          guaranteed_yearly_salary: number | null
          height: string | null
          id: number
          injury: string | null
          jersey: number
          league_id: string
          mpg: number
          mpg5: number
          name: string
          nba_url: string | null
          note: string | null
          oreb: number | null
          pf: number | null
          photo: string | null
          plus_minus: number | null
          pos: string | null
          pts: number
          pts5: number
          reb: number
          reb5: number
          salary: number
          source_league: string | null
          source_player_id: string | null
          source_url: string | null
          stl: number
          stl5: number
          stocks: number
          stocks5: number
          team: string
          total_contract_value: number | null
          tov: number | null
          tp_pct: number | null
          tpa: number | null
          tpm: number | null
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
          contract_end_year?: number | null
          delta_fp?: number
          delta_mpg?: number
          dob?: string | null
          dreb?: number | null
          exp?: number
          fc_bc: string
          fg_pct?: number | null
          fga?: number | null
          fgm?: number | null
          fp_pg_t?: number
          fp_pg5?: number
          ft_pct?: number | null
          fta?: number | null
          ftm?: number | null
          gp?: number
          guaranteed_yearly_salary?: number | null
          height?: string | null
          id: number
          injury?: string | null
          jersey?: number
          league_id: string
          mpg?: number
          mpg5?: number
          name: string
          nba_url?: string | null
          note?: string | null
          oreb?: number | null
          pf?: number | null
          photo?: string | null
          plus_minus?: number | null
          pos?: string | null
          pts?: number
          pts5?: number
          reb?: number
          reb5?: number
          salary?: number
          source_league?: string | null
          source_player_id?: string | null
          source_url?: string | null
          stl?: number
          stl5?: number
          stocks?: number
          stocks5?: number
          team: string
          total_contract_value?: number | null
          tov?: number | null
          tp_pct?: number | null
          tpa?: number | null
          tpm?: number | null
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
          contract_end_year?: number | null
          delta_fp?: number
          delta_mpg?: number
          dob?: string | null
          dreb?: number | null
          exp?: number
          fc_bc?: string
          fg_pct?: number | null
          fga?: number | null
          fgm?: number | null
          fp_pg_t?: number
          fp_pg5?: number
          ft_pct?: number | null
          fta?: number | null
          ftm?: number | null
          gp?: number
          guaranteed_yearly_salary?: number | null
          height?: string | null
          id?: number
          injury?: string | null
          jersey?: number
          league_id?: string
          mpg?: number
          mpg5?: number
          name?: string
          nba_url?: string | null
          note?: string | null
          oreb?: number | null
          pf?: number | null
          photo?: string | null
          plus_minus?: number | null
          pos?: string | null
          pts?: number
          pts5?: number
          reb?: number
          reb5?: number
          salary?: number
          source_league?: string | null
          source_player_id?: string | null
          source_url?: string | null
          stl?: number
          stl5?: number
          stocks?: number
          stocks5?: number
          team?: string
          total_contract_value?: number | null
          tov?: number | null
          tp_pct?: number | null
          tpa?: number | null
          tpm?: number | null
          updated_at?: string
          value_t?: number
          value5?: number
          weight?: number
        }
        Relationships: [
          {
            foreignKeyName: "players_league_fk"
            columns: ["league_id"]
            isOneToOne: false
            referencedRelation: "leagues"
            referencedColumns: ["id"]
          },
        ]
      }
      roster: {
        Row: {
          created_at: string
          day: number
          gw: number
          id: string
          is_captain: boolean
          league_id: string
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
          league_id: string
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
          league_id?: string
          player_id?: number
          slot?: string
          team_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "roster_league_fk"
            columns: ["league_id"]
            isOneToOne: false
            referencedRelation: "leagues"
            referencedColumns: ["id"]
          },
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
      roster_rule_sets: {
        Row: {
          bc_slots: number
          bench_count: number
          budget_cap: number | null
          created_at: string
          fc_slots: number
          id: string
          is_template: boolean
          max_players_per_team: number | null
          name: string
          owner_id: string | null
          starters_count: number
          total_players: number
        }
        Insert: {
          bc_slots?: number
          bench_count?: number
          budget_cap?: number | null
          created_at?: string
          fc_slots?: number
          id?: string
          is_template?: boolean
          max_players_per_team?: number | null
          name: string
          owner_id?: string | null
          starters_count?: number
          total_players?: number
        }
        Update: {
          bc_slots?: number
          bench_count?: number
          budget_cap?: number | null
          created_at?: string
          fc_slots?: number
          id?: string
          is_template?: boolean
          max_players_per_team?: number | null
          name?: string
          owner_id?: string | null
          starters_count?: number
          total_players?: number
        }
        Relationships: []
      }
      schedule_games: {
        Row: {
          away_pts: number
          away_team: string
          day: number
          game_boxscore_url: string | null
          game_charts_url: string | null
          game_id: string
          game_playbyplay_url: string | null
          game_recap_url: string | null
          gw: number
          home_pts: number
          home_team: string
          league_id: string
          nba_game_url: string | null
          status: string
          tipoff_utc: string | null
          youtube_recap_id: string | null
        }
        Insert: {
          away_pts?: number
          away_team: string
          day?: number
          game_boxscore_url?: string | null
          game_charts_url?: string | null
          game_id: string
          game_playbyplay_url?: string | null
          game_recap_url?: string | null
          gw?: number
          home_pts?: number
          home_team: string
          league_id: string
          nba_game_url?: string | null
          status?: string
          tipoff_utc?: string | null
          youtube_recap_id?: string | null
        }
        Update: {
          away_pts?: number
          away_team?: string
          day?: number
          game_boxscore_url?: string | null
          game_charts_url?: string | null
          game_id?: string
          game_playbyplay_url?: string | null
          game_recap_url?: string | null
          gw?: number
          home_pts?: number
          home_team?: string
          league_id?: string
          nba_game_url?: string | null
          status?: string
          tipoff_utc?: string | null
          youtube_recap_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "schedgames_league_fk"
            columns: ["league_id"]
            isOneToOne: false
            referencedRelation: "leagues"
            referencedColumns: ["id"]
          },
        ]
      }
      scoring_daily_team_totals: {
        Row: {
          calculated_at: string
          captain_bonus: number
          chip_bonus: number
          day: number
          fantasy_league_id: string
          game_date: string
          gw: number
          id: string
          player_breakdown: Json
          scoring_system_id: string
          team_id: string
          total_fp: number
        }
        Insert: {
          calculated_at?: string
          captain_bonus?: number
          chip_bonus?: number
          day: number
          fantasy_league_id: string
          game_date: string
          gw: number
          id?: string
          player_breakdown?: Json
          scoring_system_id: string
          team_id: string
          total_fp?: number
        }
        Update: {
          calculated_at?: string
          captain_bonus?: number
          chip_bonus?: number
          day?: number
          fantasy_league_id?: string
          game_date?: string
          gw?: number
          id?: string
          player_breakdown?: Json
          scoring_system_id?: string
          team_id?: string
          total_fp?: number
        }
        Relationships: [
          {
            foreignKeyName: "scoring_daily_team_totals_fantasy_league_id_fkey"
            columns: ["fantasy_league_id"]
            isOneToOne: false
            referencedRelation: "leagues"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "scoring_daily_team_totals_scoring_system_id_fkey"
            columns: ["scoring_system_id"]
            isOneToOne: false
            referencedRelation: "scoring_systems"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "scoring_daily_team_totals_team_id_fkey"
            columns: ["team_id"]
            isOneToOne: false
            referencedRelation: "teams"
            referencedColumns: ["id"]
          },
        ]
      }
      scoring_rules: {
        Row: {
          applies_to: string
          created_at: string
          id: string
          is_active: boolean
          metadata: Json
          rule_type: string
          scoring_system_id: string
          sort_order: number
          stat_key: string
          updated_at: string
          weight: number
        }
        Insert: {
          applies_to?: string
          created_at?: string
          id?: string
          is_active?: boolean
          metadata?: Json
          rule_type?: string
          scoring_system_id: string
          sort_order?: number
          stat_key: string
          updated_at?: string
          weight?: number
        }
        Update: {
          applies_to?: string
          created_at?: string
          id?: string
          is_active?: boolean
          metadata?: Json
          rule_type?: string
          scoring_system_id?: string
          sort_order?: number
          stat_key?: string
          updated_at?: string
          weight?: number
        }
        Relationships: [
          {
            foreignKeyName: "scoring_rules_scoring_system_id_fkey"
            columns: ["scoring_system_id"]
            isOneToOne: false
            referencedRelation: "scoring_systems"
            referencedColumns: ["id"]
          },
        ]
      }
      scoring_systems: {
        Row: {
          code: string
          created_at: string
          id: string
          is_active: boolean
          is_template: boolean
          name: string
          owner_id: string | null
          sport: string
          updated_at: string
        }
        Insert: {
          code: string
          created_at?: string
          id?: string
          is_active?: boolean
          is_template?: boolean
          name: string
          owner_id?: string | null
          sport?: string
          updated_at?: string
        }
        Update: {
          code?: string
          created_at?: string
          id?: string
          is_active?: boolean
          is_template?: boolean
          name?: string
          owner_id?: string | null
          sport?: string
          updated_at?: string
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
      team_chips: {
        Row: {
          chip: string
          gw: number
          id: string
          league_id: string
          metadata: Json
          team_id: string
          used_at: string
        }
        Insert: {
          chip: string
          gw: number
          id?: string
          league_id: string
          metadata?: Json
          team_id: string
          used_at?: string
        }
        Update: {
          chip?: string
          gw?: number
          id?: string
          league_id?: string
          metadata?: Json
          team_id?: string
          used_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "team_chips_league_fk"
            columns: ["league_id"]
            isOneToOne: false
            referencedRelation: "leagues"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "team_chips_team_id_fkey"
            columns: ["team_id"]
            isOneToOne: false
            referencedRelation: "teams"
            referencedColumns: ["id"]
          },
        ]
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
          league_id: string
          name: string
          owner_id: string
          sport_league_id: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          description?: string | null
          id?: string
          league_id: string
          name: string
          owner_id: string
          sport_league_id: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          description?: string | null
          id?: string
          league_id?: string
          name?: string
          owner_id?: string
          sport_league_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "teams_league_id_fkey"
            columns: ["league_id"]
            isOneToOne: false
            referencedRelation: "leagues"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "teams_sport_league_fk"
            columns: ["sport_league_id"]
            isOneToOne: false
            referencedRelation: "leagues"
            referencedColumns: ["id"]
          },
        ]
      }
      transactions: {
        Row: {
          cost_points: number
          created_at: string
          id: string
          league_id: string
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
          league_id: string
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
          league_id?: string
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
          {
            foreignKeyName: "tx_league_fk"
            columns: ["league_id"]
            isOneToOne: false
            referencedRelation: "leagues"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      get_league_teams: {
        Args: { _league_id: string }
        Returns: {
          created_at: string
          id: string
          league_id: string
          name: string
          owner_id: string
          owner_label: string
        }[]
      }
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
