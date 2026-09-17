// Persistência e estados das ideias. As regras do formulário ficam em ideiaRegras.js.
import Ideia from './ideia.js';
import Comentario from './comentario.js';
import ConversaIdeia from './conversaIdeia.js';
import MensagemIdeia from './mensagemIdeia.js';
import {
    ideias,
    comentarios,
    conversasIdeia,
    mensagensIdeia,
    novoId,
} from '../data/mock.js';
import { usandoMongo, idValido } from '../config/banco.js';
import { normalizarTexto, escaparRegex } from '../services/texto.js';
import { preencherPublicacaoDemo } from '../data/relacionamentos.js';

// Funções de ideias: cada consulta usa MongoDB ou os dados locais de demonstração.
export async function listarIdeias({
    q = '',
    curso = '',
    area = '',
    status = '',
    dificuldade = '',
    origem = '',
    usuario = null,
    incluirOcultas = false,
    autorId = '',
} = {}) {
    if (usandoMongo()) {
        const filtros = {};
        if (autorId) filtros.autor = autorId;
        if (!incluirOcultas && !autorId) {
            if (usuario?.perfil === 'colaborador') filtros.autor = usuario.id || usuario._id;
            else {
                filtros.$and = [
                    { $or: [{ moderacao: 'aprovada' }, { moderacao: { $exists: false } }] },
                    { status: { $ne: 'Em desenvolvimento' } },
                ];
            }
        }
        if (q) {
            const termo = new RegExp(escaparRegex(q), 'i');
            filtros.$or = [{ titulo: termo }, { tema: termo }, { descricao: termo }];
        }
        if (curso) filtros.curso = curso;
        if (area) filtros.area = area;
        if (status) filtros.status = status;
        if (dificuldade) filtros.dificuldade = dificuldade;
        if (origem) filtros.origem = origem;
        return Ideia.find(filtros)
            .populate('autor', 'nome perfil curso areaAtuacao')
            .populate('reservadaPor', 'nome perfil curso')
            .populate('tccRelacionado', 'titulo visibilidade status')
            .sort({ createdAt: -1 })
            .lean();
    }

    const termo = normalizarTexto(q);
    return ideias
        .filter((ideia) => {
            const texto = normalizarTexto(`${ideia.titulo} ${ideia.tema} ${ideia.descricao}`);
            const ehAutor = autorId && ideia.autorId === String(autorId);
            const colaboradorVendoProprias = usuario?.perfil === 'colaborador'
                && ideia.autorId === String(usuario.id || usuario._id);
            const visivel = incluirOcultas || ehAutor || colaboradorVendoProprias
                || ((ideia.moderacao || 'aprovada') === 'aprovada' && ideia.status !== 'Em desenvolvimento');
            return visivel
                && (usuario?.perfil !== 'colaborador' || incluirOcultas || colaboradorVendoProprias)
                && (!autorId || ideia.autorId === String(autorId))
                && (!termo || texto.includes(termo))
                && (!curso || ideia.curso === curso)
                && (!area || ideia.area === area)
                && (!status || ideia.status === status)
                && (!dificuldade || ideia.dificuldade === dificuldade)
                && (!origem || (ideia.origem || 'interna') === origem);
        })
        .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt))
        .map(preencherPublicacaoDemo);
}

export async function buscarIdeiaPorId(id) {
    if (usandoMongo()) {
        if (!idValido(id)) return null;
        return Ideia.findById(id)
            .populate('autor', 'nome perfil curso areaAtuacao')
            .populate('interessados', 'nome perfil curso')
            .populate('reservadaPor', 'nome perfil curso')
            .populate('tccRelacionado', 'titulo visibilidade status')
            .lean();
    }
    const ideia = ideias.find((item) => item.id === String(id));
    return ideia ? preencherPublicacaoDemo(ideia) : null;
}

export async function cadastrarIdeia(dados) {
    if (usandoMongo()) return Ideia.create(dados);
    const ideia = {
        id: novoId(),
        createdAt: new Date(),
        interessadosIds: [],
        ...dados,
        autorId: String(dados.autor),
    };
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

export async function alterarModeracaoIdeia(id, moderacao) {
    if (usandoMongo()) {
        if (!idValido(id)) return null;
        return Ideia.findByIdAndUpdate(id, { moderacao }, { new: true, runValidators: true });
    }
    return atualizarIdeia(id, { moderacao });
}

// $addToSet inclui o aluno sem duplicá-lo; $ne impede usar uma ideia de sua autoria.
export async function registrarInteresseIdeia(id, alunoId) {
    if (usandoMongo()) {
        if (!idValido(id) || !idValido(alunoId)) return null;
        return Ideia.findOneAndUpdate(
            {
                _id: id,
                autor: { $ne: alunoId },
                status: 'Disponível',
                $or: [{ moderacao: 'aprovada' }, { moderacao: { $exists: false } }],
            },
            { $addToSet: { interessados: alunoId } },
            { new: true },
        ).populate('autor', 'nome perfil');
    }
    const ideia = ideias.find((item) => item.id === String(id)
        && item.autorId !== String(alunoId)
        && item.status === 'Disponível'
        && (item.moderacao || 'aprovada') === 'aprovada');
    if (!ideia) return null;
    ideia.interessadosIds ||= [];
    if (!ideia.interessadosIds.includes(String(alunoId))) ideia.interessadosIds.push(String(alunoId));
    return preencherPublicacaoDemo(ideia);
}

export async function buscarIdeiaReservadaPeloAluno(alunoId) {
    if (usandoMongo()) {
        if (!idValido(alunoId)) return null;
        return Ideia.findOne({ reservadaPor: alunoId, status: 'Em desenvolvimento' })
            .populate('autor', 'nome perfil')
            .lean();
    }
    const ideia = ideias.find((item) => item.reservadaPorId === String(alunoId)
        && item.status === 'Em desenvolvimento');
    return ideia ? preencherPublicacaoDemo(ideia) : null;
}

// A condição Disponível faz a reserva depender do estado atual no banco, não só da tela do aluno.
export async function reservarIdeia(id, alunoId) {
    const existente = await buscarIdeiaReservadaPeloAluno(alunoId);
    if (existente && String(existente.id || existente._id) !== String(id)) return { erro: 'ALUNO_JA_RESERVOU' };

    if (usandoMongo()) {
        if (!idValido(id) || !idValido(alunoId)) return null;
        return Ideia.findOneAndUpdate(
            {
                _id: id,
                autor: { $ne: alunoId },
                status: 'Disponível',
                $or: [{ moderacao: 'aprovada' }, { moderacao: { $exists: false } }],
            },
            { status: 'Em desenvolvimento', reservadaPor: alunoId, $addToSet: { interessados: alunoId } },
            { new: true },
        ).populate('autor', 'nome perfil');
    }
    const ideia = ideias.find((item) => item.id === String(id)
        && item.autorId !== String(alunoId)
        && item.status === 'Disponível'
        && (item.moderacao || 'aprovada') === 'aprovada');
    if (!ideia) return null;
    ideia.status = 'Em desenvolvimento';
    ideia.reservadaPorId = String(alunoId);
    ideia.interessadosIds ||= [];
    if (!ideia.interessadosIds.includes(String(alunoId))) ideia.interessadosIds.push(String(alunoId));
    return preencherPublicacaoDemo(ideia);
}

export async function liberarIdeia(id, alunoId) {
    if (usandoMongo()) {
        if (!idValido(id) || !idValido(alunoId)) return null;
        return Ideia.findOneAndUpdate(
            { _id: id, reservadaPor: alunoId, status: 'Em desenvolvimento' },
            { status: 'Disponível', reservadaPor: null },
            { new: true },
        ).populate('autor', 'nome perfil');
    }
    const ideia = ideias.find((item) => item.id === String(id)
        && item.reservadaPorId === String(alunoId)
        && item.status === 'Em desenvolvimento');
    if (!ideia) return null;
    ideia.status = 'Disponível';
    ideia.reservadaPorId = null;
    return preencherPublicacaoDemo(ideia);
}

export async function marcarIdeiaUsada(id, tccId) {
    if (!id) return null;
    if (usandoMongo()) {
        if (!idValido(id) || !idValido(tccId)) return null;
        return Ideia.findByIdAndUpdate(
            id,
            { status: 'Usada', tccRelacionado: tccId, reservadaPor: null },
            { new: true },
        ).populate('autor', 'nome perfil');
    }
    const ideia = ideias.find((item) => item.id === String(id));
    if (!ideia) return null;
    ideia.status = 'Usada';
    ideia.tccRelacionadoId = String(tccId);
    ideia.reservadaPorId = null;
    return preencherPublicacaoDemo(ideia);
}

export async function excluirIdeia(id) {
    if (usandoMongo()) {
        const conversas = await ConversaIdeia.find({ ideia: id }).select('_id').lean();
        const conversaIds = conversas.map((conversa) => conversa._id);
        await Promise.all([
            Ideia.findByIdAndDelete(id),
            Comentario.deleteMany({ alvoTipo: 'Ideia', alvo: id }),
            ConversaIdeia.deleteMany({ ideia: id }),
            MensagemIdeia.deleteMany({ conversa: { $in: conversaIds } }),
        ]);
        return;
    }
    const indice = ideias.findIndex((item) => item.id === String(id));
    if (indice >= 0) ideias.splice(indice, 1);
    for (let i = comentarios.length - 1; i >= 0; i -= 1) {
        if (comentarios[i].alvoTipo === 'ideia' && comentarios[i].alvoId === String(id)) comentarios.splice(i, 1);
    }
    const idsConversas = conversasIdeia
        .filter((conversa) => conversa.ideiaId === String(id))
        .map((conversa) => conversa.id);
    for (let i = conversasIdeia.length - 1; i >= 0; i -= 1) {
        if (conversasIdeia[i].ideiaId === String(id)) conversasIdeia.splice(i, 1);
    }
    for (let i = mensagensIdeia.length - 1; i >= 0; i -= 1) {
        if (idsConversas.includes(mensagensIdeia[i].conversaId)) mensagensIdeia.splice(i, 1);
    }
}
