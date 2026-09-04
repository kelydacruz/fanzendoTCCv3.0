import {
    atualizarStatusConversaIdeia,
    buscarConversaIdeiaPorId,
    criarNotificacao,
    cadastrarMensagemIdeia,
    listarConversasIdeia,
    listarMensagensIdeia,
    solicitarConversaIdeia,
} from '../services/repositorio.js';
import { validarConteudo } from '../services/filtroConteudo.js';
import { obterId } from '../services/permissoes.js';
import { textoComTamanho } from '../services/validacao.js';

function outroParticipante(conversa, usuarioId) {
    const alunoId = obterId(conversa.aluno || conversa.alunoId);
    return alunoId === String(usuarioId)
        ? conversa.autorIdeia
        : conversa.aluno;
}

export default class MensagemController {
    constructor() {
        this.list = async (req, res, next) => {
            try {
                const conversas = await listarConversasIdeia(req.session.usuario.id);
                return res.render('mensagem/lst', { title: 'Mensagens', conversas });
            } catch (erro) {
                return next(erro);
            }
        };

        this.details = async (req, res, next) => {
            try {
                const conversa = await buscarConversaIdeiaPorId(req.params.id);
                const mensagens = await listarMensagensIdeia(req.params.id, req.session.usuario.id);
                if (!conversa || mensagens === null) return res.status(404).render('404', { title: 'Conversa não encontrada' });
                return res.render('mensagem/detalhes', {
                    title: 'Conversa sobre uma ideia', conversa, mensagens,
                    outroUsuario: outroParticipante(conversa, req.session.usuario.id),
                    podeResponderSolicitacao: obterId(conversa.autorIdeia) === String(req.session.usuario.id)
                        && conversa.status === 'pendente',
                });
            } catch (erro) {
                return next(erro);
            }
        };

        this.request = async (req, res, next) => {
            try {
                const conversa = await solicitarConversaIdeia(req.params.ideiaId, req.session.usuario.id);
                if (!conversa) return res.redirect('/ideia/lst?mensagem=Não foi possível solicitar o contato.');
                if (conversa.status === 'pendente') {
                    await criarNotificacao({
                        destinatario: obterId(conversa.autorIdeia),
                        remetente: req.session.usuario.id,
                        tipo: 'contato_solicitado',
                        mensagem: `${req.session.usuario.nome} solicitou contato sobre a ideia “${conversa.ideia.titulo}”.`,
                        link: `/mensagens/${obterId(conversa)}`,
                    });
                }
                return res.redirect(`/mensagens/${obterId(conversa)}?mensagem=Solicitação de contato enviada.`);
            } catch (erro) {
                return next(erro);
            }
        };

        this.respond = async (req, res, next) => {
            try {
                const status = req.body.acao === 'aceitar' ? 'ativa' : 'recusada';
                const conversa = await atualizarStatusConversaIdeia(
                    req.params.id,
                    req.session.usuario.id,
                    status,
                );
                if (!conversa) return res.redirect('/mensagens?mensagem=Solicitação não encontrada.');
                await criarNotificacao({
                    destinatario: obterId(conversa.aluno),
                    remetente: req.session.usuario.id,
                    tipo: 'contato_aceito',
                    mensagem: status === 'ativa'
                        ? 'Seu pedido de contato sobre uma ideia foi aceito.'
                        : 'Seu pedido de contato sobre uma ideia foi recusado.',
                    link: `/mensagens/${obterId(conversa)}`,
                });
                return res.redirect(`/mensagens/${obterId(conversa)}?mensagem=${status === 'ativa' ? 'Conversa liberada.' : 'Solicitação recusada.'}`);
            } catch (erro) {
                return next(erro);
            }
        };

        this.send = async (req, res, next) => {
            const texto = String(req.body.texto || '').trim();
            try {
                validarConteudo(texto);
                if (!textoComTamanho(texto, 1, 1000)) {
                    return res.redirect(`/mensagens/${req.params.id}?mensagem=A mensagem deve ter entre 1 e 1.000 caracteres.`);
                }
                const conversa = await buscarConversaIdeiaPorId(req.params.id);
                const mensagem = await cadastrarMensagemIdeia(req.params.id, req.session.usuario.id, texto);
                if (!conversa || !mensagem) {
                    return res.redirect(`/mensagens/${req.params.id}?mensagem=Esta conversa ainda não está liberada.`);
                }
                const destinatario = outroParticipante(conversa, req.session.usuario.id);
                await criarNotificacao({
                    destinatario: obterId(destinatario),
                    remetente: req.session.usuario.id,
                    tipo: 'mensagem',
                    mensagem: `${req.session.usuario.nome} enviou uma mensagem sobre “${conversa.ideia.titulo}”.`,
                    link: `/mensagens/${req.params.id}`,
                });
                return res.redirect(`/mensagens/${req.params.id}`);
            } catch (erro) {
                if (erro.message.includes('termo não permitido')) {
                    return res.redirect(`/mensagens/${req.params.id}?mensagem=${encodeURIComponent(erro.message)}`);
                }
                return next(erro);
            }
        };
    }
}
