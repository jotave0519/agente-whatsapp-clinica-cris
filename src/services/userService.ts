import * as userRepository from "../repositories/userRepository";
import { User } from "../types";

/**
 * fallbackName so deve ser usado quando quem esta cadastrando o paciente
 * digitou um nome de verdade (ex: cadastro manual via CRM) - nunca o pushName
 * do WhatsApp. Sem fallbackName, o cliente novo nasce com name: "" e o nome
 * real e capturado explicitamente pelo fluxo de conversa.
 */
export async function getOrCreateUserByPhone(phone: string, fallbackName?: string): Promise<User> {
  return userRepository.findOrCreateUser(phone, fallbackName || "");
}
