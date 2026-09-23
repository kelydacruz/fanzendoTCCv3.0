// Executado no head para aplicar a preferência antes de desenhar a página.
(() => {
    const chave = 'acervotcc-tema';
    const pagina = document.documentElement;
    const sistema = window.matchMedia('(prefers-color-scheme: dark)');
    let preferencia = null;

    function temaValido(valor) {
        return valor === 'claro' || valor === 'escuro';
    }

    function atualizarBotao() {
        const botao = document.querySelector('[data-alternar-tema]');
        if (!botao) return;
        const escuro = pagina.dataset.tema === 'escuro';
        botao.hidden = false;
        botao.setAttribute('aria-pressed', String(escuro));
        botao.title = escuro ? 'Ativar tema claro' : 'Ativar tema escuro';
    }

    function aplicarTema() {
        const tema = preferencia || (sistema.matches ? 'escuro' : 'claro');
        pagina.dataset.tema = tema;
        document.querySelector('meta[name="theme-color"]')?.setAttribute(
            'content', tema === 'escuro' ? '#101c17' : '#f6fbf9',
        );
        atualizarBotao();
    }

    // Alguns navegadores bloqueiam o armazenamento; a troca continua funcionando.
    try {
        const salva = localStorage.getItem(chave);
        if (temaValido(salva)) preferencia = salva;
    } catch { /* Sem armazenamento, usamos a preferência do dispositivo. */ }
    aplicarTema();

    document.addEventListener('DOMContentLoaded', () => {
        atualizarBotao();
        document.querySelector('[data-alternar-tema]')?.addEventListener('click', () => {
            preferencia = pagina.dataset.tema === 'escuro' ? 'claro' : 'escuro';
            aplicarTema();
            try { localStorage.setItem(chave, preferencia); } catch { /* A escolha vale nesta página. */ }
        });
    });

    sistema.addEventListener('change', () => {
        if (!preferencia) aplicarTema();
    });
    window.addEventListener('storage', (evento) => {
        if (evento.key !== chave && evento.key !== null) return;
        preferencia = temaValido(evento.newValue) ? evento.newValue : null;
        aplicarTema();
    });
})();
