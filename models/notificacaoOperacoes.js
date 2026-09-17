import { listarUsuarios } from './usuarioOperacoes.js';
import Notificacao from './notificacao.js';
import { notificacoes, novoId } from '../data/mock.js';
import { usandoMongo, idValido } from '../config/banco.js';
import { autorDemo } from '../data/relacionamentos.js';

// Funções de notificacoes: cada consulta usa MongoDB ou os dados locais de demonstração.
export async function criarNotificacao({ destinatario, remetente = null, tipo, mensagem, link }) {
    if (!destinatario || !mensagem || !link) return null;
    if (usandoMongo()) {
        if (!idValido(destinatario)) return null;
        return Notificacao.create({ destinatario, remetente, tipo, mensagem, link });
    }
    const notificacao = {
        id: novoId(),
        destinatario: String(destinatario),
        remetente: remetente ? autorDemo(remetente) : null,
        tipo,
        mensagem,
        link,
        lida: false,
        createdAt: new Date(),
    };
    notificacoes.unshift(notificacao);
    return notificacao;
}

export async function listarNotificacoes(usuarioId, { somenteNaoLidas = false } = {}) {
    if (usandoMongo()) {
        if (!idValido(usuarioId)) return [];
        const filtro = { destinatario: usuarioId };
        if (somenteNaoLidas) filtro.lida = false;
        return Notificacao.find(filtro)
            .populate('remetente', 'nome perfil')
            .sort({ createdAt: -1 })
            .lean();
    }
    return notificacoes
        .filter((item) => item.destinatario === String(usuarioId) && (!somenteNaoLidas || !item.lida))
        .map((item) => ({ ...item }));
}

export async function contarNotificacoesNaoLidas(usuarioId) {
    if (!usuarioId) return 0;
    if (usandoMongo()) {
        if (!idValido(usuarioId)) return 0;
        return Notificacao.countDocuments({ destinatario: usuarioId, lida: false });
    }
    return notificacoes.filter((item) => item.destinatario === String(usuarioId) && !item.lida).length;
}

export async function marcarNotificacaoLida(id, usuarioId) {
    if (usandoMongo()) {
        if (!idValido(id) || !idValido(usuarioId)) return null;
        return Notificacao.findOneAndUpdate(
            { _id: id, destinatario: usuarioId },
            { lida: true },
            { new: true },
        );
    }
    const notificacao = notificacoes.find((item) => item.id === String(id) && item.destinatario === String(usuarioId));
    if (!notificacao) return null;
    notificacao.lida = true;
    return notificacao;
}

export async function marcarTodasNotificacoesLidas(usuarioId) {
    if (usandoMongo()) {
        if (!idValido(usuarioId)) return;
        await Notificacao.updateMany({ destinatario: usuarioId, lida: false }, { lida: true });
        return;
    }
    notificacoes.forEach((item) => {
        if (item.destinatario === String(usuarioId)) item.lida = true;
    });
}

// O administrador recebe o aviso no sininho; a fila continua sendo a fonte das pendências.
export async function notificarAdministradores(remetente, mensagem, link) {
    const usuarios = await listarUsuarios();
    const administradores = usuarios.filter((usuario) => usuario.perfil === 'admin' && usuario.ativo !== false);
    for (const administrador of administradores) {
        await criarNotificacao({ destinatario: String(administrador.id || administrador._id), remetente, tipo: 'sistema', mensagem, link });
    }
}
