# UC-002 Criar projeto a partir de material — sequência

```mermaid
sequenceDiagram
    actor U as Usuário
    participant F as App
    participant API as API Next.js
    participant ST as Supabase Storage
    participant AI as Haiku / OpenAI transcrição
    participant DB as Supabase DB
    U->>F: fotos / arquivo / áudio
    F->>ST: upload (tus)
    F->>API: POST /api/projects {source_paths, type}
    API->>DB: checa limite do mês
    alt imagem ou PDF escaneado
        API->>AI: claude-haiku-5-5 (OCR)
    else áudio
        API->>AI: transcrição OpenAI
    else docx/pptx/pdf texto/docs link
        API->>API: extração local
    end
    AI-->>API: texto
    API->>DB: INSERT projects (source_text)
    API-->>F: 201 {project_id, text}
    U->>F: edita e continua
    F->>API: PATCH /api/projects/:id {source_text}
```
