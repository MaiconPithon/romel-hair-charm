

## Barbearia do Romel — Plano de Recriação

### Visão Geral
Recriar o sistema completo de agendamento para barbearia com landing page, fluxo de agendamento do cliente, painel administrativo e backend com Supabase (Lovable Cloud).

---

### 1. Backend — Banco de Dados (Lovable Cloud / Supabase)
Criar todas as tabelas e configurações:
- **services** — Serviços oferecidos (nome, preço, duração, ordem, ativo)
- **appointments** — Agendamentos (cliente, telefone, serviço, data, hora, status, pagamento, preço)
- **schedule_config** — Configuração de horários por dia da semana (aberto/fechado, horário de abertura/fechamento, intervalo de almoço)
- **blocked_slots** — Bloqueio de horários/dias específicos
- **avaliacoes** — Avaliações dos clientes (estrelas, nome)
- **business_settings** — Configurações gerais do negócio (nome, chave PIX, etc.)
- **user_roles** — Controle de permissões admin
- Políticas de segurança RLS para cada tabela
- Dados iniciais (serviços padrão, configuração de agenda)

### 2. Landing Page (Página Inicial)
- Hero section com imagem de fundo customizável, logo e nome do negócio
- Exibição da média de avaliações (estrelas)
- Informações de localização, horário e telefone
- Botão "Agendar Horário" e botão flutuante do WhatsApp
- Tabela de preços dos serviços
- Design escuro/elegante com tema de barbearia

### 3. Fluxo de Agendamento (Página /agendar)
Wizard em etapas:
1. **Selecionar serviço** — Lista de serviços ativos com preço (seleção múltipla com checkbox)
2. **Escolher data** — Calendário respeitando dias de funcionamento e bloqueios
3. **Escolher horário** — Slots gerados dinamicamente, respeitando horários ocupados e intervalos
4. **Informações do cliente** — Nome e telefone (WhatsApp)
5. **Pagamento** — Opção PIX (com QR code/chave) ou dinheiro
6. **Confirmação** — Resumo com todos os dados e envio do agendamento
7. **Tela de confirmado** — Mensagem de sucesso com opção de avaliar (estrelas) e enviar mensagem via WhatsApp

### 4. Painel Administrativo (/admin)
- **Login de admin** — Autenticação via Supabase Auth (email/senha) com verificação de role admin
- **Dashboard de agendamentos** — Filtro por data, tabela com status, ações (confirmar, finalizar, cancelar, editar, excluir)
- **Edição de agendamento** — Modal para alterar dados do agendamento
- **Gerenciamento de serviços** — Adicionar, editar preço/nome/duração, ativar/desativar, reordenar
- **Configuração de horários** — Abrir/fechar dias da semana, definir horários de abertura/fechamento e intervalo
- **Bloqueio de horários** — Bloquear datas ou horários específicos com motivo
- **Venda rápida** — Registrar vendas avulsas (sem agendamento prévio)
- **Configuração de aparência** — Personalizar imagem de fundo, logo, cores do site
- **Configurações gerais** — Nome do negócio, chave PIX, WhatsApp
- **Reset de senha** — Página para redefinir senha do admin

### 5. Funcionalidades Extras
- Botão flutuante do WhatsApp em todas as páginas
- Aparência customizável (imagem de fundo, logo) via tabela business_settings
- Hook `useAppearance` e `useBusinessName` para carregar configurações dinamicamente
- Responsividade mobile-first

