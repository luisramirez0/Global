import { ApiError } from './errors';
import {
  ACCIONES_AUDITORIA,
  ROLES,
  type AccionAuditoria,
  type Bloqueo,
  type DiaSemana,
  type EntradaAuditoria,
  type ExportPaciente,
  type Pagina,
  type ValorDetalle,
  type Horario,
  type LoginResponse,
  type MeResponse,
  type Prestacion,
  type RegistroResponse,
  type Rol,
  type Sillon,
} from './types';

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

/* Configuración de agenda (C-04). */

function bool(o: Obj, key: string): boolean {
  const v = o[key];
  if (typeof v !== 'boolean') fail();
  return v;
}

function idOrNull(o: Obj, key: string): number | null {
  return o[key] === null || o[key] === undefined ? null : id(o, key);
}

function strOrNull(o: Obj, key: string): string | null {
  return o[key] === null || o[key] === undefined ? null : str(o, key);
}

function hhmm(o: Obj, key: string): string {
  const v = str(o, key);
  if (!/^([01]\d|2[0-3]):[0-5]\d$/.test(v)) fail();
  return v;
}

/** Instant de Java (ISO-8601 con zona): nunca una fecha local ambigua. */
function instant(o: Obj, key: string): string {
  const v = str(o, key);
  if (!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}(:\d{2}(\.\d+)?)?(Z|[+-]\d{2}:\d{2})$/.test(v) || Number.isNaN(Date.parse(v))) fail();
  return v;
}

function diaSemana(o: Obj, key: string): DiaSemana {
  const v = o[key];
  if (v === 1 || v === 2 || v === 3 || v === 4 || v === 5 || v === 6 || v === 7) return v;
  return fail();
}

export function listOf<T>(decode: (value: unknown) => T): (value: unknown) => T[] {
  return (value) => {
    if (!Array.isArray(value)) fail();
    return value.map((item: unknown) => decode(item));
  };
}

export function decodeSillon(value: unknown): Sillon {
  const o = obj(value);
  return { id: id(o, 'id'), nombre: str(o, 'nombre'), activo: bool(o, 'activo') };
}

export function decodePrestacion(value: unknown): Prestacion {
  const o = obj(value);
  // `id` exige un entero seguro positivo: sirve también para la duración.
  return { id: id(o, 'id'), nombre: str(o, 'nombre'), duracionMinutos: id(o, 'duracionMinutos'), activo: bool(o, 'activo') };
}

export function decodeHorario(value: unknown): Horario {
  const o = obj(value);
  return {
    id: id(o, 'id'),
    profesionalId: id(o, 'profesionalId'),
    diaSemana: diaSemana(o, 'diaSemana'),
    horaDesde: hhmm(o, 'horaDesde'),
    horaHasta: hhmm(o, 'horaHasta'),
  };
}

export function decodeBloqueo(value: unknown): Bloqueo {
  const o = obj(value);
  return {
    id: id(o, 'id'),
    sillonId: idOrNull(o, 'sillonId'),
    profesionalId: idOrNull(o, 'profesionalId'),
    inicio: instant(o, 'inicio'),
    fin: instant(o, 'fin'),
    motivo: strOrNull(o, 'motivo'),
  };
}

/* Auditoría (C-06) y export (C-15). */

function nonNegativeInt(o: Obj, key: string): number {
  const v = o[key];
  if (typeof v !== 'number' || !Number.isSafeInteger(v) || v < 0) fail();
  return v;
}

function accionAuditoria(o: Obj, key: string): AccionAuditoria {
  const v = o[key];
  const found = ACCIONES_AUDITORIA.find((a) => a === v);
  if (found === undefined) fail();
  return found;
}

/** Objeto JSON plano con valores escalares, o `null`. */
function detalle(o: Obj, key: string): Readonly<Record<string, ValorDetalle>> | null {
  const v = o[key];
  if (v === null || v === undefined) return null;
  const d = obj(v);
  const result: Record<string, ValorDetalle> = {};
  for (const [k, valor] of Object.entries(d)) {
    if (typeof valor !== 'string' && typeof valor !== 'boolean' && (typeof valor !== 'number' || !Number.isFinite(valor))) fail();
    result[k] = valor;
  }
  return result;
}

export function decodeEntradaAuditoria(value: unknown): EntradaAuditoria {
  const o = obj(value);
  return {
    id: id(o, 'id'),
    fecha: instant(o, 'fecha'),
    usuarioId: idOrNull(o, 'usuarioId'),
    accion: accionAuditoria(o, 'accion'),
    entidad: str(o, 'entidad', { nonEmpty: true }),
    entidadId: idOrNull(o, 'entidadId'),
    detalle: detalle(o, 'detalle'),
    ip: strOrNull(o, 'ip'),
  };
}

export function paginaOf<T>(decode: (value: unknown) => T): (value: unknown) => Pagina<T> {
  return (value) => {
    const o = obj(value);
    return {
      contenido: listOf(decode)(o['contenido']),
      pagina: nonNegativeInt(o, 'pagina'),
      tamanio: nonNegativeInt(o, 'tamanio'),
      totalElementos: nonNegativeInt(o, 'totalElementos'),
      totalPaginas: nonNegativeInt(o, 'totalPaginas'),
    };
  };
}

/** Solo valida la forma mínima (objeto con `paciente`); el contenido se descarga sin interpretar. */
export function decodeExportPaciente(value: unknown): ExportPaciente {
  const o = obj(value);
  obj(o['paciente']);
  return o;
}
