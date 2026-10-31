# Piano di completamento e standard UX

Ambito: CRM Italfit già collegato a Supabase, area amministratore e area studente. Le richieste precedenti restano il riferimento: quattro sezioni principali, configurazione CRM e amministratori nelle impostazioni, nessuna registrazione pubblica, persistenza reale. Resend resta predisposto per un passaggio successivo; le regole di accesso per tier richiedono una definizione esplicita.

## Criteri di accettazione

| Standard                 | Comportamento da consegnare                                                                                                                            | Evidenza richiesta                              |
| ------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------ | ----------------------------------------------- |
| Dati affidabili          | Salvataggi serializzati, nessun aggiornamento obsoleto dopo una scrittura, nessun retry automatico di una scrittura dall’esito incerto                 | Test di concorrenza dell’adapter e verifica API |
| Stato comprensibile      | Salvataggio, errore di sincronizzazione e rete assente distinguibili anche su mobile; recupero esplicito senza chiudere i form                         | Test di rete e browser                          |
| Form accessibili         | Etichette associate, errori in italiano, focus sul primo campo non valido, conferma di scarto, azioni raggiungibili durante lo scroll                  | Browser con tastiera e schermo stretto          |
| Azioni contestuali       | Primo utilizzo distinto da ricerca senza risultati; reset filtri solo quando utile; stato delle azioni disabilitate spiegato                           | Directory e piani con/senza filtri              |
| Area studente            | Esito della prenotazione annunciato, conferma prima di annullare, disponibilità aggiornabile senza perdere il mese selezionato                         | API autenticata e browser                       |
| Responsive e leggibilità | Nessun overflow della pagina a 320/390/768/1440px; touch 44px sui controlli principali; testo secondario con contrasto almeno 4.5:1 sul fondo previsto | Misure DOM e controllo visivo                   |
| Coerenza                 | Navigazione richiesta, nessun testo di roadmap nel prodotto, date italiane e fuso Roma, stesse convenzioni per errori e comandi                        | Revisione delle pagine                          |
| Regressioni              | Permessi e isolamento dei dati mantenuti; lint, TypeScript, test e build verdi; segreti esclusi da Git e dal client                                    | Suite, API e scansione repository               |

## Ordine di lavoro

1. Verificare lo stato attuale e correggere affidabilità dell’adapter remoto.
2. Centralizzare lo stato di sincronizzazione e il recupero dagli errori.
3. Rifinire validazione, focus e stati vuoti nelle schermate operative.
4. Migliorare prenotazione e aggiornamento dell’area studente.
5. Verificare i flussi e i breakpoint; correggere le regressioni rilevate.
6. Aggiornare le evidenze, creare un commit e sincronizzare la repository privata.

Questo documento definisce controlli verificabili, non una promessa di assenza assoluta di difetti. Gli esiti sono registrati nella verifica finale.

## Esito dell’audit finale · 1 novembre 2026

| Criterio                 | Esito ed evidenza                                                                                                                                   |
| ------------------------ | --------------------------------------------------------------------------------------------------------------------------------------------------- |
| Dati affidabili          | Superato: 10 test dell’adapter, coda di lettura/scrittura, conflitti e richieste dall’esito incerto                                                 |
| Stato comprensibile      | Superato: errore e recupero osservati nel browser con servizio interrotto; offline e sessioni scadute coperti dalla suite                           |
| Form accessibili         | Superato: primo campo invalido, errori associati, conferma di scarto e ritorno del focus verificati; azioni da 44px sul form a 320px                |
| Azioni contestuali       | Superato: directory iniziale e ricerca vuota, piani iniziali, ricerca e filtro di stato senza risultati verificati                                  |
| Area studente            | Superato: piano mensile e menu da tastiera, aggiornamento, prenotazione e annullamento via API e browser, focus dopo la rimozione della riga        |
| Responsive e leggibilità | Superato: 44 rilevazioni senza overflow; navigazione e opzioni da 44px misurate; contrasto del testo secondario 5.02:1 o maggiore sui fondi di base |
| Coerenza                 | Superato: quattro sezioni principali, configurazione nelle impostazioni, mesi in italiano, fuso Roma e callback sulla stessa origine                |
| Regressioni              | Superato: 52 test, lint, TypeScript e build; isolamento riconfermato nel cloud; nessuna chiave server nel codice versionato o nei chunk client      |

Le prove dettagliate e i confini della verifica sono in [verification.md](verification.md). La matrice è in [responsive-verification.json](responsive-verification.json). I dati tecnici di questa verifica sono stati rimossi; il frontend resta locale e la repository GitHub resta privata.
