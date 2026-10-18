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
      admins: {
        Row: {
          created_at: string
          display_name: string | null
          email: string | null
          user_id: string
        }
        Insert: {
          created_at?: string
          display_name?: string | null
          email?: string | null
          user_id: string
        }
        Update: {
          created_at?: string
          display_name?: string | null
          email?: string | null
          user_id?: string
        }
        Relationships: []
      }
      app_config: {
        Row: {
          key: string
          updated_at: string
          value: Json
        }
        Insert: {
          key: string
          updated_at?: string
          value: Json
        }
        Update: {
          key?: string
          updated_at?: string
          value?: Json
        }
        Relationships: []
      }
      article_candidates: {
        Row: {
          article_id: string
          candidate_id: string
          score: number
        }
        Insert: {
          article_id: string
          candidate_id: string
          score?: number
        }
        Update: {
          article_id?: string
          candidate_id?: string
          score?: number
        }
        Relationships: [
          {
            foreignKeyName: "article_candidates_article_id_fkey"
            columns: ["article_id"]
            isOneToOne: false
            referencedRelation: "news_articles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "article_candidates_candidate_id_fkey"
            columns: ["candidate_id"]
            isOneToOne: false
            referencedRelation: "candidates"
            referencedColumns: ["id"]
          },
        ]
      }
      article_parties: {
        Row: {
          article_id: string
          party_id: string
          score: number
        }
        Insert: {
          article_id: string
          party_id: string
          score?: number
        }
        Update: {
          article_id?: string
          party_id?: string
          score?: number
        }
        Relationships: [
          {
            foreignKeyName: "article_parties_article_id_fkey"
            columns: ["article_id"]
            isOneToOne: false
            referencedRelation: "news_articles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "article_parties_party_id_fkey"
            columns: ["party_id"]
            isOneToOne: false
            referencedRelation: "parties"
            referencedColumns: ["id"]
          },
        ]
      }
      article_themes: {
        Row: {
          article_id: string
          score: number
          theme_id: string
        }
        Insert: {
          article_id: string
          score?: number
          theme_id: string
        }
        Update: {
          article_id?: string
          score?: number
          theme_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "article_themes_article_id_fkey"
            columns: ["article_id"]
            isOneToOne: false
            referencedRelation: "news_articles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "article_themes_theme_id_fkey"
            columns: ["theme_id"]
            isOneToOne: false
            referencedRelation: "themes"
            referencedColumns: ["id"]
          },
        ]
      }
      candidate_affairs: {
        Row: {
          candidate_id: string
          created_at: string
          date: string | null
          description: string | null
          id: string
          order_index: number
          source_urls: string[]
          status: Database["public"]["Enums"]["affair_status"]
          title: string
          updated_at: string
        }
        Insert: {
          candidate_id: string
          created_at?: string
          date?: string | null
          description?: string | null
          id?: string
          order_index?: number
          source_urls?: string[]
          status?: Database["public"]["Enums"]["affair_status"]
          title: string
          updated_at?: string
        }
        Update: {
          candidate_id?: string
          created_at?: string
          date?: string | null
          description?: string | null
          id?: string
          order_index?: number
          source_urls?: string[]
          status?: Database["public"]["Enums"]["affair_status"]
          title?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "candidate_affairs_candidate_id_fkey"
            columns: ["candidate_id"]
            isOneToOne: false
            referencedRelation: "candidates"
            referencedColumns: ["id"]
          },
        ]
      }
      candidate_aliases: {
        Row: {
          alias: string
          candidate_id: string
          created_at: string
          id: string
        }
        Insert: {
          alias: string
          candidate_id: string
          created_at?: string
          id?: string
        }
        Update: {
          alias?: string
          candidate_id?: string
          created_at?: string
          id?: string
        }
        Relationships: [
          {
            foreignKeyName: "candidate_aliases_candidate_id_fkey"
            columns: ["candidate_id"]
            isOneToOne: false
            referencedRelation: "candidates"
            referencedColumns: ["id"]
          },
        ]
      }
      candidate_bio_sections: {
        Row: {
          candidate_id: string
          content: string
          created_at: string
          id: string
          order_index: number
          title: string
          updated_at: string
        }
        Insert: {
          candidate_id: string
          content: string
          created_at?: string
          id?: string
          order_index?: number
          title: string
          updated_at?: string
        }
        Update: {
          candidate_id?: string
          content?: string
          created_at?: string
          id?: string
          order_index?: number
          title?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "candidate_bio_sections_candidate_id_fkey"
            columns: ["candidate_id"]
            isOneToOne: false
            referencedRelation: "candidates"
            referencedColumns: ["id"]
          },
        ]
      }
      candidate_match_propositions: {
        Row: {
          candidate_id: string
          created_at: string
          id: string
          is_active: boolean
          order_index: number
          text: string
          theme_id: string
          updated_at: string
        }
        Insert: {
          candidate_id: string
          created_at?: string
          id?: string
          is_active?: boolean
          order_index?: number
          text: string
          theme_id: string
          updated_at?: string
        }
        Update: {
          candidate_id?: string
          created_at?: string
          id?: string
          is_active?: boolean
          order_index?: number
          text?: string
          theme_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "candidate_match_propositions_candidate_id_fkey"
            columns: ["candidate_id"]
            isOneToOne: false
            referencedRelation: "candidates"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "candidate_match_propositions_theme_id_fkey"
            columns: ["theme_id"]
            isOneToOne: false
            referencedRelation: "themes"
            referencedColumns: ["id"]
          },
        ]
      }
      candidate_news: {
        Row: {
          candidate_id: string | null
          created_at: string
          id: string
          is_featured: boolean
          published_at: string
          source_name: string | null
          summary: string | null
          title: string
          url: string
        }
        Insert: {
          candidate_id?: string | null
          created_at?: string
          id?: string
          is_featured?: boolean
          published_at: string
          source_name?: string | null
          summary?: string | null
          title: string
          url: string
        }
        Update: {
          candidate_id?: string | null
          created_at?: string
          id?: string
          is_featured?: boolean
          published_at?: string
          source_name?: string | null
          summary?: string | null
          title?: string
          url?: string
        }
        Relationships: [
          {
            foreignKeyName: "candidate_news_candidate_id_fkey"
            columns: ["candidate_id"]
            isOneToOne: false
            referencedRelation: "candidates"
            referencedColumns: ["id"]
          },
        ]
      }
      candidate_programs: {
        Row: {
          candidate_id: string
          content: string
          created_at: string
          id: string
          intro: string | null
          order_index: number
          theme_id: string
          updated_at: string
        }
        Insert: {
          candidate_id: string
          content: string
          created_at?: string
          id?: string
          intro?: string | null
          order_index?: number
          theme_id: string
          updated_at?: string
        }
        Update: {
          candidate_id?: string
          content?: string
          created_at?: string
          id?: string
          intro?: string | null
          order_index?: number
          theme_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "candidate_programs_candidate_id_fkey"
            columns: ["candidate_id"]
            isOneToOne: false
            referencedRelation: "candidates"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "candidate_programs_theme_id_fkey"
            columns: ["theme_id"]
            isOneToOne: false
            referencedRelation: "themes"
            referencedColumns: ["id"]
          },
        ]
      }
      candidate_proposals: {
        Row: {
          candidate_id: string
          content: string | null
          created_at: string
          id: string
          order_index: number
          source_url: string | null
          theme_id: string
          title: string
          updated_at: string
        }
        Insert: {
          candidate_id: string
          content?: string | null
          created_at?: string
          id?: string
          order_index?: number
          source_url?: string | null
          theme_id: string
          title: string
          updated_at?: string
        }
        Update: {
          candidate_id?: string
          content?: string | null
          created_at?: string
          id?: string
          order_index?: number
          source_url?: string | null
          theme_id?: string
          title?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "candidate_proposals_candidate_id_fkey"
            columns: ["candidate_id"]
            isOneToOne: false
            referencedRelation: "candidates"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "candidate_proposals_theme_id_fkey"
            columns: ["theme_id"]
            isOneToOne: false
            referencedRelation: "themes"
            referencedColumns: ["id"]
          },
        ]
      }
      candidates: {
        Row: {
          birth_date: string | null
          birth_place: string | null
          created_at: string
          declared_at: string | null
          first_name: string
          gender: string | null
          id: string
          is_published: boolean
          last_name: string
          order_index: number
          party_id: string | null
          photo_url: string | null
          short_bio: string | null
          slug: string
          sponsorships_count: number
          sponsorships_target: number
          status: Database["public"]["Enums"]["candidate_status"]
          updated_at: string
          website_url: string | null
        }
        Insert: {
          birth_date?: string | null
          birth_place?: string | null
          created_at?: string
          declared_at?: string | null
          first_name: string
          gender?: string | null
          id?: string
          is_published?: boolean
          last_name: string
          order_index?: number
          party_id?: string | null
          photo_url?: string | null
          short_bio?: string | null
          slug: string
          sponsorships_count?: number
          sponsorships_target?: number
          status?: Database["public"]["Enums"]["candidate_status"]
          updated_at?: string
          website_url?: string | null
        }
        Update: {
          birth_date?: string | null
          birth_place?: string | null
          created_at?: string
          declared_at?: string | null
          first_name?: string
          gender?: string | null
          id?: string
          is_published?: boolean
          last_name?: string
          order_index?: number
          party_id?: string | null
          photo_url?: string | null
          short_bio?: string | null
          slug?: string
          sponsorships_count?: number
          sponsorships_target?: number
          status?: Database["public"]["Enums"]["candidate_status"]
          updated_at?: string
          website_url?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "candidates_party_id_fkey"
            columns: ["party_id"]
            isOneToOne: false
            referencedRelation: "parties"
            referencedColumns: ["id"]
          },
        ]
      }
      dk_affinities: {
        Row: {
          candidate_a_id: string
          candidate_b_id: string
          commentary: string | null
          distribution: Json | null
          id: number
          points: NonNullable<Json>
          theme_id: string | null
          url: string
        }
        Insert: {
          candidate_a_id: string
          candidate_b_id: string
          commentary?: string | null
          distribution?: Json | null
          id?: never
          points?: NonNullable<Json>
          theme_id?: string | null
          url: string
        }
        Update: {
          candidate_a_id?: string
          candidate_b_id?: string
          commentary?: string | null
          distribution?: Json | null
          id?: never
          points?: NonNullable<Json>
          theme_id?: string | null
          url?: string
        }
        Relationships: [
          {
            foreignKeyName: "dk_affinities_candidate_a_id_fkey"
            columns: ["candidate_a_id"]
            isOneToOne: false
            referencedRelation: "dk_candidates"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "dk_affinities_candidate_b_id_fkey"
            columns: ["candidate_b_id"]
            isOneToOne: false
            referencedRelation: "dk_candidates"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "dk_affinities_theme_id_fkey"
            columns: ["theme_id"]
            isOneToOne: false
            referencedRelation: "dk_themes"
            referencedColumns: ["id"]
          },
        ]
      }
      dk_candidate_links: {
        Row: {
          candidate_id: string
          created_at: string
          dk_candidate_id: string
        }
        Insert: {
          candidate_id: string
          created_at?: string
          dk_candidate_id: string
        }
        Update: {
          candidate_id?: string
          created_at?: string
          dk_candidate_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "dk_candidate_links_candidate_id_fkey"
            columns: ["candidate_id"]
            isOneToOne: true
            referencedRelation: "candidates"
            referencedColumns: ["id"]
          },
        ]
      }
      dk_candidates: {
        Row: {
          full_name: string
          id: string
          measure_count: number
          official_site_url: string | null
          party: string | null
          photo_url: string | null
          short_bio: string | null
          slug: string
          theme_counts: NonNullable<Json>
          url: string
        }
        Insert: {
          full_name: string
          id: string
          measure_count?: number
          official_site_url?: string | null
          party?: string | null
          photo_url?: string | null
          short_bio?: string | null
          slug: string
          theme_counts?: NonNullable<Json>
          url: string
        }
        Update: {
          full_name?: string
          id?: string
          measure_count?: number
          official_site_url?: string | null
          party?: string | null
          photo_url?: string | null
          short_bio?: string | null
          slug?: string
          theme_counts?: NonNullable<Json>
          url?: string
        }
        Relationships: []
      }
      dk_imports: {
        Row: {
          content_hash: string
          counts: NonNullable<Json>
          file_name: string
          format_version: number
          generated_at: string
          id: number
          imported_at: string
          kind: string
          meta: NonNullable<Json>
        }
        Insert: {
          content_hash: string
          counts: NonNullable<Json>
          file_name: string
          format_version: number
          generated_at: string
          id?: never
          imported_at?: string
          kind: string
          meta: NonNullable<Json>
        }
        Update: {
          content_hash?: string
          counts?: NonNullable<Json>
          file_name?: string
          format_version?: number
          generated_at?: string
          id?: never
          imported_at?: string
          kind?: string
          meta?: NonNullable<Json>
        }
        Relationships: []
      }
      dk_match_candidates: {
        Row: {
          full_name: string
          id: string
          party: string | null
          photo_url: string | null
          slug: string
          url: string
        }
        Insert: {
          full_name: string
          id: string
          party?: string | null
          photo_url?: string | null
          slug: string
          url: string
        }
        Update: {
          full_name?: string
          id?: string
          party?: string | null
          photo_url?: string | null
          slug?: string
          url?: string
        }
        Relationships: []
      }
      dk_match_stances: {
        Row: {
          candidate_id: string
          stance: string
          statement_id: string
        }
        Insert: {
          candidate_id: string
          stance: string
          statement_id: string
        }
        Update: {
          candidate_id?: string
          stance?: string
          statement_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "dk_match_stances_candidate_id_fkey"
            columns: ["candidate_id"]
            isOneToOne: false
            referencedRelation: "dk_match_candidates"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "dk_match_stances_statement_id_fkey"
            columns: ["statement_id"]
            isOneToOne: false
            referencedRelation: "dk_match_statements"
            referencedColumns: ["id"]
          },
        ]
      }
      dk_match_statements: {
        Row: {
          id: string
          sort_order: number
          text: string
          theme_id: string | null
          theme_label: string | null
          theme_slug: string | null
        }
        Insert: {
          id: string
          sort_order: number
          text: string
          theme_id?: string | null
          theme_label?: string | null
          theme_slug?: string | null
        }
        Update: {
          id?: string
          sort_order?: number
          text?: string
          theme_id?: string | null
          theme_label?: string | null
          theme_slug?: string | null
        }
        Relationships: []
      }
      dk_measure_themes: {
        Row: {
          measure_id: string
          position: number
          theme_id: string
        }
        Insert: {
          measure_id: string
          position: number
          theme_id: string
        }
        Update: {
          measure_id?: string
          position?: number
          theme_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "dk_measure_themes_measure_id_fkey"
            columns: ["measure_id"]
            isOneToOne: false
            referencedRelation: "dk_measures"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "dk_measure_themes_theme_id_fkey"
            columns: ["theme_id"]
            isOneToOne: false
            referencedRelation: "dk_themes"
            referencedColumns: ["id"]
          },
        ]
      }
      dk_measures: {
        Row: {
          candidate_id: string
          description: string
          exact_quote: string
          id: string
          source_url: string
          title: string
          url: string
        }
        Insert: {
          candidate_id: string
          description: string
          exact_quote: string
          id: string
          source_url: string
          title: string
          url: string
        }
        Update: {
          candidate_id?: string
          description?: string
          exact_quote?: string
          id?: string
          source_url?: string
          title?: string
          url?: string
        }
        Relationships: [
          {
            foreignKeyName: "dk_measures_candidate_id_fkey"
            columns: ["candidate_id"]
            isOneToOne: false
            referencedRelation: "dk_candidates"
            referencedColumns: ["id"]
          },
        ]
      }
      dk_syntheses: {
        Row: {
          candidate_id: string
          id: number
          key_figures: NonNullable<Json>
          key_measure_ids: string[]
          scope: string
          summary: string
          theme_id: string | null
          url: string
        }
        Insert: {
          candidate_id: string
          id?: never
          key_figures?: NonNullable<Json>
          key_measure_ids?: string[]
          scope: string
          summary: string
          theme_id?: string | null
          url: string
        }
        Update: {
          candidate_id?: string
          id?: never
          key_figures?: NonNullable<Json>
          key_measure_ids?: string[]
          scope?: string
          summary?: string
          theme_id?: string | null
          url?: string
        }
        Relationships: [
          {
            foreignKeyName: "dk_syntheses_candidate_id_fkey"
            columns: ["candidate_id"]
            isOneToOne: false
            referencedRelation: "dk_candidates"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "dk_syntheses_theme_id_fkey"
            columns: ["theme_id"]
            isOneToOne: false
            referencedRelation: "dk_themes"
            referencedColumns: ["id"]
          },
        ]
      }
      dk_theme_map: {
        Row: {
          dk_theme_id: string
          dk_theme_slug: string
          theme_slug: string | null
        }
        Insert: {
          dk_theme_id: string
          dk_theme_slug: string
          theme_slug?: string | null
        }
        Update: {
          dk_theme_id?: string
          dk_theme_slug?: string
          theme_slug?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "dk_theme_map_theme_slug_fkey"
            columns: ["theme_slug"]
            isOneToOne: false
            referencedRelation: "themes"
            referencedColumns: ["slug"]
          },
        ]
      }
      dk_themes: {
        Row: {
          id: string
          label: string
          slug: string
          sort_order: number
          url: string
        }
        Insert: {
          id: string
          label: string
          slug: string
          sort_order: number
          url: string
        }
        Update: {
          id?: string
          label?: string
          slug?: string
          sort_order?: number
          url?: string
        }
        Relationships: []
      }
      election_reminders_sent: {
        Row: {
          milestone_key: string
          sent_at: string
        }
        Insert: {
          milestone_key: string
          sent_at?: string
        }
        Update: {
          milestone_key?: string
          sent_at?: string
        }
        Relationships: []
      }
      election_results: {
        Row: {
          candidate_id: string
          created_at: string
          is_qualified: boolean
          is_winner: boolean
          percentage: number
          rank: number | null
          round: number
          updated_at: string
          votes: number | null
        }
        Insert: {
          candidate_id: string
          created_at?: string
          is_qualified?: boolean
          is_winner?: boolean
          percentage: number
          rank?: number | null
          round: number
          updated_at?: string
          votes?: number | null
        }
        Update: {
          candidate_id?: string
          created_at?: string
          is_qualified?: boolean
          is_winner?: boolean
          percentage?: number
          rank?: number | null
          round?: number
          updated_at?: string
          votes?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "election_results_candidate_id_fkey"
            columns: ["candidate_id"]
            isOneToOne: false
            referencedRelation: "candidates"
            referencedColumns: ["id"]
          },
        ]
      }
      news_articles: {
        Row: {
          author: string | null
          fetched_at: string
          guid: string
          id: string
          image_url: string | null
          is_factcheck: boolean
          kind: string
          published_at: string
          source_id: string
          summary: string | null
          title: string
          url: string
          verdict: string | null
        }
        Insert: {
          author?: string | null
          fetched_at?: string
          guid: string
          id?: string
          image_url?: string | null
          is_factcheck?: boolean
          kind?: string
          published_at: string
          source_id: string
          summary?: string | null
          title: string
          url: string
          verdict?: string | null
        }
        Update: {
          author?: string | null
          fetched_at?: string
          guid?: string
          id?: string
          image_url?: string | null
          is_factcheck?: boolean
          kind?: string
          published_at?: string
          source_id?: string
          summary?: string | null
          title?: string
          url?: string
          verdict?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "news_articles_source_id_fkey"
            columns: ["source_id"]
            isOneToOne: false
            referencedRelation: "news_sources"
            referencedColumns: ["id"]
          },
        ]
      }
      news_sources: {
        Row: {
          candidate_id: string | null
          color: string | null
          created_at: string
          fetch_via_github: boolean
          homepage_url: string | null
          id: string
          is_active: boolean
          is_factcheck: boolean
          kind: string
          last_fetch_error: string | null
          last_fetched_at: string | null
          name: string
          orientation: string
          rss_url: string
          slug: string
          updated_at: string
        }
        Insert: {
          candidate_id?: string | null
          color?: string | null
          created_at?: string
          fetch_via_github?: boolean
          homepage_url?: string | null
          id?: string
          is_active?: boolean
          is_factcheck?: boolean
          kind?: string
          last_fetch_error?: string | null
          last_fetched_at?: string | null
          name: string
          orientation: string
          rss_url: string
          slug: string
          updated_at?: string
        }
        Update: {
          candidate_id?: string | null
          color?: string | null
          created_at?: string
          fetch_via_github?: boolean
          homepage_url?: string | null
          id?: string
          is_active?: boolean
          is_factcheck?: boolean
          kind?: string
          last_fetch_error?: string | null
          last_fetched_at?: string | null
          name?: string
          orientation?: string
          rss_url?: string
          slug?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "news_sources_candidate_id_fkey"
            columns: ["candidate_id"]
            isOneToOne: false
            referencedRelation: "candidates"
            referencedColumns: ["id"]
          },
        ]
      }
      parrainages: {
        Row: {
          candidate_id: string | null
          created_at: string
          id: string
          snapshot_date: string
          source_name: string
          total: number
        }
        Insert: {
          candidate_id?: string | null
          created_at?: string
          id?: string
          snapshot_date: string
          source_name: string
          total: number
        }
        Update: {
          candidate_id?: string | null
          created_at?: string
          id?: string
          snapshot_date?: string
          source_name?: string
          total?: number
        }
        Relationships: [
          {
            foreignKeyName: "parrainages_candidate_id_fkey"
            columns: ["candidate_id"]
            isOneToOne: false
            referencedRelation: "candidates"
            referencedColumns: ["id"]
          },
        ]
      }
      parties: {
        Row: {
          abbreviation: string | null
          color: string | null
          created_at: string
          id: string
          logo_url: string | null
          name: string
          order_index: number
          updated_at: string
        }
        Insert: {
          abbreviation?: string | null
          color?: string | null
          created_at?: string
          id?: string
          logo_url?: string | null
          name: string
          order_index?: number
          updated_at?: string
        }
        Update: {
          abbreviation?: string | null
          color?: string | null
          created_at?: string
          id?: string
          logo_url?: string | null
          name?: string
          order_index?: number
          updated_at?: string
        }
        Relationships: []
      }
      party_aliases: {
        Row: {
          alias: string
          created_at: string
          id: string
          party_id: string
        }
        Insert: {
          alias: string
          created_at?: string
          id?: string
          party_id: string
        }
        Update: {
          alias?: string
          created_at?: string
          id?: string
          party_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "party_aliases_party_id_fkey"
            columns: ["party_id"]
            isOneToOne: false
            referencedRelation: "parties"
            referencedColumns: ["id"]
          },
        ]
      }
      push_token_follows: {
        Row: {
          candidate_id: string
          created_at: string
          token: string
        }
        Insert: {
          candidate_id: string
          created_at?: string
          token: string
        }
        Update: {
          candidate_id?: string
          created_at?: string
          token?: string
        }
        Relationships: [
          {
            foreignKeyName: "push_token_follows_candidate_id_fkey"
            columns: ["candidate_id"]
            isOneToOne: false
            referencedRelation: "candidates"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "push_token_follows_token_fkey"
            columns: ["token"]
            isOneToOne: false
            referencedRelation: "push_tokens"
            referencedColumns: ["token"]
          },
        ]
      }
      push_token_muted_channels: {
        Row: {
          channel: string
          created_at: string
          token: string
        }
        Insert: {
          channel: string
          created_at?: string
          token: string
        }
        Update: {
          channel?: string
          created_at?: string
          token?: string
        }
        Relationships: [
          {
            foreignKeyName: "push_token_muted_channels_token_fkey"
            columns: ["token"]
            isOneToOne: false
            referencedRelation: "push_tokens"
            referencedColumns: ["token"]
          },
        ]
      }
      push_token_orientations: {
        Row: {
          created_at: string
          orientation: string
          token: string
        }
        Insert: {
          created_at?: string
          orientation: string
          token: string
        }
        Update: {
          created_at?: string
          orientation?: string
          token?: string
        }
        Relationships: [
          {
            foreignKeyName: "push_token_orientations_token_fkey"
            columns: ["token"]
            isOneToOne: false
            referencedRelation: "push_tokens"
            referencedColumns: ["token"]
          },
        ]
      }
      push_token_themes: {
        Row: {
          created_at: string
          theme: string
          token: string
        }
        Insert: {
          created_at?: string
          theme: string
          token: string
        }
        Update: {
          created_at?: string
          theme?: string
          token?: string
        }
        Relationships: []
      }
      push_tokens: {
        Row: {
          app_version: string | null
          created_at: string
          enabled: boolean
          last_seen_at: string
          platform: string
          token: string
        }
        Insert: {
          app_version?: string | null
          created_at?: string
          enabled?: boolean
          last_seen_at?: string
          platform: string
          token: string
        }
        Update: {
          app_version?: string | null
          created_at?: string
          enabled?: boolean
          last_seen_at?: string
          platform?: string
          token?: string
        }
        Relationships: []
      }
      theme_keywords: {
        Row: {
          created_at: string
          id: string
          keyword: string
          theme_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          keyword: string
          theme_id: string
        }
        Update: {
          created_at?: string
          id?: string
          keyword?: string
          theme_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "theme_keywords_theme_id_fkey"
            columns: ["theme_id"]
            isOneToOne: false
            referencedRelation: "themes"
            referencedColumns: ["id"]
          },
        ]
      }
      themes: {
        Row: {
          color: string | null
          created_at: string
          icon: string | null
          id: string
          name: string
          order_index: number
          slug: string
          updated_at: string
        }
        Insert: {
          color?: string | null
          created_at?: string
          icon?: string | null
          id?: string
          name: string
          order_index?: number
          slug: string
          updated_at?: string
        }
        Update: {
          color?: string | null
          created_at?: string
          icon?: string | null
          id?: string
          name?: string
          order_index?: number
          slug?: string
          updated_at?: string
        }
        Relationships: []
      }
    }
    Views: {
      parrainages_latest: {
        Row: {
          candidate_id: string | null
          first_name: string | null
          last_name: string | null
          party_id: string | null
          photo_url: string | null
          snapshot_date: string | null
          source_name: string | null
          total: number | null
        }
        Relationships: [
          {
            foreignKeyName: "candidates_party_id_fkey"
            columns: ["party_id"]
            isOneToOne: false
            referencedRelation: "parties"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "parrainages_candidate_id_fkey"
            columns: ["candidate_id"]
            isOneToOne: false
            referencedRelation: "candidates"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Functions: {
      _bump_admin_change_counter: { Args: never; Returns: undefined }
      _schedule_election_milestone: {
        Args: { job_name: string; milestone_qs: string; target_ts: string }
        Returns: undefined
      }
      clear_orientations: { Args: { p_token: string }; Returns: undefined }
      clear_themes: { Args: { p_token: string }; Returns: undefined }
      decode_html_entities: { Args: { s: string }; Returns: string }
      dk_import: {
        Args: { p_file_name: string; p_payload: Json }
        Returns: Json
      }
      get_election_results_for_round: {
        Args: { p_round: number }
        Returns: {
          candidate_id: string
          first_name: string
          gender: string
          is_qualified: boolean
          is_winner: boolean
          last_name: string
          party_abbreviation: string
          party_color: string
          party_name: string
          percentage: number
          photo_url: string
          rank: number
          round: number
          slug: string
          votes: number
        }[]
      }
      get_fcm_service_account: { Args: never; Returns: string }
      get_ingest_secret: { Args: never; Returns: string }
      get_push_broadcast_secret: { Args: never; Returns: string }
      is_admin: { Args: { uid: string }; Returns: boolean }
      publish_round_results: { Args: { p_round: number }; Returns: undefined }
      purge_old_articles: {
        Args: never
        Returns: {
          deleted_factcheck: number
          deleted_orphan: number
          deleted_total: number
        }[]
      }
      register_push_token: {
        Args: { p_app_version?: string; p_platform: string; p_token: string }
        Returns: undefined
      }
      reschedule_election_reminders: { Args: never; Returns: undefined }
      set_token_enabled: {
        Args: { p_enabled: boolean; p_token: string }
        Returns: undefined
      }
      tokens_for_press_orientation: {
        Args: { orient: string }
        Returns: {
          platform: string
          token: string
        }[]
      }
      tokens_for_press_orientations: {
        Args: { orients: string[] }
        Returns: {
          platform: string
          token: string
        }[]
      }
      unaccent: { Args: { "": string }; Returns: string }
      unfollow_candidate: {
        Args: { p_candidate_id: string; p_token: string }
        Returns: undefined
      }
      unfollow_orientation: {
        Args: { p_orientation: string; p_token: string }
        Returns: undefined
      }
      unfollow_theme: {
        Args: { p_theme: string; p_token: string }
        Returns: undefined
      }
      unmute_channel: {
        Args: { p_channel: string; p_token: string }
        Returns: undefined
      }
      unpublish_round_results: { Args: { p_round: number }; Returns: undefined }
    }
    Enums: {
      affair_status:
        | "mis_en_examen"
        | "en_cours"
        | "classee"
        | "condamnation"
        | "relaxe"
      candidate_status: "declared" | "pressenti" | "withdrawn"
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
      affair_status: [
        "mis_en_examen",
        "en_cours",
        "classee",
        "condamnation",
        "relaxe",
      ],
      candidate_status: ["declared", "pressenti", "withdrawn"],
    },
  },
} as const
