# ADR 0053 — Histórico é um adaptador opcional do vault

**Status:** aceito

Git nunca é requisito para abrir um vault. Quando disponível, o Workspace
Service o consulta em modo somente leitura e limita comandos a `git -C` com
argumentos fixos; não inicializa repositórios nem cria commits. Para vaults sem
Git, snapshots explícitos ficam em `.academic/history/snapshots.json`, fora do
Markdown e do índice SQLite descartável. O diff é uma projeção LCS por linhas
produzida no host e enviada como DTO ao renderer. Diff estrutural fica adiado
até existir source map adequado para módulos transcluídos.

**Atualização (Onda O):** diff estrutural chegou em F70/ADR 0055 —
`@abnt/structural-diff` compara duas revisões do mesmo arquivo por fatos
editoriais (seção renomeada, citação adicionada etc.), complementando este
diff por linha sem substituí-lo. Não precisou do source map de F66: opera
sobre texto que o host já tem em mãos, não sobre a fonte composta.
