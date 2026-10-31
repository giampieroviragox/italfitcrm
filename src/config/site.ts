export const siteConfig = {
  name: "Team Italfit",
  timezone: "Europe/Rome",
  website: "https://www.teamitalfit.com/",
} as const;

export const navigation = [
  { href: "/admin", label: "Home", icon: "overview" },
  { href: "/admin/studenti", label: "Studenti", icon: "students" },
  {
    href: "/admin/piani",
    label: "Piani e percorsi",
    icon: "plans",
  },
  {
    href: "/admin/lezioni",
    label: "Lezioni in sede",
    icon: "calendar",
  },
] as const;
