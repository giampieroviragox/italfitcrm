"use client";

import { useState } from "react";
import {
  ArrowLeft,
  ArrowRight,
  CalendarDays,
  Check,
  ChevronRight,
  Play,
  Plus,
  Minus,
} from "lucide-react";
import {
  prototypeDate,
  sessions,
  slots,
  type ProposalId,
} from "./proposal-data";
import styles from "./experience-variants.module.css";

type PlanProps = {
  concept: ProposalId;
  selected: number;
  onSelect: (index: number) => void;
  onStart: (index: number) => void;
  completed: number[];
  note: string;
  onNote: (value: string) => void;
  onSave: () => void;
};

export function VariantPlan(props: PlanProps) {
  const {
    concept,
    selected,
    onSelect,
    onStart,
    completed,
    note,
    onNote,
    onSave,
  } = props;
  const [expanded, setExpanded] = useState<number | null>(selected);
  const session = sessions[selected]!;
  const prescription = (index: number) => (
    <ol className={styles.prescriptions}>
      {sessions[index]!.exercises.map((exercise, i) => (
        <li key={exercise.name}>
          <span>{String(i + 1).padStart(2, "0")}</span>
          <div>
            <strong>{exercise.name}</strong>
            <small>{exercise.note}</small>
          </div>
          <b>{exercise.dose}</b>
          <em>{exercise.rest}″ recupero</em>
        </li>
      ))}
    </ol>
  );
  const startButton = (index: number) => (
    <button className={styles.action} onClick={() => onStart(index)}>
      <Play size={16} />
      {completed.includes(index) ? "Ripeti la sessione" : "Inizia allenamento"}
      <ArrowRight size={16} />
    </button>
  );
  const notes = (
    <label className={styles.note}>
      Il tuo diario
      <textarea
        value={note}
        onChange={(e) => onNote(e.target.value)}
        placeholder="Una sensazione da ricordare…"
        rows={3}
      />
      <button onClick={onSave}>
        Salva la nota <Check size={14} />
      </button>
    </label>
  );

  if (concept === "ritmo")
    return (
      <section className={styles.planner}>
        <header className={styles.heading}>
          <span>IL TUO PROGRAMMA / NOVEMBRE</span>
          <h2>
            Una settimana.
            <br />
            Tre passi avanti.
          </h2>
          <p>2 — 8 novembre · Forza & resistenza</p>
        </header>
        <div className={styles.weekBoard}>
          {sessions.map((s, i) => (
            <button
              key={s.id}
              aria-pressed={selected === i}
              onClick={() => onSelect(i)}
            >
              <span>
                {s.day}
                <b>{2 + i * 2}</b>
              </span>
              <div>
                <small>
                  {completed.includes(i) ? "COMPLETATO" : "IN PROGRAMMA"}
                </small>
                <h3>{s.name}</h3>
                <p>{s.duration}</p>
                <em>{s.focus}</em>
              </div>
              <ChevronRight size={17} />
            </button>
          ))}
        </div>
        <div className={styles.plannerDetail}>
          <div>
            <span className={styles.eyebrow}>
              SELEZIONATO · {session.day.toUpperCase()}
            </span>
            <h3>{session.name}</h3>
            <p>Controlla la sessione prima di partire.</p>
            {startButton(selected)}
          </div>
          <div>{prescription(selected)}</div>
        </div>
      </section>
    );

  if (concept === "vicino")
    return (
      <section className={styles.journal}>
        <header className={styles.journalHeading}>
          <span>IL DIARIO DI GIULIA / NOVEMBRE 2026</span>
          <h2>
            Prima di cominciare,
            <br />
            ascolta come stai.
          </h2>
          <p>
            «Non serve fare tutto subito. Questa settimana concentriamoci sul
            gesto: il carico viene dopo.»
          </p>
          <div>
            <span className={styles.initial}>G</span>
            <span>
              Giorgio<small>Il tuo coach</small>
            </span>
          </div>
        </header>
        <div className={styles.chapters}>
          {sessions.map((s, i) => (
            <article key={s.id}>
              <button
                aria-expanded={expanded === i}
                onClick={() => {
                  onSelect(i);
                  setExpanded(expanded === i ? null : i);
                }}
              >
                <span>
                  CAPITOLO {i + 1}
                  <small>
                    {s.day} · {s.duration}
                  </small>
                </span>
                <h3>{s.name}</h3>
                <span>
                  {completed.includes(i) ? (
                    <Check size={18} />
                  ) : expanded === i ? (
                    <Minus size={18} />
                  ) : (
                    <Plus size={18} />
                  )}
                </span>
              </button>
              {expanded === i && (
                <div className={styles.chapterBody}>
                  <p>
                    {s.exercises[0]!.note} Trova il tuo ritmo, senza fretta.
                  </p>
                  {prescription(i)}
                  {startButton(i)}
                  {notes}
                </div>
              )}
            </article>
          ))}
        </div>
      </section>
    );

  if (concept === "studio")
    return (
      <section className={styles.library}>
        <header className={styles.heading}>
          <span>ANCHE FUORI DALLA SEDE</span>
          <h2>Il lavoro continua.</h2>
          <p>
            Le tue sessioni individuali, accanto agli allenamenti con il team.
          </p>
        </header>
        <div className={styles.libraryGrid}>
          {sessions.map((s, i) => (
            <article key={s.id}>
              <div className={styles.libraryCover}>
                <span>{String(i + 1).padStart(2, "0")}</span>
                <b>{s.kind === "run" ? "CORSA" : "FORZA"}</b>
                <small>{s.duration}</small>
              </div>
              <div>
                <p>
                  {s.day} · {s.focus}
                </p>
                <h3>{s.name}</h3>
                <button
                  className={styles.textAction}
                  aria-expanded={expanded === i}
                  onClick={() => {
                    onSelect(i);
                    setExpanded(expanded === i ? null : i);
                  }}
                >
                  {expanded === i ? "Chiudi dettagli" : "Esplora la sessione"}
                  <ChevronRight size={16} />
                </button>
                {expanded === i && prescription(i)}
                {startButton(i)}
              </div>
            </article>
          ))}
        </div>
      </section>
    );

  if (concept === "essenziale")
    return (
      <section className={styles.simplePlan}>
        <span className={styles.eyebrow}>IL MIO PIANO · NOVEMBRE</span>
        <h2>
          Che allenamento
          <br />
          facciamo oggi?
        </h2>
        <p>Scegli una sessione. Ti accompagniamo esercizio per esercizio.</p>
        <div className={styles.simpleChoices}>
          {sessions.map((s, i) => (
            <button
              key={s.id}
              aria-expanded={expanded === i}
              onClick={() => {
                onSelect(i);
                setExpanded(expanded === i ? null : i);
              }}
            >
              <span>{completed.includes(i) ? <Check size={22} /> : i + 1}</span>
              <div>
                <h3>{s.name}</h3>
                <p>
                  {s.duration} · {s.exercises.length} esercizi
                </p>
              </div>
              <ChevronRight size={19} />
            </button>
          ))}
        </div>
        {expanded !== null && (
          <div className={styles.simpleSummary}>
            <h3>{session.name}</h3>
            <p>Oggi lavoriamo su {session.focus.toLowerCase()}.</p>
            <div>
              {session.exercises.map((e) => (
                <span key={e.name}>
                  {e.name}
                  <small>{e.dose}</small>
                </span>
              ))}
            </div>
            {startButton(selected)}
          </div>
        )}
      </section>
    );

  return (
    <section className={styles.trainingConsole}>
      <header>
        <span>TEAM ITALFIT / IL TUO PROGRAMMA</span>
        <h2>
          IL TUO
          <br />
          CAMPO DI GIOCO.
        </h2>
        <p>NOVEMBRE ’26 · FORZA & RESISTENZA</p>
      </header>
      <div className={styles.consoleTabs}>
        {sessions.map((s, i) => (
          <button
            key={s.id}
            aria-pressed={selected === i}
            onClick={() => onSelect(i)}
          >
            <span>0{i + 1}</span>
            <b>{s.kind === "run" ? "CORSA" : "FORZA"}</b>
            <small>{s.day}</small>
            {completed.includes(i) && <Check size={15} />}
          </button>
        ))}
      </div>
      <div className={styles.consoleSession}>
        <div>
          <span>SESSIONE 0{selected + 1}</span>
          <h3>{session.name}</h3>
          <div className={styles.consoleNumbers}>
            <span>
              <b>{session.duration.split(" ")[0]}</b>MINUTI
            </span>
            <span>
              <b>03</b>ESERCIZI
            </span>
          </div>
          {startButton(selected)}
        </div>
        <div>
          {prescription(selected)}
          <p className={styles.consoleCoach}>
            GIORGIO / Prima la tecnica. Poi il resto.
          </p>
        </div>
      </div>
    </section>
  );
}

type CalendarProps = {
  concept: ProposalId;
  day: number;
  onDay: (day: number) => void;
  booked: Record<string, boolean>;
  onBook: (day: number, slot: string) => void;
  onStageChange: () => void;
};

export function VariantCalendar({
  concept,
  day,
  onDay,
  booked,
  onBook,
  onStageChange,
}: CalendarProps) {
  const [phase, setPhase] = useState(0);
  const move = (next: number) => {
    setPhase(next);
    if (concept === "vicino" || concept === "essenziale") onStageChange();
  };
  const [coach, setCoach] = useState<string | null>(null);
  const [mine, setMine] = useState(false);
  const [week, setWeek] = useState(0);
  const days = Array.from({ length: 7 }, (_, i) => week * 7 + i);
  const myBookings = Object.entries(booked)
    .filter(([, value]) => value)
    .sort(
      ([a], [b]) =>
        Number(a.split(":")[0]) - Number(b.split(":")[0]) || a.localeCompare(b),
    );
  const pick = (offset: number) => {
    onDay(offset);
    move(2);
  };
  const dayButtons = (
    <div className={styles.dates}>
      {days.map((offset) => (
        <button
          key={offset}
          aria-pressed={day === offset}
          onClick={() => onDay(offset)}
          aria-label={prototypeDate(offset).label}
        >
          <small>{prototypeDate(offset).label.slice(0, 3)}</small>
          <b>{prototypeDate(offset).number}</b>
        </button>
      ))}
    </div>
  );
  const weekPicker = (
    <div className={styles.weekSwitch}>
      <button
        disabled={week === 0}
        onClick={() => {
          setWeek((w) => w - 1);
          onDay((week - 1) * 7);
        }}
        aria-label="Settimana precedente"
      >
        <ArrowLeft size={16} />
      </button>
      <span>
        {prototypeDate(week * 7).number} — {prototypeDate(week * 7 + 6).number}{" "}
        novembre
      </span>
      <button
        disabled={week === 3}
        onClick={() => {
          setWeek((w) => w + 1);
          onDay((week + 1) * 7);
        }}
        aria-label="Settimana successiva"
      >
        <ArrowRight size={16} />
      </button>
    </div>
  );
  const timeButtons = (offset = day, filterCoach = coach) => (
    <div className={styles.times}>
      {slots
        .filter((s) => !filterCoach || s.coach === filterCoach)
        .map((slot) => {
          const isMine = Boolean(booked[`${offset}:${slot.id}`]);
          return (
            <button
              key={slot.id}
              disabled={!slot.available && !isMine}
              onClick={() => onBook(offset, slot.id)}
              className={isMine ? styles.reserved : ""}
            >
              <strong>{slot.time}</strong>
              <span>
                <b>{slot.coach}</b>
                <small>60 minuti · In sede</small>
              </span>
              <em>
                {isMine
                  ? "Prenotata"
                  : slot.available
                    ? `${slot.available} ${slot.available === 1 ? "posto" : "posti"}`
                    : "Completa"}
              </em>
              {isMine ? <Check size={16} /> : <Plus size={16} />}
            </button>
          );
        })}
    </div>
  );
  const reservations = (
    <div className={styles.reservations}>
      {myBookings.length ? (
        myBookings.map(([key]) => {
          const [offset, id] = key.split(":");
          const slot = slots.find((s) => s.id === id)!;
          return (
            <button key={key} onClick={() => onBook(Number(offset), id!)}>
              <CalendarDays size={20} />
              <span>
                <b>{prototypeDate(Number(offset)).label}</b>
                <small>
                  {slot.time} · {slot.coach}
                </small>
              </span>
              <ChevronRight size={16} />
            </button>
          );
        })
      ) : (
        <div className={styles.empty}>
          <CalendarDays size={28} />
          <h3>Ancora nessun appuntamento.</h3>
          <p>Scegli quando allenarti e riserva il tuo posto.</p>
          <button className={styles.action} onClick={() => setMine(false)}>
            Trova un orario <ArrowRight size={16} />
          </button>
        </div>
      )}
    </div>
  );
  const bookingToggle = (
    <button className={styles.textAction} onClick={() => setMine((v) => !v)}>
      {mine ? "Torna agli orari" : `I miei appuntamenti (${myBookings.length})`}
      <ArrowRight size={16} />
    </button>
  );

  if (concept === "ritmo")
    return (
      <section className={styles.weekCalendar}>
        <header className={styles.heading}>
          <span>LA TUA AGENDA / IN SEDE</span>
          <h2>
            Trova un buco.
            <br />
            Fallo tuo.
          </h2>
          {bookingToggle}
        </header>
        {mine ? (
          reservations
        ) : (
          <>
            {weekPicker}
            <p className={styles.scrollHint}>
              Scorri la settimana e tocca direttamente un orario.
            </p>
            <div className={styles.weekColumns}>
              {days.map((offset) => (
                <div key={offset}>
                  <header>
                    <small>{prototypeDate(offset).label.split(" ")[0]}</small>
                    <strong>{prototypeDate(offset).number}</strong>
                  </header>
                  {slots.map((slot) => {
                    const isMine = booked[`${offset}:${slot.id}`];
                    return (
                      <button
                        key={slot.id}
                        aria-label={`${prototypeDate(offset).label}, ${slot.time}, ${slot.coach}${isMine ? ", prenotata" : ""}`}
                        disabled={!slot.available && !isMine}
                        className={isMine ? styles.reserved : ""}
                        onClick={() => onBook(offset, slot.id)}
                      >
                        <b>{slot.time}</b>
                        <span>{slot.coach}</span>
                        <small>
                          {isMine
                            ? "Prenotata"
                            : slot.available
                              ? `${slot.available} posti`
                              : "Completa"}
                        </small>
                      </button>
                    );
                  })}
                </div>
              ))}
            </div>
          </>
        )}
      </section>
    );

  if (concept === "vicino")
    return (
      <section className={styles.coachBooking}>
        <header className={styles.journalHeading}>
          <span>UN MOMENTO INSIEME</span>
          <h2 aria-live="polite">
            {mine
              ? "I nostri appuntamenti."
              : phase === 0
                ? "Con chi ci alleniamo?"
                : phase === 1
                  ? "Troviamo il giorno giusto."
                  : "Ci prendiamo un’ora."}
          </h2>
          <p>
            {mine
              ? "Le tue lezioni in sede, in un unico posto."
              : phase === 0
                ? "Scegli il coach, poi il giorno. Il posto lo confermi alla fine."
                : `${coach} ti aspetta in sede. Scegli con calma.`}
          </p>
          {bookingToggle}
        </header>
        {mine ? (
          reservations
        ) : (
          <>
            <div className={styles.breadcrumb}>
              <button
                onClick={() => move(0)}
                aria-current={phase === 0 ? "step" : undefined}
              >
                01 · Coach
              </button>
              <span>—</span>
              <button
                disabled={!coach}
                onClick={() => move(1)}
                aria-current={phase === 1 ? "step" : undefined}
              >
                02 · Giorno
              </button>
              <span>—</span>
              <button
                disabled={phase < 2}
                onClick={() => move(2)}
                aria-current={phase === 2 ? "step" : undefined}
              >
                03 · Orario
              </button>
            </div>
            {phase === 0 ? (
              <div className={styles.coachChoices}>
                {["Giorgio", "Marta"].map((name) => (
                  <button
                    key={name}
                    onClick={() => {
                      setCoach(name);
                      move(1);
                    }}
                  >
                    <span>{name[0]}</span>
                    <h3>{name}</h3>
                    <p>
                      {name === "Giorgio"
                        ? "Il tuo coach di riferimento"
                        : "Coach Team Italfit"}
                    </p>
                    <b>
                      Scegli {name}
                      <ArrowRight size={16} />
                    </b>
                  </button>
                ))}
              </div>
            ) : phase === 1 ? (
              <>
                {weekPicker}
                <div className={styles.journalDates}>
                  {days.map((offset) => (
                    <button
                      key={offset}
                      aria-label={prototypeDate(offset).label}
                      onClick={() => pick(offset)}
                    >
                      <CalendarDays size={20} />
                      <span>{prototypeDate(offset).label}</span>
                      <ArrowRight size={17} />
                    </button>
                  ))}
                </div>
              </>
            ) : (
              <>
                <button className={styles.textAction} onClick={() => move(1)}>
                  <ArrowLeft size={15} />
                  {prototypeDate(day).label}
                </button>
                {timeButtons()}
              </>
            )}
          </>
        )}
      </section>
    );

  if (concept === "studio")
    return (
      <section className={styles.studioCalendar}>
        <header className={styles.heading}>
          <span>ITALFIT STUDIO / IL TUO POSTO IN SEDE</span>
          <h2>
            Novembre <em>2026</em>
          </h2>
          {bookingToggle}
        </header>
        {mine ? (
          reservations
        ) : (
          <div className={styles.studioSchedule}>
            <div className={styles.monthWall}>
              <div className={styles.monthLabels}>
                {["LUN", "MAR", "MER", "GIO", "VEN", "SAB", "DOM"].map(
                  (label) => (
                    <span key={label}>{label}</span>
                  ),
                )}
              </div>
              <div className={styles.monthDays}>
                {Array.from({ length: 6 }, (_, i) => (
                  <span key={`empty${i}`} />
                ))}
                <span className={styles.pastDay}>1</span>
                {Array.from({ length: 28 }, (_, offset) => (
                  <button
                    key={offset}
                    aria-label={`Apri ${prototypeDate(offset).label}`}
                    aria-pressed={day === offset}
                    onClick={() => {
                      onDay(offset);
                      move(1);
                    }}
                  >
                    <b>{offset + 2}</b>
                    <small>
                      {Object.entries(booked).some(
                        ([key, v]) => v && key.startsWith(`${offset}:`),
                      )
                        ? "Prenotata"
                        : "4 lezioni"}
                    </small>
                    <i />
                  </button>
                ))}
                <span className={styles.pastDay}>30</span>
              </div>
              <p>Orari di Roma · Tocca un giorno per scegliere la lezione.</p>
            </div>
            <div className={styles.dayInspector}>
              <span>IL TUO GIORNO</span>
              <h3>{prototypeDate(day).label}</h3>
              <p>Allenamenti di 60 minuti · Sede Italfit</p>
              {timeButtons(day, null)}
            </div>
          </div>
        )}
      </section>
    );

  if (concept === "essenziale")
    return (
      <section className={styles.simpleBooking}>
        <span className={styles.eyebrow}>PRENOTA IN SEDE</span>
        <h2 aria-live="polite">
          {mine
            ? "I tuoi appuntamenti."
            : phase === 0
              ? "Quando vuoi venire?"
              : "A che ora?"}
        </h2>
        <p>
          {mine
            ? "Apri un appuntamento per controllarlo o annullarlo."
            : phase === 0
              ? "Prima il giorno, poi l’orario. Tutto qui."
              : prototypeDate(day).label}
        </p>
        {bookingToggle}
        {mine ? (
          reservations
        ) : phase === 0 ? (
          <>
            {weekPicker}
            <div className={styles.largeDates}>
              {days.map((offset) => (
                <button
                  key={offset}
                  aria-label={prototypeDate(offset).label}
                  onClick={() => pick(offset)}
                >
                  <strong>{prototypeDate(offset).number}</strong>
                  <span>
                    {prototypeDate(offset).label.split(" ")[0]}
                    <small>Novembre · 3 orari disponibili</small>
                  </span>
                  <ArrowRight size={20} />
                </button>
              ))}
            </div>
          </>
        ) : (
          <>
            <button className={styles.textAction} onClick={() => move(0)}>
              <ArrowLeft size={17} />
              Cambia giorno
            </button>
            {timeButtons(day, null)}
            <p className={styles.footnote}>
              Controlli e confermi prima di riservare il posto.
            </p>
          </>
        )}
      </section>
    );

  return (
    <section className={styles.sportsSchedule}>
      <header>
        <span>TEAM ITALFIT / ORARI IN SEDE</span>
        <h2>
          PRESENTE.
          <br />
          PIÙ FORTE.
        </h2>
        <p>UN POSTO IN SQUADRA. IL TUO.</p>
      </header>
      <div className={styles.scheduleToggle}>
        <button aria-pressed={!mine} onClick={() => setMine(false)}>
          GLI ORARI
        </button>
        <button aria-pressed={mine} onClick={() => setMine(true)}>
          I TUOI POSTI / {myBookings.length}
        </button>
      </div>
      {mine ? (
        reservations
      ) : (
        <>
          {weekPicker}
          {dayButtons}
          <div className={styles.scheduleDate}>
            <span>IN SEDE</span>
            <h3>{prototypeDate(day).label}</h3>
          </div>
          {timeButtons(day, null)}
        </>
      )}
    </section>
  );
}
