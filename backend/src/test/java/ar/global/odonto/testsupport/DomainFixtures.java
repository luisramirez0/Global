package ar.global.odonto.testsupport;

import ar.global.odonto.agenda.BloqueoAgenda;
import ar.global.odonto.agenda.BloqueoAgendaRepository;
import ar.global.odonto.agenda.HorarioAtencion;
import ar.global.odonto.agenda.HorarioAtencionRepository;
import ar.global.odonto.agenda.Prestacion;
import ar.global.odonto.agenda.PrestacionRepository;
import ar.global.odonto.agenda.Profesional;
import ar.global.odonto.agenda.ProfesionalRepository;
import ar.global.odonto.agenda.Sillon;
import ar.global.odonto.agenda.SillonRepository;
import ar.global.odonto.agenda.Turno;
import ar.global.odonto.agenda.TurnoRepository;
import ar.global.odonto.auditoria.AccionAuditoria;
import ar.global.odonto.auditoria.AuditLog;
import ar.global.odonto.auditoria.AuditLogRepository;
import ar.global.odonto.paciente.ConsentimientoDatos;
import ar.global.odonto.paciente.ConsentimientoDatosRepository;
import ar.global.odonto.paciente.FichaClinica;
import ar.global.odonto.paciente.FichaClinicaRepository;
import ar.global.odonto.paciente.NotaClinica;
import ar.global.odonto.paciente.NotaClinicaRepository;
import ar.global.odonto.paciente.Paciente;
import ar.global.odonto.paciente.PacienteRepository;
import ar.global.odonto.recordatorio.CanalRecordatorio;
import ar.global.odonto.recordatorio.EstadoRecordatorio;
import ar.global.odonto.recordatorio.Recordatorio;
import ar.global.odonto.recordatorio.RecordatorioRepository;
import ar.global.odonto.usuario.Rol;
import ar.global.odonto.usuario.Usuario;
import ar.global.odonto.usuario.UsuarioRepository;
import java.time.Instant;
import java.time.LocalTime;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.TestComponent;

/** Crea un grafo completo de datos de negocio dentro de un tenant (para tests de aislamiento y FK). */
@TestComponent
public class DomainFixtures {

	/** Un registro de cada entidad de negocio de un consultorio. */
	public record Graph(Usuario usuario, Profesional profesional, Sillon sillon, Prestacion prestacion,
			HorarioAtencion horario, BloqueoAgenda bloqueo, Paciente paciente, FichaClinica ficha, NotaClinica nota,
			ConsentimientoDatos consentimiento, Turno turno, Recordatorio recordatorio, AuditLog audit) {
	}

	@Autowired
	private TenantFixtures fixtures;

	@Autowired
	private UsuarioRepository usuarios;

	@Autowired
	private ProfesionalRepository profesionales;

	@Autowired
	private SillonRepository sillones;

	@Autowired
	private PrestacionRepository prestaciones;

	@Autowired
	private HorarioAtencionRepository horarios;

	@Autowired
	private BloqueoAgendaRepository bloqueos;

	@Autowired
	private PacienteRepository pacientes;

	@Autowired
	private FichaClinicaRepository fichas;

	@Autowired
	private NotaClinicaRepository notas;

	@Autowired
	private ConsentimientoDatosRepository consentimientos;

	@Autowired
	private TurnoRepository turnos;

	@Autowired
	private RecordatorioRepository recordatorios;

	@Autowired
	private AuditLogRepository auditLogs;

	/** Guarda un registro de cada entidad en el consultorio indicado; {@code tag} evita colisiones de unicos. */
	public Graph seed(Long consultorioId, String tag) {
		return fixtures.inTenant(consultorioId, () -> {
			Usuario usuario = usuarios.save(new Usuario("user-" + tag + "@x.test", "hash", "Usuario " + tag,
					Rol.ADMIN));
			Profesional profesional = new Profesional("Prof", "Apellido " + tag);
			profesional.setUsuario(usuario);
			profesional = profesionales.save(profesional);
			Sillon sillon = sillones.save(new Sillon("Sillon " + tag));
			Prestacion prestacion = prestaciones.save(new Prestacion("Consulta " + tag, 30));
			HorarioAtencion horario = horarios
					.save(new HorarioAtencion(profesional, 1, LocalTime.of(9, 0), LocalTime.of(13, 0)));
			BloqueoAgenda bloqueo = new BloqueoAgenda(Instant.parse("2026-12-01T12:00:00Z"),
					Instant.parse("2026-12-01T13:00:00Z"));
			bloqueo.setSillon(sillon);
			bloqueo = bloqueos.save(bloqueo);
			Paciente paciente = pacientes.save(new Paciente("Pac", "Apellido " + tag, "DNI-" + tag));
			FichaClinica ficha = fichas.save(new FichaClinica(paciente));
			Turno turno = turnos.save(new Turno(paciente, profesional, sillon, prestacion,
					Instant.parse("2026-12-02T12:00:00Z"), Instant.parse("2026-12-02T12:30:00Z")));
			NotaClinica nota = new NotaClinica(paciente, profesional, Instant.parse("2026-12-02T12:40:00Z"), "nota");
			nota.setTurno(turno);
			nota = notas.save(nota);
			ConsentimientoDatos consentimiento = consentimientos.save(new ConsentimientoDatos(paciente, "v1",
					Instant.parse("2026-12-02T11:00:00Z"), usuario));
			Recordatorio recordatorio = recordatorios.save(new Recordatorio(turno, CanalRecordatorio.WHATSAPP_LINK,
					Instant.parse("2026-12-01T12:00:00Z"), EstadoRecordatorio.GENERADO));
			AuditLog audit = auditLogs.save(new AuditLog(usuario.getId(), AccionAuditoria.READ, "FichaClinica",
					ficha.getId(), null, null));
			return new Graph(usuario, profesional, sillon, prestacion, horario, bloqueo, paciente, ficha, nota,
					consentimiento, turno, recordatorio, audit);
		});
	}
}
