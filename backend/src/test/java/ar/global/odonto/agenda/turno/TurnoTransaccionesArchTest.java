package ar.global.odonto.agenda.turno;

import static org.assertj.core.api.Assertions.assertThat;

import ar.global.odonto.auditoria.Audited;
import java.lang.reflect.Method;
import java.util.ArrayList;
import java.util.List;
import java.util.Set;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.config.BeanDefinition;
import org.springframework.context.annotation.ClassPathScanningCandidateComponentProvider;
import org.springframework.core.type.filter.RegexPatternTypeFilter;
import org.springframework.transaction.annotation.Transactional;

/**
 * Regla 5 del handoff de C-06 (C-07 tarea 8.1): un metodo auditado no puede ser {@code readOnly}, porque el INSERT
 * de auditoria comparte la transaccion y MySQL lo rechaza en una conexion de solo lectura (H2 no lo detecta, asi
 * que este test es la red). Ademas, toda escritura de {@link TurnoService} audita a mano y debe ser de
 * lectura-escritura.
 */
class TurnoTransaccionesArchTest {

	private static final Set<String> ESCRITURAS = Set.of("crear", "cambiarEstado", "reprogramar");

	private static List<Class<?>> clasesDelPaquete() throws ClassNotFoundException {
		ClassPathScanningCandidateComponentProvider scanner = new ClassPathScanningCandidateComponentProvider(false) {
			@Override
			protected boolean isCandidateComponent(
					org.springframework.beans.factory.annotation.AnnotatedBeanDefinition definition) {
				return true;
			}
		};
		scanner.addIncludeFilter(new RegexPatternTypeFilter(java.util.regex.Pattern.compile(".*")));
		List<Class<?>> clases = new ArrayList<>();
		for (BeanDefinition bd : scanner.findCandidateComponents(TurnoService.class.getPackageName())) {
			clases.add(Class.forName(bd.getBeanClassName()));
		}
		return clases;
	}

	private static boolean readOnly(Method m) {
		Transactional t = m.getAnnotation(Transactional.class);
		if (t == null) {
			t = m.getDeclaringClass().getAnnotation(Transactional.class);
		}
		return t != null && t.readOnly();
	}

	@Test
	void scanFindsTheProductionClassesOfThePackage() throws Exception {
		assertThat(clasesDelPaquete()).contains(TurnoService.class, TurnoController.class, DetectorConflictos.class);
	}

	@Test
	void noMethodCombinesAuditedWithReadOnly() throws Exception {
		List<String> violaciones = new ArrayList<>();
		for (Class<?> clase : clasesDelPaquete()) {
			for (Method m : clase.getDeclaredMethods()) {
				if (m.isAnnotationPresent(Audited.class) && readOnly(m)) {
					violaciones.add(clase.getSimpleName() + "." + m.getName());
				}
			}
		}
		assertThat(violaciones).isEmpty();
	}

	@Test
	void turnoServiceWritesAreReadWriteTransactions() {
		List<Method> escrituras = new ArrayList<>();
		for (Method m : TurnoService.class.getDeclaredMethods()) {
			if (ESCRITURAS.contains(m.getName())) {
				escrituras.add(m);
			}
		}

		assertThat(escrituras).hasSize(ESCRITURAS.size()).allSatisfy(m -> {
			assertThat(m.getAnnotation(Transactional.class)).as(m.getName()).isNotNull();
			assertThat(readOnly(m)).as(m.getName()).isFalse();
		});
	}

	@Test
	void onlyTheUnauditedReadsAreReadOnly() {
		List<String> soloLectura = new ArrayList<>();
		for (Method m : TurnoService.class.getDeclaredMethods()) {
			if (readOnly(m)) {
				soloLectura.add(m.getName());
			}
		}
		assertThat(soloLectura).containsExactlyInAnyOrder("listar", "obtener");
	}
}
