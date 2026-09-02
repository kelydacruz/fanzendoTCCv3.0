import {
    listarNotificacoes,
    marcarNotificacaoLida,
    marcarTodasNotificacoesLidas,
} from '../services/repositorio.js';

function idUsuario(req) {
    return req.session.usuario.id;
}

export default class NotificacaoController {
    constructor() {
        this.list = async (req, res, next) => {
            try {
                const notificacoes = await listarNotificacoes(idUsuario(req));
                return res.render('notificacao/lst', { title: 'Notificações', notificacoes });
            } catch (erro) {
                return next(erro);
            }
        };

        this.read = async (req, res, next) => {
            try {
                const notificacao = await marcarNotificacaoLida(req.params.id, idUsuario(req));
                return res.redirect(notificacao?.link || '/notificacoes');
            } catch (erro) {
                return next(erro);
            }
        };

        this.readAll = async (req, res, next) => {
            try {
                await marcarTodasNotificacoesLidas(idUsuario(req));
                return res.redirect('/notificacoes?mensagem=Notificações marcadas como lidas.');
            } catch (erro) {
                return next(erro);
            }
        };
    }
}
