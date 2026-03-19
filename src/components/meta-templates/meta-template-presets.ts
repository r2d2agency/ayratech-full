export interface MetaTemplatePreset {
  id: string;
  name: string;
  displayName: string;
  category: "UTILITY" | "MARKETING";
  language: string;
  bodyText: string;
  headerText?: string;
  footerText?: string;
}

export interface MetaTemplateSegment {
  id: string;
  label: string;
  icon: string;
  presets: MetaTemplatePreset[];
}

export const META_TEMPLATE_SEGMENTS: MetaTemplateSegment[] = [
  {
    id: "imobiliaria",
    label: "🏢 Imobiliária",
    icon: "🏢",
    presets: [
      {
        id: "imob_resposta_inicial",
        name: "imob_resposta_inicial",
        displayName: "Resposta Inicial Lead",
        category: "UTILITY",
        language: "pt_BR",
        bodyText: `Olá, {{1}}! Tudo bem?

Recebemos seu interesse no imóvel: {{2}}.

Para te atender melhor, me conta:
• Você busca compra ou locação?
• Melhor horário para um corretor falar com você: {{3}}

Já vamos direcionar seu atendimento 😊`,
      },
      {
        id: "imob_agendamento_corretor",
        name: "imob_agendamento_corretor",
        displayName: "Agendamento de Corretor",
        category: "UTILITY",
        language: "pt_BR",
        bodyText: `Olá, {{1}}! 👋

Perfeito, já organizamos por aqui.

Um corretor entrará em contato com você no período: {{2}}.

Fique atento(a), combinado?`,
      },
      {
        id: "imob_followup",
        name: "imob_followup",
        displayName: "Follow-up de Interesse",
        category: "MARKETING",
        language: "pt_BR",
        bodyText: `Olá, {{1}}!

Vi que você demonstrou interesse em um imóvel recentemente.

Ainda faz sentido pra você? Podemos te mostrar novas opções dentro do seu perfil 😊`,
      },
      {
        id: "imob_envio_opcoes",
        name: "imob_envio_opcoes",
        displayName: "Envio de Opções",
        category: "MARKETING",
        language: "pt_BR",
        bodyText: `Olá, {{1}}!

Separei algumas opções que podem fazer sentido pra você:

{{2}}

Se quiser, posso te explicar melhor ou agendar uma visita.`,
      },
    ],
  },
];
