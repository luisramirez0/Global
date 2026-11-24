package ar.global.odonto.agenda.prestacion;

public record PrestacionResponse(Long id, String nombre, int duracionMinutos, boolean activo) {
}
