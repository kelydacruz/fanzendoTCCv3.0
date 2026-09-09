import { mongoose } from '../config/conexao.js';
import Denuncia from '../models/denuncia.js';
import { listarMensagensIdeia } from './repositorio.js';
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
