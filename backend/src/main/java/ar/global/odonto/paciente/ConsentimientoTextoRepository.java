package ar.global.odonto.paciente;

import java.time.Instant;
import java.util.List;
import java.util.Optional;
import org.springframework.data.repository.Repository;

/** Solo lectura: el catalogo se modifica unicamente con migraciones. */
public interface ConsentimientoTextoRepository extends Repository<ConsentimientoTexto, String> {

	Optional<ConsentimientoTexto> findById(String version);

	List<ConsentimientoTexto> findAll();

	/** Texto vigente en {@code ahora}: el de {@code vigente_desde} mas reciente que no sea futuro (C-08 D10). */
	Optional<ConsentimientoTexto> findFirstByVigenteDesdeLessThanEqualOrderByVigenteDesdeDescVersionDesc(
			Instant ahora);
}
