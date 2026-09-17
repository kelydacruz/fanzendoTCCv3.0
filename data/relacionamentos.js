import {
    usuarios,
    tccs,
    ideias,
    cursos,
    turmas,
} from './mock.js';

// Monta os relacionamentos dos exemplos locais, como o populate faz no MongoDB.
// Não copiamos senha nem credenciais quando os dados do autor são enviados para as telas.
export function usuarioPublico(usuario) {
    if (!usuario) return null;
    return {
        id: String(usuario.id || usuario._id),
        nome: usuario.nome,
        email: usuario.email,
        perfil: usuario.perfil,
        curso: usuario.curso || '',
        areaAtuacao: usuario.areaAtuacao || '',
        ativo: usuario.ativo !== false,
        emailVerificado: usuario.emailVerificado === true,
    };
}

export function autorDemo(autorId) {
    return usuarioPublico(usuarios.find((usuario) => usuario.id === autorId));
}

export function preencherPublicacaoDemo(publicacao) {
    return {
        ...publicacao,
        autor: autorDemo(publicacao.autorId),
        orientadorUsuario: autorDemo(publicacao.orientadorId),
        reservadaPor: autorDemo(publicacao.reservadaPorId),
        interessados: (publicacao.interessadosIds || []).map(autorDemo).filter(Boolean),
        tccRelacionado: tccs.find((tcc) => tcc.id === publicacao.tccRelacionadoId) || null,
        ideiaOrigem: ideias.find((ideia) => ideia.id === publicacao.ideiaOrigemId) || null,
        cursoCadastro: cursos.find((curso) => curso.id === publicacao.cursoCadastroId) || null,
        turmaCadastro: publicacao.turmaCadastroId
            ? preencherTurmaDemo(turmas.find((turma) => turma.id === publicacao.turmaCadastroId))
            : null,
    };
}

export function preencherConversaDemo(conversa) {
    const ideia = ideias.find((item) => item.id === conversa.ideiaId);
    return {
        ...conversa,
        ideia: ideia ? preencherPublicacaoDemo(ideia) : null,
        aluno: autorDemo(conversa.alunoId),
        autorIdeia: autorDemo(conversa.autorIdeiaId),
    };
}

export function usuarioInstitucional(usuario) {
    return ['aluno', 'professor', 'admin'].includes(usuario?.perfil);
}

export function preencherTurmaDemo(turma) {
    if (!turma) return null;
    const curso = cursos.find((item) => item.id === turma.cursoId) || null;
    return { ...turma, curso };
}
