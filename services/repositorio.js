import { mongoose } from '../config/conexao.js';
import Usuario from '../models/usuario.js';
import Tcc from '../models/tcc.js';
import Ideia from '../models/ideia.js';
import Comentario from '../models/comentario.js';
import {
    usuarios,
    tccs,
    ideias,
    comentarios,
    novoId,
} from '../data/mock.js';
import { normalizarTexto, escaparRegex } from './texto.js';

const usandoMongo = () => mongoose.connection.readyState === 1;
const idValido = (id) => mongoose.Types.ObjectId.isValid(id);

function usuarioPublico(usuario) {
    if (!usuario) return null;
    return {
        id: String(usuario.id || usuario._id),
        nome: usuario.nome,
        email: usuario.email,
        perfil: usuario.perfil,
        curso: usuario.curso || '',
        areaAtuacao: usuario.areaAtuacao || '',
    };
}

function autorDemo(autorId) {
    return usuarioPublico(usuarios.find((usuario) => usuario.id === autorId));
}

function preencherPublicacaoDemo(publicacao) {
    return { ...publicacao, autor: autorDemo(publicacao.autorId) };
}

export async function buscarUsuarioPorEmail(email) {
    if (usandoMongo()) return Usuario.findOne({ email: normalizarTexto(email) });
    return usuarios.find((usuario) => usuario.email === normalizarTexto(email)) || null;
}

export async function buscarUsuarioPorId(id) {
    if (usandoMongo()) {
        if (!idValido(id)) return null;
        return Usuario.findById(id);
    }
    return usuarios.find((usuario) => usuario.id === String(id)) || null;
}

export async function cadastrarUsuario(dados) {
    if (usandoMongo()) return Usuario.create(dados);
    const usuario = { id: novoId(), ...dados };
    usuarios.push(usuario);
    return usuario;
}

export async function listarTccs({ q = '', tema = '', ano = '' } = {}) {
    if (usandoMongo()) {
        const filtros = {};
        if (q) {
            const termo = new RegExp(escaparRegex(q), 'i');
            filtros.$or = [
                { titulo: termo },
                { tema: termo },
                { resumo: termo },
                { orientador: termo },
                { palavrasChave: termo },
            ];
        }
        if (tema) filtros.tema = new RegExp(escaparRegex(tema), 'i');
        if (ano) filtros.ano = Number(ano);

        return Tcc.find(filtros).populate('autor', 'nome perfil curso').sort({ createdAt: -1 }).lean();
    }

    const termo = normalizarTexto(q);
    return tccs
        .filter((tcc) => {
            const texto = normalizarTexto([
                tcc.titulo,
                tcc.tema,
                tcc.resumo,
                tcc.orientador,
                ...tcc.palavrasChave,
            ].join(' '));
            return (!termo || texto.includes(termo))
                && (!tema || normalizarTexto(tcc.tema).includes(normalizarTexto(tema)))
                && (!ano || String(tcc.ano) === String(ano));
        })
        .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt))
        .map(preencherPublicacaoDemo);
}

export async function buscarTccPorId(id) {
    if (usandoMongo()) {
        if (!idValido(id)) return null;
        return Tcc.findById(id).populate('autor', 'nome perfil curso').lean();
    }
    const tcc = tccs.find((item) => item.id === String(id));
    return tcc ? preencherPublicacaoDemo(tcc) : null;
}

export async function cadastrarTcc(dados) {
    if (usandoMongo()) return Tcc.create(dados);
    const tcc = { id: novoId(), createdAt: new Date(), ...dados, autorId: String(dados.autor) };
    delete tcc.autor;
    tccs.push(tcc);
    return preencherPublicacaoDemo(tcc);
}

export async function atualizarTcc(id, dados) {
    if (usandoMongo()) return Tcc.findByIdAndUpdate(id, dados, { new: true, runValidators: true });
    const indice = tccs.findIndex((item) => item.id === String(id));
    if (indice < 0) return null;
    tccs[indice] = { ...tccs[indice], ...dados };
    return preencherPublicacaoDemo(tccs[indice]);
}

export async function excluirTcc(id) {
    if (usandoMongo()) {
        await Promise.all([
            Tcc.findByIdAndDelete(id),
            Comentario.deleteMany({ alvoTipo: 'Tcc', alvo: id }),
        ]);
        return;
    }
    const indice = tccs.findIndex((item) => item.id === String(id));
    if (indice >= 0) tccs.splice(indice, 1);
    for (let i = comentarios.length - 1; i >= 0; i -= 1) {
        if (comentarios[i].alvoTipo === 'tcc' && comentarios[i].alvoId === String(id)) comentarios.splice(i, 1);
    }
}

export async function obterPdfTcc(id) {
    if (usandoMongo()) {
        if (!idValido(id)) return null;
        const tcc = await Tcc.findById(id).select('+pdf.dados').lean();
        return tcc?.pdf?.dados ? tcc.pdf : null;
    }
    return tccs.find((item) => item.id === String(id))?.pdf || null;
}

export async function listarIdeias({ q = '', curso = '', status = '' } = {}) {
    if (usandoMongo()) {
        const filtros = {};
        if (q) {
            const termo = new RegExp(escaparRegex(q), 'i');
            filtros.$or = [{ titulo: termo }, { tema: termo }, { descricao: termo }];
        }
        if (curso) filtros.curso = curso;
        if (status) filtros.status = status;
        return Ideia.find(filtros).populate('autor', 'nome perfil curso areaAtuacao').sort({ createdAt: -1 }).lean();
    }

    const termo = normalizarTexto(q);
    return ideias
        .filter((ideia) => {
            const texto = normalizarTexto(`${ideia.titulo} ${ideia.tema} ${ideia.descricao}`);
            return (!termo || texto.includes(termo))
                && (!curso || ideia.curso === curso)
                && (!status || ideia.status === status);
        })
        .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt))
        .map(preencherPublicacaoDemo);
}

export async function buscarIdeiaPorId(id) {
    if (usandoMongo()) {
        if (!idValido(id)) return null;
        return Ideia.findById(id).populate('autor', 'nome perfil curso areaAtuacao').lean();
    }
    const ideia = ideias.find((item) => item.id === String(id));
    return ideia ? preencherPublicacaoDemo(ideia) : null;
}

export async function cadastrarIdeia(dados) {
    if (usandoMongo()) return Ideia.create(dados);
    const ideia = { id: novoId(), createdAt: new Date(), ...dados, autorId: String(dados.autor) };
    delete ideia.autor;
    ideias.push(ideia);
    return preencherPublicacaoDemo(ideia);
}

export async function atualizarIdeia(id, dados) {
    if (usandoMongo()) return Ideia.findByIdAndUpdate(id, dados, { new: true, runValidators: true });
    const indice = ideias.findIndex((item) => item.id === String(id));
    if (indice < 0) return null;
    ideias[indice] = { ...ideias[indice], ...dados };
    return preencherPublicacaoDemo(ideias[indice]);
}

export async function excluirIdeia(id) {
    if (usandoMongo()) {
        await Promise.all([
            Ideia.findByIdAndDelete(id),
            Comentario.deleteMany({ alvoTipo: 'Ideia', alvo: id }),
        ]);
        return;
    }
    const indice = ideias.findIndex((item) => item.id === String(id));
    if (indice >= 0) ideias.splice(indice, 1);
    for (let i = comentarios.length - 1; i >= 0; i -= 1) {
        if (comentarios[i].alvoTipo === 'ideia' && comentarios[i].alvoId === String(id)) comentarios.splice(i, 1);
    }
}

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

export async function resumoDoPainel(usuarioId) {
    if (usandoMongo()) {
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
