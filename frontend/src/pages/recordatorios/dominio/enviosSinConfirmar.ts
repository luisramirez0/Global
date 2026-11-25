/**
 * Registro en memoria de turnos con email enviado o con envío sin confirmar (design D11).
 * Solo guarda ids numéricos y nunca usa localStorage/sessionStorage (reglas 5 y D10).
 */
export interface RegistroEnviosSinConfirmar {
  marcar(turnoId: number): void;
  tiene(turnoId: number): boolean;
  /** Email enviado con éxito (`201`): "Email" queda deshabilitado el resto de la sesión (C-14). */
  marcarEnviado(turnoId: number): void;
  enviado(turnoId: number): boolean;
  /** Pedido de email en vuelo: un ítem reconstruido (Actualizar, otra fecha, otra pantalla) no debe reenviar (C-14, M1). */
  iniciarEnvio(turnoId: number): void;
  terminarEnvio(turnoId: number): void;
  enCurso(turnoId: number): boolean;
  /** Vacía todo el registro (cierre de sesión). */
  limpiar(): void;
}

export function crearRegistroEnviosSinConfirmar(): RegistroEnviosSinConfirmar {
  const ids = new Set<number>();
  const enviados = new Set<number>();
  const enCurso = new Set<number>();
  return {
    marcar(turnoId) {
      ids.add(turnoId);
    },
    tiene(turnoId) {
      return ids.has(turnoId);
    },
    marcarEnviado(turnoId) {
      enviados.add(turnoId);
    },
    enviado(turnoId) {
      return enviados.has(turnoId);
    },
    iniciarEnvio(turnoId) {
      enCurso.add(turnoId);
    },
    terminarEnvio(turnoId) {
      enCurso.delete(turnoId);
    },
    enCurso(turnoId) {
      return enCurso.has(turnoId);
    },
    limpiar() {
      ids.clear();
      enviados.clear();
      enCurso.clear();
    },
  };
}
