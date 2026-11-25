package ar.global.odonto.paciente.export;

import static org.assertj.core.api.Assertions.assertThat;

import java.lang.reflect.Method;
import java.util.ArrayList;
import java.util.Arrays;
import java.util.List;

import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.config.BeanDefinition;
import org.springframework.context.annotation.ClassPathScanningCandidateComponentProvider;
import org.springframework.core.annotation.AnnotatedElementUtils;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.repository.CrudRepository;
import org.springframework.transaction.annotation.Transactional;

import ar.global.odonto.auditoria.AccionAuditoria;
import ar.global.odonto.auditoria.Audited;

/**
 * Regla 5 de C-06 (MySQL 8.4) aplicada al export (C-15 design D3, tarea 4.1): el export registra auditoria, asi
 * que ningun metodo del paquete puede correr en una transaccion {@code readOnly}; H2 no lo detecta, por eso se
 * verifica por reflexion. Tampoco se usa {@code @Audited} (detalle dinamico, regla 6) y el repositorio es de solo
 * lectura.
 */
class PacienteExportArchTest {

	private static final String PAQUETE = "ar.global.odonto.paciente.export";

	/** Metodos de la clase que quedan en una transaccion de solo lectura o usan {@code @Audited}. */
	static List<String> violaciones(Class<?> clase) {
		List<String> encontradas = new ArrayList<>();
		Transactional deClase = AnnotatedElementUtils.findMergedAnnotation(clase, Transactional.class);
		if (deClase != null && deClase.readOnly()) {
			encontradas.add(clase.getSimpleName());
		}
		for (Method m : clase.getDeclaredMethods()) {
			Transactional delMetodo = AnnotatedElementUtils.findMergedAnnotation(m, Transactional.class);
			if ((delMetodo != null && delMetodo.readOnly()) || m.isAnnotationPresent(Audited.class)) {
				encontradas.add(clase.getSimpleName() + "." + m.getName());
			}
		}
		return encontradas;
	}

	private static List<Class<?>> clasesDelPaquete() throws ClassNotFoundException {
		ClassPathScanningCandidateComponentProvider scanner = new ClassPathScanningCandidateComponentProvider(false) {
			@Override
			protected boolean isCandidateComponent(
					org.springframework.beans.factory.annotation.AnnotatedBeanDefinition definition) {
				return true;
			}
		};
		scanner.addIncludeFilter((reader, factory) -> true);
		List<Class<?>> clases = new ArrayList<>();
		for (BeanDefinition bd : scanner.findCandidateComponents(PAQUETE)) {
			clases.add(Class.forName(bd.getBeanClassName()));
		}
		return clases;
	}

	@Test
	void nothingInTheExportPackageIsReadOnlyOrUsesAudited() throws Exception {
		List<Class<?>> clases = clasesDelPaquete();
		List<String> todas = new ArrayList<>();
		for (Class<?> c : clases) {
			if (c.getEnclosingClass() == null && !c.getSimpleName().endsWith("Test")) {
				todas.addAll(violaciones(c));
			}
		}

		assertThat(clases).contains(PacienteExportService.class, PacienteExportRepository.class);
		assertThat(todas).isEmpty();
	}

	@Test
	void theRepositoryCannotWrite() {
		assertThat(CrudRepository.class.isAssignableFrom(PacienteExportRepository.class)).isFalse();
		assertThat(JpaRepository.class.isAssignableFrom(PacienteExportRepository.class)).isFalse();
		assertThat(Arrays.stream(PacienteExportRepository.class.getMethods()).map(Method::getName))
				.noneMatch(n -> n.startsWith("save") || n.startsWith("delete") || n.startsWith("flush"));
	}

	@Test
	void theCheckDetectsReadOnlyOnAMethodOrTheClassAndAudited() {
		assertThat(violaciones(MetodoReadOnly.class)).containsExactly("MetodoReadOnly.leer");
		assertThat(violaciones(ClaseReadOnly.class)).containsExactly("ClaseReadOnly");
		assertThat(violaciones(ConAudited.class)).containsExactly("ConAudited.exportar");
		assertThat(violaciones(Limpia.class)).isEmpty();
	}

	static class MetodoReadOnly {

		@Transactional(readOnly = true)
		public void leer() {
		}
	}

	@Transactional(readOnly = true)
	static class ClaseReadOnly {

		public void leer() {
		}
	}

	static class ConAudited {

		@Audited(accion = AccionAuditoria.EXPORT, entidad = "Paciente")
		public void exportar() {
		}
	}

	static class Limpia {

		@Transactional
		public void exportar() {
		}
	}
}
