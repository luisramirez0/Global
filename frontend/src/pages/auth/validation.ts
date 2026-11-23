/**
 * Validación en el cliente con las mismas reglas que el backend de C-03 (LoginRequest, RegistroRequest).
 * El servidor sigue siendo la autoridad: sus 400 se muestran por campo igual.
 */

export type FieldErrors<K extends string> = Partial<Record<K, string>>;

export interface LoginInput {
  email: string;
  password: string;
}

export interface RegistroInput {
  consultorioNombre: string;
  nombre: string;
  apellido: string;
  email: string;
  password: string;
  matricula: string;
}

export const MSG_REQUIRED = 'Este campo es obligatorio.';
export const MSG_EMAIL = 'Ingresá un email válido.';
export const MSG_PASSWORD_SHORT = 'La contraseña debe tener al menos 8 caracteres.';
export const MSG_PASSWORD_LONG = 'La contraseña es demasiado larga.';
const maxMsg = (max: number): string => `Máximo ${max} caracteres.`;

/** Equivalente laxo a `@Email` de Hibernate Validator: algo@algo, sin espacios. */
const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+$/;
const PASSWORD_MAX_BYTES = 72; // límite de BCrypt (MaxUtf8Bytes en el backend)

export function utf8Length(value: string): number {
  return new TextEncoder().encode(value).length;
}

function requiredText(value: string, max: number): string | undefined {
  const trimmed = value.trim();
  if (trimmed === '') return MSG_REQUIRED;
  if (trimmed.length > max) return maxMsg(max);
  return undefined;
}

function emailError(value: string): string | undefined {
  const trimmed = value.trim();
  if (trimmed === '') return MSG_REQUIRED;
  if (trimmed.length > 254) return maxMsg(254);
  if (!EMAIL_PATTERN.test(trimmed)) return MSG_EMAIL;
  return undefined;
}

function compact<K extends string>(errors: Record<K, string | undefined>): FieldErrors<K> {
  const result: FieldErrors<K> = {};
  for (const key of Object.keys(errors) as K[]) {
    const message = errors[key];
    if (message !== undefined) result[key] = message;
  }
  return result;
}

export function validateLogin(input: LoginInput): FieldErrors<keyof LoginInput> {
  let password: string | undefined;
  if (input.password === '') password = MSG_REQUIRED;
  else if (input.password.length > 200) password = maxMsg(200);
  return compact({ email: emailError(input.email), password });
}

export function validateRegistro(input: RegistroInput): FieldErrors<keyof RegistroInput> {
  let password: string | undefined;
  if (input.password === '') password = MSG_REQUIRED;
  else if (input.password.length < 8) password = MSG_PASSWORD_SHORT;
  else if (utf8Length(input.password) > PASSWORD_MAX_BYTES) password = MSG_PASSWORD_LONG;

  const matricula = input.matricula.trim();
  return compact({
    consultorioNombre: requiredText(input.consultorioNombre, 150),
    nombre: requiredText(input.nombre, 100),
    apellido: requiredText(input.apellido, 100),
    email: emailError(input.email),
    password,
    matricula: matricula.length > 50 ? maxMsg(50) : undefined,
  });
}
