package ar.global.odonto.common.web;

import java.util.List;
import org.springframework.data.domain.Page;

/**
 * Pagina de resultados de la API. Contrato estable en lugar de serializar {@code Page} de Spring Data (design
 * C-05 D2); reutilizable por otros listados paginados.
 */
public record Pagina<T>(List<T> contenido, int pagina, int tamanio, long totalElementos, int totalPaginas) {

	public static <T> Pagina<T> de(Page<T> page) {
		return new Pagina<>(page.getContent(), page.getNumber(), page.getSize(), page.getTotalElements(),
				page.getTotalPages());
	}
}
