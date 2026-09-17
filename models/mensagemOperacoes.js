import ConversaIdeia from './conversaIdeia.js';
import MensagemIdeia from './mensagemIdeia.js';
import { conversasIdeia, mensagensIdeia, novoId } from '../data/mock.js';
import { usandoMongo, idValido } from '../config/banco.js';
import { autorDemo, preencherConversaDemo } from '../data/relacionamentos.js';
import { buscarIdeiaPorId } from './ideiaOperacoes.js';

// Funções de mensagens: cada consulta usa MongoDB ou os dados locais de demonstração.
export async function solicitarConversaIdeia(ideiaId, alunoId) {
    const ideia = await buscarIdeiaPorId(ideiaId);
    const autorId = ideia?.autor?.id || ideia?.autor?._id || ideia?.autorId;
    const demonstrouInteresse = (ideia?.interessados || ideia?.interessadosIds || [])
        .some((interessado) => String(interessado?.id || interessado?._id || interessado) === String(alunoId));
    const reservou = String(ideia?.reservadaPor?.id || ideia?.reservadaPor?._id || ideia?.reservadaPorId || '')
        === String(alunoId);
    if (!ideia || !autorId || String(autorId) === String(alunoId)
        || (!demonstrouInteresse && !reservou)) return null;

    if (usandoMongo()) {
        if (!idValido(ideiaId) || !idValido(alunoId) || !idValido(autorId)) return null;
        let conversa = await ConversaIdeia.findOne({ ideia: ideiaId, aluno: alunoId });
        if (!conversa) {
            conversa = await ConversaIdeia.create({
                ideia: ideiaId,
                aluno: alunoId,
                autorIdeia: autorId,
                status: 'pendente',
            });
        }
        return ConversaIdeia.findById(conversa._id)
            .populate('ideia', 'titulo origem status')
            .populate('aluno', 'nome perfil curso')
            .populate('autorIdeia', 'nome perfil')
            .lean();
    }

    let conversa = conversasIdeia.find((item) => item.ideiaId === String(ideiaId)
        && item.alunoId === String(alunoId));
    if (!conversa) {
        conversa = {
            id: novoId(),
            ideiaId: String(ideiaId),
            alunoId: String(alunoId),
            autorIdeiaId: String(autorId),
            status: 'pendente',
            createdAt: new Date(),
        };
        conversasIdeia.push(conversa);
    }
    return preencherConversaDemo(conversa);
}

export async function listarConversasIdeia(usuarioId) {
    if (usandoMongo()) {
        if (!idValido(usuarioId)) return [];
        return ConversaIdeia.find({ $or: [{ aluno: usuarioId }, { autorIdeia: usuarioId }] })
            .populate('ideia', 'titulo origem status')
            .populate('aluno', 'nome perfil curso')
            .populate('autorIdeia', 'nome perfil')
            .sort({ updatedAt: -1 })
            .lean();
    }
    return conversasIdeia
        .filter((item) => item.alunoId === String(usuarioId) || item.autorIdeiaId === String(usuarioId))
        .map(preencherConversaDemo)
        .sort((a, b) => new Date(b.updatedAt || b.createdAt) - new Date(a.updatedAt || a.createdAt));
}

export async function buscarConversaIdeiaPorId(id) {
    if (usandoMongo()) {
        if (!idValido(id)) return null;
        return ConversaIdeia.findById(id)
            .populate('ideia', 'titulo origem status')
            .populate('aluno', 'nome perfil curso')
            .populate('autorIdeia', 'nome perfil')
            .lean();
    }
    const conversa = conversasIdeia.find((item) => item.id === String(id));
    return conversa ? preencherConversaDemo(conversa) : null;
}

export async function atualizarStatusConversaIdeia(id, autorIdeiaId, status) {
    if (usandoMongo()) {
        if (!idValido(id) || !idValido(autorIdeiaId)) return null;
        return ConversaIdeia.findOneAndUpdate(
            { _id: id, autorIdeia: autorIdeiaId },
            { status },
            { new: true, runValidators: true },
        ).populate('aluno', 'nome perfil curso');
    }
    const conversa = conversasIdeia.find((item) => item.id === String(id)
        && item.autorIdeiaId === String(autorIdeiaId));
    if (!conversa) return null;
    conversa.status = status;
    conversa.updatedAt = new Date();
    return preencherConversaDemo(conversa);
}

export async function listarMensagensIdeia(conversaId, usuarioId) {
    const conversa = await buscarConversaIdeiaPorId(conversaId);
    const participante = conversa
        && [conversa.aluno?.id || conversa.aluno?._id || conversa.alunoId,
            conversa.autorIdeia?.id || conversa.autorIdeia?._id || conversa.autorIdeiaId]
            .some((id) => String(id) === String(usuarioId));
    if (!participante) return null;

    if (usandoMongo()) {
        await MensagemIdeia.updateMany(
            { conversa: conversaId, autor: { $ne: usuarioId }, lida: false },
            { lida: true },
        );
        return MensagemIdeia.find({ conversa: conversaId })
            .populate('autor', 'nome perfil')
            .sort({ createdAt: 1 })
            .lean();
    }
    const resultado = mensagensIdeia.filter((item) => item.conversaId === String(conversaId));
    resultado.forEach((item) => {
        if (item.autorId !== String(usuarioId)) item.lida = true;
    });
    return resultado.map((item) => ({ ...item, autor: autorDemo(item.autorId) }));
}

export async function cadastrarMensagemIdeia(conversaId, autorId, texto) {
    const conversa = await buscarConversaIdeiaPorId(conversaId);
    const participantes = [
        conversa?.aluno?.id || conversa?.aluno?._id || conversa?.alunoId,
        conversa?.autorIdeia?.id || conversa?.autorIdeia?._id || conversa?.autorIdeiaId,
    ];
    if (!conversa || conversa.status !== 'ativa'
        || !participantes.some((id) => String(id) === String(autorId))) return null;

    if (usandoMongo()) {
        const mensagem = await MensagemIdeia.create({ conversa: conversaId, autor: autorId, texto });
        await ConversaIdeia.findByIdAndUpdate(conversaId, { updatedAt: new Date() });
        return mensagem;
    }
    const mensagem = {
        id: novoId(),
        conversaId: String(conversaId),
        autorId: String(autorId),
        texto,
        lida: false,
        createdAt: new Date(),
    };
    mensagensIdeia.push(mensagem);
    const conversaDemo = conversasIdeia.find((item) => item.id === String(conversaId));
    if (conversaDemo) conversaDemo.updatedAt = new Date();
    return { ...mensagem, autor: autorDemo(autorId) };
}
