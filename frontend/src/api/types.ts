/** Contrato de autenticación de C-03 (knowledge-base/entrega/C-03.md). */

export const ROLES = ['ADMIN', 'PROFESIONAL', 'RECEPCION'] as const;
export type Rol = (typeof ROLES)[number];

export interface RegistroRequest {
  consultorioNombre: string;
  nombre: string;
  apellido: string;
  email: string;
  password: string;
  /** Opcional; si viene vacía no se envía. */
  matricula?: string;
}

export interface RegistroResponse {
  consultorioId: number;
  usuarioId: number;
}

export interface LoginRequest {
  email: string;
  password: string;
}

export interface LoginResponse {
  accessToken: string;
  tokenType: 'Bearer';
  expiresIn: number;
  usuario: { id: number; nombre: string; rol: Rol };
  consultorioId: number;
}

export interface MeResponse {
  usuario: { id: number; nombre: string; email: string; rol: Rol };
  consultorio: { id: number; nombre: string };
}

/** Contrato de configuración de agenda de C-04 (knowledge-base/entrega/C-04.md, spec agenda-configuration). */

export interface Sillon {
  id: number;
  nombre: string;
  activo: boolean;
}

export interface SillonRequest {
  nombre: string;
  /** Omitido en PUT = no cambia. */
  activo?: boolean;
}

export interface Prestacion {
  id: number;
  nombre: string;
  duracionMinutos: number;
  activo: boolean;
}

export interface PrestacionRequest {
  nombre: string;
  duracionMinutos: number;
  /** Omitido en PUT = no cambia. */
  activo?: boolean;
}

/** `diaSemana` ISO: lunes = 1 … domingo = 7. */
export type DiaSemana = 1 | 2 | 3 | 4 | 5 | 6 | 7;

export interface Horario {
  id: number;
  profesionalId: number;
  diaSemana: DiaSemana;
  /** `HH:mm`, hora local del consultorio. */
  horaDesde: string;
  horaHasta: string;
}

export interface HorarioRequest {
  /** Omitido: el backend usa el único profesional activo (422 si no hay exactamente uno). */
  profesionalId?: number;
  diaSemana: DiaSemana;
  horaDesde: string;
  horaHasta: string;
}

export interface Bloqueo {
  id: number;
  sillonId: number | null;
  profesionalId: number | null;
  /** Instantes ISO-8601 UTC. */
  inicio: string;
  fin: string;
  motivo: string | null;
}

export interface BloqueoRequest {
  sillonId: number | null;
  profesionalId: number | null;
  inicio: string;
  fin: string;
  motivo?: string;
}

export interface FiltroBloqueos {
  desde?: string;
  hasta?: string;
}

/* Pacientes (C-05; C-12). */

/** Página de resultados de la API (`common.web.Pagina` del backend). */
export interface Pagina<T> {
  contenido: T[];
  pagina: number;
  tamanio: number;
  totalElementos: number;
  totalPaginas: number;
}

/** Paciente tal como lo devuelve la API: DNI sin separadores y teléfono en E.164 o `null`. */
export interface Paciente {
  id: number;
  nombre: string;
  apellido: string;
  dni: string;
  /** `YYYY-MM-DD` o `null`. */
  fechaNacimiento: string | null;
  sexo: string | null;
  telefono: string | null;
  email: string | null;
  direccion: string | null;
  obraSocialTexto: string | null;
  activo: boolean;
}

/** Alta y edición (reemplazo completo de datos personales; no cambia `activo`). */
export interface PacienteRequest {
  nombre: string;
  apellido: string;
  dni: string;
  fechaNacimiento: string | null;
  sexo: string | null;
  telefono: string | null;
  email: string | null;
  direccion: string | null;
  obraSocialTexto: string | null;
}

/* Historia clínica (C-08; C-12b). Datos de salud: solo en memoria de la página (design D8). */

export interface Consentimiento {
  id: number;
  versionTexto: string;
  /** Instant ISO-8601. */
  aceptadoEn: string;
  registradoPorUsuarioId: number;
}

export interface TextoConsentimiento {
  version: string;
  contenido: string;
  vigenteDesde: string;
}

/** Anamnesis. Ficha no cargada: campos clínicos, `version` y `actualizadaEn` en `null` (D5 de C-08). */
export interface Ficha {
  pacienteId: number;
  alergias: string | null;
  medicacionActual: string | null;
  antecedentesMedicos: string | null;
  enfermedadesRelevantes: string | null;
  embarazo: boolean | null;
  motivoConsulta: string | null;
  observaciones: string | null;
  version: number | null;
  actualizadaEn: string | null;
}

/** Reemplazo completo: un campo en `null` queda vacío. `version` es la leída (`null` en la primera carga). */
export interface FichaRequest {
  alergias: string | null;
  medicacionActual: string | null;
  antecedentesMedicos: string | null;
  enfermedadesRelevantes: string | null;
  embarazo: boolean | null;
  motivoConsulta: string | null;
  observaciones: string | null;
  version: number | null;
}

export interface Nota {
  id: number;
  fecha: string;
  profesionalId: number;
  turnoId: number | null;
  texto: string;
}

export interface FiltroPacientes {
  /** Nombre, apellido o prefijo de DNI; vacío = sin filtro. Nunca va en la URL de la app (D1). */
  q: string;
  incluirInactivos: boolean;
  /** Página desde 0. */
  page: number;
  /** 1..50 (el backend ajusta; default 20). */
  size: number;
}
