
export type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[]

export type Database = {
  
  "graphql_public": {
          Tables: {
            [_ in never]: never
          }
          Views: {
            [_ in never]: never
          }
          Functions: {
            "graphql":
{ Args: { "extensions"?: Json,"operationName"?: string,"query"?: string,"variables"?: Json }; Returns: Json
                           }
          }
          Enums: {
            [_ in never]: never
          }
          CompositeTypes: {
            [_ in never]: never
          }
        },"public": {
          Tables: {
            "ai_connections": {
                  Row: {
                    "created_at": string,"key_ciphertext": string,"key_hint": string,"provider": string,"user_id": string
                  }
                  ComputedFields: never
                  Insert: {
                    "created_at"?: string,"key_ciphertext": string,"key_hint": string,"provider": string,"user_id": string
                  }
                  Update: {
                    "created_at"?: string,"key_ciphertext"?: string,"key_hint"?: string,"provider"?: string,"user_id"?: string
                  }
                  Relationships: [
                    
                  ]
                },"ai_usage": {
                  Row: {
                    "billed_to": string,"completion_tokens": number | null,"cost_usd": number,"created_at": string,"id": string,"kind": string,"model": string,"prompt_tokens": number | null,"user_id": string
                  }
                  ComputedFields: never
                  Insert: {
                    "billed_to"?: string,"completion_tokens"?: number | null,"cost_usd": number,"created_at"?: string,"id"?: string,"kind": string,"model": string,"prompt_tokens"?: number | null,"user_id": string
                  }
                  Update: {
                    "billed_to"?: string,"completion_tokens"?: number | null,"cost_usd"?: number,"created_at"?: string,"id"?: string,"kind"?: string,"model"?: string,"prompt_tokens"?: number | null,"user_id"?: string
                  }
                  Relationships: [
                    
                  ]
                },"ctas": {
                  Row: {
                    "id": string,"kind": string,"label": string | null,"user_id": string,"value": string | null
                  }
                  ComputedFields: never
                  Insert: {
                    "id"?: string,"kind": string,"label"?: string | null,"user_id"?: string,"value"?: string | null
                  }
                  Update: {
                    "id"?: string,"kind"?: string,"label"?: string | null,"user_id"?: string,"value"?: string | null
                  }
                  Relationships: [
                    
                  ]
                },"exports": {
                  Row: {
                    "created_at": string,"cut_id": string | null,"duration_seconds": number | null,"end_seconds": number | null,"expires_at": string,"id": string,"kind": string,"mime": string,"project_id": string,"size_bytes": number,"start_seconds": number | null,"storage_path": string,"user_id": string
                  }
                  ComputedFields: never
                  Insert: {
                    "created_at"?: string,"cut_id"?: string | null,"duration_seconds"?: number | null,"end_seconds"?: number | null,"expires_at": string,"id"?: string,"kind": string,"mime": string,"project_id": string,"size_bytes": number,"start_seconds"?: number | null,"storage_path": string,"user_id": string
                  }
                  Update: {
                    "created_at"?: string,"cut_id"?: string | null,"duration_seconds"?: number | null,"end_seconds"?: number | null,"expires_at"?: string,"id"?: string,"kind"?: string,"mime"?: string,"project_id"?: string,"size_bytes"?: number,"start_seconds"?: number | null,"storage_path"?: string,"user_id"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "exports_project_id_fkey"
      columns: ["project_id"]
isOneToOne: false
      referencedRelation: "projects"
      referencedColumns: ["id"]
    }
                  ]
                },"folders": {
                  Row: {
                    "about": string | null,"color": string,"created_at": string,"deleted_at": string | null,"id": string,"name": string,"settings": NonNullable<Json>,"user_id": string
                  }
                  ComputedFields: never
                  Insert: {
                    "about"?: string | null,"color"?: string,"created_at"?: string,"deleted_at"?: string | null,"id"?: string,"name": string,"settings"?: NonNullable<Json>,"user_id"?: string
                  }
                  Update: {
                    "about"?: string | null,"color"?: string,"created_at"?: string,"deleted_at"?: string | null,"id"?: string,"name"?: string,"settings"?: NonNullable<Json>,"user_id"?: string
                  }
                  Relationships: [
                    
                  ]
                },"jobs": {
                  Row: {
                    "attempts": number,"created_at": string,"error": string | null,"finished_at": string | null,"heartbeat_at": string | null,"id": string,"kind": string,"payload": NonNullable<Json>,"progress": number,"project_id": string,"started_at": string | null,"status": string,"step": string | null,"user_id": string
                  }
                  ComputedFields: never
                  Insert: {
                    "attempts"?: number,"created_at"?: string,"error"?: string | null,"finished_at"?: string | null,"heartbeat_at"?: string | null,"id"?: string,"kind": string,"payload"?: NonNullable<Json>,"progress"?: number,"project_id": string,"started_at"?: string | null,"status"?: string,"step"?: string | null,"user_id"?: string
                  }
                  Update: {
                    "attempts"?: number,"created_at"?: string,"error"?: string | null,"finished_at"?: string | null,"heartbeat_at"?: string | null,"id"?: string,"kind"?: string,"payload"?: NonNullable<Json>,"progress"?: number,"project_id"?: string,"started_at"?: string | null,"status"?: string,"step"?: string | null,"user_id"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "jobs_project_id_fkey"
      columns: ["project_id"]
isOneToOne: false
      referencedRelation: "projects"
      referencedColumns: ["id"]
    }
                  ]
                },"profiles": {
                  Row: {
                    "audience": string | null,"niche": string | null,"onboarded": boolean,"phrases": string | null,"tone": string | null,"user_id": string
                  }
                  ComputedFields: never
                  Insert: {
                    "audience"?: string | null,"niche"?: string | null,"onboarded"?: boolean,"phrases"?: string | null,"tone"?: string | null,"user_id"?: string
                  }
                  Update: {
                    "audience"?: string | null,"niche"?: string | null,"onboarded"?: boolean,"phrases"?: string | null,"tone"?: string | null,"user_id"?: string
                  }
                  Relationships: [
                    
                  ]
                },"projects": {
                  Row: {
                    "cover_prompt": string | null,"created_at": string,"cuts": NonNullable<Json>,"deleted_at": string | null,"descriptions": NonNullable<Json>,"episode_index": number | null,"folder_id": string | null,"id": string,"interview": NonNullable<Json>,"script_stale": boolean,"series_id": string | null,"source_kind": string,"source_text": string,"source_truncated": boolean,"status": string,"title": string,"user_id": string
                  }
                  ComputedFields: never
                  Insert: {
                    "cover_prompt"?: string | null,"created_at"?: string,"cuts"?: NonNullable<Json>,"deleted_at"?: string | null,"descriptions"?: NonNullable<Json>,"episode_index"?: number | null,"folder_id"?: string | null,"id"?: string,"interview"?: NonNullable<Json>,"script_stale"?: boolean,"series_id"?: string | null,"source_kind": string,"source_text": string,"source_truncated"?: boolean,"status"?: string,"title": string,"user_id"?: string
                  }
                  Update: {
                    "cover_prompt"?: string | null,"created_at"?: string,"cuts"?: NonNullable<Json>,"deleted_at"?: string | null,"descriptions"?: NonNullable<Json>,"episode_index"?: number | null,"folder_id"?: string | null,"id"?: string,"interview"?: NonNullable<Json>,"script_stale"?: boolean,"series_id"?: string | null,"source_kind"?: string,"source_text"?: string,"source_truncated"?: boolean,"status"?: string,"title"?: string,"user_id"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "projects_folder_id_fkey"
      columns: ["folder_id"]
isOneToOne: false
      referencedRelation: "folders"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "projects_series_id_fkey"
      columns: ["series_id"]
isOneToOne: false
      referencedRelation: "series"
      referencedColumns: ["id"]
    }
                  ]
                },"recordings": {
                  Row: {
                    "block_id": string | null,"created_at": string,"crop": Json | null,"duration_seconds": number | null,"id": string,"kind": string,"mime": string,"project_id": string,"size_bytes": number,"status": string,"storage_path": string,"user_id": string
                  }
                  ComputedFields: never
                  Insert: {
                    "block_id"?: string | null,"created_at"?: string,"crop"?: Json | null,"duration_seconds"?: number | null,"id"?: string,"kind": string,"mime": string,"project_id": string,"size_bytes": number,"status"?: string,"storage_path": string,"user_id"?: string
                  }
                  Update: {
                    "block_id"?: string | null,"created_at"?: string,"crop"?: Json | null,"duration_seconds"?: number | null,"id"?: string,"kind"?: string,"mime"?: string,"project_id"?: string,"size_bytes"?: number,"status"?: string,"storage_path"?: string,"user_id"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "recordings_block_id_fkey"
      columns: ["block_id"]
isOneToOne: false
      referencedRelation: "script_blocks"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "recordings_project_id_fkey"
      columns: ["project_id"]
isOneToOne: false
      referencedRelation: "projects"
      referencedColumns: ["id"]
    }
                  ]
                },"script_blocks": {
                  Row: {
                    "cover_prompt": string | null,"cut_index": number | null,"cut_title": string | null,"descriptions": NonNullable<Json>,"id": string,"kind": string,"position": number,"project_id": string,"text": string,"user_id": string
                  }
                  ComputedFields: never
                  Insert: {
                    "cover_prompt"?: string | null,"cut_index"?: number | null,"cut_title"?: string | null,"descriptions"?: NonNullable<Json>,"id"?: string,"kind": string,"position": number,"project_id": string,"text"?: string,"user_id"?: string
                  }
                  Update: {
                    "cover_prompt"?: string | null,"cut_index"?: number | null,"cut_title"?: string | null,"descriptions"?: NonNullable<Json>,"id"?: string,"kind"?: string,"position"?: number,"project_id"?: string,"text"?: string,"user_id"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "script_blocks_project_id_fkey"
      columns: ["project_id"]
isOneToOne: false
      referencedRelation: "projects"
      referencedColumns: ["id"]
    }
                  ]
                },"series": {
                  Row: {
                    "created_at": string,"id": string,"title": string,"user_id": string
                  }
                  ComputedFields: never
                  Insert: {
                    "created_at"?: string,"id"?: string,"title": string,"user_id"?: string
                  }
                  Update: {
                    "created_at"?: string,"id"?: string,"title"?: string,"user_id"?: string
                  }
                  Relationships: [
                    
                  ]
                },"transcripts": {
                  Row: {
                    "created_at": string,"project_id": string,"recording_id": string,"user_id": string,"words": NonNullable<Json>
                  }
                  ComputedFields: never
                  Insert: {
                    "created_at"?: string,"project_id": string,"recording_id": string,"user_id": string,"words": NonNullable<Json>
                  }
                  Update: {
                    "created_at"?: string,"project_id"?: string,"recording_id"?: string,"user_id"?: string,"words"?: NonNullable<Json>
                  }
                  Relationships: [
                    {
      foreignKeyName: "transcripts_project_id_fkey"
      columns: ["project_id"]
isOneToOne: false
      referencedRelation: "projects"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "transcripts_recording_id_fkey"
      columns: ["recording_id"]
isOneToOne: true
      referencedRelation: "recordings"
      referencedColumns: ["id"]
    }
                  ]
                },"storage_quota": {
                  Row: {
                    "limit_bytes": number,"used_bytes": number,"user_id": string
                  }
                  ComputedFields: never
                  Insert: {
                    "limit_bytes"?: number,"used_bytes"?: number,"user_id": string
                  }
                  Update: {
                    "limit_bytes"?: number,"used_bytes"?: number,"user_id"?: string
                  }
                  Relationships: [
                    
                  ]
                },"usage_months": {
                  Row: {
                    "month": string,"projects": number,"transcription_seconds": number,"user_id": string
                  }
                  ComputedFields: never
                  Insert: {
                    "month": string,"projects"?: number,"transcription_seconds"?: number,"user_id": string
                  }
                  Update: {
                    "month"?: string,"projects"?: number,"transcription_seconds"?: number,"user_id"?: string
                  }
                  Relationships: [
                    
                  ]
                }
          }
          Views: {
            [_ in never]: never
          }
          Functions: {
            "trash_folder":
{ Args: { "p_id": string }; Returns: boolean
                           },
            "restore_folder":
{ Args: { "p_id": string }; Returns: boolean
                           },
            "claim_job":
{ Args: Record<PropertyKey, never>; Returns: {
              "attempts": number,
"created_at": string,
"error": string | null,
"finished_at": string | null,
"heartbeat_at": string | null,
"id": string,
"kind": string,
"payload": NonNullable<Json>,
"progress": number,
"project_id": string,
"started_at": string | null,
"status": string,
"step": string | null,
"user_id": string
            }[]
                          SetofOptions: {
        from: "*"
        to: "jobs"
        isOneToOne: false
        isSetofReturn: true
      } },
"consume_usage":
{ Args: { "p_projects": number,"p_seconds": number }; Returns: boolean
                           },
"create_episode_projects":
{ Args: { "p_rows": Json }; Returns: {
              "ep_index": number,"project_id": string
            }[]
                           },
"create_project":
{ Args: { "p_folder_id"?: string,"p_seconds"?: number,"p_source_kind": string,"p_source_text": string,"p_source_truncated"?: boolean,"p_title": string }; Returns: string
                           },
"create_render_job":
{ Args: { "p_kind": string,"p_payload"?: Json,"p_project": string }; Returns: string
                           },
"finish_recording":
{ Args: { "p_duration": number,"p_id": string,"p_size_bytes": number }; Returns: (string)[]
                           },
"storage_fits":
{ Args: { "p_bytes": number }; Returns: boolean
                           },
"purge_expired_exports":
{ Args: Record<PropertyKey, never>; Returns: (string)[]
                           },
"refund_usage":
{ Args: { "p_projects": number,"p_seconds": number,"p_user": string }; Returns: undefined
                           },
"requeue_stale_jobs":
{ Args: Record<PropertyKey, never>; Returns: number
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

type DatabaseWithoutInternals = Omit<Database, '__InternalSupabase'>

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
    : never = never
> = DefaultSchemaTableNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
  ? (DefaultSchema["Tables"] & DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
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
    : never = never
> = DefaultSchemaTableNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
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
    : never = never
> = DefaultSchemaTableNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
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
    : never = never
> = DefaultSchemaEnumNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
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
    : never = never
> = PublicCompositeTypeNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
  ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
  : never

export const Constants = {
  "graphql_public": {
          Enums: {
            
          }
        },"public": {
          Enums: {
            
          }
        }
} as const
