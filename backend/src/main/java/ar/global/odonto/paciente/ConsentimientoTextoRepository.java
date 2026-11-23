package ar.global.odonto.paciente;

import java.util.List;
import java.util.Optional;
import org.springframework.data.repository.Repository;

/** Solo lectura: el catalogo se modifica unicamente con migraciones. */
public interface ConsentimientoTextoRepository extends Repository<ConsentimientoTexto, String> {

	Optional<ConsentimientoTexto> findById(String version);

	List<ConsentimientoTexto> findAll();
}
