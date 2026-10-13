# UC-007 Baixar e organizar — estados

```mermaid
stateDiagram-v2
    [*] --> Disponivel
    Disponivel --> GerandoZip: baixar tudo
    GerandoZip --> Baixando
    Baixando --> Disponivel
    Disponivel --> AvisoExpiracao: dia 25
    AvisoExpiracao --> Expirado: dia 30
    Expirado --> [*]
```
