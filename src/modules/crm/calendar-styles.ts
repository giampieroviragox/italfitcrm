import "./calendar.css";

// Scoped names keep calendar styling independent from other CRM surfaces.
const styles = {
  surface: "crm-cal-surface",
  toolbar: "crm-cal-toolbar",
  meta: "crm-cal-meta",
  scroll: "crm-cal-scroll",
  dayHeader: "crm-cal-day-header",
  day: "crm-cal-day",
  dayNumber: "crm-cal-day-number",
  today: "crm-cal-today",
  axis: "crm-cal-axis",
  hour: "crm-cal-hour",
  column: "crm-cal-column",
  cell: "crm-cal-cell",
  event: "crm-cal-event",
  eventTitle: "crm-cal-event-title",
  eventDetail: "crm-cal-event-detail",
  compactEvent: "crm-cal-compact-event",
  now: "crm-cal-now",
  footer: "crm-cal-footer",
  lessonLink: "crm-cal-lesson-link",
} as const;
export default styles;
