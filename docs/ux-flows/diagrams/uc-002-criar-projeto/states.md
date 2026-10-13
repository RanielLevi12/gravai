# UC-002 Criar projeto a partir de material — estados

```mermaid
stateDiagram-v2
    [*] --> Escolhendo
    Escolhendo --> Capturando: foto/áudio
    Escolhendo --> Enviando: arquivo/link
    Escolhendo --> Editando: colar texto
    Capturando --> Enviando
    Enviando --> Extraindo
    Extraindo --> Editando: ok
    Extraindo --> Erro: ilegível / link privado
    Erro --> Escolhendo
    Escolhendo --> Bloqueado: limite mensal
    Editando --> [*]: continuar
```
