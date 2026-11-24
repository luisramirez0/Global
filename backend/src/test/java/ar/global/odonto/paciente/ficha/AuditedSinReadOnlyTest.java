package ar.global.odonto.paciente.ficha;

import static org.assertj.core.api.Assertions.assertThat;

import ar.global.odonto.auditoria.AccionAuditoria;
import ar.global.odonto.auditoria.Audited;
import java.lang.reflect.Method;
import java.util.ArrayList;
import java.util.List;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.config.BeanDefinition;
import org.springframework.context.annotation.ClassPathScanningCandidateComponentProvider;
import org.springframework.core.annotation.AnnotatedElementUtils;
import org.springframework.transaction.annotation.Transactional;

/**
 * Regla 5 de C-06 (MySQL 8.4): ningun metodo {@code @Audited} de {@code paciente.ficha} corre en una transaccion
 * {@code readOnly}, ni por el metodo ni por su clase. H2 no detecta el problema, por eso se verifica por reflexion
 * (design D14, tarea 6.4).
 */
class AuditedSinReadOnlyTest {

	private static final String PAQUETE = "ar.global.odonto.paciente.ficha";

	/** Metodos {@code @Audited} de la clase que quedan en una transaccion de solo lectura. */
	static List<String> violaciones(Class<?> clase) {
		List<String> encontradas = new ArrayList<>();
		Transactional deClase = AnnotatedElementUtils.findMergedAnnotation(clase, Transactional.class);
		for (Method m : clase.getDeclaredMethods()) {
			if (!m.isAnnotationPresent(Audited.class)) {
				continue;
			}
			Transactional delMetodo = AnnotatedElementUtils.findMergedAnnotation(m, Transactional.class);
			Transactional efectiva = delMetodo != null ? delMetodo : deClase;
			if (efectiva != null && efectiva.readOnly()) {
				encontradas.add(clase.getSimpleName() + "." + m.getName());
			}
		}
		return encontradas;
	}

	private static List<Class<?>> clasesDelPaquete() throws ClassNotFoundException {
		ClassPathScanningCandidateComponentProvider scanner = new ClassPathScanningCandidateComponentProvider(false);
		scanner.addIncludeFilter((reader, factory) -> true);
		List<Class<?>> clases = new ArrayList<>();
		for (BeanDefinition bd : scanner.findCandidateComponents(PAQUETE)) {
			clases.add(Class.forName(bd.getBeanClassName()));
		}
		return clases;
	}

	@Test
	void noAuditedMethodOfTheClinicalPackageIsReadOnly() throws Exception {
		List<Class<?>> clases = clasesDelPaquete();
		List<String> todas = new ArrayList<>();
		for (Class<?> c : clases) {
			if (c.getEnclosingClass() == null && !c.getSimpleName().endsWith("Test")) {
				todas.addAll(violaciones(c));
			}
		}

		assertThat(clases).contains(FichaService.class, NotaService.class);
		assertThat(todas).isEmpty();
	}

	@Test
	void theAuditedReadsUnderTestReallyAreAudited() throws Exception {
		assertThat(FichaService.class.getMethod("obtener", Long.class).isAnnotationPresent(Audited.class)).isTrue();
		assertThat(NotaService.class.getMethod("listar", Long.class, int.class, int.class)
				.isAnnotationPresent(Audited.class)).isTrue();
	}

	@Test
	void theCheckDetectsReadOnlyOnTheMethod() {
		assertThat(violaciones(MetodoReadOnly.class)).containsExactly("MetodoReadOnly.leer");
	}

	@Test
	void theCheckDetectsReadOnlyInheritedFromTheClass() {
		assertThat(violaciones(ClaseReadOnly.class)).containsExactly("ClaseReadOnly.leer");
		assertThat(violaciones(ClaseReadOnlyConMetodoRw.class)).isEmpty();
	}

	static class MetodoReadOnly {

		@Audited(accion = AccionAuditoria.READ, entidad = "Prueba")
		@Transactional(readOnly = true)
		public void leer() {
		}

		@Transactional(readOnly = true)
		public void sinAuditar() {
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
