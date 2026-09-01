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

const campoEmailPerfil = document.querySelector('[data-identificar-perfil]');
const campoCurso = document.querySelector('#curso');
const campoArea = document.querySelector('#areaAtuacao');
const grupoAluno = document.querySelector('[data-campo-aluno]');
const grupoProfessor = document.querySelector('[data-campo-professor]');
const textoPerfil = document.querySelector('#perfil-identificado');

function atualizarCamposDoPerfil() {
    if (!campoEmailPerfil || !campoCurso || !campoArea) return;
    const email = campoEmailPerfil.value.trim().toLowerCase();
    const dominioAluno = campoEmailPerfil.dataset.dominioAluno;
    const dominioProfessor = campoEmailPerfil.dataset.dominioProfessor;
    const aluno = email.endsWith(`@${dominioAluno}`);
    const professor = email.endsWith(`@${dominioProfessor}`);

    campoCurso.required = aluno;
    campoArea.required = professor;
    if (grupoAluno) grupoAluno.hidden = professor;
    if (grupoProfessor) grupoProfessor.hidden = aluno;

    if (textoPerfil) {
        if (aluno) textoPerfil.textContent = 'Perfil identificado: Aluno';
        else if (professor) textoPerfil.textContent = 'Perfil identificado: Professor';
        else textoPerfil.textContent = `Aluno: @${dominioAluno} · Professor: @${dominioProfessor}`;
    }
}

campoEmailPerfil?.addEventListener('input', atualizarCamposDoPerfil);
atualizarCamposDoPerfil();
