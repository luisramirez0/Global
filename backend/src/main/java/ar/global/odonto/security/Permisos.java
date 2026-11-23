package ar.global.odonto.security;

/**
 * Expresiones de {@code @PreAuthorize} derivadas de la matriz RBAC de KB 03 (design D4). Usarlas en lugar de
 * escribir roles a mano. Las combinaciones finas (p. ej. RECEPCION sin borrar pacientes) se arman por metodo
 * eligiendo {@link #GESTION} u {@link #OPERACION}.
 *
 * <ul>
 * <li>{@link #GESTION}: configuracion del consultorio (escritura), usuarios, auditoria, exportacion y ficha
 * clinica. RECEPCION queda excluida de la ficha hasta resolver PA-07 (fail closed).</li>
 * <li>{@link #OPERACION}: turnos, pacientes (CRU), bloqueos (CRU), recordatorios y lectura de
 * configuracion.</li>
 * </ul>
 */
public final class Permisos {

	public static final String GESTION = "hasAnyRole('ADMIN','PROFESIONAL')";
	public static final String OPERACION = "hasAnyRole('ADMIN','PROFESIONAL','RECEPCION')";

	private Permisos() {
	}
}
