# Manual de Operação: Filtro de Produtos por Rede (Grupo de Supermercados)

Este documento descreve o funcionamento e o passo a passo para utilização do recurso de **Filtro de Produtos por Rede**.

## Visão Geral

O sistema agora permite associar Produtos a **Redes (Grupos de Supermercados)** específicas. 
Isso garante que, ao criar ou editar uma Rota de Visitas, o usuário visualize apenas os produtos que fazem parte do sortimento daquela Rede, além dos produtos globais.

## Como Funciona a Regra

1.  **Produto sem Rede (Global):** Se nenhum grupo for selecionado no cadastro do produto, ele será considerado "Global" e aparecerá para **todos** os supermercados.
2.  **Produto com Rede (Restrito):** Se um ou mais grupos forem selecionados, o produto aparecerá **apenas** para supermercados que pertençam a esses grupos.
3.  **Supermercado sem Grupo:** Se o supermercado da rota não tiver um grupo definido, ele verá apenas os produtos Globais.

---

## Passo a Passo

### 1. Configurar Produtos (Associar a Redes)

Para restringir um produto a uma ou mais redes:

1.  Acesse o menu **Produtos**.
2.  Clique em **Novo Produto** ou **Editar** um produto existente.
3.  No formulário, localize o campo **Redes (Opcional)** (geralmente abaixo do Cliente/Fabricante).
4.  Clique no campo para abrir a lista de redes disponíveis.
5.  Selecione as redes desejadas (ex: "Rede A", "Rede B").
    *   *Nota: Se não selecionar nenhuma, o produto continuará visível para todas as redes.*
6.  Clique em **Salvar**.

### 2. Criar ou Editar Rotas

Ao planejar uma rota, o sistema aplicará o filtro automaticamente:

1.  Acesse o menu **Rotas**.
2.  No editor de rotas, adicione um **Supermercado** (ex: "Loja 01 - Rede A").
3.  No card do supermercado adicionado, clique em **+ Adicionar Produtos**.
4.  O modal de seleção abrirá com o título indicando a rede (ex: *"Selecionar Produtos | Rede A"*).
5.  **O que você verá na lista:**
    *   Produtos marcados especificamente para a "Rede A".
    *   Produtos Globais (sem nenhuma rede marcada).
    *   *Produtos exclusivos da "Rede B" NÃO aparecerão na lista.*
6.  Selecione os produtos desejados e confirme.

### 3. Verificar Clientes Disponíveis

No passo de seleção de clientes dentro do modal de produtos:

*   O sistema exibirá apenas os Clientes (Fabricantes) que possuem pelo menos um produto disponível para aquela rede.
*   Isso evita que você selecione um cliente e encontre uma lista vazia de produtos.

---

## Exemplos de Uso

| Produto | Redes Configuradas | Supermercado da Rota | Aparece na Lista? | Motivo |
| :--- | :--- | :--- | :--- | :--- |
| Coca-Cola 2L | Nenhuma (Vazio) | Qualquer Supermercado | **SIM** | Produto Global |
| Arroz Marca X | Rede Top | Loja 1 (Rede Top) | **SIM** | Rede Coincide |
| Arroz Marca X | Rede Top | Loja 2 (Rede Max) | **NÃO** | Rede Diferente |
| Feijão Marca Y | Rede Top, Rede Max | Loja 2 (Rede Max) | **SIM** | Rede Coincide |
| Sabão Z | Rede Top | Supermercado S/ Grupo | **NÃO** | Supermercado sem grupo não vê restritos |

## Solução de Problemas

*   **"Não encontro o produto na lista da rota":** 
    *   Verifique no cadastro do Produto se ele está restrito a alguma rede.
    *   Verifique no cadastro do Supermercado se ele pertence à rede correta.
*   **"O produto aparece onde não deveria":**
    *   Verifique se o campo "Redes" no cadastro do produto está vazio (tornando-o global).
