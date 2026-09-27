# AuraPanel: Analise Atual e Plano de Migracao

## Escopo

Este documento descreve o AuraPanel existente no plugin AuraEssentials e separa o que pertence ao servidor, ao site e ao futuro Cloudflare Worker.

Nenhum codigo do plugin foi alterado nesta analise.

## O Que Existe Hoje No Plugin

Classe principal: `src/main/java/com/rogih/kingdoms/managers/AuraPanelManager.java`.

Comando principal: `/aurapainel`.

Aliases registrados no `plugin.yml`:

- `/aurapanel`
- `/painelaura`

Subcomandos aceitos:

- `link` e `tags`: cria sessao de vinculo do servidor.
- `status`: mostra URL da API, server ID e ultimo status de sincronizacao.
- `alteracoes` e `changes`: consulta draft pendente.
- `aplicar`, `apply` e `confirmar`: aplica o draft no servidor.
- `rejeitar`, `reject` e `descartar`: rejeita o draft.
- `reload`: recarrega `aura-panel.yml`.

O comando exige OP ou `kingdoms.admin`.

## Arquivo Local Do Servidor

O plugin cria `plugins/AuraEssentials/aura-panel.yml` com:

```yaml
apiBaseUrl: https://rochaproject.qzz.io
serverId: uuid-estavel
serverSecret: segredo-estavel
serverName: nome-opcional
linkTtlSeconds: 1800
syncIntervalSeconds: 60
```

Regras observadas:

- `serverId` e `serverSecret` sao gerados uma vez e persistidos.
- `linkTtlSeconds` tem minimo forcado de 1800 segundos, ou 30 minutos.
- `syncIntervalSeconds` e limitado em runtime entre 30 e 900 segundos.
- A API padrao atual e `https://rochaproject.qzz.io`.
- O plugin envia `serverSecret` em requisicoes HTTP para autenticar o servidor.

## Fluxo De Vinculo

1. Um administrador executa `/aurapainel link` ou `/aurapainel tags`.
2. O plugin cria um codigo aleatorio de 8 caracteres.
3. O codigo usa o alfabeto `ABCDEFGHJKLMNPQRSTUVWXYZ23456789`.
4. O plugin envia para a API:

```json
{
  "serverId": "uuid",
  "serverSecret": "secret",
  "code": "CODE1234",
  "scope": "admin",
  "expiresAt": 0,
  "serverName": "",
  "pluginVersion": "1.0.5",
  "minecraftVersion": "...",
  "snapshot": {}
}
```

5. A API retorna uma URL ou dados de sessao.
6. O plugin monta um link temporario com `#server-panel?code=...` quando necessario.
7. O administrador abre o painel pelo link.

Existe um cooldown local de 5 segundos entre geracoes de sessao.

## Endpoints Usados Hoje

Base atual: `apiBaseUrl`.

### Iniciar sessao

```text
POST /api/aura/panel/link/start
```

Usado por `/aurapainel link` e `/aurapainel tags`.

### Sincronizacao viva

```text
POST /api/aura/panel/server/sync
```

Executado automaticamente pelo plugin a cada intervalo configurado. Envia o snapshot atual e atualiza `lastStatus` conforme o servidor esta vinculado, sincronizado ou com draft pendente.

### Consultar draft

```text
POST /api/aura/panel/server/pending
```

Usado por `/aurapainel alteracoes` e antes de aplicar/rejeitar.

### Confirmar draft

```text
POST /api/aura/panel/server/draft/confirm
```

Payload inclui:

```json
{
  "serverId": "uuid",
  "serverSecret": "secret",
  "version": 12,
  "action": "apply"
}
```

Acoes usadas atualmente: `apply` e `reject`.

## Snapshot Enviado Pelo Plugin

O snapshot possui estas areas:

- `modules`
- `permissions`
- `prefixVisual`
- `tags`
- `vips`
- `messages`
- `discord`
- `login`
- `clearLag`
- `shop`
- `missions`
- `blockedItems`

O servidor compara o draft recebido com o `liveSnapshot`. O plugin calcula areas alteradas, aplica cada area e depois confirma a versao.

## O Que O Aplicar Faz No Servidor

O metodo `applyPanelSnapshot` aceita mudancas por area. Na pratica, o painel web nao altera diretamente o servidor. Ele altera um draft remoto.

O servidor so muda quando um administrador executa:

```text
/aurapainel aplicar
```

O fluxo de aplicacao:

1. Busca o draft pendente.
2. Verifica se existe `hasPending`.
3. Le `version`, `snapshot` e `liveSnapshot`.
4. Calcula as areas alteradas.
5. Aplica as areas suportadas.
6. Recarrega os managers afetados.
7. Confirma a versao com `action=apply`.
8. Mostra no chat as areas ajustadas.

O fluxo de rejeicao apenas confirma `action=reject`; ele nao aplica nenhuma mudanca local.

## Areas Editaveis Atualmente

### Modulos

Ativa/desativa os 35 modulos registrados no `ModuleToggleManager`.

### Permissoes

Edita grupos, permissoes, comandos permitidos e comandos visiveis.

### PrefixVisual

Edita visual de chat, nametag, tablist, glyphs, cores e placeholders.

### Tags

Edita cargos visuais e configuracoes relacionadas a tags.

### VIPs

Edita definicoes VIP, aliases, itens, kits, lore, nomes, brilho e encantamentos.

### Messages

Edita regras, ajuda e mensagens configuraveis.

### Discord

Edita configuracoes do link/bridge, mas o token do bot deve continuar tratado como segredo de servidor.

### Login

Edita configuracoes de login, multiconta, trusted IP, AuraClient e rotas de autenticacao.

### ClearLag

Edita ativacao, idade minima, intervalo, avisos, itens alvo e ignorar nomes customizados.

### Shop

Edita catalogo, categorias, precos, itens e configuracoes da loja.

### Missions

Edita categorias, objetivos, recompensas e configuracoes de autosave/cooldown.

### BlockedItems

Edita ativacao, lista de materiais, verificacao do Ender Chest e notificacao.

## Problemas E Limites Do Modelo Atual

### Dependencia da API antiga

O plugin esta acoplado a `https://rochaproject.qzz.io`. Se esse dominio nao esta acessivel, `link`, `sync`, `pending`, `apply` e `reject` nao funcionam, mesmo que a UI esteja hospedada no GitHub.

### Segredo no servidor

`serverSecret` nunca deve ir para HTML, JavaScript publico, GitHub Pages ou cliente do navegador.

### O navegador nao deve falar diretamente com o plugin

O site publico nao consegue acessar diretamente a API interna do servidor Minecraft de forma segura. O Worker precisa intermediar autenticacao, drafts e confirmacoes.

### Snapshot pode conter dados sensiveis

O snapshot inclui permissoes, configuracoes de login, Discord, VIPs e possivelmente URLs/token fields. O Worker deve remover ou mascarar segredos antes de entregar dados ao navegador.

### Aplicacao e assincrona

O plugin aplica o draft localmente e confirma depois. A UI precisa exibir estados `pending`, `applying`, `applied`, `rejected` e `error`, em vez de assumir sucesso imediato.

## Ordem Correta De Implementacao

Antes de decidir D1, KV, Durable Objects ou qualquer persistencia final, precisamos entender o backend antigo real. O plugin ja tem um protocolo funcional e a prioridade correta e:

1. Mapear o backend antigo real.
2. Descobrir como o painel antigo guarda `servers`, `drafts`, `sessions`, `version` e `serverSecret`.
3. Documentar o contrato real de cada endpoint.
4. Reproduzir esse contrato no Worker sem quebrar o plugin.
5. Validar o fluxo em ambiente de teste com o Worker e sem banco final ainda.
6. Somente depois decidir banco, cache ou filas.

Essa ordem e mais segura do que assumir `D1` ou `KV` antes de conhecer a estrutura existente.

## Arquitetura Recomendada: GitHub Pages + Cloudflare Worker

### GitHub Pages

Responsavel somente por:

- UI do AuraPanel.
- Paginas estaticas.
- Login visual/sessao do usuario.
- Edicao de formularios.
- Preview de mudancas.
- Comparacao live versus draft.

Nunca colocar no GitHub:

- `serverSecret`.
- Token Discord.
- Credenciais de banco.
- Chaves de assinatura privadas.

### Cloudflare Worker

Responsavel por:

- Receber o codigo temporario criado pelo plugin.
- Validar `serverId` + `serverSecret` em chamadas do servidor.
- Reproduzir o contrato do backend antigo, ate a compatibilidade funcional ser confirmada.
- Intermediar o fluxo entre o plugin e a interface publica.
- Entregar ao site apenas dados autorizados.
- Receber edicoes e criar nova versao do draft.
- Responder ao plugin em `/pending`.
- Confirmar `apply` ou `reject`.
- Mascarar segredos e validar schema.
- Aplicar rate limit, expiracao e auditoria.

Importante: o Worker ainda nao e a escolha final do mecanismo de persistencia. Primeiro ele deve reproduzir o comportamento real do sistema antigo.

### Persistencia ainda nao decidida

Ainda nao e prudente escolher automaticamente D1, KV ou Durable Objects.

Isso so deve acontecer depois de responder:

- onde `servers` sao guardados;
- onde `drafts` sao guardados;
- como `version` e incrementada;
- como `link` expira;
- como a sessao do navegador e validada;
- como `serverSecret` e autenticado;
- como o `confirm` previne versoes antigas;
- quais campos do `snapshot` podem virar UI publica.

## API Futura Do Worker

### Criar ou consumir sessao

```text
POST /api/panel/session/start
POST /api/panel/session/consume
```

### Dados do servidor

```text
GET /api/panel/servers/:serverId/live
GET /api/panel/servers/:serverId/draft
```

### Editar draft

```text
PUT /api/panel/servers/:serverId/draft
POST /api/panel/servers/:serverId/draft/publish
POST /api/panel/servers/:serverId/draft/discard
```

### Endpoints para o plugin

Manter contrato separado e autenticado:

```text
POST /api/aura/panel/link/start
POST /api/aura/panel/server/sync
POST /api/aura/panel/server/pending
POST /api/aura/panel/server/draft/confirm
```

A ideia e trocar somente o `apiBaseUrl` do plugin em uma etapa futura, sem misturar API publica do navegador com API autenticada do servidor.

## Recomendacao De UI Fullscreen

A tela completa do AuraPanel deve ter:

- Barra superior com servidor selecionado, status online e idioma.
- Navegacao lateral por areas do snapshot.
- Area central de formulario.
- Painel lateral de preview/diff.
- Barra inferior com `Salvar rascunho`, `Ver alteracoes`, `Aplicar no servidor` e `Rejeitar`.
- Indicador de versao do draft.
- Aviso claro quando o servidor estiver offline ou sem sincronizacao recente.
- Confirmacao forte antes de aplicar mudancas.
- Historico de auditoria por usuario, data e area.

## Plano De Implementacao Futuro

1. Mapear o backend antigo real, endpoint por endpoint.
2. Listar os campos e schemas retornados em cada resposta do backend atual.
3. Registrar o comportamento real de `link`, `sync`, `pending`, `draft`, `confirm`, `version` e `session`.
4. Reproduzir o contrato no Worker sem banco final ainda.
5. Criar UI fullscreen usando fixtures `liveSnapshot` e `draft` em ambiente de teste.
6. Validar `apply/reject` e `version` pelo fluxo real do plugin.
7. Apenas depois, decidir se D1, KV, Durable Objects ou uma combinacao e necessaria.
8. Trocar `apiBaseUrl` no plugin somente apos confirmar compatibilidade.
9. Adicionar auditoria, rate limit e rollback em uma segunda camada.

## Conclusao

A ordem correta e: primeiro compreender o backend antigo, depois reproduzir o contrato e so entao decidir persistencia. O plugin ja possui a base do protocolo correto: `serverId`, `serverSecret`, `sync`, `pending`, `draft`, `version` e `confirm`. O problema principal nao e inventar um sistema novo do zero; e substituir a API antiga por uma camada compatível e segura, com GitHub Pages na frente e Cloudflare Worker no meio. O navegador nunca deve receber segredos do server, e a escolha de D1/KV/Do deve vir depois de entender precisamente como o backend antigo funciona hoje.
