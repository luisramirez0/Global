package ar.global.odonto.recordatorio;

import ar.global.odonto.agenda.EstadoTurno;
import ar.global.odonto.agenda.Turno;
import java.time.Instant;
import java.util.Collection;
import java.util.List;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

public interface RecordatorioRepository extends JpaRepository<Recordatorio, Long> {

	/**
	 * Turnos del rango {@code [desde, hasta)} en alguno de los {@code estados} que no tienen un recordatorio
	 * {@code GENERADO} ni {@code ENVIADO} (design D10). Un turno con solo recordatorios {@code ERROR} sigue pendiente.
	 * Paciente y profesional vienen en la misma consulta (sin N+1, accesibles con la transaccion cerrada).
	 */
	@Query("""
			select t from Turno t
			join fetch t.paciente
			join fetch t.profesional
			where t.estado in :estados
			  and t.inicio >= :desde and t.inicio < :hasta
			  and not exists (
			      select r.id from Recordatorio r
			      where r.turno = t
			        and r.estado in (ar.global.odonto.recordatorio.EstadoRecordatorio.GENERADO,
			                         ar.global.odonto.recordatorio.EstadoRecordatorio.ENVIADO))
			order by t.inicio, t.id
			""")
	List<Turno> buscarPendientes(@Param("estados") Collection<EstadoTurno> estados, @Param("desde") Instant desde,
			@Param("hasta") Instant hasta);

	/**
	 * Recordatorios de los turnos indicados, el mas reciente primero ({@code generadoEn desc, id desc}): el servicio
	 * elige el ultimo de cada turno en memoria (design D10). Los turnos sin recordatorio no aparecen.
	 */
	@Query("""
			select r from Recordatorio r
			join fetch r.turno
			where r.turno.id in :turnoIds
			order by r.generadoEn desc, r.id desc
			""")
	List<Recordatorio> buscarPorTurnos(@Param("turnoIds") Collection<Long> turnoIds);
}
