# Verifica · Supabase e controlli personalizzati

31 ottobre 2026. Progetto dedicato TEAM ITALFIT CRM, organizzazione TEAM ITALFIT. Nessuna modifica al progetto personale del connettore.

Il percorso verificato è browser → API autenticata → validazione → transazione Postgres → rilettura e interfaccia. Il database è reale; i record dei test sono esclusivamente tecnici e vengono rimossi alla fine.

## Prove sul progetto cloud

17 verifiche completate:

1. Login del proprietario e scheda creata dal browser presente in Supabase.
2. API e pagine admin protette dall’accesso anonimo.
3. Persistenza di tutti gli 11 tipi di proprietà, tier, note, cronologia, programmi, assegnazioni, lezioni e amministratori.
4. Salvataggio di viste e preferenze per account.
5. Scritture con revisione superata respinte con HTTP 409.
6. Link di invito studenti e admin funzionanti senza invio di email.
7. RLS: uno studente non legge le righe private e non può eseguire direttamente le RPC di scrittura.
8. Metadati utente modificati per dichiararsi owner senza ottenere privilegi.
9. Admin ordinari impossibilitati a concedere accesso amministratore.
10. Area studente senza note interne e identità di altri studenti.
11. Due richieste concorrenti per l’ultimo posto: una prenotazione accettata e una respinta.
12. Annullamento della prenotazione persistente.
13. Archiviazione dello studente che revoca subito anche l’accesso con una sessione già esistente.
14. Violazione di chiave esterna che annulla l’intera transazione, senza incrementare la revisione.
15. Scritture da origine estranea respinte.
16. JSON malformato rifiutato con errore controllato.
17. Tentativo di sostituire il proprietario respinto.

Il test concorrente ha evidenziato che usare SQLSTATE 40001 per un conflitto applicativo poteva causare retry e attese del gateway. La migrazione dedicata restituisce ora PT409; il test completo è stato ripetuto con successo. Le richieste upstream hanno anche un timeout esplicito.

## Interfaccia

- Select, checkbox e radio visibili sono componenti Radix personalizzati.
- Menu verificati con frecce, Invio ed Escape; opzioni e stato selezionato coerenti.
- Modifiche a radio, scelta multipla e booleano salvate dal browser e rilette dal database.
- Cambio di un menu nel form che attiva correttamente la conferma di scarto.
- Selezione della tabella e stato intermedio della checkbox di pagina verificati.
- Scheda e directory a 390px senza overflow della pagina; menu dei tier entro viewport, con bordo destro a 378px su schermo da 390px.
- Campi mobile a 16px, azioni principali e controlli touch più grandi, pannelli scorrevoli e azioni di salvataggio raggiungibili.
- Desktop, navigazione e sidebar riducibile verificati a 1440px.

## Controlli automatici

40 unit test per dominio CRM, piani e lezioni, schema, isolamento della proiezione studente, permessi server, note/cronologia e autori. ESLint senza warning, TypeScript strict, formattazione e build di produzione vengono eseguiti prima della consegna.

I tipi TypeScript del database sono generati dallo schema reale. L’advisor di sicurezza non segnala errori di RLS/privilegi. Rimane la segnalazione del controllo password compromesse: l’API ne ha rifiutato l’attivazione con HTTP 402 perché il piano Free non include la funzione. Nessun upgrade è stato effettuato.

La chiave Resend è soltanto nell’ambiente locale. Invii automatici tramite Resend e pubblicazione su un dominio definitivo non fanno parte di questo passaggio.

## Revisione UX e affidabilità · 1 novembre 2026

Piano e criteri in [quality-plan.md](quality-plan.md). La suite attuale comprende **52 test**: ai 40 iniziali si aggiungono 10 prove dell’adapter remoto e 2 della proiezione studente.

- Le letture e le scritture sono serializzate. Test riproducibili per aggiornamento durante un salvataggio, scrittura durante una lettura, deduplicazione, conflitto 409, coda dopo un errore, offline, sessione scaduta e risposta obsoleta.
- Le richieste hanno un timeout esplicito e nessun reinvio automatico. Un esito di scrittura incerto richiede una rilettura prima di un altro salvataggio. Il browser ha mostrato l’errore controllato con il servizio interrotto e il comando di aggiornamento; la rilettura API al ripristino ha restituito 200.
- Errori dei campi in italiano, stato `aria-invalid` e descrizioni associate. Form vuoto verificato con focus sul nome, anche quando manca un select obbligatorio. Conferma di scarto verificata conservando la bozza e ripristinando il focus al comando del form.
- Stati iniziali distinti dai risultati vuoti; azioni di creazione o reset contestuali. I menu delle proprietà, filtri, tier e ordinamenti mantengono lo stesso sistema di controllo.
- Il testo secondario base è `#69696c`: contrasto 5.47:1 sul bianco e 5.02:1 su `#f5f5f5`. Campi mobile a 16px; pulsanti principali, opzioni dei menu, navigazione e righe radio hanno aree touch di almeno 44px su mobile.
- [Matrice responsive](responsive-verification.json): 44 osservazioni, 11 schermate a 320, 390, 768 e 1440px, con `scrollWidth` della pagina uguale alla viewport. La tabella conserva lo scorrimento orizzontale all’interno del proprio contenitore.
- Area studente verificata con un account Auth tecnico reale: login, piano assegnato, scelta del mese con frecce e Invio, aggiornamento senza perdere il mese, prenotazione, vista personale, conferma di annullamento, stato vuoto dopo la cancellazione. Quando la riga scompare, il focus torna al filtro delle proprie prenotazioni.
- Il callback di accesso usava l’origine interna della richiesta e poteva passare da `127.0.0.1` a `localhost`. Ora restituisce un redirect relativo, senza cache e senza referrer. Il browser ha confermato sessione valida sulla stessa origine e ritorno alla Home del proprietario; anche il link non valido torna all’accesso sulla stessa origine.

Sette ulteriori verifiche cloud sono passate: fixture via API CRM, GET disponibilità anonimo 401, GET staff 403, proiezione solo del proprio studente, prenotazione e annullamento rilette dal database, RLS e API CRM ancora isolate. Nessuna email inviata.

Account Auth e record tecnici rimossi. Conteggi finali: 0 studenti, 1 amministratore, 2 tier, 0 proprietà, 0 piani e 0 lezioni. La revisione globale è stata incrementata per impedire a finestre con dati di prova obsoleti di riscriverli. Credenziali tecniche temporanee eliminate.

Screenshot dell’[area studente mobile](screenshots/student-ux-mobile.jpg) acquisito con la fixture prima della pulizia. La documentazione descrive gli esiti e i limiti osservati; non equivale a una certificazione WCAG o a un audit di sicurezza esterno.

## Tier e inviti manuali · rilascio del 1 novembre 2026

L’utente ha confermato piani per Coaching online e lezioni per Allenamento in sede; ha poi richiesto di procedere senza configurare il dominio Resend. Le abilitazioni iniziali sono state salvate esplicitamente e rilette dal database. Sono modificabili dalle impostazioni; i limiti mensili sono facoltativi.

La suite comprende ora **62 test**. Le dieci prove aggiuntive coprono le policy dei tier, i limiti e il calendario di Roma, la conservazione dello storico, la validazione dei payload, il template email e gli esiti del provider. Sette verifiche end-to-end sul database reale hanno confermato le policy, il limite con due richieste simultanee, l’annullamento dopo la riduzione dei servizi e la conferma degli inviti tramite POST. Aperture GET ripetute della pagina invito non consumano il token.

Verificati dal browser: checkbox dei servizi e limite riletti e salvati dal form; generazione del link dalla scheda; assenza del pulsante email quando non configurato; recupero dell’accesso con istruzioni per ottenere un nuovo link dal team. Nessuna promessa di email automatica nella modalità manuale. La configurazione senza Supabase non può attivare il workspace dimostrativo su Vercel.

## Invito e reinvito con email precompilata · 1 novembre 2026

Inviti e reinviti aprono direttamente il form con email non modificabile, password e conferma. Il contesto del link è firmato sul server; email, token e tipo non possono essere sostituiti. Il token viene verificato soltanto nel POST di salvataggio. I link precedenti restano compatibili.

Verificati sul servizio Auth reale con account tecnici poi eliminati: primo invito e recupero, apertura GET senza consumo del token, email in sola lettura, password discordanti respinte prima dell’attivazione, salvataggio con redirect all’area studente, login con la nuova password e rifiuto del riutilizzo senza sessione. `pnpm check`: 68 test superati, lint, TypeScript e formattazione corretti. La build Turbopack resta bloccata dal runtime locale durante l’avvio del processo di compilazione CSS.
