import { normalizarTexto } from './texto.js';

const DOMINIO_ALUNO_PADRAO = 'academico.ifsul.edu.br';
const DOMINIO_PROFESSOR_PADRAO = 'ifsul.edu.br';

export function emailNormalizado(email) {
    return normalizarTexto(email).replace(/\s/g, '');
}

export function perfilPeloEmail(email) {
    const normalizado = emailNormalizado(email);
    const emailAdmin = emailNormalizado(process.env.ADMIN_EMAIL || '');

    if (emailAdmin && normalizado === emailAdmin) return 'admin';

    const partes = normalizado.split('@');
    if (partes.length !== 2 || !partes[0] || !partes[1]) return null;

    const dominio = partes[1];
    const dominioAluno = normalizarTexto(
        process.env.DOMINIO_ALUNO || DOMINIO_ALUNO_PADRAO,
    );
    const dominioProfessor = normalizarTexto(
        process.env.DOMINIO_PROFESSOR || DOMINIO_PROFESSOR_PADRAO,
    );

    if (dominio === dominioAluno) return 'aluno';
    if (dominio === dominioProfessor) return 'professor';
    return 'colaborador';
}

export function descricaoPerfil(perfil) {
    const nomes = {
        aluno: 'Aluno',
        professor: 'Professor',
        colaborador: 'Colaborador externo',
        admin: 'Administrador',
    };
    return nomes[perfil] || 'Usuário';
}
