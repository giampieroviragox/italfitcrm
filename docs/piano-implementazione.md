# Team Italfit · Piano di implementazione

Il piano raccoglie le attività di prodotto e i criteri di collaudo per il CRM e l’area studente. Lo stato di ciascuna fase distingue il lavoro verificato in locale dal rilascio in produzione.

Il [piano integrale](piano-implementazione-cliente.md) contiene anche gli appunti e i riferimenti alle due trascrizioni.

## 1. Inviti e recupero password

- [x] Configurare il mittente verificato in Resend e l’invio di recupero tramite Supabase Auth.
- [x] Consentire agli admin di inviare un invito o un reinvito esplicito. Conservare l’opzione di copiare il link e l’assenza di registrazione pubblica.
- [x] Verificare consegna, impostazione della password, accesso, conferma esplicita del recupero e rifiuto del riuso del link.
- [x] Preparare i template Team Italfit per invito, reinvito e recupero.
- [ ] Pubblicare i template aggiornati e provare nuovamente tutti e tre i flussi con un account tecnico. Il [template Supabase e le istruzioni di rilascio](production.md#inviti-e-recupero-password-con-resend) sono nel repository.

## 2. Lezioni in sede e wallet

- [x] Materializzare una lezione al primo ingresso in una disponibilità prenotabile, rispettando capienza e regole del tier.
- [x] Confermare le presenze dopo la lezione e fissare la tariffa individuale in funzione della sede e del numero di presenti. Inserire la tariffa al consuntivo quando il listino non la copre.
- [x] Assegnare crediti a ore o lezioni tramite i pacchetti standard, i pacchetti personalizzati e gli abbonamenti con lezioni in sede. Applicare eventuali vincoli di sede e di lezione individuale.
- [x] Provvedere allo scalamento al consuntivo. Mostrare allo studente e all’admin le ore svolte, i crediti acquistati, usati e residui, il pagato e il saldo. Associare a ogni lezione il costo o la quota del pacchetto.
- [ ] Confermare la finestra di prenotazione e stabilire le regole per assenze, annullamenti, recuperi e scadenza dei crediti. Definire come importare i saldi iniziali. Finestra confermata il 17 novembre 2026: 12 ore prima, per prenotare e disdire.
- [ ] Prima del rilascio, provare prenotazione, consuntivo, lezione individuale coperta da pacchetto e lezione di gruppo per ciascuna sede.

## 3. Pagamenti esterni e ricevute

- [x] Consentire all’admin di registrare incassi parziali e rifiutare importi superiori al residuo.
- [x] Consentire allo studente di registrare un pagamento esterno indicando l’importo e allegando una ricevuta.
- [x] Creare una coda di verifica per l’admin con esito e data della revisione. Aggiornare il residuo una sola volta quando il pagamento viene approvato.
- [ ] Definire i permessi di approvazione e la prova richiesta per i pagamenti di persona. Impostazione attuale: ricevuta facoltativa solo per i pagamenti di persona; verificano tutti gli admin.
- [ ] Provare due versamenti parziali, il rifiuto di una ricevuta e una doppia richiesta di approvazione.

## 4. Coaching online

- [x] Gestire abbonamenti a più durate, scadenze e rinnovo del piano di allenamento a cicli di quattro settimane.
- [x] Aggiungere una vista con elenco studenti, piano e coach assegnato. La stessa anagrafica deve poter accedere anche alle lezioni in sede.
- [x] Assegnare un coach a ogni piano mensile, con default dal coach dell’abbonamento.
- [ ] Confermare sorgente, campi e regole di deduplicazione prima di importare le anagrafiche.
- [x] Affiancare alla prescrizione il registro di serie, ripetizioni, carichi e note. Aggiungere lo storico e i massimali per esercizio, inseribili da studente e coach.
- [x] Registrare data effettiva e fatica percepita.
- [ ] Calcolo dei carichi da percentuale e audio del timer: rinviati il 17 novembre 2026.
- [ ] Provare un ciclo completo con profili tecnici di studente e coach.

## 5. Feedback, gare e piano successivo

- [x] Raccogliere a fine ciclo il feedback su durata e frequenza delle sessioni, difficoltà e note libere. Collegare le risposte alla versione del piano e renderle consultabili dal coach.
- [ ] Permettere allo studente di aggiungere gare ed eventi anche dal questionario. Definire canale e anticipo del promemoria per l’admin. Gare aggiunte anche dal questionario; promemoria in Home a 14 giorni, canale esterno da decidere.
- [x] Esportare note e feedback attraverso il connettore dei piani per preparare il piano successivo. Il coach controlla la bozza prima della consegna.
- [ ] Associare foto dimostrative agli esercizi dove disponibili. Valutare ricerca e animazioni per gli altri. Conservare i video originali e i programmi standardizzati come sviluppi successivi.

## 6. Contabilità e compensi

- [ ] Creare la vista di contabilità del coaching online per i ruoli autorizzati e la vista complessiva privata per il proprietario.
- [ ] Consentire al coach di consultare gli studenti assegnati e il proprio compenso. Definire importo o aliquota, base di calcolo e momento di maturazione per studente e ciclo.
- [ ] Separare importi dovuti e incassati. Verificare i permessi sul server con account distinti e provare il riepilogo mensile.

## 7. Google Calendar

- [ ] Collegare il Google Calendar dell’admin e scegliere il calendario di destinazione.
- [ ] Sincronizzare dal CRM creazione, modifica e annullamento degli eventi scelti.
- [ ] Definire visibilità e permessi dell’agenda condivisa. Provare una call del team e il recupero da un errore di sincronizzazione.

La sequenza di rilascio parte da template, wallet e ricevute. Seguono abbonamenti e registro del coaching online, feedback e gare, contabilità e Google Calendar.
