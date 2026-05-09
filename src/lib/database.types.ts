export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  __InternalSupabase: {
    PostgrestVersion: "14.5"
  }
  public: {
    Tables: {
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
        Update: Partial<Database["public"]["Tables"]["candidate_affairs"]["Insert"]>
        Relationships: []
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
        Update: Partial<Database["public"]["Tables"]["candidate_bio_sections"]["Insert"]>
        Relationships: []
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
        Update: Partial<Database["public"]["Tables"]["candidate_news"]["Insert"]>
        Relationships: []
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
        Update: Partial<Database["public"]["Tables"]["candidate_match_propositions"]["Insert"]>
        Relationships: []
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
        Update: Partial<Database["public"]["Tables"]["candidate_programs"]["Insert"]>
        Relationships: []
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
        Update: Partial<Database["public"]["Tables"]["candidate_proposals"]["Insert"]>
        Relationships: []
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
        }
        Update: Partial<Database["public"]["Tables"]["candidates"]["Insert"]>
        Relationships: []
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
        Update: Partial<Database["public"]["Tables"]["parties"]["Insert"]>
        Relationships: []
      }
      news_sources: {
        Row: {
          id: string
          slug: string
          name: string
          homepage_url: string | null
          rss_url: string
          orientation: string
          color: string | null
          is_factcheck: boolean
          is_active: boolean
          last_fetched_at: string | null
          last_fetch_error: string | null
          kind: string
          candidate_id: string | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          slug: string
          name: string
          homepage_url?: string | null
          rss_url: string
          orientation: string
          color?: string | null
          is_factcheck?: boolean
          is_active?: boolean
          last_fetched_at?: string | null
          last_fetch_error?: string | null
          kind?: string
          candidate_id?: string | null
          created_at?: string
          updated_at?: string
        }
        Update: Partial<Database["public"]["Tables"]["news_sources"]["Insert"]>
        Relationships: []
      }
      news_articles: {
        Row: {
          id: string
          source_id: string
          guid: string
          url: string
          title: string
          summary: string | null
          image_url: string | null
          author: string | null
          published_at: string
          fetched_at: string
          is_factcheck: boolean
          verdict: string | null
          kind: string
        }
        Insert: {
          id?: string
          source_id: string
          guid: string
          url: string
          title: string
          summary?: string | null
          image_url?: string | null
          author?: string | null
          published_at: string
          fetched_at?: string
          is_factcheck?: boolean
          verdict?: string | null
          kind?: string
        }
        Update: Partial<Database["public"]["Tables"]["news_articles"]["Insert"]>
        Relationships: []
      }
      candidate_aliases: {
        Row: { id: string; candidate_id: string; alias: string; created_at: string }
        Insert: { id?: string; candidate_id: string; alias: string; created_at?: string }
        Update: Partial<Database["public"]["Tables"]["candidate_aliases"]["Insert"]>
        Relationships: []
      }
      party_aliases: {
        Row: { id: string; party_id: string; alias: string; created_at: string }
        Insert: { id?: string; party_id: string; alias: string; created_at?: string }
        Update: Partial<Database["public"]["Tables"]["party_aliases"]["Insert"]>
        Relationships: []
      }
      theme_keywords: {
        Row: { id: string; theme_id: string; keyword: string; created_at: string }
        Insert: { id?: string; theme_id: string; keyword: string; created_at?: string }
        Update: Partial<Database["public"]["Tables"]["theme_keywords"]["Insert"]>
        Relationships: []
      }
      article_candidates: {
        Row: { article_id: string; candidate_id: string; score: number }
        Insert: { article_id: string; candidate_id: string; score?: number }
        Update: Partial<Database["public"]["Tables"]["article_candidates"]["Insert"]>
        Relationships: []
      }
      article_parties: {
        Row: { article_id: string; party_id: string; score: number }
        Insert: { article_id: string; party_id: string; score?: number }
        Update: Partial<Database["public"]["Tables"]["article_parties"]["Insert"]>
        Relationships: []
      }
      article_themes: {
        Row: { article_id: string; theme_id: string; score: number }
        Insert: { article_id: string; theme_id: string; score?: number }
        Update: Partial<Database["public"]["Tables"]["article_themes"]["Insert"]>
        Relationships: []
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
        Update: Partial<Database["public"]["Tables"]["themes"]["Insert"]>
        Relationships: []
      }
    }
    Views: Record<string, never>
    Functions: Record<string, never>
    Enums: {
      affair_status:
        | "mis_en_examen"
        | "en_cours"
        | "classee"
        | "condamnation"
        | "relaxe"
      candidate_status: "declared" | "pressenti" | "withdrawn"
    }
    CompositeTypes: Record<string, never>
  }
}

export type Tables<T extends keyof Database["public"]["Tables"]> =
  Database["public"]["Tables"][T]["Row"]
export type Enums<T extends keyof Database["public"]["Enums"]> =
  Database["public"]["Enums"][T]
