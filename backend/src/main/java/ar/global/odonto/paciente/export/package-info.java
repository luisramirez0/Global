/**
 * Exportacion de los datos de un paciente (C-15, US-040, RN-DS-06, Flujo 7). ZONA DE RIESGO (regla 12): exporta
 * datos de salud. Solo ADMIN/PROFESIONAL; cada export exitoso queda en {@code audit_log} como {@code EXPORT}
 * {@code Paciente} con {@code entidadId = pacienteId}, en la misma transaccion de lectura-escritura (fail-closed,
 * RN-DS-02). Nada del paquete corre en {@code @Transactional(readOnly = true)} (regla 5 de C-06, MySQL). Logs solo
 * con ids (regla 5).
 */
package ar.global.odonto.paciente.export;
