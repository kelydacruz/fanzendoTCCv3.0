import { prepararConfirmacao, consumirConfirmacao } from '../services/confirmacao.js';
import { normalizarTexto } from '../services/texto.js';
import { denunciarMensagem, listarDenuncias, analisarDenuncia, buscarDenuncia, excluirDenuncia, alvoDaDenuncia, denunciarAlvo } from '../services/denuncias.js';
import { criarNotificacao } from '../services/repositorio.js';
export default class DenunciaController {
    constructor() {
        this.form = async (req, res, next) => {
            try {
                const contexto = { publicacaoTipo: req.query.publicacaoTipo, publicacaoId: req.query.publicacaoId };
                const alvo = await alvoDaDenuncia(req.params.tipo, req.params.id, req.session.usuario, contexto);
                if (!alvo) return res.status(404).render('404', { title: 'Conteúdo não disponível' });
                return res.render('denunciar', { title: 'Enviar denúncia', alvo, tipo: req.params.tipo, id: req.params.id, contexto,
                    token: prepararConfirmacao(req, `denunciar-${req.params.tipo}`, req.params.id) });
            } catch (erro) { next(erro); }
        };
        this.report = async (req, res, next) => {
            try {
                if (!consumirConfirmacao(req, `denunciar-${req.params.tipo}`, req.params.id)) return res.status(403).render('erro', { title: 'Confirmação necessária', mensagemErro: 'Abra novamente o formulário de denúncia.' });
                const item = await denunciarAlvo(req.params.tipo, req.params.id, req.session.usuario, req.body.motivo, req.body);
                if (!item) return res.status(400).render('erro', { title: 'Denúncia não enviada', mensagemErro: 'Verifique o conteúdo e informe um motivo entre 5 e 500 caracteres.' });
                return res.redirect(`${item.link}?mensagem=${encodeURIComponent('Denúncia enviada para análise da administração.')}`);
            } catch (erro) { next(erro); }
        };
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
                const denuncias = todas.filter((item) => !termo || normalizarTexto([item.tipo || 'mensagem', item.nomeAutor, item.texto, item.motivo, item.resposta, item.status].filter(Boolean).join(' ')).includes(termo));
                res.render('admin/denuncias', { title: 'Denúncias', denuncias, busca });
            }
            catch (erro) { next(erro); }
        };
        this.confirmDelete = async (req, res, next) => {
            try {
                const item = await buscarDenuncia(req.params.id);
                if (!item) return res.status(404).render('404', { title: 'Denúncia não encontrada' });
                const busca = typeof req.query.q === 'string' ? req.query.q.slice(0, 150) : '';
                return res.render('admin/confirmar-remocao', {
                    title: 'Excluir denúncia', nome: `Denúncia de ${item.tipo || 'mensagem'}: ${item.nomeAutor}`,
                    explicacao: `Motivo: ${item.motivo}. A denúncia e sua análise serão apagadas definitivamente. O conteúdo ou perfil denunciado não será excluído.`,
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
                await criarNotificacao({ destinatario: item.denunciante, remetente: req.session.usuario.id, tipo: 'mensagem', mensagem: `Sua denúncia foi analisada: ${item.resposta}`, link: item.link || `/mensagens/${item.conversa}` });
                res.redirect('/admin/denuncias?mensagem=Análise registrada.');
            } catch (erro) { next(erro); }
        };
    }
}
