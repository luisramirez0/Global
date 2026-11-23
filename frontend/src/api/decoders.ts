import { ApiError } from './errors';
import { ROLES, type LoginResponse, type MeResponse, type RegistroResponse, type Rol } from './types';

/** Decodificadores de respuestas: narrowing de `unknown`, sin `as` sobre JSON crudo (regla 4). */

type Obj = Record<string, unknown>;

function fail(): never {
  throw new ApiError('unexpected');
}

function obj(value: unknown): Obj {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) fail();
  return value as Obj;
}

function id(o: Obj, key: string): number {
  const v = o[key];
  if (typeof v !== 'number' || !Number.isSafeInteger(v) || v <= 0) fail();
  return v;
}

function str(o: Obj, key: string, { nonEmpty = false } = {}): string {
  const v = o[key];
  if (typeof v !== 'string' || (nonEmpty && v === '')) fail();
  return v;
}

function rol(o: Obj, key: string): Rol {
  const v = o[key];
  const found = ROLES.find((r) => r === v);
  if (found === undefined) fail();
  return found;
}

export function decodeRegistro(value: unknown): RegistroResponse {
  const o = obj(value);
  return { consultorioId: id(o, 'consultorioId'), usuarioId: id(o, 'usuarioId') };
}

export function decodeLogin(value: unknown): LoginResponse {
  const o = obj(value);
  if (o['tokenType'] !== 'Bearer') fail();
  const expiresIn = o['expiresIn'];
  if (typeof expiresIn !== 'number' || !Number.isFinite(expiresIn) || expiresIn <= 0) fail();
  const u = obj(o['usuario']);
  return {
    accessToken: str(o, 'accessToken', { nonEmpty: true }),
    tokenType: 'Bearer',
    expiresIn,
    usuario: { id: id(u, 'id'), nombre: str(u, 'nombre'), rol: rol(u, 'rol') },
    consultorioId: id(o, 'consultorioId'),
  };
}

export function decodeMe(value: unknown): MeResponse {
  const o = obj(value);
  const u = obj(o['usuario']);
  const c = obj(o['consultorio']);
  return {
    usuario: { id: id(u, 'id'), nombre: str(u, 'nombre'), email: str(u, 'email'), rol: rol(u, 'rol') },
    consultorio: { id: id(c, 'id'), nombre: str(c, 'nombre') },
  };
}
