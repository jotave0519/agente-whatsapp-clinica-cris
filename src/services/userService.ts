import * as userRepository from "../repositories/userRepository";
import { User } from "../types";

export async function getOrCreateUserByPhone(phone: string, pushName?: string): Promise<User> {
  return userRepository.findOrCreateUser(phone, pushName || phone);
}
