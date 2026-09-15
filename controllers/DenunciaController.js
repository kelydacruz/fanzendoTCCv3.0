import { prepararConfirmacao, consumirConfirmacao } from '../services/confirmacao.js';
import { normalizarTexto } from '../services/texto.js';
import { denunciarMensagem, listarDenuncias, analisarDenuncia, buscarDenuncia, excluirDenuncia } from '../services/denuncias.js';
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
            try {
                const busca = typeof req.query.q === 'string' ? req.query.q.trim().slice(0, 150) : '';
                const termo = normalizarTexto(busca);
                const todas = await listarDenuncias();
                const denuncias = todas.filter((item) => !termo || normalizarTexto([item.nomeAutor, item.texto, item.motivo, item.resposta, item.status].filter(Boolean).join(' ')).includes(termo));
                res.render('admin/denuncias', { title: 'Denúncias de mensagens', denuncias, busca });
            }
            catch (erro) { next(erro); }
        };
        this.confirmDelete = async (req, res, next) => {
            try {
                const item = await buscarDenuncia(req.params.id);
                if (!item) return res.status(404).render('404', { title: 'Denúncia não encontrada' });
                const busca = typeof req.query.q === 'string' ? req.query.q.slice(0, 150) : '';
                return res.render('admin/confirmar-remocao', {
                    title: 'Excluir denúncia', nome: `Denúncia de mensagem de ${item.nomeAutor}`,
                    explicacao: `Motivo: ${item.motivo}. A denúncia e sua análise serão apagadas definitivamente. A mensagem original continuará na conversa.`,
                    destino: `/admin/denuncias/${req.params.id}/excluir`, voltar: `/admin/denuncias?q=${encodeURIComponent(busca)}`,
                    busca, token: prepararConfirmacao(req, 'denuncia', req.params.id),
                });
            } catch (erro) { next(erro); }
        };
        this.delete = async (req, res, next) => {
            try {
                if (!consumirConfirmacao(req, 'denuncia', req.params.id)) return res.status(403).render('erro', { title: 'Confirmação necessária', mensagemErro: 'Abra novamente a confirmação de exclusão.' });
                const item = await excluirDenuncia(req.params.id);
                const busca = typeof req.body.q === 'string' ? req.body.q.slice(0, 150) : '';
                return res.redirect(`/admin/denuncias?${new URLSearchParams({ q: busca, mensagem: item ? 'Denúncia excluída com sucesso.' : 'Denúncia não encontrada.' })}`);
            } catch (erro) { next(erro); }
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
