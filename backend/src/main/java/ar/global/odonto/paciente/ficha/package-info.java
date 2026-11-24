/**
 * Ficha clinica (anamnesis), notas clinicas y consentimiento de datos (C-08, US-021). ZONA DE RIESGO (regla 12):
 * datos de salud sensibles (RN-DS-01). Solo ADMIN/PROFESIONAL; cada acceso clinico queda en {@code audit_log}
 * con {@code entidadId = pacienteId} (RN-DS-02). Ningun metodo {@code @Audited} lleva
 * {@code @Transactional(readOnly = true)} (regla 5 de C-06, MySQL). Logs solo con ids (regla 5).
 */
package ar.global.odonto.paciente.ficha;
