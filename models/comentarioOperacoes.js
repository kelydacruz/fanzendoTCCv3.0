import Tcc from './tcc.js';
import Ideia from './ideia.js';
import Comentario from './comentario.js';
import { comentarios, novoId } from '../data/mock.js';
import { usandoMongo, idValido } from '../config/banco.js';
import { autorDemo } from '../data/relacionamentos.js';

// Funções de comentarios: cada consulta usa MongoDB ou os dados locais de demonstração.
export async function listarComentarios(alvoTipo, alvoId) {
    if (usandoMongo()) {
        const tipoModel = alvoTipo === 'tcc' ? 'Tcc' : 'Ideia';
        if (!idValido(alvoId)) return [];
        return Comentario.find({ alvoTipo: tipoModel, alvo: alvoId })
            .populate('autor', 'nome perfil')
            .sort({ createdAt: 1 })
            .lean();
    }

    return comentarios
        .filter((comentario) => comentario.alvoTipo === alvoTipo && comentario.alvoId === String(alvoId))
        .map((comentario) => ({ ...comentario, autor: autorDemo(comentario.autorId) }));
}

export async function cadastrarComentario({ texto, autor, alvoTipo, alvoId }) {
    if (usandoMongo()) {
        return Comentario.create({
            texto,
            autor,
            alvoTipo: alvoTipo === 'tcc' ? 'Tcc' : 'Ideia',
            alvo: alvoId,
        });
    }
    const comentario = {
        id: novoId(),
        texto,
        autorId: String(autor),
        alvoTipo,
        alvoId: String(alvoId),
        createdAt: new Date(),
    };
    comentarios.push(comentario);
    return comentario;
}
