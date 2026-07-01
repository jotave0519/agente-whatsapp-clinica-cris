/**
 * Script de configuracao unica: autoriza o acesso ao Google Calendar via OAuth
 * e salva o token.json usado em tempo de execucao pelo googleCalendarClient.
 *
 * Uso:
 *   1. Colocar o credentials.json (OAuth "Desktop app") na raiz do projeto.
 *   2. Rodar: npm run google:auth
 *   3. Abrir a URL impressa no terminal, autorizar, e aguardar a confirmacao.
 */
import fs from "fs";
import http from "http";
import { URL } from "url";
import axios from "axios";
import { env } from "../src/config/env";

// Nao usamos a lib "googleapis" aqui porque o gaxios/node-fetch interno dela
// apresenta "Premature close" ao ler respostas gzip neste ambiente Windows.
// Tanto a URL de autorizacao quanto a troca de token sao feitas manualmente.

const SCOPES = ["https://www.googleapis.com/auth/calendar"];
const PORT = 4321;
const REDIRECT_URI = `http://localhost:${PORT}/oauth2callback`;
const AUTH_URL = "https://accounts.google.com/o/oauth2/v2/auth";

async function main() {
  if (!fs.existsSync(env.googleCredentialsPath)) {
    console.error(`Arquivo nao encontrado: ${env.googleCredentialsPath}`);
    process.exit(1);
  }

  const credentials = JSON.parse(fs.readFileSync(env.googleCredentialsPath, "utf-8"));
  const { client_id, client_secret } = credentials.installed || credentials.web;

  const authUrl = `${AUTH_URL}?${new URLSearchParams({
    client_id,
    redirect_uri: REDIRECT_URI,
    response_type: "code",
    scope: SCOPES.join(" "),
    access_type: "offline",
    prompt: "consent",
  }).toString()}`;
  console.log("\nAbra esta URL no navegador para autorizar o acesso a agenda:\n");
  console.log(authUrl, "\n");

  const code = await new Promise<string>((resolve, reject) => {
    const server = http.createServer((req, res) => {
      const url = new URL(req.url || "", REDIRECT_URI);
      const authCode = url.searchParams.get("code");
      if (authCode) {
        res.end("Autorizacao concluida! Pode fechar esta aba e voltar ao terminal.");
        server.close();
        resolve(authCode);
      } else {
        res.end("Codigo de autorizacao nao encontrado.");
        server.close();
        reject(new Error("Codigo de autorizacao nao encontrado na resposta do Google."));
      }
    });
    server.listen(PORT);
  });

  // Troca do code pelo token feita via axios (em vez da lib do Google) porque o
  // gaxios/node-fetch interno apresentou "Premature close" ao ler a resposta
  // gzip do endpoint de token neste ambiente Windows.
  const tokenResponse = await axios.post(
    "https://oauth2.googleapis.com/token",
    new URLSearchParams({
      code,
      client_id,
      client_secret,
      redirect_uri: REDIRECT_URI,
      grant_type: "authorization_code",
    }).toString(),
    { headers: { "Content-Type": "application/x-www-form-urlencoded" } }
  );

  const { access_token, refresh_token, scope, token_type, expires_in } = tokenResponse.data;
  const tokens = {
    access_token,
    refresh_token,
    scope,
    token_type,
    expiry_date: Date.now() + expires_in * 1000,
  };

  fs.writeFileSync(env.googleTokenPath, JSON.stringify(tokens, null, 2));
  console.log(`\nToken salvo em ${env.googleTokenPath}. Configuracao concluida.`);
}

main().catch((err) => {
  console.error("Erro na configuracao do Google OAuth:", err);
  process.exit(1);
});
