package ar.global.odonto.common.tenant;

import java.util.Optional;
import java.util.function.Supplier;

/**
 * Consultorio (tenant) en curso para el hilo actual. Alimenta al resolver de Hibernate
 * ({@link TenantIdentifierResolver}), que acota toda lectura y escritura de datos de negocio.
 *
 * <ul>
 * <li><b>Quién lo puebla:</b> el filtro JWT de C-03 (con {@code consultorio_id} del token), que debe
 * limpiarlo en un {@code finally}. Las tareas asíncronas o programadas deben usar
 * {@link #runAs(Long, Supplier)} de forma explícita: no hay propagación implícita entre hilos.</li>
 * <li><b>Modo sistema ({@link #runAsSystem(Supplier)}):</b> bypass consciente del filtro, permitido
 * solo para la búsqueda de usuario por email en el login, el alta de consultorio, el seed de
 * desarrollo y la construcción de los repositorios al arrancar
 * ({@code TenantAwareJpaRepositoryFactoryBean}, sin ejecutar consultas de datos). Cada uso queda
 * acotado a un bloque y debe justificarse en el PR.</li>
 * <li><b>SQL nativo:</b> el filtro de tenant NO aplica a consultas nativas. Está prohibido usarlas
 * sobre tablas de negocio salvo que reciban {@code consultorio_id} como parámetro y lo documenten.</li>
 * <li><b>Transacciones:</b> Hibernate resuelve el tenant al abrir la sesión, es decir, al iniciar la
 * transacción: el tenant debe estar fijado <i>antes</i> de entrar a un método {@code @Transactional}.</li>
 * </ul>
 */
public final class TenantContext {

	private static final ThreadLocal<Long> TENANT = new ThreadLocal<>();
	private static final ThreadLocal<Boolean> SYSTEM = new ThreadLocal<>();

	private TenantContext() {
	}

	public static void set(Long consultorioId) {
		if (consultorioId == null) {
			throw new IllegalArgumentException("consultorioId es obligatorio");
		}
		TENANT.set(consultorioId);
	}

	public static Optional<Long> get() {
		return Optional.ofNullable(TENANT.get());
	}

	public static Long require() {
		Long id = TENANT.get();
		if (id == null) {
			throw new TenantNotSetException();
		}
		return id;
	}

	public static boolean isSystem() {
		return Boolean.TRUE.equals(SYSTEM.get());
	}

	public static void clear() {
		TENANT.remove();
		SYSTEM.remove();
	}

	/** Ejecuta el bloque con el tenant indicado y restaura el estado previo, aun si el bloque lanza. */
	public static <T> T runAs(Long consultorioId, Supplier<T> block) {
		Long previous = TENANT.get();
		set(consultorioId);
		try {
			return block.get();
		}
		finally {
			restoreTenant(previous);
		}
	}

	/** Ejecuta el bloque en modo sistema (sin filtro de tenant) y restaura el estado previo. */
	public static <T> T runAsSystem(Supplier<T> block) {
		Boolean previous = SYSTEM.get();
		SYSTEM.set(Boolean.TRUE);
		try {
			return block.get();
		}
		finally {
			if (previous == null) {
				SYSTEM.remove();
			}
			else {
				SYSTEM.set(previous);
			}
		}
	}

	private static void restoreTenant(Long previous) {
		if (previous == null) {
			TENANT.remove();
		}
		else {
			TENANT.set(previous);
		}
	}
}
