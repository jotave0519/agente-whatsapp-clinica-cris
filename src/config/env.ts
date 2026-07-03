import dotenv from "dotenv";

dotenv.config();

function required(name: string): string {
  const value = process.env[name];
  if (!value) {
    throw new Error(`Variavel de ambiente obrigatoria ausente: ${name}`);
  }
  return value;
}

export const env = {
  port: Number(process.env.PORT || 5000),

  anthropicApiKey: process.env.ANTHROPIC_API_KEY || "",
  anthropicModel: process.env.ANTHROPIC_MODEL || "claude-sonnet-5",

  evolutionApiUrl: process.env.EVOLUTION_API_URL || "",
  evolutionApiKey: process.env.EVOLUTION_API_KEY || "",
  evolutionInstanceName: process.env.EVOLUTION_INSTANCE_NAME || "",

  supabaseUrl: process.env.SUPABASE_URL || "",
  supabaseServiceKey: process.env.SUPABASE_SERVICE_KEY || "",
  // Chave publica, usada so para verificar o JWT de sessoes do CRM web (src/middleware/requireAuth.ts).
  supabaseAnonKey: process.env.SUPABASE_ANON_KEY || "",

  googleCalendarId: process.env.GOOGLE_CALENDAR_ID || "primary",
  googleCredentialsPath: process.env.GOOGLE_CREDENTIALS_PATH || "credentials.json",
  googleTokenPath: process.env.GOOGLE_TOKEN_PATH || "token.json",
  // Alternativa para deploys sem acesso ao filesystem local (ex: EasyPanel):
  // conteudo integral dos arquivos credentials.json/token.json como JSON cru na env var.
  googleCredentialsJson: process.env.GOOGLE_CREDENTIALS_JSON || "",
  googleTokenJson: process.env.GOOGLE_TOKEN_JSON || "",
};

export { required };
