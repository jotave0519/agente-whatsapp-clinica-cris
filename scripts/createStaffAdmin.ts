/**
 * Cria o primeiro usuario admin do CRM web: um usuario no Supabase Auth +
 * o registro correspondente na tabela "staff" com role=admin.
 *
 * Uso:
 *   npx ts-node scripts/createStaffAdmin.ts --email dra@clinica.com --password "senha-forte" --name "Dra. Cristiane Zangelmi"
 */
import { getSupabaseClient } from "../src/integrations/supabaseClient";
import * as staffRepository from "../src/repositories/staffRepository";

function getArg(name: string): string | undefined {
  const idx = process.argv.indexOf(`--${name}`);
  return idx !== -1 ? process.argv[idx + 1] : undefined;
}

async function main() {
  const email = getArg("email");
  const password = getArg("password");
  const name = getArg("name");

  if (!email || !password || !name) {
    console.error('Uso: npx ts-node scripts/createStaffAdmin.ts --email <email> --password <senha> --name "<nome>"');
    process.exit(1);
  }

  const supabase = getSupabaseClient();

  const { data, error } = await supabase.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
  });

  if (error || !data.user) {
    console.error("Erro ao criar usuario no Supabase Auth:", error?.message);
    process.exit(1);
  }

  const staff = await staffRepository.create(data.user.id, name, email, "admin");
  console.log(`Staff admin criado: ${staff.name} <${staff.email}> (id: ${staff.id})`);
}

main().catch((err) => {
  console.error("Erro:", err.message);
  process.exit(1);
});
