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
