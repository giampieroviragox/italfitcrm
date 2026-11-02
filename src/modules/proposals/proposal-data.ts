export type ProposalId =
  "oggi" | "ritmo" | "vicino" | "studio" | "essenziale" | "team";
export type Screen = "home" | "piano" | "calendario" | "profilo" | "accesso";
export type ServiceMode = "entrambi" | "online" | "sede";
export type Device = "mobile" | "desktop";
export interface Proposal {
  id: ProposalId;
  number: string;
  name: string;
  claim: string;
  summary: string;
  color: string;
  home: string;
  plan: string;
  calendar: string;
  mobile: string;
  desktop: string;
  tradeoff: string;
  sources: number[];
}
export const sources = [
  {
    name: "Team Italfit",
    url: "https://www.teamitalfit.com/",
    note: "Identità osservata: bianco/nero, rosso, titoli sportivi e centralità del coach. I contenuti non sono stati copiati.",
  },
  {
    name: "Mobbin · Sports",
    url: "https://mobbin.com/explore/mobile/app-categories/sports",
    note: "Schermate pubbliche: dashboard Any Distance, tab bar, progress indicator e dettaglio evento Apple Sports. Salvataggio e copia richiedono un account; non utilizzati.",
  },
  {
    name: "Nike Training Club",
    url: "https://www.nike.com/ntc-app",
    note: "Presentazione pubblica: programmi, allenamenti per obiettivo, guida e pianificazione. Riferimento al flusso, non replica di schermate autenticate.",
  },
  {
    name: "Hevy",
    url: "https://www.hevyapp.com/",
    note: "Presentazione pubblica con UI: registrazione serie, recuperi, note e routine; continuità tra telefono e desktop.",
  },
  {
    name: "ABC Trainerize",
    url: "https://www.trainerize.com/",
    note: "Presentazione pubblica: rapporto coach/cliente, programmi assegnati e continuità tra online e presenza. Nessuna chat viene aggiunta alle proposte.",
  },
  {
    name: "Cal.com",
    url: "https://cal.com/it/",
    note: "Demo pubblica di prenotazione: separazione giorno/orario, durata, fuso e conferma. Non è stata effettuata alcuna prenotazione.",
  },
];
export const proposals: Proposal[] = [
  {
    id: "oggi",
    number: "01",
    name: "Oggi",
    claim: "Apri. Sai cosa fare.",
    summary:
      "La prossima azione domina la home. Calma, leggibile, immediata anche al primo accesso.",
    color: "#365448",
    home: "Un allenamento in evidenza, poi la prossima prenotazione e una nota del coach.",
    plan: "Sessioni ordinate per giornata. Una schermata guidata per allenarsi senza cercare tra le righe.",
    calendar:
      "Giorni scorrevoli, orari leggibili, riepilogo prima della conferma.",
    mobile:
      "Tre destinazioni principali a portata di pollice, un’azione primaria per schermata.",
    desktop:
      "Navigazione laterale e prossimo appuntamento affiancato al piano del giorno.",
    tradeoff:
      "Meno panoramica iniziale: la settimana si apre dal piano. È il compromesso più equilibrato.",
    sources: [0, 2, 3],
  },
  {
    id: "ritmo",
    number: "02",
    name: "Ritmo",
    claim: "Una settimana da organizzare.",
    summary:
      "Planner orizzontale: il piano si legge per giornate e la prenotazione si fa direttamente sulla griglia della settimana.",
    color: "#3658cf",
    home: "Una settimana navigabile con un’attività chiara per giorno, senza metriche superflue.",
    plan: "Tre giornate a confronto in una lavagna settimanale; prescrizioni e avvio sotto la selezione.",
    calendar:
      "Sette colonne giorno/orario: tocchi direttamente lo slot. Su mobile scorri le colonne della settimana.",
    mobile:
      "Planner a scorrimento orizzontale e barra inferiore a schede; niente menu laterale.",
    desktop: "Spazio usato per confrontare l’intera settimana e le sessioni.",
    tradeoff:
      "Richiede di capire il giorno selezionato. Ideale per chi si organizza in anticipo.",
    sources: [1, 3, 5],
  },
  {
    id: "vicino",
    number: "03",
    name: "Vicino",
    claim: "Un diario, accompagnato dal coach.",
    summary:
      "Un’esperienza personale, calda e accompagnata. Il metodo viene prima dei numeri.",
    color: "#9b4f35",
    home: "Una nota di Giorgio introduce il prossimo allenamento e spiega il focus della settimana.",
    plan: "Un diario a capitoli espandibili, con lettera del coach, prescrizioni e nota personale nella stessa pagina.",
    calendar:
      "Prima il coach, poi il giorno e gli orari, con riepilogo esplicito.",
    mobile:
      "Testi brevi e gerarchia da taccuino; il workout resta grande e operativo.",
    desktop:
      "Navigazione tipografica da quaderno e pagina centrale con capitoli; superficie calda, senza griglia di card.",
    tradeoff:
      "Meno densità, più lettura. Non implica messaggistica o disponibilità del coach in tempo reale.",
    sources: [0, 4, 2],
  },
  {
    id: "studio",
    number: "04",
    name: "Studio",
    claim: "Entri direttamente nel calendario.",
    summary:
      "La proposta per chi frequenta la sede: disponibilità e appuntamenti vengono prima.",
    color: "#087e84",
    home: "La home è il calendario mensile: selezioni il giorno e prenoti nel pannello degli orari.",
    plan: "Una libreria di sessioni fuori dalla sede: copertine tipografiche, dettagli espandibili e avvio diretto.",
    calendar:
      "Il mese occupa lo spazio principale; il giorno selezionato alimenta un pannello di disponibilità.",
    mobile:
      "Menu in alto, mese compatto e orari sotto: il calendario resta il centro della navigazione.",
    desktop:
      "Giorni, orari e dettagli dell’appuntamento occupano colonne distinte.",
    tradeoff:
      "Meno centrata sul coaching online. Con il solo piano la home dà priorità all’allenamento.",
    sources: [5, 1],
  },
  {
    id: "essenziale",
    number: "05",
    name: "Essenziale",
    claim: "Una scelta per schermata.",
    summary:
      "Il minimo indispensabile, fatto bene. Pochi elementi, contrasti netti, etichette chiare.",
    color: "#252525",
    home: "Due scelte grandi: Il mio piano e Prenota una lezione. Mostra soltanto i servizi inclusi.",
    plan: "Scegli una sessione da una lista, leggi un riepilogo compatto e inizi. Una decisione alla volta.",
    calendar:
      "Prima una schermata di giorni; dopo la scelta appare soltanto la lista degli orari. Poi confermi.",
    mobile:
      "Controlli ampi, navigazione breve, nessuna metrica o grafico da interpretare.",
    desktop:
      "Pagina centrata senza sidebar, navigazione testuale e flusso sequenziale come sul telefono.",
    tradeoff:
      "Meno carattere e meno contesto in home; è la scelta più facile da spiegare al cliente.",
    sources: [5, 2],
  },
  {
    id: "team",
    number: "06",
    name: "Team",
    claim: "Una console sportiva, tutta scura.",
    summary:
      "La direzione più vicina al sito: contrasto forte, rosso e linguaggio sportivo.",
    color: "#e04438",
    home: "Il prossimo allenamento è una testata sportiva; la prenotazione resta una seconda azione chiara.",
    plan: "Console scura: scegli FORZA o CORSA, leggi numeri e prescrizioni su due colonne, poi avvii.",
    calendar:
      "Schedule sportivo scuro, selettore giorni, orari grandi e scheda I tuoi posti per gestire gli appuntamenti.",
    mobile:
      "Aspetto da app sportiva, barra inferiore persistente e pulsanti grandi durante il workout.",
    desktop:
      "Navigazione orizzontale, spazio scuro a tutta larghezza e console di allenamento; nessuna sidebar.",
    tradeoff:
      "Più intensa visivamente. Va confermata la preferenza per titoli sportivi e contrasto deciso.",
    sources: [0, 1, 3],
  },
];
export const sessions = [
  {
    id: "a",
    day: "Lunedì",
    name: "Forza & controllo",
    focus: "Full body · tecnica",
    duration: "45 min",
    kind: "strength",
    exercises: [
      {
        name: "Goblet squat",
        dose: "3 × 10 ripetizioni",
        rest: 60,
        note: "Scendi in controllo e mantieni stabile il busto.",
      },
      {
        name: "Rematore con manubri",
        dose: "3 × 12 ripetizioni",
        rest: 45,
        note: "Gomiti vicini al corpo, senza slanci.",
      },
      {
        name: "Plank",
        dose: "3 × 40 secondi",
        rest: 30,
        note: "Respira, senza perdere l’allineamento.",
      },
    ],
  },
  {
    id: "b",
    day: "Mercoledì",
    name: "Corsa facile",
    focus: "Resistenza · zona 2",
    duration: "35 min",
    kind: "run",
    exercises: [
      {
        name: "Riscaldamento",
        dose: "5 minuti facili",
        rest: 30,
        note: "Aumenta gradualmente il ritmo.",
      },
      {
        name: "Corsa continua",
        dose: "25 minuti · ritmo conversazione",
        rest: 60,
        note: "Mantieni una respirazione regolare.",
      },
      {
        name: "Defaticamento",
        dose: "5 minuti camminando",
        rest: 30,
        note: "Riduci il ritmo in modo graduale.",
      },
    ],
  },
  {
    id: "c",
    day: "Venerdì",
    name: "Forza & resistenza",
    focus: "Circuito · total body",
    duration: "40 min",
    kind: "strength",
    exercises: [
      {
        name: "Affondi alternati",
        dose: "3 × 10 per lato",
        rest: 60,
        note: "Passo stabile e ginocchio in linea.",
      },
      {
        name: "Push-up",
        dose: "3 × 8 ripetizioni",
        rest: 45,
        note: "Scegli l’appoggio che ti permette controllo.",
      },
      {
        name: "Farmer carry",
        dose: "3 × 30 metri",
        rest: 60,
        note: "Passi corti, spalle basse e busto stabile.",
      },
    ],
  },
] as const;
export const slots = [
  {
    id: "s1",
    time: "07:30",
    duration: "60 min",
    coach: "Giorgio",
    name: "Allenamento in sede",
    available: 3,
  },
  {
    id: "s2",
    time: "12:30",
    duration: "60 min",
    coach: "Marta",
    name: "Allenamento in sede",
    available: 1,
  },
  {
    id: "s3",
    time: "18:00",
    duration: "60 min",
    coach: "Giorgio",
    name: "Allenamento in sede",
    available: 0,
  },
  {
    id: "s4",
    time: "19:00",
    duration: "60 min",
    coach: "Marta",
    name: "Allenamento in sede",
    available: 2,
  },
];
export function servicesFor(mode: ServiceMode) {
  return { plans: mode !== "sede", lessons: mode !== "online" };
}
export function prototypeDate(offset: number) {
  const date = new Date(Date.UTC(2026, 10, 2 + offset, 12));
  return {
    number: date.getUTCDate(),
    label: new Intl.DateTimeFormat("it-IT", {
      weekday: "long",
      day: "numeric",
      month: "long",
      timeZone: "Europe/Rome",
    }).format(date),
  };
}
export function nextWorkoutStep(step: number, total: number) {
  return Math.min(Math.max(0, step + 1), total);
}
