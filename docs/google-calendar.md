# Google Calendar

Ogni membro del team collega il proprio Google Calendar da **Impostazioni → Google Calendar** e sceglie il calendario di destinazione. Il CRM scrive in quel calendario:

- le lezioni di cui è coach, con gli iscritti nella descrizione;
- le call e gli appuntamenti dell’agenda a cui partecipa;
- le gare dei suoi studenti come eventi di un giorno (il super admin riceve tutte le gare).

La direzione è dal CRM verso Google. Modifiche e annullamenti nel CRM aggiornano o rimuovono gli eventi; cambiare calendario sposta gli eventi; scollegarsi li rimuove. Gli eventi hanno un ID fisso per persona e voce del CRM, quindi una sincronizzazione ripetuta non crea doppioni. Le modifiche fatte direttamente in Google su questi eventi vengono sovrascritte alla sincronizzazione successiva.

La sincronizzazione parte dopo ogni salvataggio rilevante (lezioni, prenotazioni, agenda, gare) senza rallentarlo, e si può avviare a mano con **Sincronizza ora**. Scrive gli eventi da 30 giorni fa a un anno avanti; quelli passati restano. L’agenda mostra, per i partecipanti scelti, gli orari già occupati presi dal CRM e, se collegato, da Google (solo inizio e fine, mai i dettagli).

## Configurazione delle credenziali (una volta)

1. Apri [Google Cloud Console](https://console.cloud.google.com/) con l’account di Team Italfit e crea un progetto, ad esempio «Team Italfit CRM».
2. **API e servizi → Libreria**: abilita **Google Calendar API**.
3. **API e servizi → Schermata consenso OAuth** (Google Auth Platform):
   - tipo di utenti **Esterno**, nome app «Team Italfit CRM», email di assistenza e contatto dello sviluppatore;
   - dominio autorizzato: il dominio del CRM (ad esempio `vercel.app` o quello personalizzato);
   - ambiti: `.../auth/calendar.events`, `.../auth/calendar.calendarlist.readonly`, `.../auth/calendar.freebusy`, `openid`, `email`.
4. **Pubblica l’app** («In produzione»). In modalità test Google fa scadere il collegamento dopo 7 giorni. Senza la verifica di Google l’app funziona fino a 100 utenti: al primo collegamento compare l’avviso «app non verificata» e si prosegue con **Avanzate → Vai a Team Italfit CRM**.
5. **Credenziali → Crea credenziali → ID client OAuth**, tipo **Applicazione web**, con questi URI di reindirizzamento autorizzati:
   - `https://italfitcrm.vercel.app/api/google/callback`
   - `http://127.0.0.1:3000/api/google/callback` (solo per lo sviluppo)
6. Copia ID client e segreto nelle variabili `GOOGLE_CLIENT_ID` e `GOOGLE_CLIENT_SECRET` su Vercel (Production) e in `.env.local`, poi ridistribuisci.

## Sicurezza

Il token di aggiornamento di Google è cifrato con AES-GCM prima del salvataggio, con una chiave derivata da `SUPABASE_SECRET_KEY`: se quella chiave cambia, ogni membro deve ricollegare il calendario. Le tabelle `crm_google_connections`, `crm_google_links` e `crm_events` (migrazione `20261118120000_italfit_google_calendar`, applicata il 18 novembre 2026) sono accessibili solo dal server. Il collegamento usa uno `state` firmato e un cookie monouso legato al membro che lo avvia.
