import "server-only";
import { createAdminClient } from "@/lib/supabase/admin";
import { maxReceiptBytes, receiptFileTypes } from "../lesson-wallet";
import { HttpError } from "./errors";

/** Private bucket: files are only served through /api/ricevute after an access check. */
const bucket = "ricevute";
type ReceiptType = keyof typeof receiptFileTypes;

async function ensureBucket() {
  const storage = createAdminClient().storage;
  const { error } = await storage.getBucket(bucket);
  if (!error) return;
  const created = await storage.createBucket(bucket, {
    public: false,
    fileSizeLimit: maxReceiptBytes,
    allowedMimeTypes: Object.keys(receiptFileTypes),
  });
  if (created.error && !/exist/i.test(created.error.message))
    throw new HttpError(503, "Archivio ricevute non disponibile. Riprova.");
}

/** Checks the declared type against the file signature. */
export async function receiptType(file: File): Promise<ReceiptType> {
  if (!(file.type in receiptFileTypes))
    throw new HttpError(
      400,
      "Carica un’immagine (JPG, PNG, WEBP, HEIC) o un PDF.",
    );
  if (file.size < 1 || file.size > maxReceiptBytes)
    throw new HttpError(400, "Il file deve pesare al massimo 4 MB.");
  const head = new Uint8Array(await file.slice(0, 12).arrayBuffer());
  const ascii = (from: number, to: number) =>
    String.fromCharCode(...head.slice(from, to));
  const type = file.type as ReceiptType;
  const valid =
    type === "application/pdf"
      ? ascii(0, 4) === "%PDF"
      : type === "image/jpeg"
        ? head[0] === 0xff && head[1] === 0xd8
        : type === "image/png"
          ? head[0] === 0x89 && ascii(1, 4) === "PNG"
          : type === "image/webp"
            ? ascii(0, 4) === "RIFF" && ascii(8, 12) === "WEBP"
            : ascii(4, 8) === "ftyp";
  if (!valid)
    throw new HttpError(400, "Il file non corrisponde al formato dichiarato.");
  return type;
}

export async function uploadReceipt(path: string, file: File, type: string) {
  await ensureBucket();
  const { error } = await createAdminClient()
    .storage.from(bucket)
    .upload(path, file, { contentType: type, upsert: false });
  if (error)
    throw new HttpError(
      503,
      "Caricamento della ricevuta non riuscito. Riprova.",
    );
}

export async function removeReceipt(path: string) {
  await createAdminClient().storage.from(bucket).remove([path]);
}

export async function downloadReceipt(path: string) {
  const { data, error } = await createAdminClient()
    .storage.from(bucket)
    .download(path);
  if (error || !data) throw new HttpError(404, "Ricevuta non disponibile.");
  return data;
}
