# Sei direzioni per l’esperienza studente Italfit

Ricerca e prototipi del 2 novembre 2026. Obiettivo: scegliere come uno studente entra, capisce cosa fare, consulta il proprio piano, si allena e prenota in sede, su telefono e desktop.

## Come provarle

Aprire `http://127.0.0.1:3000/proposte`. La galleria permette di cambiare direzione, formato e servizi assegnati. La barra Home / Il mio piano / Prenotazioni / Profilo permette di confrontare la stessa destinazione passando da una proposta all’altra; la destinazione viene mantenuta. “Apri esperienza” apre una proposta a schermo intero, adattata alla larghezza reale del browser. Le sei URL dirette sono `/proposte/oggi`, `/proposte/ritmo`, `/proposte/vicino`, `/proposte/studio`, `/proposte/essenziale`, `/proposte/team`.

Percorso suggerito: home → piano → giornata → inizia allenamento → recupero → completa esercizi → riepilogo → calendario → giorno → orario → conferma → prenotazione → annulla → profilo. Nella galleria “Vedi ingresso” apre il login dimostrativo; nell’esperienza completa è raggiungibile con “Esci dalla demo” dal profilo.

Provare anche solo coaching online e solo sede. I servizi mostrati cambiano con la selezione: online dà accesso al piano, sede alle prenotazioni, entrambi a entrambe le sezioni. Il profilo resta disponibile. Questo selettore serve alla revisione; nell’app definitiva i permessi arrivano dalle policy dei tier sul server.

## Le direzioni

| Proposta          | Priorità                         | Home                                                               | Piano e calendario                                                                                          | Compromesso                                        |
| ----------------- | -------------------------------- | ------------------------------------------------------------------ | ----------------------------------------------------------------------------------------------------------- | -------------------------------------------------- |
| **01 Oggi**       | Capire subito la prossima azione | Sessione principale, prossimo appuntamento e indicazione del coach | Giorni del piano, dettaglio e modalità allenamento; selezione giorno/orario                                 | La panoramica completa richiede di aprire il piano |
| **02 Ritmo**      | Organizzare la settimana         | Timeline degli impegni, navigazione orizzontale                    | Piano a tre colonne selezionabili; prenotazioni sulla griglia settimanale, senza passare dalla lista giorno | Scorrimento orizzontale necessario su mobile       |
| **03 Vicino**     | Sentire la presenza del coach    | Lettera e prossimo passo                                           | Piano come diario a capitoli espandibili; prenotazione coach → giorno → orario                              | Più lettura e più passaggi espliciti               |
| **04 Studio**     | Prenotare in sede                | La home è il calendario mensile                                    | Mese a tutta pagina e pannello giorno; piano come libreria di sessioni da esplorare                         | La prenotazione domina l’esperienza                |
| **05 Essenziale** | Una decisione per schermata      | Due azioni aperte, senza card o sidebar                            | Scelta della sessione e riepilogo; prenotazione prima giorno, poi orario, poi conferma                      | Meno visione d’insieme                             |
| **06 Team**       | Una console sportiva             | Superficie completamente scura e navigazione superiore             | Console FORZA/CORSA, numeri e prescrizioni; schedule scuro e sezione I tuoi posti                           | Più intenso visivamente                            |

**Raccomandazione:** partire dalla gerarchia di Oggi e dall’identità Team. La prima riduce il lavoro mentale; la seconda è la più vicina al sito ufficiale. Considerare il selettore settimana di Ritmo nel piano e la prenotazione di Studio. Nessuna combinazione è già stata imposta nell’area operativa.

## Riferimenti osservati

Tutti consultati via browser sulle pagine pubbliche, senza account nuovi, strumenti a pagamento, copie di file UI o prenotazioni reali.

- [Team Italfit](https://www.teamitalfit.com/): header nero, logo bianco, accenti rossi, immagini palestra in bianco e nero, titoli sportivi. Messaggio centrato su metodo, personalizzazione e coach. Applicazione: proposta Team e gerarchia del rapporto col coach; nessuna statistica commerciale importata.
- [Mobbin · Sports](https://mobbin.com/explore/mobile/app-categories/sports): schermate pubbliche Any Distance e Apple Sports. [Activity Dashboard Any Distance](https://mobbin.com/explore/screens/997a1009-ef06-4185-9494-25451db591ec) e [dettaglio evento Apple Sports](https://mobbin.com/explore/screens/3b899cbb-daf5-4d94-8766-4e7acd1f40f9). Applicazione: navigazione inferiore, gerarchia attività/progresso, dettaglio in pannello. La funzione di salvataggio/copia richiede accesso e non è stata utilizzata.
- [Hevy](https://www.hevyapp.com/): presentazione pubblica con immagini dell’interfaccia, routine, prescrizioni, recuperi e note; uso su mobile e desktop. Applicazione: passaggio piano → esercizio → recupero → completamento.
- [Nike Training Club](https://www.nike.com/ntc-app): presentazione pubblica di programmi, allenamenti per obiettivo, guida e pianificazione. Applicazione: piano leggibile come percorso guidato. Non è stata analizzata un’area autenticata dell’app.
- [ABC Trainerize](https://www.trainerize.com/): presentazione pubblica del rapporto coach/cliente e della continuità tra online e presenza. Applicazione: nota attribuita al coach, piano assegnato e accessi distinti. Non introduce una chat.
- [Cal.com](https://cal.com/it/): esempio pubblico di prenotazione, giorno, fascia oraria, durata e fuso. Applicazione: calendario → orari → riepilogo → conferma; disponibilità distinta dalla prenotazione confermata.

Le proposte sono interpretazioni originali. Logo e illustrazioni provengono dagli asset già presenti nel repository. Non sono state riutilizzate immagini delle app citate né inventate foto di coach o studenti.

## Comportamento desktop e mobile

- Desktop: Oggi usa la sidebar, Ritmo una barra orizzontale, Vicino un indice tipografico da diario, Studio un menu a icone, Essenziale una pagina centrata con navigazione testuale, Team una console scura a tutta larghezza.
- Mobile: Oggi mantiene la tab bar; Ritmo usa schede e colonne scorrevoli; Vicino un indice testuale; Studio porta la navigazione sopra al calendario; Essenziale usa solo il menu testuale superiore; Team usa una tab bar scura. La conferma della prenotazione e il timer restano componenti condivisi, con gli stessi dati e la stessa semantica operativa.
- La galleria è responsive; il formato Desktop resta intenzionalmente largo quando viene ispezionato da un telefono. Per l’esperienza responsive reale usare “Apri esperienza”.
- Date italiane in Europe/Rome. Focus visibile, nomi accessibili dei giorni, pulsanti selezionati, dialog con titolo e descrizione, conferme annunciate come stato, rispetto di `prefers-reduced-motion`.

## Cosa è effettivamente interattivo

Navigazione, accesso dimostrativo, selezione mese/settimana/giornata, esercizi, timer reale di recupero, completamento, note per settimana/sessione, selezione giorno, filtro coach, disponibilità esaurita, riepilogo, conferma, annullamento e profilo. È presente un mese senza piano e una vista senza prenotazioni. La prossima lezione in home segue le prenotazioni della demo.

Dati in memoria, azzerati ricaricando o ripristinando; non vengono inviati al CRM. Il campione usa le tre sessioni del 2–8 novembre; Oggi permette anche di ispezionare settimane con prescrizioni ripetute e il mese vuoto. Gli orari sono esemplificativi dal 2 al 29 novembre. Il coach e il nome dello studente sono fixture. Nessuna sessione o prenotazione reale viene modificata. Il prototipo non sostituisce validazioni, limiti mensili o gestione concorrenza del backend operativo.

## Da definire dopo la scelta

1. Gerarchia della home e tono visivo finale: Oggi + Team è il punto di partenza proposto.
2. Quanto dettaglio mantenere nella modalità allenamento: conferma dell’intero esercizio nel prototipo, eventuale registrazione delle singole serie da discutere.
3. Stati collegati al backend: caricamento, errori di rete, sessione scaduta, conflitto per ultimo posto e ripristino dopo invio incerto. Il prototipo non simula una robustezza di rete inesistente.
4. Integrazione delle policy già operative: servizi dei tier, limiti mensili e conservazione dello storico.
5. Installazione PWA, notifiche e offline sono un’eventuale fase separata. La proposta attuale offre una UX da app web; non dichiara queste capacità disponibili.

## Verifica

Controlli automatici del repository: lint, TypeScript, 117 test esistenti, formattazione e build di produzione. Controlli browser: sei home, navigazione desktop/mobile, piano, completamento, timer, calendario, conferma/annullamento, profilo, accessi singoli e stato vuoto. Le prove interessano il prototipo e non certificano un’integrazione con il backend, che qui non è prevista.

## Tesi visiva e interazione

Le direzioni si distinguono per architettura, oltre che per tono: planner, diario, calendario, flusso sequenziale, console sportiva e home operativa. Le superfici e la tipografia sostengono questi modelli: righe e colonne per Ritmo, carta e serif per Vicino, mese pieno per Studio, assenza di sidebar per Essenziale, nero/rosso e numeri per Team. Le interazioni principali sono rispettivamente selezione di una colonna, apertura di un capitolo, ispezione di un giorno e avanzamento di un passaggio. Focus, conferma e dati rimangono coerenti. I componenti operativi condivisi non sostituiscono più le pagine proposte.
