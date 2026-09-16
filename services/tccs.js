import Tcc from '../models/tcc.js';
import Ideia from '../models/ideia.js';
import Comentario from '../models/comentario.js';
import { tccs, ideias, comentarios, novoId } from '../data/mock.js';
import { usandoMongo, idValido } from './banco.js';
import { normalizarTexto, escaparRegex } from './texto.js';
import { autorDemo, preencherPublicacaoDemo, usuarioInstitucional } from './dadosDemo.js';

// Funções de tccs: cada consulta usa MongoDB ou os dados locais de demonstração.
export async function listarTccs({
    q = '',
    curso = '',
    ano = '',
    area = '',
    orientador = '',
    ordem = 'recentes',
    usuario = null,
} = {}) {
    if (usandoMongo()) {
        const filtros = { $and: [{ $or: [{ status: 'publicado' }, { status: { $exists: false } }] }] };
        if (!usuarioInstitucional(usuario)) {
            filtros.$and.push({ $or: [{ visibilidade: 'publico' }, { visibilidade: { $exists: false } }] });
        }
        if (q) {
            const termo = new RegExp(escaparRegex(q), 'i');
            filtros.$and.push({ $or: [
                { titulo: termo },
                { tema: termo },
                { resumo: termo },
                { orientador: termo },
                { curso: termo },
                { area: termo },
                { palavrasChave: termo },
            ] });
        }
        if (curso) filtros.curso = new RegExp(`^${escaparRegex(curso)}$`, 'i');
        if (ano) filtros.ano = Number(ano);
        if (area) filtros.area = new RegExp(`^${escaparRegex(area)}$`, 'i');
        if (orientador) filtros.orientador = new RegExp(`^${escaparRegex(orientador)}$`, 'i');

        const ordenacoes = {
            recentes: { createdAt: -1 },
            visualizados: { visualizacoes: -1, createdAt: -1 },
            downloads: { downloads: -1, createdAt: -1 },
            az: { titulo: 1 },
        };

        return Tcc.find(filtros)
            // populate troca o ID do autor pelos dados necessários para exibição.
            .populate('autor', 'nome perfil curso')
            .populate('cursoCadastro', 'nome sigla')
            .populate('turmaCadastro', 'nome ano')
            .populate('ideiaOrigem', 'titulo origem status')
            .sort(ordenacoes[ordem] || ordenacoes.recentes)
            .lean();
    }

    const termo = normalizarTexto(q);
    const resultado = tccs
        .filter((tcc) => {
            const autor = autorDemo(tcc.autorId);
            const texto = normalizarTexto([
                tcc.titulo,
                tcc.tema,
                tcc.resumo,
                tcc.curso,
                tcc.area,
                tcc.orientador,
                autor?.nome,
                ...tcc.palavrasChave,
            ].join(' '));
            return (tcc.status === 'publicado' || !tcc.status)
                && (usuarioInstitucional(usuario) || tcc.visibilidade !== 'interno')
                && (!termo || texto.includes(termo))
                && (!curso || normalizarTexto(tcc.curso) === normalizarTexto(curso))
                && (!ano || String(tcc.ano) === String(ano))
                && (!area || normalizarTexto(tcc.area) === normalizarTexto(area))
                && (!orientador || normalizarTexto(tcc.orientador) === normalizarTexto(orientador));
        })
        .map(preencherPublicacaoDemo);

    const comparadores = {
        recentes: (a, b) => new Date(b.createdAt) - new Date(a.createdAt),
        visualizados: (a, b) => (b.visualizacoes || 0) - (a.visualizacoes || 0),
        downloads: (a, b) => (b.downloads || 0) - (a.downloads || 0),
        az: (a, b) => a.titulo.localeCompare(b.titulo, 'pt-BR'),
    };

    return resultado.sort(comparadores[ordem] || comparadores.recentes);
}

export async function buscarTccPorId(id) {
    if (usandoMongo()) {
        if (!idValido(id)) return null;
        return Tcc.findById(id)
            // populate troca o ID do autor pelos dados necessários para exibição.
            .populate('autor', 'nome perfil curso')
            .populate('orientadorUsuario', 'nome email perfil')
            .populate('cursoCadastro', 'nome sigla')
            .populate('turmaCadastro', 'nome ano')
            .populate('ideiaOrigem', 'titulo origem status autor')
            .lean();
    }
    const tcc = tccs.find((item) => item.id === String(id));
    return tcc ? preencherPublicacaoDemo(tcc) : null;
}

export async function cadastrarTcc(dados) {
    if (usandoMongo()) return Tcc.create(dados);
    const tcc = {
        id: novoId(),
        createdAt: new Date(),
        visualizacoes: 0,
        downloads: 0,
        status: 'em_analise',
        feedbackOrientador: '',
        ...dados,
        autorId: String(dados.autor),
        orientadorId: dados.orientadorUsuario ? String(dados.orientadorUsuario) : null,
        cursoCadastroId: dados.cursoCadastro ? String(dados.cursoCadastro) : null,
        turmaCadastroId: dados.turmaCadastro ? String(dados.turmaCadastro) : null,
        ideiaOrigemId: dados.ideiaOrigem ? String(dados.ideiaOrigem) : null,
    };
    delete tcc.autor;
    delete tcc.orientadorUsuario;
    delete tcc.cursoCadastro;
    delete tcc.turmaCadastro;
    delete tcc.ideiaOrigem;
    tccs.push(tcc);
    return preencherPublicacaoDemo(tcc);
}

export async function buscarTccDoAluno(usuarioId) {
    if (usandoMongo()) {
        if (!idValido(usuarioId)) return null;
        return Tcc.findOne({ autor: usuarioId })
            // populate troca o ID do autor pelos dados necessários para exibição.
            .populate('autor', 'nome perfil curso')
            .populate('orientadorUsuario', 'nome email perfil')
            .lean();
    }
    const tcc = tccs.find((item) => item.autorId === String(usuarioId));
    return tcc ? preencherPublicacaoDemo(tcc) : null;
}

export async function listarTccsDoOrientador(usuarioId) {
    if (usandoMongo()) {
        if (!idValido(usuarioId)) return [];
        return Tcc.find({ orientadorUsuario: usuarioId })
            // populate troca o ID do autor pelos dados necessários para exibição.
            .populate('autor', 'nome email curso perfil')
            .sort({ updatedAt: -1 })
            .lean();
    }
    return tccs
        .filter((item) => item.orientadorId === String(usuarioId))
        .map(preencherPublicacaoDemo);
}

export async function listarTodosTccs() {
    if (usandoMongo()) {
        return Tcc.find({})
            // populate troca o ID do autor pelos dados necessários para exibição.
            .populate('autor', 'nome email curso perfil')
            .populate('orientadorUsuario', 'nome email perfil')
            .populate('cursoCadastro', 'nome sigla')
            .populate('turmaCadastro', 'nome ano')
            .populate('ideiaOrigem', 'titulo origem status')
            .sort({ updatedAt: -1 })
            .lean();
    }
    return tccs.map(preencherPublicacaoDemo);
}

export async function avaliarTcc(id, { status, feedbackOrientador }) {
    const dados = {
        status,
        feedbackOrientador: String(feedbackOrientador || '').trim(),
        avaliadoEm: new Date(),
    };
    if (usandoMongo()) {
        if (!idValido(id)) return null;
        return Tcc.findByIdAndUpdate(id, dados, { new: true, runValidators: true });
    }
    return atualizarTcc(id, dados);
}

export async function atualizarTcc(id, dados) {
    if (usandoMongo()) return Tcc.findByIdAndUpdate(id, dados, { new: true, runValidators: true });
    const indice = tccs.findIndex((item) => item.id === String(id));
    if (indice < 0) return null;
    const atualizacao = { ...dados };
    if ('orientadorUsuario' in atualizacao) {
        atualizacao.orientadorId = atualizacao.orientadorUsuario ? String(atualizacao.orientadorUsuario) : null;
        delete atualizacao.orientadorUsuario;
    }
    if ('cursoCadastro' in atualizacao) {
        atualizacao.cursoCadastroId = atualizacao.cursoCadastro ? String(atualizacao.cursoCadastro) : null;
        delete atualizacao.cursoCadastro;
    }
    if ('turmaCadastro' in atualizacao) {
        atualizacao.turmaCadastroId = atualizacao.turmaCadastro ? String(atualizacao.turmaCadastro) : null;
        delete atualizacao.turmaCadastro;
    }
    if ('ideiaOrigem' in atualizacao) {
        atualizacao.ideiaOrigemId = atualizacao.ideiaOrigem ? String(atualizacao.ideiaOrigem) : null;
        delete atualizacao.ideiaOrigem;
    }
    tccs[indice] = { ...tccs[indice], ...atualizacao };
    return preencherPublicacaoDemo(tccs[indice]);
}

export async function excluirTcc(id) {
    if (usandoMongo()) {
        await Promise.all([
            Tcc.findByIdAndDelete(id),
            Ideia.updateMany({ tccRelacionado: id }, { $set: { tccRelacionado: null } }),
            Comentario.deleteMany({ alvoTipo: 'Tcc', alvo: id }),
        ]);
        return;
    }
    ideias.forEach((ideia) => {
        if (ideia.tccRelacionadoId === String(id)) ideia.tccRelacionadoId = null;
    });
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

export async function registrarVisualizacaoTcc(id) {
    if (usandoMongo()) {
        if (!idValido(id)) return;
        await Tcc.findByIdAndUpdate(id, { $inc: { visualizacoes: 1 } });
        return;
    }

    const tcc = tccs.find((item) => item.id === String(id));
    if (tcc) tcc.visualizacoes = (tcc.visualizacoes || 0) + 1;
}

export async function registrarDownloadTcc(id) {
    if (usandoMongo()) {
        if (!idValido(id)) return;
        await Tcc.findByIdAndUpdate(id, { $inc: { downloads: 1 } });
        return;
    }

    const tcc = tccs.find((item) => item.id === String(id));
    if (tcc) tcc.downloads = (tcc.downloads || 0) + 1;
}

export async function listarTccsRelacionados(tcc, limite = 3) {
    if (!tcc) return [];
    const idAtual = String(tcc.id || tcc._id);
    const todos = await listarTccs();

    return todos
        .filter((item) => String(item.id || item._id) !== idAtual)
        .filter((item) => item.curso === tcc.curso || item.area === tcc.area)
        .slice(0, limite);
}
