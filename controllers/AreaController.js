import {
    listarAreasAtuacao,
    buscarAreaAtuacao,
    cadastrarAreaAtuacao,
    atualizarAreaAtuacao,
    excluirAreaAtuacao,
} from '../models/areaOperacoes.js';
import { prepararConfirmacao, consumirConfirmacao } from '../services/confirmacao.js';
import { erroCadastro } from '../models/cadastroValidacao.js';

async function renderPagina(res, edicao = '', dados = {}, erro = '', status = 200) {
    return res.status(status).render('admin/areas', {
        title: 'Áreas de atuação', areas: await listarAreasAtuacao(), edicao, dados, erro,
    });
}

function erroEsperado(erro) {
    return [400, 409].includes(erro.status) || erro.code === 11000 || erro.name === 'ValidationError';
}

export default class AreaController {
    constructor() {
        this.list = async (req, res, next) => {
            try { return await renderPagina(res); } catch (erro) { return next(erro); }
        };

        this.add = async (req, res, next) => {
            const dados = { nome: req.body.nome };
            try {
                await cadastrarAreaAtuacao(dados);
                return res.redirect('/admin/areas?mensagem=' + encodeURIComponent('Cadastro realizado com sucesso.'));
            } catch (erro) {
                if (erroEsperado(erro)) return renderPagina(res, '', dados, erro.code === 11000 ? 'Este cadastro já existe.' : erro.message, erro.status || 400).catch(next);
                return next(erro);
            }
        };

        this.openEdt = async (req, res, next) => {
            try {
                const item = await buscarAreaAtuacao(req.params.id);
                if (!item) return res.status(404).render('404', { title: 'Cadastro não encontrado' });
                return await renderPagina(res, req.params.id, item);
            } catch (erro) { return next(erro); }
        };

        this.edt = async (req, res, next) => {
            const dados = { nome: req.body.nome };
            try {
                const item = await atualizarAreaAtuacao(req.params.id, dados);
                if (!item) return res.status(404).render('404', { title: 'Cadastro não encontrado' });
                return res.redirect('/admin/areas?mensagem=' + encodeURIComponent('Cadastro atualizado com sucesso.'));
            } catch (erro) {
                if (erroEsperado(erro)) return renderPagina(res, req.params.id, dados, erro.code === 11000 ? 'Este cadastro já existe.' : erro.message, erro.status || 400).catch(next);
                return next(erro);
            }
        };

        this.status = async (req, res, next) => {
            try {
                if (!['true', 'false'].includes(req.body.ativo)) throw erroCadastro('Situação inválida.');
                const item = await atualizarAreaAtuacao(req.params.id, { ativo: req.body.ativo === 'true' });
                if (!item) return res.status(404).render('404', { title: 'Cadastro não encontrado' });
                return res.redirect('/admin/areas?mensagem=' + encodeURIComponent('Situação atualizada.'));
            } catch (erro) {
                if (erroEsperado(erro)) return renderPagina(res, '', {}, erro.message, erro.status || 400).catch(next);
                return next(erro);
            }
        };

        this.confirmDelete = async (req, res, next) => {
            try {
                const item = await buscarAreaAtuacao(req.params.id);
                if (!item) return res.status(404).render('404', { title: 'Cadastro não encontrado' });
                return res.render('admin/confirmar-remocao', {
                    title: 'Excluir área', nome: item.nome,
                    explicacao: 'A área deixará de aparecer nas opções para novos cadastros. Os nomes já salvos em perfis e ideias serão preservados.',
                    destino: `/admin/areas/${req.params.id}/excluir`, voltar: '/admin/areas', busca: '',
                    token: prepararConfirmacao(req, 'area', req.params.id),
                });
            } catch (erro) { return next(erro); }
        };

        this.del = async (req, res, next) => {
            try {
                if (!consumirConfirmacao(req, 'area', req.params.id)) return res.status(403).render('erro', {
                    title: 'Confirmação necessária', mensagemErro: 'Abra novamente a confirmação de exclusão.',
                });
                const item = await excluirAreaAtuacao(req.params.id);
                if (!item) return res.status(404).render('404', { title: 'Cadastro não encontrado' });
                return res.redirect('/admin/areas?mensagem=' + encodeURIComponent('Cadastro excluído com sucesso. Os cadastros existentes foram preservados.'));
            } catch (erro) {
                if (erroEsperado(erro)) return renderPagina(res, '', {}, erro.message, erro.status || 400).catch(next);
                return next(erro);
            }
        };
    }
}
