import Usuario from '../models/usuario.js';
import Tcc from '../models/tcc.js';
import Ideia from '../models/ideia.js';
import Comentario from '../models/comentario.js';
import Curso from '../models/curso.js';
import Turma from '../models/turma.js';
import AreaAtuacao from '../models/areaAtuacao.js';
import {
    usuarios,
    tccs,
    ideias,
    comentarios,
    cursos,
    areasAtuacao,
    turmas,
} from '../data/mock.js';
import { usandoMongo } from './banco.js';

// Funções de resumos: cada consulta usa MongoDB ou os dados locais de demonstração.
export async function resumoDoPainel(usuarioId) {
    if (usandoMongo()) {
        // As contagens são independentes, então Promise.all consulta todas ao mesmo tempo.
        const [totalTccs, totalIdeias, totalComentarios] = await Promise.all([
            Tcc.countDocuments({ autor: usuarioId }),
            Ideia.countDocuments({ autor: usuarioId }),
            Comentario.countDocuments({ autor: usuarioId }),
        ]);
        return { totalTccs, totalIdeias, totalComentarios };
    }

    return {
        totalTccs: tccs.filter((tcc) => tcc.autorId === String(usuarioId)).length,
        totalIdeias: ideias.filter((ideia) => ideia.autorId === String(usuarioId)).length,
        totalComentarios: comentarios.filter((comentario) => comentario.autorId === String(usuarioId)).length,
    };
}

export async function resumoAdministrativo() {
    if (usandoMongo()) {
        const [totalUsuarios, totalAlunos, totalProfessores, tccsPendentes, totalCursos, totalTurmas, totalIdeias, totalAreas] = await Promise.all([
            Usuario.countDocuments({ removido: { $ne: true } }),
            Usuario.countDocuments({ perfil: 'aluno', removido: { $ne: true } }),
            Usuario.countDocuments({ perfil: 'professor', removido: { $ne: true } }),
            Tcc.countDocuments({ status: { $in: ['em_analise', 'correcao_solicitada'] } }),
            Curso.countDocuments(),
            Turma.countDocuments(),
            Ideia.countDocuments(),
            AreaAtuacao.countDocuments(),
        ]);
        return { totalUsuarios, totalAlunos, totalProfessores, tccsPendentes, totalCursos, totalTurmas, totalIdeias, totalAreas };
    }
    return {
        totalUsuarios: usuarios.filter((usuario) => !usuario.removido).length,
        totalAlunos: usuarios.filter((usuario) => !usuario.removido && usuario.perfil === 'aluno').length,
        totalProfessores: usuarios.filter((usuario) => !usuario.removido && usuario.perfil === 'professor').length,
        tccsPendentes: tccs.filter((tcc) => ['em_analise', 'correcao_solicitada'].includes(tcc.status)).length,
        totalCursos: cursos.length,
        totalTurmas: turmas.length,
        totalAreas: areasAtuacao.length,
        totalIdeias: ideias.length,
    };
}

// Mantém a autoria e impede que a conta removida volte a acessar o sistema.
