export const siteConfig = {
  name: "Team Italfit",
  timezone: "Europe/Rome",
  website: "https://www.teamitalfit.com/",
} as const;

export const navigation = [
  { href: "/admin", label: "Home", icon: "overview" },
  { href: "/admin/studenti", label: "Studenti", icon: "students" },
  {
    href: "/admin/coaching-online",
    label: "Coaching online",
    icon: "coaching",
  },
  {
    href: "/admin/programmi-guidati",
    label: "Programmi guidati",
    icon: "plans",
    permission: "plans",
  },
  {
    href: "/admin/lezioni",
    label: "Calendario",
    icon: "calendar",
    permission: "lessons",
  },
  {
    href: "/admin/agenda",
    label: "Agenda",
    icon: "agenda",
    permission: "agenda",
  },
  {
    href: "/admin/pagamenti",
    label: "Pagamenti",
    icon: "payments",
    permission: "payments",
  },
  {
    href: "/admin/contabilita",
    label: "Contabilità",
    icon: "accounting",
  },
] as const;
