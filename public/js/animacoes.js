// Anima somente quando o conteúdo entra na tela. Sem JavaScript, tudo fica visível.
function iniciarAnimacoes() {
    const preferencia = window.matchMedia('(prefers-reduced-motion: reduce)');
    if (preferencia.matches || !('IntersectionObserver' in window)) return;

    const elementos = document.querySelectorAll('[data-animar], .topo-pagina > .container, .hero-grid > div, .hero-publico-grid > div, .sobre-abertura > div, .titulo-secao, .cabecalho-secao, .curso-card, .sobre-titulo, .sobre-etapas li');
    const observador = new IntersectionObserver((entradas) => {
        entradas.forEach((entrada) => {
            if (!entrada.isIntersecting) return;
            if (!preferencia.matches) entrada.target.classList.add('animar-entrada');
            observador.unobserve(entrada.target);
        });
    }, { threshold: 0.08 });

    elementos.forEach((elemento) => observador.observe(elemento));

    preferencia.addEventListener('change', () => {
        if (!preferencia.matches) return;
        observador.disconnect();
        elementos.forEach((elemento) => elemento.classList.remove('animar-entrada'));
    });
}

iniciarAnimacoes();
