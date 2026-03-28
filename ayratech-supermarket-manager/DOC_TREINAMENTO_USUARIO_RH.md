# Treinamento do Usuário (RH / Ponto / Afastamentos)

## Modificações implementadas nesta entrega

### 1) Documentos do App vinculados ao promotor (colaborador)
- Antes: o upload/consulta de documentos podia ficar vinculado ao usuário logado, causando divergência na visualização pelo RH.
- Agora: o App usa o colaborador do token (employeeId do usuário) para gravar e listar documentos.
- Impacto no RH: na guia de Afastamentos do colaborador, o RH consegue ver os documentos corretos vinculados ao promotor.

### 2) Atestado (campos obrigatórios)
Para atestado, os campos passam a contemplar:
- CRM (fixo)
- Local de atendimento
- CID
- Nome do médico

### 3) RH → Relatórios e conferências de ponto
Na tela de Gestão de Ponto, foram adicionadas abas/relatórios para:
- Lista de ponto diário (com filtro por colaborador)
- Ocorrências (padrão “dia anterior”)
- Marcação manual (diário)
- Marcações ímpares (diário)
- Faltas (diário)
- Relatório de horas (50%, 100%, adicional noturno, banco e horas faltas)
- Banco de horas (consulta e ajuste manual de saldo por competência)

## Como usar (Web Admin)

### A) Afastamentos → Criar Atestado
1. Abra **Colaboradores** → selecione o colaborador → **Afastamentos**.
2. Clique em **Novo afastamento** e selecione **Atestado**.
3. Preencha:
   - CID
   - Nome do médico
   - Local de atendimento
   - CRM
4. Salve o afastamento.

### B) RH → Gestão de Ponto Eletrônico
Abra a tela **Gestão de Ponto Eletrônico** e use as abas:

#### 1) Eventos
- Mostra os registros “crus” agrupados por colaborador e data, com Entrada/Almoço/Saída.
- Filtro por colaborador e período.
- Permite **Lançamento Manual** (ajuste), que fica identificado como “Manual”.

#### 2) Ponto diário
- Mostra um resumo por colaborador para uma data:
  - Escala do dia (se existir)
  - Entrada/Almoço/Saída
  - Trabalhadas, Previstas, Extras e Faltas (diferença)
  - Indicadores: “Manual” e “Ímpar”

#### 3) Ocorrências (dia anterior)
- Para conferência de ponto e inclusão de faltas:
  - Marcação faltando (ENTRY/EXIT/LUNCH_START/LUNCH_END)
  - Marcações ímpares
  - Marcação manual
  - Atraso e saída antecipada (com tolerância da escala)

#### 4) Manuais
- Lista as marcações manuais do dia, com “editado por” e motivo.

#### 5) Ímpares
- Lista colaboradores com quantidade ímpar de marcações no dia.

#### 6) Faltas
- Lista colaboradores sem marcações no dia (quando existe escala do dia e não há afastamento aprovado no período).

#### 7) Horas
- Consolida por colaborador no período:
  - Extra 50%
  - Extra 100% (domingo)
  - Adicional noturno (minutos entre 22:00–05:00)
  - Banco (saldo do período = trabalhadas - previstas)
  - Horas faltas

#### 8) Banco
- Consulta o **saldo de banco** por competência (AAAA-MM).
- Permite **ajuste manual**:
  - Seleciona colaborador
  - Competência
  - Delta (horas): positivo soma no banco, negativo reduz
  - Motivo

## Funções já existentes no sistema (para treinamento)

### Ponto (App / Web Admin)
- Bater ponto pelo App (Entrada/Almoço/Saída).
- Visualizar pontos do dia no App.
- Visualizar eventos no Web Admin (aba “Eventos”).
- Lançar marcação manual pelo Web Admin (correções e justificativas).
- Exportar relatório em Excel do período filtrado.

### Afastamentos (RH)
- Cadastrar afastamento por colaborador.
- Anexar/visualizar documentos do colaborador na guia de Afastamentos.
- Registrar atestado com dados clínicos básicos (CID, médico, local e CRM).

### Rotas / Operação (Agendamento e Recorrência)
O sistema permite o planejamento eficiente das visitas dos promotores aos supermercados. Abaixo está a lógica de como funciona o agendamento de rotas e suas recorrências:

#### 1) Criação Simples e Editor de Calendário
- Ao criar uma nova rota, você pode usar o **Calendário** para selecionar múltiplas datas de uma só vez.
- O sistema valida a disponibilidade do promotor para evitar conflitos de agendamento na mesma data/hora.
- As rotas criadas juntas (em lote) recebem um vínculo de grupo (`recurrenceGroup`), permitindo que edições futuras sejam aplicadas a todas elas de uma vez, se desejado.

#### 2) Duplicação e Recorrência Automática
A partir de uma rota já existente (mesmo que seja de uma única data), é possível **Duplicar/Gerar Recorrência**:
- **Dias da semana:** Você seleciona em quais dias da semana essa rota deve se repetir (ex: Segunda, Quarta e Sexta).
- **Período:** Você define por quanto tempo essa regra deve ser aplicada (ex: por 4 semanas ou por 3 meses).
- **Lógica do Sistema:** O sistema calcula todas as datas válidas dentro do período escolhido que caem nos dias da semana selecionados e agenda a mesma rota (mesmos supermercados, marcas e promotor) para essas datas.

#### 3) Edição de Rotas Recorrentes
Quando você tenta editar uma rota que faz parte de uma recorrência (grupo), o sistema pergunta como você deseja salvar:
- **Somente esta rota:** Altera apenas a visita daquele dia específico. O vínculo com o grupo é quebrado para essa data.
- **Esta e as próximas:** Aplica a alteração para a rota do dia selecionado e **para todas as rotas futuras** daquele mesmo grupo de recorrência.
  - *Como funciona (técnico):* O sistema remove as rotas futuras daquele grupo que ainda estão com status `DRAFT` (Rascunho) ou `CONFIRMED` (Confirmado) e recria as novas visitas com as alterações atualizadas (ex: inclusão de um novo supermercado ou mudança de promotor), mantendo o histórico das visitas passadas intacto.

#### 4) Exclusão em Lote
- Da mesma forma que na edição, ao excluir uma rota recorrente, você tem a opção de apagar apenas aquela visita ou excluir toda a série (a rota atual e as futuras).
- Também existe uma funcionalidade de "Remoção em Lote" (`batch`), onde é possível limpar a agenda de um promotor selecionando um período (Data Inicial e Data Final).

#### Check-in/Check-out e Relatórios
- Os promotores visualizam as rotas de hoje e dos próximos dias em seu App.
- A execução das rotas recorrentes gera dados individuais de Check-in, Check-out e preenchimento de checklist para cada data.
- Relatórios gerenciais compilam a assiduidade e a performance (Rotas Concluídas vs. Agendadas).

## Endpoints (referência técnica)
- Documentos do colaborador pelo token:
  - `GET /employees/me/documents`
  - `POST /employees/me/documents`
  - `PATCH /employees/me/documents/:id/sign`
- RH (Folha de Ponto):
  - `POST /employees/documents/timesheets/generate` (gera e vincula todas as folhas da competência, opção geral)
  - `GET /employees/documents/timesheets/general/export?competence=YYYY-MM` (baixa planilha consolidada)
- RH (Relatórios de Ponto):
  - `GET /time-clock/reports/daily?date=YYYY-MM-DD&employeeId=...`
  - `GET /time-clock/reports/occurrences?date=YYYY-MM-DD&employeeId=...`
  - `GET /time-clock/reports/manual?date=YYYY-MM-DD&employeeId=...`
  - `GET /time-clock/reports/odd?date=YYYY-MM-DD&employeeId=...`
  - `GET /time-clock/reports/overtime?startDate=YYYY-MM-DD&endDate=YYYY-MM-DD&employeeId=...`
- Banco de horas:
  - `GET /time-clock/balances?competence=YYYY-MM&employeeId=...`
  - `POST /time-clock/balances/adjust`

## Folha de Ponto (Geração, Assinatura e Holerite)

- Geração Automática (1º dia útil):
  - Todo mês, no primeiro dia útil às 06:00, o sistema gera a folha da competência anterior para todos e vincula no perfil de cada colaborador (Documento “folha_ponto”, requer assinatura).
- Geração Manual (RH):
  - Em “Gestão de Ponto Eletrônico”, selecione a competência (YYYY-MM) e use:
    - “Gerar folhas (mês)”: cria e vincula todas as folhas daquela competência.
    - “Folha geral”: faz download do consolidado em XLSX.
- Assinatura no App:
  - No App (Meus Arquivos), documentos que exigem assinatura exibem o botão “Assinar”.
  - Ao assinar, são registrados dados para auditoria: data/hora, geolocalização (quando permitida), nome completo, CPF (se disponível), informações do dispositivo (User-Agent, plataforma) e a imagem desenhada da assinatura. Esses dados são armazenados no documento e um PDF assinado é gerado com carimbo.
  - O PDF assinado contém: área de assinatura com o desenho, carimbo com hash (SHA-256) e QR Code de verificação pública.
- Holerite:
  - Envio em massa via Web Admin (aba Documentos) anexando um único arquivo/competência e selecionando o público; o sistema vincula nos colaboradores e notifica no App automaticamente.

### Validação e Envio (Workflow RH)
- Ao gerar folhas, ficam com status “aguardando” (pendente). Isso permite ajustes manuais de horas por colaborador.
- Após validação, use o endpoint de aprovação para marcar as folhas como “ok validado” e notificar os colaboradores:
  - `POST /employees/documents/timesheets/approve?competence=YYYY-MM`
- Apenas após a aprovação é enviada a notificação aos colaboradores. As pendências podem ser exibidas no dashboard de RH e via notificações internas.
