package ar.global.odonto.consultorio.registro;

import ar.global.odonto.agenda.Profesional;
import ar.global.odonto.agenda.ProfesionalRepository;
import ar.global.odonto.agenda.Sillon;
import ar.global.odonto.agenda.SillonRepository;
import ar.global.odonto.common.tenant.TenantContext;
import ar.global.odonto.consultorio.Consultorio;
import ar.global.odonto.consultorio.ConsultorioRepository;
import ar.global.odonto.usuario.Rol;
import ar.global.odonto.usuario.Usuario;
import ar.global.odonto.usuario.UsuarioRepository;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.dao.DataIntegrityViolationException;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.support.TransactionTemplate;

/**
 * ZONA DE RIESGO (regla 12). Alta de consultorio + usuario ADMIN + profesional + sillon por defecto (design
 * D5).
 *
 * <p>
 * El tenant se resuelve al abrir la sesion (contrato C-02), asi que el consultorio (modo sistema) y sus
 * dependientes ({@code runAs(nuevoId)}) van en dos transacciones; si la segunda falla, se borra el consultorio
 * (compensacion). Usos de {@code runAsSystem}: verificar el email y crear/borrar el consultorio.
 */
@Service
public class RegistroService {

	static final String SILLON_POR_DEFECTO = "Sillón 1";

	private static final Logger log = LoggerFactory.getLogger(RegistroService.class);

	private final ConsultorioRepository consultorios;
	private final UsuarioRepository usuarios;
	private final ProfesionalRepository profesionales;
	private final SillonRepository sillones;
	private final PasswordEncoder passwordEncoder;
	private final TransactionTemplate tx;

	public RegistroService(ConsultorioRepository consultorios, UsuarioRepository usuarios,
			ProfesionalRepository profesionales, SillonRepository sillones, PasswordEncoder passwordEncoder,
			TransactionTemplate tx) {
		this.consultorios = consultorios;
		this.usuarios = usuarios;
		this.profesionales = profesionales;
		this.sillones = sillones;
		this.passwordEncoder = passwordEncoder;
		this.tx = tx;
	}

	public RegistroResponse registrar(RegistroRequest req) {
		String email = Usuario.normalizeEmail(req.email());
		if (emailRegistrado(email)) {
			throw new EmailYaRegistradoException();
		}
		// Hash fuera de las transacciones: BCrypt(12) es lento y no debe retener conexiones.
		String hash = passwordEncoder.encode(req.password());

		Long consultorioId = TenantContext.runAsSystem(
				() -> tx.execute(s -> consultorios.save(new Consultorio(req.consultorioNombre().trim())).getId()));
		try {
			Long usuarioId = TenantContext.runAs(consultorioId, () -> tx.execute(s -> {
				Usuario usuario = usuarios.save(new Usuario(email, hash, req.nombre().trim(), Rol.ADMIN));
				Profesional profesional = new Profesional(req.nombre().trim(), req.apellido().trim());
				profesional.setUsuario(usuario);
				profesional.setMatricula(blankToNull(req.matricula()));
				profesionales.save(profesional);
				sillones.save(new Sillon(SILLON_POR_DEFECTO));
				return usuario.getId();
			}));
			log.info("Consultorio registrado id={} usuarioId={}", consultorioId, usuarioId);
			return new RegistroResponse(consultorioId, usuarioId);
		}
		catch (RuntimeException ex) {
			compensar(consultorioId);
			// Carrera: otro registro con el mismo email gano entre la verificacion y el insert (UNIQUE de la base).
			if (ex instanceof DataIntegrityViolationException && emailRegistrado(email)) {
				throw new EmailYaRegistradoException();
			}
			throw ex;
		}
	}

	private boolean emailRegistrado(String email) {
		return TenantContext.runAsSystem(() -> usuarios.findByEmail(email).isPresent());
	}

	private void compensar(Long consultorioId) {
		try {
			TenantContext.runAsSystem(() -> tx.execute(s -> {
				consultorios.findById(consultorioId).ifPresent(consultorios::delete);
				return null;
			}));
			log.warn("Registro fallido: se revirtio el consultorio id={}", consultorioId);
		}
		catch (RuntimeException compensationFailure) {
			log.error("Registro fallido y compensacion fallida: queda el consultorio id={} sin usuario ({})",
					consultorioId, compensationFailure.getClass().getName());
		}
	}

	private static String blankToNull(String value) {
		return value == null || value.isBlank() ? null : value.trim();
	}
}
