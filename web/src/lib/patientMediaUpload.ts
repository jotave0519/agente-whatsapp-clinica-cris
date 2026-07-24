import { supabase } from "./supabaseClient";

/**
 * Sobe um arquivo direto pro Supabase Storage usando a sessao ja autenticada
 * do staff (mesmo token usado nas chamadas /api/v1) - o backend so guarda a
 * metadata depois, nunca recebe os bytes do arquivo.
 */
async function uploadFile(bucket: "patient-media" | "patient-documents", patientId: string, file: File): Promise<string> {
  const ext = file.name.includes(".") ? file.name.slice(file.name.lastIndexOf(".")) : "";
  const path = `${patientId}/${Date.now()}-${Math.random().toString(36).slice(2, 8)}${ext}`;

  const { error } = await supabase.storage.from(bucket).upload(path, file, { upsert: false });
  if (error) throw new Error(error.message);

  return path;
}

export function uploadPatientMedia(patientId: string, file: File): Promise<string> {
  return uploadFile("patient-media", patientId, file);
}

export function uploadPatientDocument(patientId: string, file: File): Promise<string> {
  return uploadFile("patient-documents", patientId, file);
}

export async function getSignedMediaUrl(path: string): Promise<string> {
  const { data, error } = await supabase.storage.from("patient-media").createSignedUrl(path, 3600);
  if (error) throw new Error(error.message);
  return data.signedUrl;
}

export async function getSignedDocumentUrl(path: string): Promise<string> {
  const { data, error } = await supabase.storage.from("patient-documents").createSignedUrl(path, 3600);
  if (error) throw new Error(error.message);
  return data.signedUrl;
}
