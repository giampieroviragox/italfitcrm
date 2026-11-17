# Team Italfit · Checklist di implementazione

Requisiti raccolti dalle registrazioni **Via Pantigliate** e **Fisic Center** e dagli appunti di Giampiero. Piano di rilascio aggiornato il 17 novembre 2026. Le opzioni ancora da scegliere sono indicate nelle sezioni a cui si riferiscono.

## 0. Resend, inviti e recupero password

**Collaudo del 17 novembre.** Il dominio `teamitalfit.com` è verificato e il mittente è `inviti@teamitalfit.com`. Invito e reinvito dal CRM e recupero tramite Supabase Auth e SMTP Resend sono arrivati alla casella automatica di test. Per tutti e tre è stato possibile salvare la password e accedere. Il link di reset è rimasto valido dopo due aperture GET e il riuso è stato rifiutato dopo la conferma. Scheda e account tecnici rimossi.

- [x] Verificare `teamitalfit.com` con la chiave del team Resend e controllare il DNS di `forge-mail`. La posta in arrivo è su Aruba.
- [x] Configurare `RESEND_API_KEY` e il mittente `inviti@teamitalfit.com` come `RESEND_FROM_EMAIL` su Vercel. Verificare `NEXT_PUBLIC_APP_URL` e ridistribuire lo stesso commit di produzione.
- [x] Abilitare gli inviti e reinviti via email gestiti dallo staff. L’invio parte dal pulsante dell’admin ed è disponibile anche il link da condividere manualmente.
- [x] Configurare Supabase Auth con SMTP Resend. Il template apre `/invito` e invia il token al callback `/auth/confirm` alla conferma esplicita. Il callback apre `/imposta-password`.
- [x] Verificare con una scheda tecnica studente invito, reinvito, reset e accesso con la nuova password. Rimuovere scheda e account tecnici.
- [x] Attivare `AUTH_EMAIL_ENABLED=true` in produzione. Verificare nel browser il campo email e il pulsante **Invia link di recupero** sul CRM pubblico.
- [x] Preparare i template Team Italfit per invito, reinvito e recupero.
- [ ] Pubblicare i template aggiornati e ripetere l’invio di prova.

[Guida Resend Forge](https://resend.com/docs/forge) · [Resend SMTP per Supabase](https://resend.com/docs/send-with-supabase-smtp)

## 1. Lezioni in presenza e listino

| Partecipanti | Milano · lezione di 1 ora, a persona | Monza e Brianza · a persona |
| ------------ | -----------------------------------: | --------------------------: |
| 1            |                                 70 € |                        40 € |
| 2            |                                 50 € |                        25 € |
| 3            |                                 40 € |                        20 € |
| 4            |                                 35 € |                        15 € |
| 5            |                                 30 € |                        15 € |
| 6–7          |                                 25 € |                        15 € |
| 8            |                                 25 € |        Tariffa non indicata |

- [x] Calcolare al consuntivo il prezzo per partecipante in base alla sede e ai presenti. Dove manca una tariffa, l’admin indica il prezzo.
- [x] Gestire le fasce prenotabili nel CRM, con la capienza impostata dall’admin. Nel colloquio sono citate le lezioni del mattino e quelle serali di Monza.
- [x] Applicare alle lezioni di gruppo di Milano la regola delle **12 ore prima della lezione**. Confermare se la prenotazione chiude 12 ore prima o si apre nelle ultime 12 ore. Il 17 novembre 2026 confermato: prenotazione e disdetta dello studente chiudono 12 ore prima, per tutte le lezioni; lo staff può sempre iscrivere e disiscrivere.
- [x] Consentire al team di inserire nel CRM le lezioni individuali 1:1 concordate direttamente con gli studenti. Includerle nei conteggi. Si registrano dal wallet dello studente anche dopo la lezione, con prezzo da listino, prezzo concordato o pacchetto.
- [x] Mostrare allo studente lo storico delle lezioni svolte, l’importo di ciascuna e il totale dovuto. Consentire all’admin di ricostruire il totale per studente dagli stessi dati, oggi aggiornati a mano in Splitwise.
- [ ] Definire se il prezzo si calcola in base agli iscritti o ai presenti effettivi, quando viene fissato e come si gestiscono annullamenti, assenze e recuperi. Confermare eventuale finestra di prenotazione a Monza e se è previsto un ottavo partecipante. Implementato sui presenti al consuntivo.

Fonti. Appunti di Giampiero. Via Pantigliate, 00:00–00:31 e 03:48–05:48.

## 2. Pacchetti di lezioni e wallet

Regola confermata il 17 novembre 2026: le lezioni di gruppo (fasce prenotabili con posti) si pagano sempre a listino in base a sede e presenti, anche con un solo presente. I pacchetti, come il Milano 10 + 1 da 750 €, valgono solo per le lezioni individuali 1:1 fissate direttamente con il coach, che si possono anche pagare a lezione.

La prima versione del wallet e del consuntivo è implementata e verificata in locale. Il rilascio in produzione è ancora da fare.

- [x] Configurare il pacchetto Milano **1:1 da 10 ore + 1 ora in regalo a 750 €**, utilizzabile per lezioni individuali.
- [x] Consentire all’admin di creare e assegnare un pacchetto personalizzato a uno studente indicando numero di lezioni e prezzo totale.
- [x] Creare il wallet dello studente. Studente e admin vedono pacchetti acquistati, importi pagati, lezioni utilizzate e credito residuo.
- [x] Collegare ogni lezione svolta al pacchetto utilizzato e scalare il residuo, rendendo visibile l’utilizzo nel wallet.
- [ ] Definire quale stato della lezione fa scattare lo scalamento, validità e scadenze dei pacchetti, regole in presenza di più pacchetti attivi e gestione di crediti o saldi preesistenti. Chiarire l’unità di consumo per i pacchetti a ore e quelli a lezioni.

Fonti. Appunti di Giampiero. Via Pantigliate, 05:50–06:18.

## 3. Pagamenti esterni e ricevute

- [x] Consentire allo studente di registrare un pagamento effettuato fuori dal CRM, indicando l’importo e allegando una ricevuta o uno screenshot. I metodi citati sono PayPal, bonifico e pagamento di persona.
- [x] Consentire all’admin di registrare più versamenti parziali per lo stesso importo dovuto.
- [x] Creare una lista dei pagamenti in attesa affinché l’admin possa aprire la ricevuta, verificare l’incasso e approvarlo quando vuole.
- [x] Registrare l’incasso approvato e aggiornare il saldo dovuto una sola volta per versamento. Le richieste in attesa restano visibili da revisionare. L’incasso salda le voci aperte dalla più vecchia; l’admin può correggere l’importo.
- [ ] Definire la prova da allegare per i pagamenti di persona e quali account possono revisionare gli incassi. Impostazione attuale: ricevuta obbligatoria per PayPal e bonifico, facoltativa di persona; verificano tutti gli admin.
- [ ] Valutare il controllo preliminare della ricevuta con IA. L’approvazione definitiva resta dell’admin.

Fonti. Appunti di Giampiero. Via Pantigliate, 00:24–01:52.

## 4. Abbonamenti e area Coaching online

| Durata acquistata | Prezzo totale |
| ----------------- | ------------: |
| 3 mesi            |         390 € |
| 6 mesi            |         690 € |
| 12 mesi           |       1.290 € |

- [x] Configurare i tre abbonamenti e visualizzare la scadenza di ciascuno. Durante l’abbonamento lo studente riceve un piano di quattro settimane per ciclo, usando il formato dei piani già presente in piattaforma.
- [x] Aggiungere **Coaching online** nella navigazione del CRM, con elenco dei clienti, scadenza dell’abbonamento e coach assegnato.
- [x] Gestire l’assegnazione dello studente a Giorgio o a Marta e associare i singoli piani online al coach che li gestisce. La stessa anagrafica può seguire coaching online e lezioni in presenza. Il coach dell’abbonamento è il default; ogni piano mensile può avere un coach diverso, che è quello a cui va il compenso.
- [ ] Individuare in Drive il file o la cartella da cui importare le anagrafiche. Confermare campi e gestione dei duplicati. Nell’audio sono citati nome, cognome, email, telefono, altezza, peso, sesso, età e città.
- [ ] Attivare un account studente di prova per far vedere a Giorgio l’esperienza da studente.

Fonti. Appunti di Giampiero. Via Pantigliate, 08:23–09:58. Fisic Center, 09:17–10:55 e 12:32–12:50.

## 5. Profilo di Marta, compensi e contabilità

- [ ] Creare il profilo personale di Marta. Mostrarle gli studenti assegnati, i piani online che gestisce e il proprio compenso.
- [x] Calcolare il compenso di Marta per ogni coppia studente–piano online che gestisce. Nel rendiconto mensile mostrare quali piani sono stati seguiti, il loro stato, le consegne e il totale dovuto.
- [ ] Confermare importo e maturazione del compenso. Nell’audio si parla di un accordo a percentuale per programma. Se la formula è questa, definire aliquota e base di calcolo.
- [x] Creare **Contabilità coaching online** per Giorgio e Annalisa, con i rispettivi account. Mostrare incassi dei piani online, dettaglio per studente e piano e rendiconto mensile.
- [x] Creare **Contabilità privata** riservata a Giorgio. Mostrare il quadro mensile complessivo con coaching online, lezioni in presenza, conteggi e importi per sede, e compensi dovuti a Marta.
- [x] Applicare i permessi ai dati di ciascuna vista. Marta accede al proprio compenso. Giorgio e Annalisa accedono alla contabilità online. Solo Giorgio accede al quadro privato complessivo.
- [ ] Definire la distinzione tra incassato, da incassare e compensi. Valutare il codice aggiuntivo citato da Giorgio per la vista privata e l’eventuale generazione di fatture.

Fonti. Appunti di Giampiero. Via Pantigliate, 07:12–13:49.

## 6. Registro allenamenti, storico e massimali

- [x] Per ciascun esercizio del piano, affiancare la prescrizione del coach al registro di ciò che lo studente ha svolto.
- [x] Far registrare il numero di serie svolte, le ripetizioni effettive e il carico in chilogrammi per ogni serie.
- [x] Far annotare sotto ogni allenamento come lo studente si è sentito e cosa è successo nella sessione.
- [x] Creare **Storico allenamenti**. Lo studente può ritrovare sessioni svolte, esercizi, serie, ripetizioni, carichi e note.
- [x] Creare **Massimali**. Lo studente registra e consulta i propri riferimenti per esercizio. Nell’audio sono citati 1RM, 3RM e 5RM. Anche il coach può inserirli dalla scheda studente.
- [x] Registrare data effettiva e fatica percepita (RPE 1–10) per ogni allenamento.
- [ ] Audio attivabile sul timer di recupero. Rinviato il 17 novembre 2026.
- [ ] Valutare il calcolo automatico dei chilogrammi quando il coach prescrive una percentuale del massimale. Concordare riferimento, formule e arrotondamenti. Rinviato il 17 novembre 2026.

Fonti. Appunti di Giampiero. Fisic Center, 01:13–05:46 e 07:47–09:17.

## 7. Feedback di fine ciclo, gare e Claude

- [x] Aprire il questionario al termine di ogni piano da quattro settimane, per tutti gli abbonamenti da 3, 6 e 12 mesi.
- [x] Chiedere allo studente come è andato il piano, se la durata delle sessioni era giusta, troppo lunga o troppo corta, se vuole confermare o cambiare il numero di sessioni a settimana e cosa vorrebbe modificare. Prevedere note libere finali.
- [x] Chiedere allo studente di confermare, modificare o aggiungere le gare pianificate anche dal questionario.
- [x] Salvare ogni risposta nello storico del relativo piano, consultabile dal coach. Confermare i campi essenziali obbligatori, il momento esatto in cui mostrare il questionario e cosa succede se rimane incompleto.
- [x] Aggiungere al profilo studente un elenco di gare ed eventi, ad esempio maratone e HYROX, con date e iscrizioni. Lo studente aggiorna gli eventi e il coach li consulta per adattare la preparazione.
- [ ] Inviare all’admin un promemoria prima della gara affinché possa contattare lo studente e augurargli in bocca al lupo. Scegliere anticipo e canale. Nell’audio si parla di avviso in calendario o di un messaggio. Per ora in Home c’è «Gare in arrivo» per i prossimi 14 giorni; manca il canale esterno (calendario o messaggio).
- [x] Estendere il collegamento con Claude affinché il coach possa recuperare note delle sessioni e feedback finali dell’ultimo piano per preparare il successivo.
- [x] Salvare il piano successivo come bozza nel CRM. Il coach verifica e corregge il risultato prima della consegna. Il connettore attuale legge i piani e salva già le bozze.

Fonti. Appunti di Giampiero. Via Pantigliate, 13:51–14:26. Fisic Center, 05:25–07:44 e 10:57–15:07.

## 8. Foto e supporto per gli esercizi

- [ ] Mostrare una foto dimostrativa quando l’esercizio ne ha una associata. La stima iniziale era di 70–80 esercizi base e quella aggiornata supera i 400 con le varianti.
- [ ] Decidere come scegliere e associare le foto. Nel primo audio si propone di farle cercare e associare da Claude.
- [ ] Scegliere cosa offrire per gli esercizi senza foto. Le opzioni discusse sono un pulsante di ricerca Google e un’animazione breve in motion graphics.
- [ ] Tenere in programma, come idea futura, video dimostrativi prodotti dal team.

Fonti. Appunti di Giampiero. Via Pantigliate, 14:27–15:20. Fisic Center, 00:00–01:12.

## 9. Calendario del CRM e Google Calendar

- [ ] Consentire all’admin di collegare il proprio Google Calendar al CRM e definire il calendario di destinazione.
- [ ] Consentire al team di inserire nel calendario del CRM eventi e lezioni. Gli eventi sincronizzati devono comparire anche nel calendario Google collegato.
- [ ] Allineare le modifiche degli eventi sincronizzati e decidere il comportamento in caso di annullamento o rimozione. Il flusso concordato parte dal CRM verso Google Calendar. Le disponibilità con capienza si gestiscono nel CRM.
- [ ] Consentire a Marta e Annalisa di consultare l’agenda condivisa. Marta deve poter trovare un orario libero e fissare una call visibile anche a Giorgio.
- [ ] Definire quali calendari e impegni sono condivisi, i permessi del team e se gli eventi vengono sincronizzati tutti o su scelta dell’admin.

Fonti. Appunti di Giampiero. Via Pantigliate, 02:21–07:06.

## 10. Programmi standardizzati

- [ ] Valutare in una fase successiva il supporto per programmi non personalizzati, chiamati «offline» nel colloquio.

Fonte. Fisic Center, 15:21–15:53.

## Piano di rilascio proposto

1. **Resend completato.** Inviti, reinviti e recupero autonomo sono abilitati in produzione. Le tre prove con account tecnico hanno verificato consegna, salvataggio della password e accesso.
2. **Rilasciare Coaching online e strumenti di allenamento.** Creare l’account di prova di Giorgio. Collegare anagrafiche, abbonamenti, scadenze e coach assegnato. Aggiungere registro per serie, storico e massimali. Provare un piano di quattro settimane dal punto di vista dello studente. Importare le anagrafiche da Drive quando fonte e deduplicazione sono confermate.
3. **Chiudere il ciclo coaching.** Aggiungere gare e questionario di fine piano. Dare al coach accesso a feedback e note con Claude e salvare il piano successivo come bozza. Provare il passaggio da un ciclo al successivo. Definire e rilasciare i promemoria gara dopo aver scelto canale e anticipo.
4. **Rilasciare lezioni, wallet e ricevute.** Confermare finestra di prenotazione, calcolo della tariffa e regole di consumo dei pacchetti. Aggiungere storico e saldo, pacchetti personalizzati, registrazione delle ricevute e approvazione. Provare lezioni di gruppo per sede, una lezione scalata dal pacchetto, un annullamento e due pagamenti parziali.
5. **Rilasciare compensi e contabilità.** Confermare il calcolo di Marta e costruire i rendiconti sui piani assegnati e sugli incassi registrati. Provare i tre account separatamente. Giorgio e Annalisa vedono la contabilità online, Giorgio vede il quadro privato e Marta vede il proprio compenso.
6. **Collegare Google Calendar.** Provare collegamento dell’admin, creazione e aggiornamento di eventi e lezioni, annullamenti e visibilità della call condivisa. Usare il calendario anche per i promemoria gara se è il canale concordato.
7. **Valutare gli extra.** Scegliere foto, ricerca o animazioni per gli esercizi. Valutare calcolo dei carichi, controllo assistito delle ricevute e programmi standardizzati.

La finestra delle 12 ore e il numero di partecipanti su cui calcolare la tariffa servono prima di rilasciare il listino. La formula di Marta serve prima del rendiconto dei compensi.

La [trascrizione 1 del 16 novembre 2026](trascrizioni/trascrizione-1-2026-11-16.txt), Via Pantigliate, inizia a conversazione già avviata. Gli appunti aggiungono tariffe, pacchetti e abbonamenti che mancavano nella registrazione. La [trascrizione 2 del 16 novembre 2026](trascrizioni/trascrizione-2-2026-11-16.txt), Fisic Center, riprende il tema delle immagini dopo l’interruzione del computer.
