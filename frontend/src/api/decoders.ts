import { ApiError } from './errors';
import {
  ROLES,
  type Bloqueo,
  type Consentimiento,
  type DiaSemana,
  type Ficha,
  type Horario,
  type Nota,
  type TextoConsentimiento,
  type LoginResponse,
  type MeResponse,
  type Paciente,
  type Pagina,
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

/* Pacientes (C-05; C-12). */

/** `LocalDate` de Java (`YYYY-MM-DD`) que existe en el calendario. */
function fechaOrNull(o: Obj, key: string): string | null {
  const v = o[key];
  if (v === null || v === undefined) return null;
  if (typeof v !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(v)) fail();
  const [y, m, d] = v.split('-').map(Number);
  if (y === undefined || m === undefined || d === undefined) fail();
  const date = new Date(Date.UTC(y, m - 1, d));
  if (date.getUTCFullYear() !== y || date.getUTCMonth() !== m - 1 || date.getUTCDate() !== d) fail();
  return v;
}

function entero(o: Obj, key: string, min: number): number {
  const v = o[key];
  if (typeof v !== 'number' || !Number.isSafeInteger(v) || v < min) fail();
  return v;
}

export function decodePaciente(value: unknown): Paciente {
  const o = obj(value);
  return {
    id: id(o, 'id'),
    nombre: str(o, 'nombre'),
    apellido: str(o, 'apellido'),
    dni: str(o, 'dni'),
    fechaNacimiento: fechaOrNull(o, 'fechaNacimiento'),
    sexo: strOrNull(o, 'sexo'),
    telefono: strOrNull(o, 'telefono'),
    email: strOrNull(o, 'email'),
    direccion: strOrNull(o, 'direccion'),
    obraSocialTexto: strOrNull(o, 'obraSocialTexto'),
    activo: bool(o, 'activo'),
  };
}

/** `Pagina<T>` del backend; cada elemento pasa por `decode`. */
export function paginaOf<T>(decode: (value: unknown) => T): (value: unknown) => Pagina<T> {
  return (value) => {
    const o = obj(value);
    const contenido = o['contenido'];
    if (!Array.isArray(contenido)) fail();
    return {
      contenido: contenido.map((item: unknown) => decode(item)),
      pagina: entero(o, 'pagina', 0),
      tamanio: entero(o, 'tamanio', 1),
      totalElementos: entero(o, 'totalElementos', 0),
      totalPaginas: entero(o, 'totalPaginas', 0),
    };
  };
}

/* Historia clínica (C-08; C-12b). */

function boolOrNull(o: Obj, key: string): boolean | null {
  return o[key] === null || o[key] === undefined ? null : bool(o, key);
}

function instantOrNull(o: Obj, key: string): string | null {
  return o[key] === null || o[key] === undefined ? null : instant(o, key);
}

/** `@Version` de JPA: entero ≥ 0, o `null` si la ficha no fue cargada. */
function versionOrNull(o: Obj, key: string): number | null {
  return o[key] === null || o[key] === undefined ? null : entero(o, key, 0);
}

export function decodeConsentimiento(value: unknown): Consentimiento {
  const o = obj(value);
  return {
    id: id(o, 'id'),
    versionTexto: str(o, 'versionTexto', { nonEmpty: true }),
    aceptadoEn: instant(o, 'aceptadoEn'),
    registradoPorUsuarioId: id(o, 'registradoPorUsuarioId'),
  };
}

export function decodeTextoConsentimiento(value: unknown): TextoConsentimiento {
  const o = obj(value);
  return {
    version: str(o, 'version', { nonEmpty: true }),
    contenido: str(o, 'contenido'),
    vigenteDesde: instant(o, 'vigenteDesde'),
  };
}

export function decodeFicha(value: unknown): Ficha {
  const o = obj(value);
  return {
    pacienteId: id(o, 'pacienteId'),
    alergias: strOrNull(o, 'alergias'),
    medicacionActual: strOrNull(o, 'medicacionActual'),
    antecedentesMedicos: strOrNull(o, 'antecedentesMedicos'),
    enfermedadesRelevantes: strOrNull(o, 'enfermedadesRelevantes'),
    embarazo: boolOrNull(o, 'embarazo'),
    motivoConsulta: strOrNull(o, 'motivoConsulta'),
    observaciones: strOrNull(o, 'observaciones'),
    version: versionOrNull(o, 'version'),
    actualizadaEn: instantOrNull(o, 'actualizadaEn'),
  };
}

export function decodeNota(value: unknown): Nota {
  const o = obj(value);
  return {
    id: id(o, 'id'),
    fecha: instant(o, 'fecha'),
    profesionalId: id(o, 'profesionalId'),
    turnoId: idOrNull(o, 'turnoId'),
    texto: str(o, 'texto'),
  };
}
