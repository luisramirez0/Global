package ar.global.odonto.common.web;

import static org.assertj.core.api.Assertions.assertThat;

import java.util.List;
import org.junit.jupiter.api.Test;
import org.springframework.data.domain.PageImpl;
import org.springframework.data.domain.PageRequest;

/** DTO de pagina estable para la API (design D2): no se serializa {@code Page} de Spring Data. */
class PaginaTest {

	@Test
	void copiesContentAndPagingMetadata() {
		var page = new PageImpl<>(List.of("c", "d"), PageRequest.of(1, 2), 5);

		Pagina<String> pagina = Pagina.de(page);

		assertThat(pagina.contenido()).containsExactly("c", "d");
		assertThat(pagina.pagina()).isEqualTo(1);
		assertThat(pagina.tamanio()).isEqualTo(2);
		assertThat(pagina.totalElementos()).isEqualTo(5);
		assertThat(pagina.totalPaginas()).isEqualTo(3);
	}

	@Test
	void emptyPage() {
		Pagina<String> pagina = Pagina.de(new PageImpl<>(List.of(), PageRequest.of(0, 20), 0));

		assertThat(pagina.contenido()).isEmpty();
		assertThat(pagina.totalElementos()).isZero();
		assertThat(pagina.totalPaginas()).isZero();
	}
}
