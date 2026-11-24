package ar.global.odonto.auditoria;

import ar.global.odonto.agenda.Sillon;
import ar.global.odonto.agenda.SillonRepository;
import ar.global.odonto.common.web.RecursoNoEncontradoException;
import ar.global.odonto.security.Permisos;
import java.util.concurrent.atomic.AtomicReference;
import org.springframework.boot.test.context.TestComponent;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.transaction.support.TransactionSynchronizationManager;

/**
 * Bean SOLO de tests con metodos {@code @Audited} que escriben/leen un {@code Sillon} (dato de negocio real,
 * sin mocks). {@code datoClinicoFicticio} devuelve un dato "clinico" ficticio para probar que no sale si falla la
 * auditoria.
 */
@TestComponent
public class AuditedProbeService {

	public record SillonCreado(Long id, String nombre) {
	}

	/** Estado {@code readOnly} de la transaccion visto dentro de un metodo {@code @Transactional(readOnly=true)}. */
	private final AtomicReference<Boolean> readOnlyVisto = new AtomicReference<>();

	private final SillonRepository sillones;

	public AuditedProbeService(SillonRepository sillones) {
		this.sillones = sillones;
	}

	/** Accesor (no campo publico): el bean esta proxeado y un campo del proxy no se inicializa. */
	public Boolean readOnlyVisto() {
		return readOnlyVisto.get();
	}

	public void resetReadOnlyVisto() {
		readOnlyVisto.set(null);
	}

	@Audited(accion = AccionAuditoria.CREATE, entidad = "Sillon", entidadId = "#result.id()")
	public SillonCreado crear(String nombre) {
		Sillon s = sillones.save(new Sillon(nombre));
		return new SillonCreado(s.getId(), s.getNombre());
	}

	/** Mal uso a proposito: el id evaluado es un String. */
	@Audited(accion = AccionAuditoria.CREATE, entidad = "Sillon", entidadId = "#result.nombre()")
	public SillonCreado crearConIdString(String nombre) {
		Sillon s = sillones.save(new Sillon(nombre));
		return new SillonCreado(s.getId(), s.getNombre());
	}

	@Audited(accion = AccionAuditoria.READ, entidad = "Sillon", entidadId = "#id")
	@Transactional(readOnly = true)
	public String leer(Long id) {
		readOnlyVisto.set(TransactionSynchronizationManager.isCurrentTransactionReadOnly());
		return sillones.findById(id).orElseThrow(RecursoNoEncontradoException::new).getNombre();
	}

	@Audited(accion = AccionAuditoria.READ, entidad = "Sillon", entidadId = "#id")
	public String leerInexistente(Long id) {
		throw new RecursoNoEncontradoException();
	}

	@Audited(accion = AccionAuditoria.CREATE, entidad = "Sillon", entidadId = "#result.id()")
	@PreAuthorize(Permisos.GESTION)
	public SillonCreado crearSoloGestion(String nombre) {
		Sillon s = sillones.save(new Sillon(nombre));
		return new SillonCreado(s.getId(), s.getNombre());
	}

	@Audited(accion = AccionAuditoria.READ, entidad = "FichaClinica", entidadId = "#id")
	public String datoClinicoFicticio(Long id) {
		return "DATO-CLINICO-FICTICIO";
	}
}
