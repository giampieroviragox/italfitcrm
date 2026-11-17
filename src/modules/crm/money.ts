/** Euro amount from cents, Italian format with thousands grouping. */
export const euro = (cents: number) =>
  new Intl.NumberFormat("it-IT", {
    style: "currency",
    currency: "EUR",
    useGrouping: "always",
  }).format(cents / 100);
