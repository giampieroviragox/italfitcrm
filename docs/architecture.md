# Architettura Italfit

## Connessione e identità

Il progetto dedicato è **TEAM ITALFIT CRM** (`nvvaxfhpcsizchzaykoi`), organizzazione TEAM ITALFIT, regione eu-west-1. Non usa il progetto del connettore personale. Le credenziali di progetto sono nel file locale ignorato `.env.local`; nessun personal access token è necessario al runtime.

L’app usa `@supabase/ssr` e cookie per la sessione. Il Proxy aggiorna i token; ogni layout protetto e ogni API verificano l’identità con `auth.getUser()` e consultano `crm_access`. Le decisioni di autorizzazione non dipendono dai metadati modificabili dall’utente. La registrazione pubblica è disattivata.

`crm_access` associa un utente Auth a una scheda e al ruolo owner, admin o student. Solo il proprietario gestisce gli amministratori. Gli admin gestiscono il CRM; gli studenti ricevono una proiezione limitata al proprio piano e alle lezioni. Non vengono inviati al loro browser note interne, proprietà CRM, elenco amministratori o contatti di altri studenti.

## Persistenza

Le migrazioni riproducibili sono in `supabase/migrations`. Le tabelle sono:

| Tabella             | Contenuto                                                   |
| ------------------- | ----------------------------------------------------------- |
| crm_access          | Collegamenti tra account, ruolo, scheda e stato accesso     |
| crm_tiers           | Definizioni dei tier                                        |
| crm_properties      | Definizioni dei campi, opzioni, gruppi e obbligatorietà     |
| crm_students        | Anagrafica, stato, tier, coach e revisione                  |
| crm_property_values | Valori delle proprietà per studente, collegati tramite ID   |
| crm_notes           | Commenti interni immutabili, datati e attribuiti all’autore |
| crm_activities      | Cronologia generata dal server                              |
| crm_admins          | Schede dei membri admin                                     |
| crm_plans           | Programmi, sessioni ed esercizi                             |
| crm_assignments     | Piano mensile e copia indipendente delle sessioni           |
| crm_lessons         | Orari, durata, coach, sala e capienza                       |
| crm_bookings        | Iscrizioni e annullamenti                                   |
| crm_preferences     | Viste e configurazione della directory per account          |
| crm_meta            | Revisione globale e ultimo aggiornamento                    |

Le colonne relazionali e le chiavi esterne collegano studenti, tier, proprietà, piani e lezioni. Vincoli univoci impediscono email duplicate, più assegnazioni per studente/mese e più iscrizioni per studente/lezione. I payload JSONB conservano i dettagli flessibili del dominio; proprietà, note e attività sono righe distinte. I tipi sono generati dal database in `src/lib/supabase/database.types.ts`.

## Letture e scritture

Le API Next.js ricevono richieste dalla stessa origine canonica, autenticano l’utente, verificano struttura, regole del dominio e permessi, poi eseguono una transazione RPC con la chiave segreta server. Le RPC sono SECURITY INVOKER ed eseguibili esclusivamente dal service role. Nessuna chiave segreta è disponibile al client.

`crm_read` restituisce uno snapshot coerente. `crm_write` blocca la riga di revisione e salva solo se la versione attesa coincide: due admin non possono sovrascriversi silenziosamente. La transazione aggiorna le righe modificate e conserva note e cronologia. Gli editor aspettano la conferma prima di chiudersi; durante il salvataggio i controlli sono disabilitati. Un conflitto aggiorna la vista e richiede di ricaricare i dati del form.

La revisione globale è una scelta conservativa per il volume iniziale del CRM. Le tabelle sono separate per consentire in futuro endpoint per entità e paginazione server senza cambiare i dati. L’endpoint attuale riceve snapshot fino a 2 MB. La ricerca nella directory aggiorna immediatamente l’interfaccia e salva le preferenze con debounce.

Le prenotazioni degli studenti accettano solo ID lezione e intenzione di prenotare/annullare; lo studente viene ricavato dalla sessione. I conflitti vengono ricalcolati sullo stato aggiornato. Si verificano capienza, stato studente, data futura e sovrapposizioni. L’archiviazione annulla le prenotazioni e revoca subito l’accesso della scheda; il ripristino riattiva il collegamento. Le assegnazioni conservano una copia del programma; modificarne il modello non modifica i mesi già assegnati.

## RLS e privilegi

RLS è attiva su ogni tabella applicativa. Gli autenticati possono leggere solo il proprio collegamento di accesso e le proprie preferenze; le tabelle private sono leggibili direttamente soltanto dallo staff attivo. Gli studenti non possono leggere quelle righe. INSERT, UPDATE, DELETE e le RPC di persistenza non sono concessi ad anon/authenticated: le mutazioni attraversano il server con autorizzazione esplicita.

Commenti e cronologia non sono riscrivibili dal payload client. L’email di un account collegato non si cambia dalla scheda, perché deve restare allineata all’identità Auth. I ruoli owner/admin e gli stati di accesso vengono gestiti dal server.

## Inviti e password

L’admin crea la scheda, poi genera un link personale temporaneo. Supabase crea l’identità e `crm_link_access` collega l’account alla scheda con controllo del ruolo e dell’email corrente. Il link viene restituito soltanto all’admin che lo ha richiesto, non viene scritto nei log o nel CRM e non viene inviato automaticamente via email. Il destinatario sceglie la password nella pagina dedicata. Per account esistenti viene generato un link di recupero.

La chiave Resend è conservata solo nell’ambiente locale per il passaggio successivo. Gli invii automatici tramite Resend non sono attivi. La pagina Password dimenticata usa il recupero nativo Supabase ed è soggetta alle sue impostazioni email e ai limiti del progetto.

## Sviluppo e operatività

Senza configurazione Supabase rimane disponibile l’adapter locale per le fixture; in modalità connessa non viene letto né caricato automaticamente il vecchio localStorage. I dati dimostrativi preesistenti restano nel browser. Il bootstrap del proprietario è un’operazione amministrativa una tantum; le credenziali non fanno parte delle migrazioni.

Prima di un deployment pubblico impostare NEXT_PUBLIC_APP_URL e i redirect Auth sul dominio definitivo, configurare l’email transazionale e verificare backup e conservazione dati secondo il piano scelto. Le abilitazioni dei contenuti per tier non sono inferite dal nome del tier: quelle regole restano da definire.

L’advisor Supabase non segnala errori di RLS o privilegi. Segnala l’assenza del controllo password compromesse: l’attivazione è stata richiesta ma il progetto Free la rifiuta con HTTP 402 perché richiede Pro. Il piano non è stato modificato.

## Affidabilità dell’interfaccia

L’adapter remoto serializza anche le riletture, deduplica gli aggiornamenti simultanei e rifiuta revisioni più vecchie. Una scrittura con esito non verificabile non viene ripetuta automaticamente: occorre prima aggiornare lo snapshot. La bozza del form resta nello stato del componente. Stato della rete, attese ed errori sono esposti nel workspace e negli editor.

`GET /api/prenotazioni` verifica la sessione e restituisce esclusivamente la proiezione del proprio studente. Aggiornare i posti non ricrea il selettore del mese. La prenotazione restituisce la proiezione aggiornata e l’interfaccia annuncia l’esito. L’annullamento richiede conferma.

Il callback Auth risponde con Location relativa, `no-store` e `no-referrer`: il browser conserva l’origine su cui è stato verificato il link, anche dietro un proxy locale.

La cronologia conserva i valori precedenti e nuovi, le assegnazioni dei piani con la prescrizione degli esercizi e le modifiche alle lezioni degli iscritti. Include prenotazioni e annullamenti fatti dagli studenti, con autore ricavato dalla sessione. I commenti precedenti restano leggibili; se manca l’autore storico la UI lo segnala senza inventarlo.

La migrazione `20261101113825_italfit_comment_history.sql` registra preparazione e rigenerazione degli inviti e attivazione dell’accesso nella stessa transazione della modifica, usando il lock su `crm_meta`. Applicarla prima di distribuire il codice che chiama `crm_accept_access`; la funzione è riservata a `service_role`, viene chiamata dopo la verifica della sessione SSR e non registra due volte la stessa attivazione.
