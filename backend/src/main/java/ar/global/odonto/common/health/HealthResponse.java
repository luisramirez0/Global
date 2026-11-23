package ar.global.odonto.common.health;

/** Cuerpo de {@code GET /api/health}: solo el estado, sin detalles internos. */
public record HealthResponse(String status) {
}
