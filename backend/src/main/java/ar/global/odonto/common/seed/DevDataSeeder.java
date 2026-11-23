package ar.global.odonto.common.seed;

import ar.global.odonto.agenda.PrestacionRepository;
import ar.global.odonto.agenda.PrestacionSugerida;
import ar.global.odonto.agenda.Sillon;
import ar.global.odonto.agenda.SillonRepository;
import ar.global.odonto.common.tenant.TenantContext;
import ar.global.odonto.config.AppProperties;
import ar.global.odonto.consultorio.Consultorio;
import ar.global.odonto.consultorio.ConsultorioRepository;
import ar.global.odonto.usuario.Rol;
import ar.global.odonto.usuario.Usuario;
import ar.global.odonto.usuario.UsuarioRepository;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.boot.ApplicationArguments;
import org.springframework.boot.ApplicationRunner;
import org.springframework.context.annotation.Profile;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Component;
import org.springframework.transaction.support.TransactionTemplate;
import org.springframework.util.StringUtils;

/**
 * Seed de desarrollo (solo perfil {@code dev}): consultorio, sillon, prestaciones sugeridas y un ADMIN.
 * Idempotente (si el email ya existe no hace nada). La contrasena viene de {@code DEV_ADMIN_PASSWORD} y se
 * guarda hasheada; sin ella no crea nada. Los logs no contienen credenciales ni email (regla 5).
 *
 * <p>
 * Uso acotado del modo sistema: buscar el email sin tenant y crear el consultorio; el resto se crea dentro de
 * {@code runAs(consultorioDev)}.
 */
@Component
@Profile("dev")
public class DevDataSeeder implements ApplicationRunner {

	private static final Logger log = LoggerFactory.getLogger(DevDataSeeder.class);

	private final AppProperties.DevAdmin devAdmin;
	private final ConsultorioRepository consultorios;
	private final UsuarioRepository usuarios;
	private final SillonRepository sillones;
	private final PrestacionRepository prestaciones;
	private final PasswordEncoder passwordEncoder;
	private final TransactionTemplate tx;

	public DevDataSeeder(AppProperties properties, ConsultorioRepository consultorios, UsuarioRepository usuarios,
			SillonRepository sillones, PrestacionRepository prestaciones, PasswordEncoder passwordEncoder,
			TransactionTemplate tx) {
		this.devAdmin = properties.devAdmin();
		this.consultorios = consultorios;
		this.usuarios = usuarios;
		this.sillones = sillones;
		this.prestaciones = prestaciones;
		this.passwordEncoder = passwordEncoder;
		this.tx = tx;
	}

	@Override
	public void run(ApplicationArguments args) {
		if (devAdmin == null || !StringUtils.hasText(devAdmin.password())) {
			log.warn("DEV_ADMIN_PASSWORD no esta definida: no se crea el usuario admin de desarrollo.");
			return;
		}
		String email = Usuario.normalizeEmail(devAdmin.email());
		boolean exists = TenantContext.runAsSystem(() -> usuarios.findByEmail(email).isPresent());
		if (exists) {
			log.info("Seed de desarrollo ya aplicado: no se crea nada.");
			return;
		}
		Long consultorioId = TenantContext.runAsSystem(
				() -> consultorios.save(new Consultorio("Consultorio de desarrollo")).getId());
		TenantContext.runAs(consultorioId, () -> tx.execute(status -> {
			usuarios.save(new Usuario(email, passwordEncoder.encode(devAdmin.password()), "Admin de desarrollo",
					Rol.ADMIN));
			sillones.save(new Sillon("Sillón 1"));
			PrestacionSugerida.CATALOGO.forEach(p -> prestaciones.save(p.toPrestacion()));
			return null;
		}));
		log.info("Seed de desarrollo creado para el consultorio id={}", consultorioId);
	}
}
