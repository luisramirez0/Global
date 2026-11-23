package ar.global.odonto.consultorio.registro;

/** Resultado del alta: solo ids, sin token (la SPA hace login despues, Flujo 1). */
public record RegistroResponse(Long consultorioId, Long usuarioId) {
}
