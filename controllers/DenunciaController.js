import { denunciarMensagem, listarDenuncias, analisarDenuncia } from '../services/denuncias.js';
import { criarNotificacao } from '../services/repositorio.js';
export default class DenunciaController {
    constructor() {
        this.create = async (req, res, next) => {
            try {
                const item = await denunciarMensagem(req.params.id, req.params.mensagemId, req.session.usuario.id, req.body.motivo);
                if (!item) return res.status(400).render('erro', { title: 'Denúncia não enviada', mensagemErro: 'Verifique a mensagem e informe um motivo de 5 a 500 caracteres.' });
                return res.redirect(`/mensagens/${encodeURIComponent(req.params.id)}?mensagem=Denúncia enviada para análise da administração.`);
            } catch (erro) { next(erro); }
        };
        this.list = async (req, res, next) => {
            try { res.render('admin/denuncias', { title: 'Denúncias de mensagens', denuncias: await listarDenuncias() }); }
            catch (erro) { next(erro); }
        };
        this.resolve = async (req, res, next) => {
            try {
                const item = await analisarDenuncia(req.params.id, req.session.usuario.id, req.body.resposta);
                if (!item) return res.redirect('/admin/denuncias?mensagem=Informe uma resposta de 5 a 250 caracteres para uma denúncia pendente.');
                await criarNotificacao({ destinatario: item.denunciante, remetente: req.session.usuario.id, tipo: 'mensagem', mensagem: `Sua denúncia foi analisada: ${item.resposta}`, link: `/mensagens/${item.conversa}` });
                res.redirect('/admin/denuncias?mensagem=Análise registrada.');
            } catch (erro) { next(erro); }
        };
    }
}
