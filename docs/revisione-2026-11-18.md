# Revisione completa · 18 novembre 2026

Revisione di app, design, area studente, calendario, contabilità, sicurezza e infrastruttura dopo il passaggio al livello dati a record singoli e alla PWA.

## Cosa è stato verificato

| Area                    | Come                                                                                                                                                                                              | Esito                                                                                                                  |
| ----------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------- |
| Qualità del codice      | ESLint, TypeScript strict, Prettier, 212 test, build di produzione                                                                                                                                | Verde                                                                                                                  |
| Dati                    | 37 controlli sul database vero (conflitti, capienza, differenze, slice studente), record tecnici poi rimossi                                                                                      | Superati dopo la migrazione finale                                                                                     |
| Sicurezza database      | RLS su tutte le tabelle, nessun permesso ad `anon`, `authenticated` solo in lettura su 2 tabelle, nessuna funzione eseguibile dal client, `search_path` fissato sulle funzioni `security definer` | Corretto                                                                                                               |
| Sicurezza applicazione  | Origine e sessione controllate su ogni scrittura, ruolo letto dal server, ricevute con CSP e `nosniff`                                                                                            | Corretto. Aggiunti X-Frame-Options, X-Content-Type-Options, Referrer-Policy e Permissions-Policy                       |
| Dipendenze              | `pnpm audit`                                                                                                                                                                                      | `shadcn` (solo strumento di build) spostato in `devDependencies`: nessuna vulnerabilità nelle dipendenze di produzione |
| Layout                  | 13 pagine admin a 320 e 390 px, area studente a desktop                                                                                                                                           | Nessun overflow orizzontale                                                                                            |
| Accessibilità           | Controllo automatico di nomi accessibili, etichette, alt, id duplicati, titoli, aree di tocco                                                                                                     | Titolo principale mancante nella scheda studente, salto di livello nell'elenco mobile, tab da 30 px: corretti          |
| Area studente           | Home, piano, progressi, prenotazioni con un accesso di prova (sola lettura)                                                                                                                       | Funziona sul nuovo livello dati; regola delle 12 ore spiegata nel dettaglio lezione                                    |
| Calendario e fusi orari | Lettura dei punti sensibili del codice: conversioni Europe/Rome, passaggio ora solare/legale                                                                                                      | Nessun problema trovato (non provato con date a cavallo del cambio d'ora)                                              |

## Correzioni di questa revisione

- Contabilità: il valore mensile di un piano ora somma sempre al prezzo dell'abbonamento (prima 100,00 € su 3 mesi dava 99,99 €). I centesimi che avanzano vanno ai primi mesi.
- Intestazioni di sicurezza su tutte le pagine (anti-clickjacking, niente sniffing dei tipi, referrer limitato, camera/microfono/posizione disattivati).
- Scheda studente con titolo principale (`h1`), elenco mobile con livelli di titolo coerenti, tab da 40 px su telefono.
- Pagina d'errore italiana per tutto ciò che sta fuori da `/admin` (area studente, accesso) e schermata di caricamento per l'area studente.
- La pagina 404 riporta alla propria area (`/login` smista per ruolo) invece che a `/admin`.
- `shadcn` tra le dipendenze di sviluppo.

## Da decidere o da fare (in ordine di importanza)

1. **Backup.** Il progetto Supabase non ha backup giornalieri né point-in-time recovery attivi (`backups: []`, `pitr_enabled: false`). Con dati veri è il rischio più alto: passare a un piano con backup giornalieri o pianificare un export periodico.
2. **Assenze e recuperi.** Decisione ancora aperta: va definito come trattare una lezione saltata o recuperata (credito, scadenza, addebito).
3. **Promemoria.** Nessuna notifica agli studenti: né per una lezione in arrivo, né per un pacchetto in scadenza, né per un pagamento da saldare. Le email Resend e le notifiche push della PWA sono la base naturale.
4. **Liste senza limite.** Lezioni e prenotazioni crescono per sempre nelle letture: servono finestre temporali (ultimi mesi + futuro), con una lettura dedicata per la contabilità dei mesi passati.
5. **Sovrapposizioni.** Coach e sala non sono bloccati dal database ma solo dal controllo sul server: due lezioni sovrapposte create nello stesso istante possono passare.
6. **Gestione dei tier.** I tier sono fissi nella configurazione: non c'è una schermata per crearli o modificarli, né per vedere quanti studenti ha ciascuno.
7. **Home studente.** Oggi mostra due schede e molto spazio vuoto. Può ospitare la prossima lezione, i posti rimasti nel pacchetto con la scadenza, l'ultimo allenamento.
8. **Contabilità.** Il margine confronta incassato (cassa) e compensi calcolati sul valore maturato: sono due criteri diversi. Un piano assegnato a uno studente senza abbonamento vale 0 e il compenso del coach resta 0: la pagina Coaching online segnala già questi casi.
9. **Pagine di proposta.** `/proposte` è pubblica, non collegata e contiene solo bozze di design: rimuoverla o proteggerla dietro l'accesso.
10. **Politica di sicurezza dei contenuti (CSP).** Oltre alle intestazioni già aggiunte, un CSP completo richiede nonce per gli script in linea di Next.js: da fare con una prova dedicata.
11. **Verifiche manuali ancora da fare.** Installazione della PWA su un iPhone vero, prenotazione e annullamento con un accesso studente reale, invio di un invito email con Resend.
