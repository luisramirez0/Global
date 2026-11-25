package ar.global.odonto.recordatorio.email;

import java.util.ArrayList;
import java.util.Collections;
import java.util.List;
import org.springframework.boot.test.context.TestComponent;
import org.springframework.context.annotation.Primary;
import org.springframework.transaction.support.TransactionSynchronizationManager;

/**
 * Fake programable del puerto {@link EnvioEmail} para los tests de integracion (C-09 design D5): reemplaza al
 * adaptador SMTP, asi ningun test abre una conexion. Registra cada envio y si habia una transaccion activa.
 */
@TestComponent
@Primary
public class FakeEnvioEmail implements EnvioEmail {

	public record Envio(String destinatario, String asunto, String texto, boolean transaccionActiva) {
	}

	private final List<Envio> envios = Collections.synchronizedList(new ArrayList<>());
	private volatile RuntimeException falla;
	private volatile Runnable alEnviar;

	public void reset() {
		envios.clear();
		falla = null;
		alEnviar = null;
	}

	/** El proximo envio (y los siguientes) lanzan {@code e}; el envio queda registrado. */
	public void fallaCon(RuntimeException e) {
		this.falla = e;
	}

	/** Efecto ejecutado dentro del envio (p. ej. avanzar el reloj o cancelar el turno). */
	public void alEnviar(Runnable accion) {
		this.alEnviar = accion;
	}

	public List<Envio> envios() {
		return List.copyOf(envios);
	}

	@Override
	public void enviar(String destinatario, String asunto, String texto) {
		envios.add(new Envio(destinatario, asunto, texto, TransactionSynchronizationManager.isActualTransactionActive()));
		if (alEnviar != null) {
			alEnviar.run();
		}
		if (falla != null) {
			throw falla;
		}
	}
}
