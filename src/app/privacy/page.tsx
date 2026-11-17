import type { Metadata } from "next";
import Link from "next/link";
import { Brand } from "@/components/brand";

export const metadata: Metadata = {
  title: "Privacy",
  description: "Informativa sul trattamento dei dati del CRM di Team Italfit.",
};

/** Public privacy notice, also referenced by the Google OAuth consent screen. */
export default function PrivacyPage() {
  return (
    <main className="mx-auto max-w-2xl px-5 py-12 sm:py-16">
      <Link href="/" aria-label="Team Italfit">
        <Brand />
      </Link>
      <h1 className="mt-8 text-3xl font-bold tracking-tight">
        Informativa privacy del CRM
      </h1>
      <p className="mt-2 text-sm text-muted-foreground">
        Ultimo aggiornamento: 18 novembre 2026
      </p>
      <div className="mt-8 space-y-6 text-[15px] leading-7">
        <section>
          <h2 className="text-lg font-semibold">Chi siamo</h2>
          <p>
            Il CRM di Team Italfit è uno strumento interno usato dal team per
            gestire studenti, piani di allenamento, lezioni e pagamenti. Vi
            accedono solo gli studenti e i membri del team invitati.
          </p>
        </section>
        <section>
          <h2 className="text-lg font-semibold">Dati trattati</h2>
          <p>
            Anagrafica e contatti degli studenti, piani e registri di
            allenamento, prenotazioni, pagamenti e ricevute caricate. I dati
            servono solo all’erogazione dei servizi di Team Italfit e non sono
            venduti né ceduti a terzi.
          </p>
        </section>
        <section>
          <h2 className="text-lg font-semibold">Google Calendar</h2>
          <p>
            I membri del team possono collegare il proprio Google Calendar. Con
            il loro consenso il CRM:
          </p>
          <ul className="list-disc space-y-1 pl-6">
            <li>
              crea, aggiorna e rimuove nel calendario scelto gli eventi generati
              dal CRM (lezioni, appuntamenti del team, gare degli studenti);
            </li>
            <li>
              legge l’elenco dei calendari per permettere di scegliere quello di
              destinazione;
            </li>
            <li>
              legge solo gli intervalli occupati (inizio e fine, senza dettagli)
              per mostrare la disponibilità nell’agenda del team.
            </li>
          </ul>
          <p>
            Il CRM non legge il contenuto degli altri eventi, non usa i dati di
            Google per altri scopi, non li condivide e non li usa per
            pubblicità. Il token di accesso è conservato cifrato. Scollegando
            Google Calendar dalle impostazioni, gli eventi creati dal CRM
            vengono rimossi e l’accesso viene revocato; si può revocarlo anche
            da myaccount.google.com/permissions. L’uso dei dati ricevuti dalle
            API di Google rispetta le Google API Services User Data Policy,
            inclusi i requisiti di Limited Use.
          </p>
        </section>
        <section>
          <h2 className="text-lg font-semibold">Contatti</h2>
          <p>
            Per domande o per esercitare i tuoi diritti (accesso, rettifica,
            cancellazione) contatta Team Italfit tramite{" "}
            <a
              href="https://www.teamitalfit.com/"
              className="underline underline-offset-4"
            >
              www.teamitalfit.com
            </a>
            .
          </p>
        </section>
      </div>
    </main>
  );
}
