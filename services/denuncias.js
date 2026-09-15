import { mongoose } from '../config/conexao.js';
import Denuncia from '../models/denuncia.js';
import { buscarUsuarioPorId, buscarTccPorId, buscarIdeiaPorId, listarComentarios, listarMensagensIdeia } from './repositorio.js';
import { obterId } from './permissoes.js';
import { randomUUID } from 'node:crypto';
const demonstracao = [];

export async function denunciarMensagem(conversa, mensagemId, usuario, motivo) {
    if (typeof motivo !== 'string' || motivo.trim().length < 5 || motivo.trim().length > 500) return null;
    const mensagens = await listarMensagensIdeia(conversa, usuario);
    const mensagem = mensagens?.find((item) => obterId(item) === mensagemId);
    if (!mensagem || obterId(mensagem.autor) === usuario) return null;
    const dados = { conversa, mensagem: mensagemId, denunciante: usuario, autor: obterId(mensagem.autor),
        nomeAutor: mensagem.autor?.nome || 'Usuário', texto: mensagem.texto, motivo: motivo.trim(), status: 'pendente' };
    return salvarDenuncia(dados);
}

async function salvarDenuncia(dados) {
    const mensagemId = dados.mensagem;
    const usuario = dados.denunciante;
    if (mongoose.connection.readyState === 1) {
        try { return await Denuncia.findOneAndUpdate({ mensagem: mensagemId, denunciante: usuario }, { $setOnInsert: dados }, { upsert: true, new: true, runValidators: true }); }
        catch (erro) { if (erro.code === 11000) return Denuncia.findOne({ mensagem: mensagemId, denunciante: usuario }); throw erro; }
    }
    const existente = demonstracao.find((item) => item.mensagem === mensagemId && item.denunciante === usuario);
    if (existente) return existente;
    const denuncia = { ...dados, id: randomUUID(), createdAt: new Date() };
    demonstracao.push(denuncia);
    return denuncia;
}
export async function listarDenuncias() {
    if (mongoose.connection.readyState === 1) return Denuncia.find().sort({ createdAt: -1 }).lean();
    return [...demonstracao].reverse();
}
export async function analisarDenuncia(id, administrador, resposta) {
    if (typeof resposta !== 'string' || resposta.trim().length < 5 || resposta.trim().length > 250) return null;
    const dados = { status: 'analisada', administrador, resposta: resposta.trim() };
    if (mongoose.connection.readyState === 1) {
        if (!mongoose.Types.ObjectId.isValid(id)) return null;
        return Denuncia.findOneAndUpdate({ _id: id, status: 'pendente' }, dados, { new: true, runValidators: true });
    }
    const item = demonstracao.find((item) => item.id === id && item.status === 'pendente');
    if (!item) return null;
    Object.assign(item, dados);
    return item;
}

export async function buscarDenuncia(id) {
    if (mongoose.connection.readyState === 1) {
        if (!mongoose.Types.ObjectId.isValid(id)) return null;
        return Denuncia.findById(id).lean();
    }
    return demonstracao.find((item) => item.id === id) || null;
}

export async function excluirDenuncia(id) {
    if (mongoose.connection.readyState === 1) {
        if (!mongoose.Types.ObjectId.isValid(id)) return null;
        return Denuncia.findByIdAndDelete(id);
    }
    const indice = demonstracao.findIndex((item) => item.id === id);
    return indice < 0 ? null : demonstracao.splice(indice, 1)[0];
}

export async function alvoDaDenuncia(tipo, id, usuario, contexto = {}) {
    if (tipo === 'usuario') {
        const autor = await buscarUsuarioPorId(id);
        if (!autor || autor.removido || obterId(autor) === obterId(usuario)) return null;
        return { autor: obterId(autor), nomeAutor: autor.nome, texto: `Perfil de ${autor.nome}`, link: '/painel' };
    }
    if (tipo !== 'comentario' || !['tcc', 'ideia'].includes(contexto.publicacaoTipo)) return null;
    const publicacao = contexto.publicacaoTipo === 'tcc' ? await buscarTccPorId(contexto.publicacaoId) : await buscarIdeiaPorId(contexto.publicacaoId);
    if (!publicacao) return null;
    const dono = obterId(publicacao.autor || publicacao.autorId) === obterId(usuario);
    const institucional = ['aluno', 'professor', 'admin'].includes(usuario.perfil);
    let permitido;
    if (contexto.publicacaoTipo === 'tcc') {
        permitido = (!publicacao.status || publicacao.status === 'publicado')
            ? publicacao.visibilidade !== 'interno' || institucional
            : dono || usuario.perfil === 'admin' || (usuario.perfil === 'professor' && obterId(publicacao.orientadorUsuario || publicacao.orientadorId) === obterId(usuario));
    } else {
        permitido = usuario.perfil !== 'colaborador' && (dono || usuario.perfil === 'admin'
            || obterId(publicacao.reservadaPor || publicacao.reservadaPorId) === obterId(usuario)
            || ((publicacao.moderacao || 'aprovada') === 'aprovada' && publicacao.status !== 'Em desenvolvimento'));
    }
    if (!permitido) return null;
    const comentarios = await listarComentarios(contexto.publicacaoTipo, contexto.publicacaoId);
    const item = comentarios.find((comentario) => obterId(comentario) === id);
    if (!item || !item.autor || obterId(item.autor) === obterId(usuario)) return null;
    return { autor: obterId(item.autor), nomeAutor: item.autor.nome, texto: item.texto,
        link: `/${contexto.publicacaoTipo}/detalhes/${contexto.publicacaoId}` };
}

export async function denunciarAlvo(tipo, id, usuario, motivo, contexto) {
    if (typeof motivo !== 'string' || motivo.trim().length < 5 || motivo.trim().length > 500) return null;
    const alvo = await alvoDaDenuncia(tipo, id, usuario, contexto);
    if (!alvo) return null;
    return salvarDenuncia({ ...alvo, tipo, mensagem: `${tipo}:${id}`, denunciante: obterId(usuario), motivo: motivo.trim(), status: 'pendente' });
}
