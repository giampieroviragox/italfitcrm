const reserved = [
  "name",
  "nome",
  "cognome",
  "email",
  "phone",
  "telefono",
  "tier",
  "status",
  "stato",
  "coach",
  "joinedAt",
  "aggiunto-il",
  "id",
];

export function propertyKey(
  name: string,
  properties: readonly { id: string }[],
): string {
  const base =
    name
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-|-$/g, "")
      .slice(0, 64)
      .replace(/-$/, "") || "campo";
  const used = new Set([...reserved, ...properties.map((p) => p.id)]);
  let key = base;
  for (let suffix = 2; used.has(key); suffix++) key = `${base}-${suffix}`;
  return key;
}
