# Regras de Negócio - Ayratech Merchandising

Este documento detalha as regras de negócio e fluxos operacionais do sistema Ayratech, servindo como guia para desenvolvimento e ajustes futuros.

## 1. Atores do Sistema

*   **Administrador (Admin):** Usuário da Agência/Ayratech. Tem acesso total ao sistema, configurações de branding, gestão de usuários e visão global de todos os clientes.
*   **Cliente (Fabricante/Marca):** Empresa contratante do serviço de merchandising. Visualiza apenas seus próprios produtos, relatórios e desempenho.
*   **Supervisor:** Responsável por uma equipe de promotores e uma rota de supermercados.
*   **Promotor:** Usuário de campo (App Mobile). Realiza as visitas, check-in, coleta de dados e fotos.

## 2. Estrutura de Dados Principal

### 2.1. Clientes (Fabricantes)
*   Cada cliente possui um contrato ativo ou inativo.
*   Um cliente pode ter múltiplos produtos (SKUs).
*   **Regra:** Um produto DEVE pertencer a um único cliente.
*   **Branding:** O sistema pode adaptar cores e logos na visualização do dashboard do cliente (white-label parcial).

### 2.2. Produtos (SKUs)
*   Itens que serão auditados no ponto de venda.
*   Atributos obrigatórios: Nome, SKU (código), Categoria.
*   Atributos importantes: 
    *   **Código de barras (EAN):** Essencial para leitura rápida no App via câmera.
    *   **Status:** Controle de 'active'/'inactive' para produtos que saíram de linha.
    *   **Imagem:** Referência visual para o promotor encontrar o produto na loja.

### 2.3. Supermercados (PDVs)
*   Locais onde o serviço é executado.
*   Classificação: Ouro, Prata, Bronze (define prioridade ou frequência de visita).
*   Geolocalização: Latitude/Longitude obrigatórias para validação de check-in.

### 2.4. Funcionários (Recursos Humanos)
*   **Cadastro Unificado:** Dados pessoais (CPF, RG, Endereço) e dados contratuais (Salário, Benefícios) centralizados.
*   **Foto Facial:** 
    *   Obrigatória para identificação visual e segurança.
    *   **Regra Técnica:** Upload deve ser validado (Máx 5MB). O sistema deve servir esse arquivo estático publicamente para o App.
*   **Acesso ao Aplicativo:** 
    *   O cadastro de funcionário permite a criação automática ("toggle") de um usuário de sistema.
    *   Este usuário herda o perfil `Promotor` e usa o email do funcionário como login.

### 2.5. Evidências (Fotos)
*   **Tipos de Registro:**
    *   **Antes (Before):** Estado inicial do ponto de venda/gôndola antes da intervenção.
    *   **Depois (After):** Resultado do trabalho do promotor (abastecimento, organização, precificação).
    *   **Estoque (Storage):** Registro de produtos em estoque/aéreo para comprovar ruptura virtual ou excesso.
*   **Associação:** Toda foto deve estar vinculada a uma **Categoria** de produtos específica da visita.

## 3. Fluxos Operacionais

### 3.1. Gestão de Rotas e Planejamento
1.  **Planejador Visual:** O Supervisor/Admin seleciona um Promotor e uma Data.
2.  **Montagem da Rota:** Adiciona-se uma lista sequencial de Supermercados (PDVs) a serem visitados.
    *   **Reordenação:** É possível ajustar a ordem de visita para otimizar o deslocamento.
    *   **Horários:** Definição de horário previsto de chegada e duração estimada da visita.
3.  **Vinculação de Produtos (Conferência):**
    *   **Regra de Negócio Crítica:** A rota não define apenas "Onde ir", mas "O que fazer".
    *   Para cada PDV na rota, deve-se selecionar **quais produtos** serão conferidos.
    *   *Exemplo:* No Supermercado A, conferir apenas Bebidas. No Supermercado B, conferir Bebidas e Salgadinhos.
4.  **Templates e Duplicação:**
    *   Rotas frequentes podem ser salvas como **Modelos (Templates)**.
    *   O Supervisor pode **Duplicar** uma rota existente para outro dia ou outro promotor, agilizando o planejamento semanal.
5.  **Ciclo de Vida da Rota (Status):**
    *   `Rascunho (Draft)`: Em planejamento (Cor Branca/Cinza). Invisível ou marcado como provisório para o promotor.
    *   `Confirmado (Confirmed)`: Validado pelo supervisor (Cor Verde). Pronto para execução.
    *   `Concluído (Completed)`: Executado pelo promotor (Cor Esmeralda/Destaque).

### 3.2. Execução (App Mobile)
*   **Check-in:** O promotor só pode realizar check-in se estiver num raio de X metros (configurável, ex: 200m) do PDV.
*   **Conferência (Checklist de Produtos):**
    *   O App exibe a lista de produtos vinculados àquele PDV específico na rota.
    *   **Ações:** Marcar como `Conferido` (Check) ou deixar pendente.
    *   **Observações:** Possibilidade de adicionar notas de texto por produto (ex: "Produto sem preço", "Embalagem danificada").
*   **Tarefas Adicionais:** Fotos de Loja, Validação de Planograma.
*   **Check-out:** Finaliza a visita e sincroniza os dados.

### 3.3. Dashboard e Relatórios
*   **Visão Admin:** Vê produtividade de todos os promotores, alertas de ruptura global e status dos contratos.
*   **Visão Cliente:** Vê apenas dados dos seus produtos (Preço médio, Presença/Ruptura, Fotos das lojas).
*   **Galeria de Fotos:** 
    *   As fotos devem ser exibidas agrupadas por **Categoria**.
    *   Dentro de cada categoria, devem ser separadas visualmente por tipo: **Antes**, **Depois** e **Estoque**.
    *   Fotos antigas ou sem tipo definido devem aparecer como "Geral".

## 4. Regras de Acesso e Segurança (Autenticação)

*   **Login:** Via JWT (Token).
*   **Permissões (RBAC):**
    *   `admin`: Acesso total (CRUD de Clientes, Produtos, Usuários).
    *   `rh` / `manager`: Gestão de funcionários e rotas.
    *   `supervisor`: Acesso a rotas e relatórios da sua equipe.
    *   `promotor`: Acesso apenas ao App Mobile (sua rota do dia).
    *   `cliente_viewer`: Acesso apenas leitura aos dashboards do seu contrato.

## 5. Integrações Previstas

*   **API de Mapas:** Para roteirização e visualização "Live Map" dos promotores.
*   **Serviço de IA:** Para processamento de imagens (reconhecimento de produtos).
*   **Exportação:** Relatórios em PDF/Excel para clientes.

---
*Documento em evolução. Última atualização: 09/01/2026*
