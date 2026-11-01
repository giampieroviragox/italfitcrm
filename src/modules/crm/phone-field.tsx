"use client";
import { useState } from "react";
import { SelectControl } from "@/components/ui/select-control";
import { Field, control } from "./ui";
const countries = [
  { code: "IT", flag: "🇮🇹", name: "Italia", dial: "+39" },
  { code: "SM", flag: "🇸🇲", name: "San Marino", dial: "+378" },
  { code: "CH", flag: "🇨🇭", name: "Svizzera", dial: "+41" },
  { code: "FR", flag: "🇫🇷", name: "Francia", dial: "+33" },
  { code: "DE", flag: "🇩🇪", name: "Germania", dial: "+49" },
  { code: "ES", flag: "🇪🇸", name: "Spagna", dial: "+34" },
  { code: "PT", flag: "🇵🇹", name: "Portogallo", dial: "+351" },
  { code: "GB", flag: "🇬🇧", name: "Regno Unito", dial: "+44" },
  { code: "IE", flag: "🇮🇪", name: "Irlanda", dial: "+353" },
  { code: "BE", flag: "🇧🇪", name: "Belgio", dial: "+32" },
  { code: "NL", flag: "🇳🇱", name: "Paesi Bassi", dial: "+31" },
  { code: "LU", flag: "🇱🇺", name: "Lussemburgo", dial: "+352" },
  { code: "AT", flag: "🇦🇹", name: "Austria", dial: "+43" },
  { code: "SI", flag: "🇸🇮", name: "Slovenia", dial: "+386" },
  { code: "HR", flag: "🇭🇷", name: "Croazia", dial: "+385" },
  { code: "AL", flag: "🇦🇱", name: "Albania", dial: "+355" },
  { code: "RO", flag: "🇷🇴", name: "Romania", dial: "+40" },
  { code: "PL", flag: "🇵🇱", name: "Polonia", dial: "+48" },
  { code: "GR", flag: "🇬🇷", name: "Grecia", dial: "+30" },
  { code: "SE", flag: "🇸🇪", name: "Svezia", dial: "+46" },
  { code: "NO", flag: "🇳🇴", name: "Norvegia", dial: "+47" },
  { code: "DK", flag: "🇩🇰", name: "Danimarca", dial: "+45" },
  { code: "US", flag: "🇺🇸", name: "Stati Uniti", dial: "+1" },
  { code: "CA", flag: "🇨🇦", name: "Canada", dial: "+1" },
  { code: "BR", flag: "🇧🇷", name: "Brasile", dial: "+55" },
  { code: "AR", flag: "🇦🇷", name: "Argentina", dial: "+54" },
  { code: "MA", flag: "🇲🇦", name: "Marocco", dial: "+212" },
  { code: "AE", flag: "🇦🇪", name: "Emirati Arabi", dial: "+971" },
  { code: "AU", flag: "🇦🇺", name: "Australia", dial: "+61" },
];
function parsePhone(value: string) {
  const phone = value.trim();
  const match = phone.startsWith("+")
    ? countries
        .filter((c) => phone.startsWith(c.dial))
        .sort((a, b) => b.dial.length - a.dial.length)[0]
    : undefined;
  return match
    ? { code: match.code, number: phone.slice(match.dial.length).trim() }
    : { code: "IT", number: phone };
}
export function PhoneField({
  value,
  onChange,
}: {
  value: string;
  onChange: (value: string) => void;
}) {
  const [code, setCode] = useState(() => parsePhone(value).code);
  const [number, setNumber] = useState(() => parsePhone(value).number);
  const update = (nextCode: string, nextNumber: string) => {
    setCode(nextCode);
    setNumber(nextNumber);
    const dial = countries.find((c) => c.code === nextCode)?.dial ?? "+39";
    onChange(nextNumber.trim() ? `${dial} ${nextNumber.trim()}` : "");
  };
  return (
    <div className="grid gap-4 sm:grid-cols-[180px_minmax(0,1fr)]">
      <Field label="Prefisso">
        <SelectControl
          className={control}
          value={code}
          onChange={(e) => update(e.target.value, number)}
        >
          {countries.map((c) => (
            <option key={c.code} value={c.code}>
              {`${c.flag} ${c.dial} ${c.name}`}
            </option>
          ))}
        </SelectControl>
      </Field>
      <Field label="Telefono">
        <input
          className={control}
          type="tel"
          autoComplete="tel-national"
          value={number}
          onChange={(e) => update(code, e.target.value)}
          placeholder="333 123 4567"
        />
      </Field>
    </div>
  );
}
