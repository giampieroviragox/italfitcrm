# Team Italfit · Product & design system

Estrazione prima dell’implementazione, 31 ottobre 2026. Riferimento: [ElevenLabs Home](https://elevenlabs.io/app/home). Metodo: Computer Use, screenshot fornito dall’utente, Home autenticata nella sessione Chrome esistente e stili calcolati del login nel browser integrato. Nessun uso di Firecrawl.

## Evidenza e limiti

La Home autenticata mostra sidebar chiara, navigazione con icone outline, selezione grigia, header con ricerca globale e shortcut ⌘K, menu profilo, azioni veloci per funzione e tab Recents/Quickstarts. La ricerca espone una combobox, azioni raggruppate e scorciatoia Invio. La schermata di login usa gli stessi asset CSS pubblici del prodotto. Studio e Voices sono stati aperti, ma il contenuto non ha completato il caricamento nel browser controllato: non sono considerati evidenza di layout o funzionalità. L’app integrata non condivide la sessione Chrome e reindirizza al login; nessuna credenziale o cookie è stato copiato. Non si tratta di un’estrazione completa del codice sorgente privato.

Screenshot originale di riferimento fornito dall’utente: `/var/folders/4s/8_smcwxn32s7_3htk8zgbzq80000gp/T/codex-clipboard-6b0b4349-dcf6-4f50-b383-5777f82c603d.png`.

## Token misurati nel browser

| Ruolo                  | Valore osservato                                      | Fonte                          |
| ---------------------- | ----------------------------------------------------- | ------------------------------ |
| Sfondo                 | `rgb(255,255,255)`                                    | computed body login            |
| Testo                  | `rgb(15,15,16)`                                       | computed body login            |
| Corpo / controlli      | `Inter`, 14px sui pulsanti                            | computed style                 |
| Titolo login           | WaldenburgHF, 24px, peso 600, line-height 30px        | computed h1                    |
| Bordo                  | `#00000013` (variabile); rgba(0,0,0,.1) sui controlli | computed root/input            |
| Muted                  | `#0000000b`                                           | computed root                  |
| Primario               | HSL `0 0% 18%`                                        | computed root                  |
| Sidebar                | HSL `0 0% 98%`                                        | computed root                  |
| Raggi di sistema       | 6, 8, 12, 16, 24px; pill 9999px                       | computed root                  |
| Input e pulsanti login | altezza 46px, raggio 12px                             | bounding rect + computed style |

Fogli di stile osservati: `/app_assets/_next/static/chunks/10fu1awomyizo.css`, `06ldasgsnyytu.css`, `32osu5wqhe91h.css`, `360zurca8l5x4.css`. Gli URL sono tracce dell’ispezione, non dipendenze del nostro prodotto. Non vengono copiati font proprietari o asset creativi ElevenLabs.

## Pattern visivi osservati nella Home

- App shell persistente, sidebar più chiara del testo e separata con un bordo sottile.
- Colore usato soprattutto nel contenuto; strumenti, navigazione e pulsanti sono neutrali.
- Gerarchia tipografica leggibile, titoli brevi e controlli con etichette concrete.
- Header con titolo corrente, ricerca centralizzata e azioni account a destra.
- Ricerca che unisce navigazione, azioni e contenuti, accessibile da tastiera.
- Funzioni raggruppate per attività, recente separato dall’avvio di un nuovo lavoro.
- Superfici bianche, ombre minime, raggi morbidi e bordi a basso contrasto.

Sidebar intorno a 250px e header intorno a 50px sono stime visive dello screenshot, non misure CSS della Home autenticata. L’implementazione Italfit adotterà 232px/64px come scelte di prodotto per densità e responsive.

## Decisioni per Team Italfit

### Mantenere

La navigazione richiesta: Home, Studenti, Piani e percorsi, Lezioni in sede. Proprietà CRM, tier e amministratori rimangono in Impostazioni. Tutti i dati esistenti sono conservati. Il colore del brand resta disponibile, ma i controlli principali diventano neutrali.

### Rimuovere / sostituire

- Sidebar scura, slogan, grande hero nero, frecce decorative e watermark tipografici.
- Home con roadmap di sviluppo e CTA che non aiutano a svolgere un’attività.
- Banner giallo ripetuto su ogni pagina: sostituito da un’indicazione globale discreta della modalità locale; gli errori restano prominenti.
- Etichette enfatiche e microcopy generico: usare nomi delle sezioni e descrizioni operative.
- Filtri/colonne aperti che occupano metà pagina: spostarli in pannelli dedicati con applicazione esplicita.

### Aggiungere / completare

- Ricerca globale ⌘K / CtrlK per studenti e navigazione, scorciatoia per creare uno studente.
- Home con azioni frequenti, studenti recenti, schede da completare e attività recenti derivate dai dati veri del prototipo.
- Piani mensili: raccolta, sessioni/esercizi, assegnazione agli studenti, stato e periodo; nessuna generazione AI fittizia.
- Lezioni: agenda settimanale, orario, durata, capienza, coach e luogo; gestione iscritti con controllo capienza e sovrapposizioni.
- Scheda studente: contatti, proprietà, percorso assegnato, note e cronologia nello stesso contesto.
- CSV dei risultati filtrati, template di proprietà fitness facoltativi e trasparenza sui campi di base.
- Anteprima studente esplicitamente separata dall’autenticazione, per provare piani e prenotazioni locali.

La prima implementazione era locale. Ora database condiviso, sessioni e ruoli sono collegati a Supabase; gli inviti sono link personali generati dall’admin. Gli invii automatici email tramite Resend restano da attivare. Vedi docs/architecture.md per lo stato attuale.

## Implementazione

Next.js App Router + React, TypeScript strict, Tailwind 4, shadcn/Radix e Lucide. Inter con file distribuiti nel pacchetto npm locale, senza richieste a font esterni in build/runtime. Token semantici nel CSS globale; componenti condivisi per pulsanti, campi, titoli, pannelli e stati vuoti. Dialog con focus trap e tastiera, link per la navigazione, dati CSV neutralizzati contro formule, conferme per archiviazione/scarto, limiti e validazioni nel confine di persistenza. Verifiche: unit test delle regole, lint/types/format/build, flussi desktop e mobile in browser.

## Esito dell’implementazione

Sistema neutro applicato a shell, navigazione, titoli, pulsanti, form e pannelli. Implementati ricerca globale, Home operativa, filtri/colonne in pannelli, ordine delle colonne salvabile, CSV, contatto telefonico, campi fitness facoltativi, piani mensili con copie indipendenti, agenda e iscrizioni, scheda integrata e anteprima studente. Rimossi hero, slogan, roadmap e componenti segnaposto non usati.

Verifica completa in [docs/verification.md](docs/verification.md), con screenshot desktop e risultati dei controlli. L’analisi di ElevenLabs resta limitata alle superfici effettivamente osservate, come dichiarato sopra.

La revisione successiva ha sostituito tutti i select, le checkbox e le scelte radio native con controlli Radix personalizzati. Focus, tastiera, validazione e protezione dalle modifiche non salvate sono condivisi; i menu vengono riposizionati entro il viewport anche su mobile.

## Calendario: ritmo e densità

La revisione del 1 novembre 2026 usa una superficie unica con raggio di 12px, toolbar compatta, intestazioni da 64px e un asse orario comune. Le fasce sono blocchi pieni con bordo laterale, testo allineato in alto e contrasto conservato anche nel passato. Evitare ombre, card sovrapposte, divisori decorativi dentro gli eventi e barre flottanti sempre visibili. Il salvataggio appare nel bordo inferiore quando ci sono modifiche. Su mobile: giorno selezionabile, controlli tattili e nessuno scorrimento orizzontale della pagina. Il calendario studenti condivide colori, intestazioni e spaziature; gli stati vuoti sono discreti e le prenotazioni confermate hanno un indicatore laterale.

## Revisione 2 novembre 2026: allineamento ElevenLabs

Misure rilevate nell’app autenticata (Home, Voices, Productions, Settings) tramite stili calcolati: sidebar 256px `#fafafa` con bordo `rgba(0,0,0,.075)`, voci di navigazione 32px, 14px/500, raggio 10px, inattive grigie e attive su `rgba(0,0,0,.045)`; header 50px con breadcrumb; contenuto centrato a 1152px; titoli 24/30px; pulsanti 32–36px con raggio 10px; tab a pillola bordata con sottolineatura; card azione 58px con icona 32px; impostazioni come righe separate da linee sottili.

Applicato a entrambe le aree:

- Token neutri (`#0f0f10`, muted `#6f6f6f`, bordi `#ececec`, input `#e3e3e3`) e componenti condivisi: `PageHeading`, `PageTabs`, `AuthLayout`, `StudentShell`.
- Admin: breadcrumb nell’header, menu account con iniziali, stato del workspace mostrato solo quando serve, Home con azioni, metriche in un’unica striscia e liste senza card, piani come lista con tab di stato, impostazioni a righe (Team, Proprietà).
- Area studente: navigazione in alto su desktop e tab bar su mobile, menu account con cambio password ed uscita, piano e calendario senza palette salvia né decorazioni.
- Rimossi: tab Studenti in Impostazioni (duplicava scheda e griglia), riepilogo duplicato nella scheda studente, campo “Data di creazione” in creazione, eyebrow maiuscoli, slogan, frecce decorative, componenti `card`, `badge`, `table`, `tabs` e tabella studenti non più usati.
- Nessun controllo nativo del browser per data, ora e mese: `DatePicker`, `TimePicker` e `MonthPicker` (Radix Popover) con validazione `required` tramite input nascosto. I campi numerici non mostrano le frecce native.
- Interruttore chiaro/scuro nell’header (admin, area studente, accesso): un clic cambia tema. Senza una scelta salvata vale la preferenza di sistema. La scelta è salvata in `localStorage` (`italfit.theme`) e applicata prima del primo paint; i colori passano tutti dai token CSS, calendario incluso.
- Rimossi l’anteprima studente lato admin (gli admin che aprono `/area-studente` tornano al CRM) e gli studenti fittizi del demo locale, che ora parte vuoto.
