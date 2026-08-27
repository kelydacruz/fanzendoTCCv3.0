const botaoMenu = document.querySelector('.menu-botao');
const menu = document.querySelector('.menu');

function fecharMenu() {
    if (!menu || !botaoMenu) return;
    menu.classList.remove('aberto');
    botaoMenu.setAttribute('aria-expanded', 'false');
}

botaoMenu?.addEventListener('click', () => {
    const menuAberto = menu.classList.toggle('aberto');
    botaoMenu.setAttribute('aria-expanded', String(menuAberto));
});

menu?.querySelectorAll('a').forEach((link) => link.addEventListener('click', fecharMenu));

document.addEventListener('keydown', (evento) => {
    if (evento.key === 'Escape') fecharMenu();
});

document.querySelectorAll('form[data-confirm]').forEach((formulario) => {
    formulario.addEventListener('submit', (evento) => {
        const mensagem = formulario.dataset.confirm || 'Deseja continuar?';
        if (!window.confirm(mensagem)) evento.preventDefault();
    });
});

document.querySelectorAll('.copiar-link').forEach((botao) => {
    botao.addEventListener('click', async () => {
        const textoOriginal = botao.textContent;

        try {
            await navigator.clipboard.writeText(window.location.href);
            botao.textContent = 'Link copiado!';
        } catch {
            botao.textContent = 'Copie o endereço do navegador';
        }

        window.setTimeout(() => {
            botao.textContent = textoOriginal;
        }, 2000);
    });
});

const campoPerfil = document.querySelector('#perfil');
const campoCurso = document.querySelector('#curso');
const campoArea = document.querySelector('#areaAtuacao');

function atualizarCamposDoPerfil() {
    if (!campoPerfil || !campoCurso || !campoArea) return;
    campoCurso.required = campoPerfil.value === 'aluno';
    campoArea.required = campoPerfil.value === 'professor';
}

campoPerfil?.addEventListener('change', atualizarCamposDoPerfil);
atualizarCamposDoPerfil();
