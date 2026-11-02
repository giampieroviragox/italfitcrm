"use client";
import {
  useEffect,
  useRef,
  useState,
  type CSSProperties,
  type ReactNode,
} from "react";
import Image from "next/image";
import Link from "next/link";
import { Dialog } from "radix-ui";
import {
  ArrowDown,
  ArrowLeft,
  ArrowRight,
  ArrowUpRight,
  BatteryFull,
  CalendarDays,
  Check,
  ChevronLeft,
  ChevronRight,
  CircleCheck,
  Clock3,
  Dumbbell,
  Home,
  Monitor,
  Play,
  RotateCcw,
  Smartphone,
  Timer,
  UserRound,
  Wifi,
  X,
} from "lucide-react";
import { SelectControl } from "@/components/ui/select-control";
import {
  nextWorkoutStep,
  proposals,
  prototypeDate,
  servicesFor,
  sessions,
  slots,
  sources,
  type Device,
  type Proposal,
  type ProposalId,
  type Screen,
  type ServiceMode,
} from "./proposal-data";
import styles from "./proposals.module.css";
import { VariantPlan, VariantCalendar } from "./experience-variants";

const screenNames: Record<Screen, string> = {
  home: "Home",
  piano: "Il mio piano",
  calendario: "Prenotazioni",
  profilo: "Profilo",
  accesso: "Ingresso",
};
const navIcons = {
  home: Home,
  piano: Dumbbell,
  calendario: CalendarDays,
  profilo: UserRound,
};

export function ProposalsGallery({
  initial,
  initialDevice,
}: {
  initial: ProposalId;
  initialDevice: Device;
}) {
  const [selected, setSelected] = useState(initial),
    [device, setDevice] = useState(initialDevice),
    [mode, setMode] = useState<ServiceMode>("entrambi"),
    [screen, setScreen] = useState<Screen>("home"),
    [reset, setReset] = useState(0);
  const proposal = proposals.find((p) => p.id === selected)!;
  const select = (id: ProposalId, nextDevice = device) => {
    setSelected(id);
    setDevice(nextDevice);
    window.history.replaceState(
      null,
      "",
      `/proposte?concept=${id}&device=${nextDevice}`,
    );
  };
  return (
    <main className={styles.gallery}>
      <header className={styles.reviewHeader}>
        <Link href="/admin" className={styles.brand}>
          TEAM ITALFIT<span> / Design studio</span>
        </Link>
        <span className={styles.reviewTag}>6 DIREZIONI · NOVEMBRE 2026</span>
        <Link href="/area-studente" className={styles.returnLink}>
          Area attuale <ArrowUpRight size={14} />
        </Link>
      </header>
      <div className={styles.galleryGrid}>
        <aside className={styles.selector}>
          <p className={styles.eyebrow}>L’ESPERIENZA STUDENTE</p>
          <h1>
            Sei esperienze.
            <br />
            Sei strutture.
          </h1>
          <p className={styles.intro}>
            Sei architetture diverse. Confronta anche i piani e le prenotazioni.
          </p>
          <nav
            aria-label="Proposte di esperienza"
            className={styles.conceptList}
          >
            {proposals.map((p) => (
              <button
                key={p.id}
                aria-pressed={p.id === selected}
                onClick={() => select(p.id)}
                className={`${styles.conceptButton} ${p.id === selected ? styles.conceptSelected : ""}`}
                style={{ "--swatch": p.color } as CSSProperties}
              >
                <span className={styles.conceptNumber}>{p.number}</span>
                <span>
                  <strong>{p.name}</strong>
                  <small>{p.claim}</small>
                </span>
                <span className={styles.swatch} />
              </button>
            ))}
          </nav>
          <div className={styles.recommendation}>
            <span>IL MIO PUNTO DI PARTENZA</span>
            <p>
              <strong>01 · Oggi</strong> per la struttura.
              <br />
              <strong>06 · Team</strong> per l’identità.
              <br />
              Una buona combinazione da validare insieme.
            </p>
          </div>
        </aside>
        <section
          className={styles.reviewMain}
          aria-label="Anteprima interattiva"
        >
          <div className={styles.reviewTitle}>
            <div>
              <p className={styles.eyebrow}>PROPOSTA {proposal.number} / 06</p>
              <h2>
                {proposal.name}
                <span>{proposal.claim}</span>
              </h2>
            </div>
            <div
              className={styles.deviceControls}
              aria-label="Formato anteprima"
            >
              <button
                aria-pressed={device === "mobile"}
                onClick={() => select(selected, "mobile")}
              >
                <Smartphone size={16} />
                Mobile
              </button>
              <button
                aria-pressed={device === "desktop"}
                onClick={() => select(selected, "desktop")}
              >
                <Monitor size={16} />
                Desktop
              </button>
            </div>
          </div>
          <div className={styles.testToolbar}>
            <label>
              Accessi{" "}
              <SelectControl
                className={styles.reviewSelect}
                value={mode}
                onChange={(e) => {
                  setMode(e.target.value as ServiceMode);
                  setScreen("home");
                }}
              >
                <option value="entrambi">Piano + sede</option>
                <option value="online">Solo coaching online</option>
                <option value="sede">Solo lezioni in sede</option>
              </SelectControl>
            </label>
            <Link
              className={styles.expandLink}
              href={`/proposte/${selected}`}
              target="_blank"
            >
              Apri esperienza <ArrowUpRight size={14} />
            </Link>
            <button onClick={() => setScreen("accesso")}>
              <UserRound size={14} /> Vedi ingresso
            </button>
            <button
              onClick={() => {
                setReset((r) => r + 1);
                setScreen("home");
              }}
            >
              <RotateCcw size={14} /> Ripristina
            </button>
            <span>Prototipo · dati dimostrativi · nessun invio</span>
          </div>
          <nav
            className={styles.compareScreens}
            aria-label="Schermata da confrontare"
          >
            {(
              [
                "home",
                ...(mode !== "sede" ? ["piano"] : []),
                ...(mode !== "online" ? ["calendario"] : []),
                "profilo",
              ] as Screen[]
            ).map((next) => (
              <button
                key={next}
                aria-pressed={screen === next}
                onClick={() => setScreen(next)}
              >
                {screenNames[next]}
              </button>
            ))}
            <span>La schermata resta selezionata quando cambi proposta.</span>
          </nav>
          <div
            className={`${styles.stage} ${device === "mobile" ? styles.mobileStage : styles.desktopStage}`}
          >
            <div
              className={`${styles.deviceFrame} ${device === "mobile" ? styles.phone : styles.computer}`}
            >
              {device === "mobile" ? (
                <div className={styles.phoneTop}>
                  <strong>9:41</strong>
                  <span className={styles.island} />
                  <span>
                    <Wifi size={14} />
                    <BatteryFull size={18} />
                  </span>
                </div>
              ) : (
                <div className={styles.browserBar}>
                  <i />
                  <i />
                  <i />
                  <span>teamitalfit · area personale</span>
                  <span>Prototipo {proposal.number}</span>
                </div>
              )}
              <Prototype
                key={`${selected}:${mode}:${reset}`}
                proposal={proposal}
                screen={screen}
                setScreen={setScreen}
                mode={mode}
              />
              {device === "mobile" && (
                <div className={styles.homeIndicator}>
                  <span />
                </div>
              )}
            </div>
            {device === "mobile" && (
              <div className={styles.stageCaption}>
                <span>PROVALA COME UN’APP</span>
                <p>
                  Tocca le sezioni in basso, avvia un allenamento
                  <br />o scegli un orario e conferma la prenotazione.
                </p>
                <ArrowDown size={18} />
              </div>
            )}
          </div>
          <div className={styles.decisionNotes}>
            <div>
              <p className={styles.eyebrow}>PERCHÉ QUESTA DIREZIONE</p>
              <h3>{proposal.summary}</h3>
            </div>
            <dl>
              <div>
                <dt>Home</dt>
                <dd>{proposal.home}</dd>
              </div>
              <div>
                <dt>Piano</dt>
                <dd>{proposal.plan}</dd>
              </div>
              <div>
                <dt>Calendario</dt>
                <dd>{proposal.calendar}</dd>
              </div>
              <div>
                <dt>Mobile</dt>
                <dd>{proposal.mobile}</dd>
              </div>
              <div>
                <dt>Desktop</dt>
                <dd>{proposal.desktop}</dd>
              </div>
              <div>
                <dt>Da valutare</dt>
                <dd>{proposal.tradeoff}</dd>
              </div>
            </dl>
            <p className={styles.sourceLine}>
              Riferimenti osservati:{" "}
              {proposal.sources.map((i) => (
                <a
                  key={i}
                  href={sources[i]!.url}
                  target="_blank"
                  rel="noreferrer"
                >
                  {sources[i]!.name} <ArrowUpRight size={11} />
                </a>
              ))}
            </p>
          </div>
          <details className={styles.research}>
            <summary>
              Ricerca, riferimenti e cosa è simulato <ChevronRight size={16} />
            </summary>
            <div>
              <p>
                Ricerca del 2 novembre 2026 su pagine pubbliche, senza
                iscrizioni o strumenti a pagamento. Queste sono interpretazioni
                per Italfit, non copie delle app citate.
              </p>
              <ul>
                {sources.map((source) => (
                  <li key={source.url}>
                    <a href={source.url} target="_blank" rel="noreferrer">
                      {source.name} ↗
                    </a>
                    <p>{source.note}</p>
                  </li>
                ))}
              </ul>
              <h4>Confine del prototipo</h4>
              <p>
                Completamenti, note, timer, selezioni e prenotazioni vivono
                soltanto in questa anteprima. Ripristina li azzera. Non vengono
                modificati utenti, programmi o calendari del CRM. Nessun login,
                invito o pagamento reale.
              </p>
              <p>
                La navigazione mobile simula un’esperienza da app web.
                Installazione, notifiche push e uso offline richiederebbero
                un’implementazione successiva: non sono funzionalità già
                disponibili.
              </p>
            </div>
          </details>
        </section>
      </div>
    </main>
  );
}

export function StudentExperiencePreview({ proposal }: { proposal: Proposal }) {
  const [mode, setMode] = useState<ServiceMode>("entrambi");
  const [screen, setScreen] = useState<Screen>("home");
  return (
    <main className={styles.standalone}>
      <header className={styles.previewBar}>
        <Link href={`/proposte?concept=${proposal.id}`}>
          <ArrowLeft size={14} /> Le 6 proposte
        </Link>
        <span>
          {proposal.number} · {proposal.name} · Prototipo
        </span>
        <label>
          Accessi{" "}
          <SelectControl
            aria-label="Accessi anteprima"
            value={mode}
            onChange={(e) => {
              setMode(e.target.value as ServiceMode);
              setScreen("home");
            }}
          >
            <option value="entrambi">Piano + sede</option>
            <option value="online">Solo online</option>
            <option value="sede">Solo sede</option>
          </SelectControl>
        </label>
      </header>
      <div className={styles.standaloneApp}>
        <Prototype
          key={mode}
          proposal={proposal}
          mode={mode}
          screen={screen}
          setScreen={setScreen}
        />
      </div>
    </main>
  );
}

function Prototype({
  proposal: p,
  screen,
  setScreen,
  mode,
}: {
  proposal: Proposal;
  screen: Screen;
  setScreen: (screen: Screen) => void;
  mode: ServiceMode;
}) {
  const services = servicesFor(mode);
  const originalExperience = ["oggi"].includes(p.id);
  const [sessionIndex, setSessionIndex] = useState(0),
    [week, setWeek] = useState(1),
    [month, setMonth] = useState("novembre"),
    [day, setDay] = useState(1),
    [calendarWeek, setCalendarWeek] = useState(0),
    [coach, setCoach] = useState("Tutti"),
    [onlyMine, setOnlyMine] = useState(false);
  const [booked, setBooked] = useState<Record<string, boolean>>(
    mode === "online" ? {} : { "1:s4": true },
  );
  const [booking, setBooking] = useState<{ day: number; slot: string } | null>(
      null,
    ),
    [notice, setNotice] = useState(""),
    [notes, setNotes] = useState<Record<string, string>>({});
  const [training, setTraining] = useState(false),
    [step, setStep] = useState(0),
    [rest, setRest] = useState(0),
    [completed, setCompleted] = useState<number[]>([]);
  const scroller = useRef<HTMLDivElement>(null);
  const session = sessions[sessionIndex]!;
  useEffect(() => {
    if (rest <= 0) return;
    const timer = window.setTimeout(
      () => setRest((value) => Math.max(0, value - 1)),
      1000,
    );
    return () => window.clearTimeout(timer);
  }, [rest]);
  const go = (next: Screen) => {
    setNotice("");
    setTraining(false);
    setBooking(null);
    setScreen(next);
    scroller.current?.scrollTo({ top: 0 });
  };
  const start = () => {
    setStep(0);
    setRest(0);
    setTraining(true);
    scroller.current?.scrollTo({ top: 0 });
  };
  const allBookings = Object.entries(booked)
    .filter(([, value]) => value)
    .map(([key]) => {
      const [offset, id] = key.split(":");
      return {
        key,
        day: Number(offset),
        slot: slots.find((slot) => slot.id === id)!,
      };
    })
    .sort((a, b) => a.day - b.day || a.slot.time.localeCompare(b.slot.time));
  const nextBooking = allBookings[0];
  const activeSlot = booking
    ? slots.find((slot) => slot.id === booking.slot)
    : null;
  const bookingKey = booking ? `${booking.day}:${booking.slot}` : "";
  const isBooked = Boolean(booked[bookingKey]);
  const days = Array.from({ length: 7 }, (_, i) => calendarWeek * 7 + i);
  const navScreens: ("home" | "piano" | "calendario" | "profilo")[] = [
    "home",
    ...(services.plans ? ["piano" as const] : []),
    ...(services.lessons ? ["calendario" as const] : []),
    "profilo",
  ];
  const sessionTile = (primary = false) => (
    <button
      className={`${styles.sessionTile} ${primary ? styles.primaryTile : ""}`}
      onClick={() => {
        setSessionIndex(0);
        go("piano");
      }}
    >
      <div>
        <span className={styles.kicker}>IL PROSSIMO ALLENAMENTO</span>
        <h3>{sessions[0].name}</h3>
        <p>{sessions[0].duration} · 3 esercizi · Full body</p>
        <span className={styles.textAction}>
          Apri il piano <ArrowRight size={15} />
        </span>
      </div>
      <span className={styles.movement}>
        <Image
          src="/illustrations/strength.svg"
          width={110}
          height={110}
          alt=""
        />
      </span>
    </button>
  );
  const appointment = () => (
    <button
      className={styles.appointment}
      onClick={() => {
        if (nextBooking) {
          setDay(nextBooking.day);
          setCalendarWeek(Math.floor(nextBooking.day / 7));
        }
        go("calendario");
      }}
    >
      <span className={styles.dateBlock}>
        <small>
          {nextBooking
            ? prototypeDate(nextBooking.day).label.slice(0, 3).toUpperCase()
            : "SEDE"}
        </small>
        <strong>
          {nextBooking
            ? String(prototypeDate(nextBooking.day).number).padStart(2, "0")
            : "+"}
        </strong>
      </span>
      <span>
        <small>
          {nextBooking ? "LA TUA PROSSIMA LEZIONE" : "CI ALLENIAMO INSIEME"}
        </small>
        <strong>
          {nextBooking ? "Allenamento in sede" : "Trova il tuo posto"}
        </strong>
        <span>
          {nextBooking
            ? `${nextBooking.slot.time} · ${nextBooking.slot.duration} · ${nextBooking.slot.coach}`
            : "Scegli il giorno e l’orario che preferisci"}
        </span>
      </span>
      <ArrowUpRight size={18} />
    </button>
  );
  const coachNote = () => (
    <div className={styles.coachNote}>
      <div className={styles.avatar}>G</div>
      <div>
        <span className={styles.kicker}>GIORGIO · IL TUO COACH</span>
        <p>
          Questa settimana cerca il controllo del movimento. Il carico viene
          dopo la tecnica.
        </p>
        <small>Nota sul tuo programma · 2 novembre</small>
      </div>
    </div>
  );
  const quickActions = () => (
    <div className={styles.quickLinks}>
      {services.plans && (
        <button onClick={() => go("piano")}>
          <Dumbbell size={18} />
          <span>Il mio piano</span>
          <ArrowUpRight size={17} />
        </button>
      )}
      {services.lessons && (
        <button onClick={() => go("calendario")}>
          <CalendarDays size={18} />
          <span>Prenota in sede</span>
          <ArrowUpRight size={17} />
        </button>
      )}
    </div>
  );
  const dayStrip = (forPlan = false) => (
    <div
      className={styles.dayStrip}
      aria-label={forPlan ? "Giornate del programma" : "Giorni disponibili"}
    >
      {(forPlan ? [0, 1, 2, 3, 4, 5, 6] : days).map((offset, i) => {
        const selected = forPlan
          ? [0, 2, 4][sessionIndex] === i
          : day === offset;
        return (
          <button
            key={offset}
            aria-pressed={selected}
            disabled={forPlan && ![0, 2, 4].includes(i)}
            aria-label={
              forPlan
                ? `${prototypeDate(offset + (week - 1) * 7).label}${[0, 2, 4].includes(i) ? ", allenamento" : ", riposo"}`
                : prototypeDate(offset).label
            }
            onClick={() =>
              forPlan
                ? setSessionIndex(i < 2 ? 0 : i < 4 ? 1 : 2)
                : setDay(offset)
            }
          >
            <span>{["L", "M", "M", "G", "V", "S", "D"][i]}</span>
            <strong>
              {prototypeDate(offset + (forPlan ? (week - 1) * 7 : 0)).number}
            </strong>
            <i
              className={
                i === 0 || i === 2 || i === 4 ? styles.activityDot : ""
              }
            />
          </button>
        );
      })}
    </div>
  );
  const slotList = () => {
    const list = slots.filter(
      (slot) =>
        (coach === "Tutti" || slot.coach === coach) &&
        (!onlyMine || booked[`${day}:${slot.id}`]),
    );
    return (
      <div className={styles.slotList}>
        {list.length ? (
          list.map((slot) => {
            const mine = booked[`${day}:${slot.id}`];
            return (
              <button
                key={slot.id}
                disabled={!mine && slot.available === 0}
                onClick={() => setBooking({ day, slot: slot.id })}
                className={`${styles.slot} ${mine ? styles.bookedSlot : ""}`}
              >
                <strong>
                  {slot.time}
                  <small>{slot.duration}</small>
                </strong>
                <span>
                  <b>{slot.name}</b>
                  <small>{slot.coach} · Sede Italfit</small>
                </span>
                <span className={styles.slotState}>
                  {mine ? (
                    <>
                      <Check size={13} />
                      Prenotata
                    </>
                  ) : slot.available === 0 ? (
                    "Completa"
                  ) : (
                    `${slot.available} ${slot.available === 1 ? "posto" : "posti"}`
                  )}
                  <ChevronRight size={15} />
                </span>
              </button>
            );
          })
        ) : (
          <div className={styles.empty}>
            <CalendarDays size={24} />
            <h3>Nessuna prenotazione qui</h3>
            <p>Prova un altro giorno oppure guarda tutti gli orari.</p>
            <button
              className={styles.secondaryButton}
              onClick={() => {
                setOnlyMine(false);
                setCoach("Tutti");
              }}
            >
              Tutti gli orari
            </button>
          </div>
        )}
      </div>
    );
  };
  return (
    <div className={`${styles.appRoot} ${styles[p.id]}`}>
      {screen !== "accesso" && (
        <div className={styles.appShell}>
          <aside className={styles.appSidebar}>
            <div className={styles.appBrand}>
              <Image
                src="/brand/team-italfit.svg"
                alt="Team Italfit"
                width={120}
                height={40}
              />
            </div>
            <p>IL TUO SPAZIO</p>
            <nav aria-label="Navigazione desktop studente">
              {navScreens.map((next) => {
                const Icon = navIcons[next];
                return (
                  <button
                    key={next}
                    aria-current={screen === next ? "page" : undefined}
                    onClick={() => go(next)}
                  >
                    <Icon size={18} />
                    {screenNames[next]}
                  </button>
                );
              })}
            </nav>
            <div className={styles.sidebarPerson}>
              <span className={styles.avatar}>GB</span>
              <span>
                Giulia Bianchi<small>Team Italfit</small>
              </span>
            </div>
          </aside>
          <div className={styles.appMain}>
            <header className={styles.appHeader}>
              <span className={styles.mobileBrand}>
                TEAM ITALFIT<span>●</span>
              </span>
              <span className={styles.desktopCrumb}>
                Il tuo spazio / <strong>{screenNames[screen]}</strong>
              </span>
              <nav
                className={styles.quickNav}
                aria-label="Navigazione rapida studente"
              >
                {navScreens.map((next) => (
                  <button
                    key={next}
                    aria-current={screen === next ? "page" : undefined}
                    onClick={() => go(next)}
                  >
                    {next === "home"
                      ? "Home"
                      : next === "piano"
                        ? "Piano"
                        : next === "calendario"
                          ? "Prenota"
                          : "Profilo"}
                  </button>
                ))}
              </nav>
              <button
                className={styles.profileButton}
                aria-label="Apri profilo"
                onClick={() => go("profilo")}
              >
                GB
              </button>
            </header>
            <div ref={scroller} className={styles.appScroll}>
              <div key={`${screen}:${training}`} className={styles.view}>
                {notice && (
                  <p role="status" className={styles.notice}>
                    <CircleCheck size={17} />
                    {notice}
                    <button
                      aria-label="Chiudi conferma"
                      onClick={() => setNotice("")}
                    >
                      <X size={14} />
                    </button>
                  </p>
                )}
                {screen === "home" && (
                  <>
                    <div
                      className={`${styles.greeting} ${p.id === "studio" && services.lessons ? styles.studioGreeting : ""}`}
                    >
                      <p className={styles.kicker}>LUNEDÌ 2 NOVEMBRE</p>
                      <h2>
                        {p.id === "team" ? (
                          <>
                            PRONTA A<br />
                            FARE IL TUO.
                          </>
                        ) : p.id === "essenziale" ? (
                          "Ciao, Giulia."
                        ) : p.id === "vicino" ? (
                          <>
                            Il tuo percorso,
                            <br />
                            un passo alla volta.
                          </>
                        ) : p.id === "ritmo" ? (
                          "Trova il tuo ritmo."
                        ) : p.id === "studio" ? (
                          services.lessons ? (
                            "Ci vediamo in sede."
                          ) : (
                            "Il tuo spazio per allenarti."
                          )
                        ) : (
                          <>
                            Ciao Giulia,
                            <br />
                            ripartiamo da te.
                          </>
                        )}
                      </h2>
                      <p>
                        {p.id === "team"
                          ? "IL TUO TEAM. IL TUO PROSSIMO PASSO."
                          : p.id === "essenziale"
                            ? "Da dove vuoi cominciare?"
                            : p.id === "studio"
                              ? "Il prossimo allenamento trova il suo spazio."
                              : "Il tuo programma, costruito intorno a te."}
                      </p>
                    </div>
                    {p.id === "oggi" && (
                      <div className={styles.homeSplit}>
                        <div>
                          {services.plans ? (
                            sessionTile(true)
                          ) : (
                            <BookingShortcut
                              dayStrip={dayStrip()}
                              onClick={() => go("calendario")}
                            />
                          )}
                          {services.plans && (
                            <div className={styles.progressLine}>
                              <span>Questa settimana</span>
                              <strong>
                                {completed.length} / 3 allenamenti
                              </strong>
                              <div>
                                {[0, 1, 2].map((i) => (
                                  <i
                                    key={i}
                                    className={
                                      completed.includes(i)
                                        ? styles.doneBar
                                        : ""
                                    }
                                  />
                                ))}
                              </div>
                            </div>
                          )}
                        </div>
                        <div className={styles.secondaryStack}>
                          {services.lessons && appointment()}
                          {coachNote()}
                          {quickActions()}
                        </div>
                      </div>
                    )}
                    {p.id === "ritmo" && (
                      <>
                        <div className={styles.weekHeading}>
                          <span>La tua settimana</span>
                          <strong>2 — 8 novembre</strong>
                        </div>
                        {dayStrip(services.plans)}
                        <div className={styles.timeline}>
                          {services.plans &&
                            sessions.map((s, i) => (
                              <button
                                key={s.id}
                                onClick={() => {
                                  setSessionIndex(i);
                                  go("piano");
                                }}
                              >
                                <span className={styles.timelineDay}>
                                  {s.day.slice(0, 3)}
                                  <strong>{2 + i * 2}</strong>
                                </span>
                                <span className={styles.timelineLine} />
                                <span>
                                  <small>COACHING ONLINE</small>
                                  <strong>{s.name}</strong>
                                  <p>
                                    {s.duration} · {s.focus}
                                  </p>
                                </span>
                                <ChevronRight size={18} />
                              </button>
                            ))}
                          {services.lessons && appointment()}
                        </div>
                        {quickActions()}
                      </>
                    )}
                    {p.id === "vicino" && (
                      <>
                        <div className={styles.letterHero}>
                          {coachNote()}
                          <span className={styles.letterSignature}>
                            Buon allenamento, Giorgio
                          </span>
                        </div>
                        <div className={styles.editorialDivider}>
                          <span>Il prossimo passo</span>
                          <span>01 / LA TUA SETTIMANA</span>
                        </div>
                        <div className={styles.homeSplit}>
                          {services.plans && sessionTile()}
                          {services.lessons && appointment()}
                        </div>
                        {quickActions()}
                      </>
                    )}
                    {p.id === "studio" &&
                      (services.lessons ? (
                        <VariantCalendar
                          onStageChange={() =>
                            scroller.current?.scrollTo({ top: 0 })
                          }
                          concept="studio"
                          day={day}
                          onDay={setDay}
                          booked={booked}
                          onBook={(day, slot) => setBooking({ day, slot })}
                        />
                      ) : (
                        <>
                          {sessionTile()}
                          {quickActions()}
                        </>
                      ))}
                    {p.id === "essenziale" && (
                      <>
                        <div className={styles.bigChoices}>
                          {services.plans && (
                            <button onClick={() => go("piano")}>
                              <span>01</span>
                              <Dumbbell size={29} />
                              <h3>Il mio piano</h3>
                              <p>
                                Settimana {week} · 3 giornate
                                <br />
                                Il tuo prossimo allenamento è pronto.
                              </p>
                              <span className={styles.textAction}>
                                Apri il piano <ArrowRight size={18} />
                              </span>
                            </button>
                          )}
                          {services.lessons && (
                            <button onClick={() => go("calendario")}>
                              <span>02</span>
                              <CalendarDays size={29} />
                              <h3>Lezioni in sede</h3>
                              <p>
                                Scegli quando venire.
                                <br />
                                Gestisci qui le tue prenotazioni.
                              </p>
                              <span className={styles.textAction}>
                                Scegli un orario <ArrowRight size={18} />
                              </span>
                            </button>
                          )}
                        </div>
                        <p className={styles.quietNote}>
                          Il tuo coach è Giorgio.{" "}
                          {services.plans
                            ? "Le sue indicazioni sono nel piano."
                            : "Scegli un orario per allenarti in sede."}
                        </p>
                      </>
                    )}
                    {p.id === "team" && (
                      <>
                        <div className={styles.teamHero}>
                          <span className={styles.teamWatermark}>ITALFIT</span>
                          <p className={styles.kicker}>
                            {services.plans
                              ? "PROSSIMA SESSIONE / 01"
                              : "IL TUO PROSSIMO APPUNTAMENTO"}
                          </p>
                          <h3>
                            {services.plans ? (
                              <>
                                FORZA.
                                <br />
                                CONTROLLO.
                                <br />
                                COSTANZA.
                              </>
                            ) : (
                              <>
                                ENTRA.
                                <br />
                                ALLENATI.
                                <br />
                                RIPARTI.
                              </>
                            )}
                          </h3>
                          <div>
                            <span>
                              {services.plans
                                ? "45 MIN · FULL BODY"
                                : "60 MIN · IN SEDE"}
                            </span>
                            <button
                              className={styles.primaryButton}
                              onClick={() => {
                                setSessionIndex(0);
                                go(services.plans ? "piano" : "calendario");
                              }}
                            >
                              {services.plans
                                ? "VAI AL PIANO"
                                : "PRENOTA IN SEDE"}
                              <ArrowUpRight size={19} />
                            </button>
                          </div>
                        </div>
                        <div className={styles.teamBottom}>
                          {services.plans && (
                            <div>
                              <span className={styles.kicker}>
                                IL METODO, UNA SESSIONE ALLA VOLTA
                              </span>
                              <strong>
                                {completed.length}
                                <span> / 3</span>
                              </strong>
                              <p>Allenamenti completati questa settimana</p>
                            </div>
                          )}
                          {services.lessons && appointment()}
                        </div>
                      </>
                    )}
                  </>
                )}
                {screen === "piano" &&
                  services.plans &&
                  !training &&
                  !originalExperience && (
                    <VariantPlan
                      concept={p.id}
                      selected={sessionIndex}
                      onSelect={setSessionIndex}
                      onStart={(index) => {
                        setSessionIndex(index);
                        start();
                      }}
                      completed={completed}
                      note={notes[`${week}:${sessionIndex}`] ?? ""}
                      onNote={(value) =>
                        setNotes((previous) => ({
                          ...previous,
                          [`${week}:${sessionIndex}`]: value,
                        }))
                      }
                      onSave={() => setNotice("Nota personale salvata.")}
                    />
                  )}
                {screen === "piano" &&
                  services.plans &&
                  !training &&
                  originalExperience && (
                    <>
                      <div className={styles.pageTitle}>
                        <p className={styles.kicker}>IL TUO PROGRAMMA</p>
                        <h2>
                          {p.id === "team"
                            ? "IL LAVORO DA FARE."
                            : p.id === "vicino"
                              ? "Il filo del tuo percorso."
                              : "Il mio piano"}
                        </h2>
                        <p>Forza & resistenza · preparato da Giorgio</p>
                      </div>
                      <div className={styles.planToolbar}>
                        <SelectControl
                          className={styles.appSelect}
                          aria-label="Mese del programma"
                          value={month}
                          onChange={(e) => setMonth(e.target.value)}
                        >
                          <option value="novembre">Novembre 2026</option>
                          <option value="ottobre">Ottobre 2026</option>
                        </SelectControl>
                        <div className={styles.weekControl}>
                          <button
                            aria-label="Settimana precedente"
                            disabled={week === 1}
                            onClick={() => {
                              setWeek((w) => w - 1);
                              setNotice(
                                "Le settimane successive ripetono le sessioni dimostrative.",
                              );
                            }}
                          >
                            <ChevronLeft size={16} />
                          </button>
                          <span>Settimana {week} / 4</span>
                          <button
                            aria-label="Settimana successiva"
                            disabled={week === 4}
                            onClick={() => {
                              setWeek((w) => w + 1);
                              setNotice(
                                "Le settimane successive ripetono le sessioni dimostrative.",
                              );
                            }}
                          >
                            <ChevronRight size={16} />
                          </button>
                        </div>
                      </div>
                      {month === "ottobre" ? (
                        <div className={styles.empty}>
                          <Dumbbell size={30} />
                          <h3>Il piano non è ancora qui</h3>
                          <p>
                            Per questo mese non c’è un programma assegnato. Il
                            tuo piano di novembre è disponibile.
                          </p>
                          <button
                            className={styles.primaryButton}
                            onClick={() => setMonth("novembre")}
                          >
                            Apri novembre
                          </button>
                        </div>
                      ) : (
                        <>
                          {p.id === "vicino" && coachNote()}
                          {p.id === "ritmo" && dayStrip(true)}
                          <div
                            className={`${styles.planLayout} ${p.id === "essenziale" ? styles.listPlan : ""}`}
                          >
                            <div
                              className={styles.sessionList}
                              aria-label="Giornate del piano"
                            >
                              {sessions.map((s, i) => (
                                <button
                                  key={s.id}
                                  aria-pressed={sessionIndex === i}
                                  onClick={() => setSessionIndex(i)}
                                >
                                  <span className={styles.sessionNumber}>
                                    {completed.includes(i) ? (
                                      <Check size={17} />
                                    ) : (
                                      String(i + 1).padStart(2, "0")
                                    )}
                                  </span>
                                  <span>
                                    <small>{s.day}</small>
                                    <strong>{s.name}</strong>
                                    <span>
                                      {s.duration} · {s.focus}
                                    </span>
                                  </span>
                                  <ChevronRight size={17} />
                                </button>
                              ))}
                            </div>
                            <div className={styles.sessionDetail}>
                              <div className={styles.sessionDetailHeading}>
                                <div>
                                  <p className={styles.kicker}>
                                    {session.day.toUpperCase()} · GIORNATA{" "}
                                    {sessionIndex + 1}
                                  </p>
                                  <h3>{session.name}</h3>
                                  <p>
                                    <Clock3 size={14} />
                                    {session.duration}
                                    <span>·</span>
                                    {session.focus}
                                  </p>
                                </div>
                                <Image
                                  src={
                                    session.kind === "run"
                                      ? "/illustrations/run.svg"
                                      : "/illustrations/strength.svg"
                                  }
                                  width={85}
                                  height={85}
                                  alt=""
                                />
                              </div>
                              <div className={styles.coachHint}>
                                <span>Indicazione di Giorgio</span>
                                <p>
                                  Prima la qualità, poi l’intensità. Prenditi il
                                  recupero prescritto tra le serie.
                                </p>
                              </div>
                              <h4 className={styles.sectionLabel}>
                                La sessione · {session.exercises.length}{" "}
                                esercizi
                              </h4>
                              <ol className={styles.exerciseList}>
                                {session.exercises.map((exercise, i) => (
                                  <li key={exercise.name}>
                                    <span>{i + 1}</span>
                                    <div>
                                      <strong>{exercise.name}</strong>
                                      <p>{exercise.dose}</p>
                                      <small>
                                        Recupero {exercise.rest}″ ·{" "}
                                        {exercise.note}
                                      </small>
                                    </div>
                                  </li>
                                ))}
                              </ol>
                              <button
                                className={styles.primaryButton}
                                onClick={start}
                              >
                                <Play size={17} />
                                {completed.includes(sessionIndex)
                                  ? "Ripeti l’allenamento"
                                  : "Inizia allenamento"}
                              </button>
                              <label className={styles.notesLabel}>
                                Le tue note
                                <textarea
                                  value={notes[`${week}:${sessionIndex}`] ?? ""}
                                  onChange={(e) =>
                                    setNotes((value) => ({
                                      ...value,
                                      [`${week}:${sessionIndex}`]:
                                        e.target.value,
                                    }))
                                  }
                                  placeholder="Come ti sei sentita?"
                                  rows={2}
                                />
                              </label>
                              <button
                                className={styles.textButton}
                                onClick={() =>
                                  setNotice("Nota personale salvata.")
                                }
                              >
                                Salva nota
                              </button>
                            </div>
                          </div>
                        </>
                      )}
                    </>
                  )}
                {screen === "piano" && training && (
                  <div className={styles.workout}>
                    <button
                      className={styles.backButton}
                      onClick={() => {
                        setTraining(false);
                        setRest(0);
                      }}
                    >
                      {" "}
                      <ArrowLeft size={16} />
                      Il mio piano
                    </button>
                    {step >= session.exercises.length ? (
                      <div className={styles.workoutDone}>
                        <span>
                          <Check size={36} />
                        </span>
                        <p className={styles.kicker}>UN ALTRO PASSO, FATTO.</p>
                        <h2>
                          Allenamento
                          <br />
                          completato.
                        </h2>
                        <p>
                          {session.name}
                          <br />
                          La sessione è segnata nel tuo percorso.
                        </p>
                        <button
                          className={styles.primaryButton}
                          onClick={() => {
                            setTraining(false);
                            setRest(0);
                          }}
                        >
                          Torna al piano <ArrowRight size={17} />
                        </button>
                      </div>
                    ) : (
                      <>
                        <div className={styles.workoutProgress}>
                          {session.exercises.map((_, i) => (
                            <i
                              key={i}
                              className={i <= step ? styles.activeProgress : ""}
                            />
                          ))}
                        </div>
                        <p className={styles.kicker}>
                          ESERCIZIO {step + 1} DI {session.exercises.length}
                        </p>
                        <h2>{session.exercises[step]!.name}</h2>
                        <div className={styles.workoutVisual}>
                          <Image
                            src={
                              session.kind === "run"
                                ? "/illustrations/run.svg"
                                : "/illustrations/strength.svg"
                            }
                            alt=""
                            width={160}
                            height={160}
                          />
                        </div>
                        <div className={styles.prescription}>
                          <strong>{session.exercises[step]!.dose}</strong>
                          <p>{session.exercises[step]!.note}</p>
                        </div>
                        <div className={styles.restTimer}>
                          <div>
                            <span>
                              Recupero prescritto ·{" "}
                              {session.exercises[step]!.rest}″
                            </span>
                            <strong role="timer" aria-label="Recupero">
                              {Math.floor(rest / 60)}:
                              {String(rest % 60).padStart(2, "0")}
                            </strong>
                          </div>
                          <button
                            className={styles.secondaryButton}
                            onClick={() =>
                              setRest(session.exercises[step]!.rest)
                            }
                          >
                            <Timer size={16} />
                            {rest ? "Ricomincia" : "Avvia recupero"}
                          </button>
                        </div>
                        <button
                          className={styles.primaryButton}
                          onClick={() => {
                            const next = nextWorkoutStep(
                              step,
                              session.exercises.length,
                            );
                            setStep(next);
                            setRest(0);
                            if (next === session.exercises.length)
                              setCompleted((value) =>
                                Array.from(new Set([...value, sessionIndex])),
                              );
                            scroller.current?.scrollTo({ top: 0 });
                          }}
                        >
                          <Check size={18} />
                          {step === session.exercises.length - 1
                            ? "Completa allenamento"
                            : "Esercizio completato"}
                        </button>
                      </>
                    )}
                  </div>
                )}
                {screen === "calendario" &&
                  services.lessons &&
                  !originalExperience && (
                    <VariantCalendar
                      onStageChange={() =>
                        scroller.current?.scrollTo({ top: 0 })
                      }
                      concept={p.id}
                      day={day}
                      onDay={setDay}
                      booked={booked}
                      onBook={(day, slot) => setBooking({ day, slot })}
                    />
                  )}
                {screen === "calendario" &&
                  services.lessons &&
                  originalExperience && (
                    <>
                      <div className={styles.pageTitle}>
                        <p className={styles.kicker}>CI ALLENIAMO INSIEME</p>
                        <h2>
                          {p.id === "team"
                            ? "CI VEDIAMO QUI."
                            : p.id === "essenziale"
                              ? "Scegli un orario."
                              : "Il tuo calendario"}
                        </h2>
                        <p>Sede Italfit · Orari di Roma</p>
                      </div>
                      <div className={styles.calendarFilters}>
                        <button
                          aria-pressed={!onlyMine}
                          onClick={() => setOnlyMine(false)}
                        >
                          Tutti gli orari
                        </button>
                        <button
                          aria-pressed={onlyMine}
                          onClick={() => setOnlyMine(true)}
                        >
                          Le mie prenotazioni <span>{allBookings.length}</span>
                        </button>
                      </div>
                      <div className={styles.calendarLayout}>
                        <div className={styles.calendarPicker}>
                          {p.id === "studio" && (
                            <div className={styles.monthGrid}>
                              <div>
                                <strong>Novembre 2026</strong>
                                <CalendarDays size={17} />
                              </div>
                              <div className={styles.monthCells}>
                                {["L", "M", "M", "G", "V", "S", "D"].map(
                                  (d, i) => (
                                    <span key={`${d}${i}`}>{d}</span>
                                  ),
                                )}
                                <span />
                                <span />
                                <span />
                                <span />
                                <span />
                                <span />
                                <span>1</span>
                                {Array.from({ length: 28 }, (_, i) => (
                                  <button
                                    key={i}
                                    className={
                                      day === i ? styles.monthSelected : ""
                                    }
                                    aria-label={`Seleziona ${i + 2} novembre`}
                                    aria-pressed={day === i}
                                    onClick={() => {
                                      setDay(i);
                                      setCalendarWeek(Math.floor(i / 7));
                                    }}
                                  >
                                    {i + 2}
                                  </button>
                                ))}
                                <button
                                  disabled
                                  title="Fuori dall’intervallo dimostrativo"
                                >
                                  30
                                </button>
                              </div>
                            </div>
                          )}
                          <div className={styles.weekControl}>
                            <button
                              aria-label="Settimana calendario precedente"
                              disabled={calendarWeek === 0}
                              onClick={() => {
                                setCalendarWeek((w) => w - 1);
                                setDay((calendarWeek - 1) * 7 + 1);
                              }}
                            >
                              <ChevronLeft size={16} />
                            </button>
                            <span>
                              {prototypeDate(calendarWeek * 7).number} —{" "}
                              {prototypeDate(calendarWeek * 7 + 6).number}{" "}
                              novembre
                            </span>
                            <button
                              aria-label="Settimana calendario successiva"
                              disabled={calendarWeek === 3}
                              onClick={() => {
                                setCalendarWeek((w) => w + 1);
                                setDay((calendarWeek + 1) * 7 + 1);
                              }}
                            >
                              <ChevronRight size={16} />
                            </button>
                          </div>
                          {dayStrip()}
                          <label className={styles.coachFilter}>
                            Coach{" "}
                            <SelectControl
                              className={styles.appSelect}
                              value={coach}
                              onChange={(e) => setCoach(e.target.value)}
                            >
                              <option value="Tutti">Tutti i coach</option>
                              <option value="Giorgio">Giorgio</option>
                              <option value="Marta">Marta</option>
                            </SelectControl>
                          </label>
                          {p.id === "vicino" && coachNote()}
                        </div>
                        <div className={styles.calendarContent}>
                          <div className={styles.sectionTitle}>
                            <h3>{prototypeDate(day).label}</h3>
                            <small>60 minuti · In sede</small>
                          </div>
                          {slotList()}
                          <p className={styles.calendarFootnote}>
                            Il posto è riservato solo dopo la conferma. Puoi
                            annullare dalla tua prenotazione.
                          </p>
                        </div>
                      </div>
                    </>
                  )}
                {screen === "profilo" && (
                  <>
                    <div className={styles.pageTitle}>
                      <p className={styles.kicker}>IL TUO SPAZIO PERSONALE</p>
                      <h2>Ciao, Giulia.</h2>
                      <p>Giulia Bianchi · giulia.bianchi@example.com</p>
                    </div>
                    <div className={styles.profileSummary}>
                      <div className={styles.bigAvatar}>GB</div>
                      <div>
                        <h3>Il tuo percorso</h3>
                        <p>
                          {mode === "entrambi"
                            ? "Coaching online + Allenamento in sede"
                            : mode === "online"
                              ? "Coaching online"
                              : "Allenamento in sede"}
                        </p>
                      </div>
                    </div>
                    <div className={styles.profileRows}>
                      <div>
                        <span>Coach di riferimento</span>
                        <strong>Giorgio</strong>
                      </div>
                      <div>
                        <span>Programma attuale</span>
                        <strong>
                          {services.plans
                            ? "Forza & resistenza"
                            : "Lezioni in sede"}
                        </strong>
                      </div>
                      <div>
                        <span>Questa settimana</span>
                        <strong>
                          {services.plans
                            ? `${completed.length} allenamenti completati`
                            : `${allBookings.length} prenotazioni attive`}
                        </strong>
                      </div>
                      <div>
                        <span>Orari</span>
                        <strong>Europe/Rome</strong>
                      </div>
                    </div>
                    {services.lessons && (
                      <>
                        <h3 className={styles.sectionLabel}>
                          Le tue prenotazioni
                        </h3>
                        {allBookings.length ? (
                          allBookings.map((item) => (
                            <button
                              key={item.key}
                              className={styles.profileBooking}
                              onClick={() => {
                                go("calendario");
                                setDay(item.day);
                                setBooking({
                                  day: item.day,
                                  slot: item.slot.id,
                                });
                              }}
                            >
                              <CalendarDays size={20} />
                              <span>
                                <strong>{prototypeDate(item.day).label}</strong>
                                <small>
                                  {item.slot.time} · {item.slot.coach}
                                </small>
                              </span>
                              <ChevronRight size={17} />
                            </button>
                          ))
                        ) : (
                          <p className={styles.quietNote}>
                            Non hai prenotazioni.
                          </p>
                        )}
                      </>
                    )}
                    <button
                      className={styles.secondaryButton}
                      onClick={() => go("accesso")}
                    >
                      Esci dalla demo <ArrowRight size={16} />
                    </button>
                  </>
                )}
              </div>
            </div>
            {!training && (
              <nav
                className={styles.bottomNav}
                aria-label="Navigazione mobile studente"
              >
                {navScreens.map((next) => {
                  const Icon = navIcons[next];
                  return (
                    <button
                      key={next}
                      aria-current={screen === next ? "page" : undefined}
                      onClick={() => go(next)}
                    >
                      <Icon size={21} />
                      <span>
                        {next === "calendario"
                          ? "Prenota"
                          : next === "piano"
                            ? "Piano"
                            : screenNames[next]}
                      </span>
                    </button>
                  );
                })}
              </nav>
            )}
          </div>
        </div>
      )}
      {screen === "accesso" && (
        <div className={styles.entry}>
          <div className={styles.entryBrand}>
            TEAM
            <br />
            ITALFIT<span>●</span>
          </div>
          <p className={styles.kicker}>IL TUO PERCORSO COMINCIA QUI</p>
          <h2>
            Bentornata
            <br />
            nel team.
          </h2>
          <p>
            Il tuo programma e i tuoi appuntamenti,
            <br />
            nello stesso spazio.
          </p>
          <label>
            Email
            <input readOnly value="giulia.bianchi@example.com" />
          </label>
          <label>
            Password
            <input type="password" readOnly value="esempio-prototipo" />
          </label>
          <button className={styles.primaryButton} onClick={() => go("home")}>
            Accedi alla demo <ArrowRight size={17} />
          </button>
          <small>Accesso dimostrativo · nessuna credenziale richiesta</small>
        </div>
      )}
      <Dialog.Root
        open={booking !== null}
        onOpenChange={(open) => {
          if (!open) setBooking(null);
        }}
      >
        <Dialog.Overlay className={styles.bookingOverlay} />
        <Dialog.Content className={styles.bookingSheet}>
          <div className={styles.sheetHandle} />
          <Dialog.Close
            className={styles.sheetClose}
            aria-label="Chiudi dettaglio prenotazione"
          >
            <X size={20} />
          </Dialog.Close>
          <p className={styles.kicker}>
            {isBooked ? "LA TUA PRENOTAZIONE" : "UN POSTO PER TE"}
          </p>
          <Dialog.Title>
            {isBooked ? "Gestisci la lezione" : "Confermi questo orario?"}
          </Dialog.Title>
          <Dialog.Description>
            Controlla i dettagli prima di {isBooked ? "annullare" : "prenotare"}
            .
          </Dialog.Description>
          {activeSlot && booking && (
            <>
              <dl className={styles.bookingDetails}>
                <div>
                  <dt>Quando</dt>
                  <dd>
                    {prototypeDate(booking.day).label}
                    <strong>
                      {activeSlot.time} · {activeSlot.duration}
                    </strong>
                  </dd>
                </div>
                <div>
                  <dt>Con chi</dt>
                  <dd>{activeSlot.coach}</dd>
                </div>
                <div>
                  <dt>Dove</dt>
                  <dd>Sede Italfit</dd>
                </div>
                <div>
                  <dt>Posti</dt>
                  <dd>
                    {isBooked
                      ? "Il tuo posto è confermato"
                      : `${activeSlot.available} ${activeSlot.available === 1 ? "posto disponibile" : "posti disponibili"}`}
                  </dd>
                </div>
              </dl>
              <button
                className={
                  isBooked ? styles.cancelButton : styles.primaryButton
                }
                onClick={() => {
                  setBooked((value) => ({ ...value, [bookingKey]: !isBooked }));
                  setNotice(
                    isBooked
                      ? "Prenotazione annullata. Il posto è di nuovo disponibile."
                      : "Prenotazione confermata. Ti aspettiamo in sede.",
                  );
                  setBooking(null);
                }}
              >
                {isBooked ? "Annulla prenotazione" : "Conferma prenotazione"}
                {isBooked ? <X size={17} /> : <Check size={17} />}
              </button>
              <Dialog.Close className={styles.textButton}>
                Torna agli orari
              </Dialog.Close>
            </>
          )}
        </Dialog.Content>
      </Dialog.Root>
    </div>
  );
}
function BookingShortcut({
  dayStrip,
  onClick,
}: {
  dayStrip: ReactNode;
  onClick: () => void;
}) {
  return (
    <div className={styles.bookingShortcut}>
      <p className={styles.kicker}>IL TUO PROSSIMO ALLENAMENTO</p>
      <h3>Trova il tuo orario.</h3>
      {dayStrip}
      <button className={styles.primaryButton} onClick={onClick}>
        Prenota in sede <ArrowRight size={16} />
      </button>
    </div>
  );
}
