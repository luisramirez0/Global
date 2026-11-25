package ar.global.odonto.recordatorio;

import static org.assertj.core.api.Assertions.assertThat;

import ar.global.odonto.auditoria.AccionAuditoria;
import ar.global.odonto.auditoria.Audited;
import java.lang.reflect.Method;
import java.util.ArrayList;
import java.util.List;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.AnnotatedBeanDefinition;
import org.springframework.beans.factory.config.BeanDefinition;
import org.springframework.context.annotation.ClassPathScanningCandidateComponentProvider;
import org.springframework.core.annotation.AnnotatedElementUtils;
import org.springframework.core.type.filter.RegexPatternTypeFilter;
import org.springframework.transaction.annotation.Transactional;

/**
 * Regla 5 del handoff de C-06 aplicada a {@code recordatorio} (C-09 tarea 6.1, design D6). H2 no detecta un INSERT
 * en una conexion de solo lectura, asi que la red es esta verificacion por reflexion: (1) ningun metodo combina
 * {@code @Audited} con {@code readOnly}, (2) {@code readOnly} solo en la consulta de pendientes, (3) el servicio de
 * email no declara {@code @Transactional} (ni de clase ni de metodo: abre sus transacciones con
 * {@code TransactionTemplate} y el envio SMTP corre fuera de toda transaccion).
 */
class RecordatorioTransaccionesArchTest {

	private static final String PENDIENTES = "RecordatorioPendientesService.pendientes";

	private static List<Class<?>> clasesDelPaquete() throws ClassNotFoundException {
		ClassPathScanningCandidateComponentProvider scanner = new ClassPathScanningCandidateComponentProvider(false) {
			@Override
			protected boolean isCandidateComponent(AnnotatedBeanDefinition definition) {
				return true;
			}
		};
		scanner.addIncludeFilter(new RegexPatternTypeFilter(java.util.regex.Pattern.compile(".*")));
		List<Class<?>> clases = new ArrayList<>();
		for (BeanDefinition bd : scanner.findCandidateComponents(RecordatorioEmailService.class.getPackageName())) {
			clases.add(Class.forName(bd.getBeanClassName()));
		}
		return clases;
	}

	private static List<Class<?>> produccion() throws ClassNotFoundException {
		// Solo clases de produccion (build/classes/java/main): excluye tests, ITs y fixtures del mismo paquete.
		return clasesDelPaquete().stream().filter(c -> c.getProtectionDomain().getCodeSource().getLocation()
				.getPath().contains("/classes/java/main")).toList();
	}

	private static Transactional efectiva(Method m) {
		Transactional delMetodo = AnnotatedElementUtils.findMergedAnnotation(m, Transactional.class);
		return delMetodo != null ? delMetodo
				: AnnotatedElementUtils.findMergedAnnotation(m.getDeclaringClass(), Transactional.class);
	}

	/** Metodos {@code @Audited} que quedan en una transaccion de solo lectura (por metodo o por clase). */
	static List<String> auditadosReadOnly(Class<?> clase) {
		List<String> encontradas = new ArrayList<>();
		for (Method m : clase.getDeclaredMethods()) {
			Transactional t = efectiva(m);
			if (m.isAnnotationPresent(Audited.class) && t != null && t.readOnly()) {
				encontradas.add(clase.getSimpleName() + "." + m.getName());
			}
		}
		return encontradas;
	}

	/** Metodos en una transaccion {@code readOnly}, por metodo o heredado de la clase. */
	static List<String> readOnly(Class<?> clase) {
		List<String> encontradas = new ArrayList<>();
		for (Method m : clase.getDeclaredMethods()) {
			Transactional t = efectiva(m);
			if (t != null && t.readOnly()) {
				encontradas.add(clase.getSimpleName() + "." + m.getName());
			}
		}
		return encontradas;
	}

	/** {@code @Transactional} declarado en la clase o en cualquiera de sus metodos. */
	static List<String> transaccionales(Class<?> clase) {
		List<String> encontradas = new ArrayList<>();
		if (AnnotatedElementUtils.findMergedAnnotation(clase, Transactional.class) != null) {
			encontradas.add(clase.getSimpleName() + " (clase)");
		}
		for (Method m : clase.getDeclaredMethods()) {
			if (AnnotatedElementUtils.findMergedAnnotation(m, Transactional.class) != null) {
				encontradas.add(clase.getSimpleName() + "." + m.getName());
			}
		}
		return encontradas;
	}

	@Test
	void scanFindsTheProductionClassesOfThePackage() throws Exception {
		assertThat(produccion()).contains(RecordatorioWhatsAppService.class, RecordatorioEmailService.class,
				RecordatorioPendientesService.class, RecordatorioController.class);
	}

	@Test
	void noMethodCombinesAuditedWithReadOnly() throws Exception {
		List<String> violaciones = new ArrayList<>();
		for (Class<?> c : produccion()) {
			violaciones.addAll(auditadosReadOnly(c));
		}
		assertThat(violaciones).isEmpty();
	}

	@Test
	void readOnlyOnlyOnThePendientesQuery() throws Exception {
		List<String> readOnly = new ArrayList<>();
		for (Class<?> c : produccion()) {
			readOnly.addAll(readOnly(c));
		}
		assertThat(readOnly).containsExactly(PENDIENTES);
	}

	@Test
	void theEmailServiceDeclaresNoTransactional() {
		assertThat(transaccionales(RecordatorioEmailService.class)).isEmpty();
	}

	@Test
	void theChecksDetectViolationsOnMethodAndOnClass() {
		assertThat(auditadosReadOnly(MetodoAuditadoReadOnly.class)).containsExactly("MetodoAuditadoReadOnly.leer");
		assertThat(auditadosReadOnly(ClaseReadOnly.class)).containsExactly("ClaseReadOnly.leer");
		assertThat(readOnly(MetodoAuditadoReadOnly.class)).containsExactlyInAnyOrder("MetodoAuditadoReadOnly.leer",
				"MetodoAuditadoReadOnly.soloLectura");
		assertThat(transaccionales(ClaseReadOnly.class)).contains("ClaseReadOnly (clase)");
		assertThat(transaccionales(MetodoAuditadoReadOnly.class)).contains("MetodoAuditadoReadOnly.soloLectura");
		assertThat(auditadosReadOnly(ClaseReadOnlyConMetodoRw.class)).isEmpty();
	}

	static class MetodoAuditadoReadOnly {

		@Audited(accion = AccionAuditoria.READ, entidad = "Prueba")
		@Transactional(readOnly = true)
		public void leer() {
		}

		@Transactional(readOnly = true)
		public void soloLectura() {
		}
	}

	@Transactional(readOnly = true)
	static class ClaseReadOnly {

		@Audited(accion = AccionAuditoria.READ, entidad = "Prueba")
		public void leer() {
		}
	}

	@Transactional(readOnly = true)
	static class ClaseReadOnlyConMetodoRw {

		@Audited(accion = AccionAuditoria.READ, entidad = "Prueba")
		@Transactional
		public void leer() {
		}
	}
}
