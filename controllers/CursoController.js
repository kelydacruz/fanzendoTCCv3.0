import {
    listarCursos,
    buscarCurso,
    cadastrarCurso,
    atualizarCurso,
    excluirCurso,
} from '../models/cursoOperacoes.js';
import { prepararConfirmacao, consumirConfirmacao } from '../services/confirmacao.js';
import { erroCadastro } from '../models/cadastroValidacao.js';

async function renderPagina(res, edicao = '', dados = {}, erro = '', status = 200) {
    return res.status(status).render('admin/cursos', {
        title: 'Cursos técnicos', cursos: await listarCursos(), edicao, dados, erro,
    });
}

function erroEsperado(erro) {
    return [400, 409].includes(erro.status) || erro.code === 11000 || erro.name === 'ValidationError';
}

export default class CursoController {
    constructor() {
        this.list = async (req, res, next) => {
            try { return await renderPagina(res); } catch (erro) { return next(erro); }
        };

        this.add = async (req, res, next) => {
            const dados = { nome: req.body.nome, sigla: req.body.sigla, area: req.body.area };
            try {
                await cadastrarCurso(dados);
                return res.redirect('/admin/cursos?mensagem=' + encodeURIComponent('Cadastro realizado com sucesso.'));
            } catch (erro) {
                if (erroEsperado(erro)) return renderPagina(res, '', dados, erro.code === 11000 ? 'Este cadastro já existe.' : erro.message, erro.status || 400).catch(next);
                return next(erro);
            }
        };

        this.openEdt = async (req, res, next) => {
            try {
                const item = await buscarCurso(req.params.id);
                if (!item) return res.status(404).render('404', { title: 'Cadastro não encontrado' });
                return await renderPagina(res, req.params.id, item);
            } catch (erro) { return next(erro); }
        };

        this.edt = async (req, res, next) => {
            const dados = { nome: req.body.nome, sigla: req.body.sigla, area: req.body.area };
            try {
                const item = await atualizarCurso(req.params.id, dados);
                if (!item) return res.status(404).render('404', { title: 'Cadastro não encontrado' });
                return res.redirect('/admin/cursos?mensagem=' + encodeURIComponent('Cadastro atualizado com sucesso.'));
            } catch (erro) {
                if (erroEsperado(erro)) return renderPagina(res, req.params.id, dados, erro.code === 11000 ? 'Este cadastro já existe.' : erro.message, erro.status || 400).catch(next);
                return next(erro);
            }
        };

        this.status = async (req, res, next) => {
            try {
                if (!['true', 'false'].includes(req.body.ativo)) throw erroCadastro('Situação inválida.');
                const item = await atualizarCurso(req.params.id, { ativo: req.body.ativo === 'true' });
                if (!item) return res.status(404).render('404', { title: 'Cadastro não encontrado' });
                return res.redirect('/admin/cursos?mensagem=' + encodeURIComponent('Situação atualizada.'));
            } catch (erro) {
                if (erroEsperado(erro)) return renderPagina(res, '', {}, erro.message, erro.status || 400).catch(next);
                return next(erro);
            }
        };

        this.confirmDelete = async (req, res, next) => {
            try {
                const item = await buscarCurso(req.params.id);
                if (!item) return res.status(404).render('404', { title: 'Cadastro não encontrado' });
                return res.render('admin/confirmar-remocao', {
                    title: 'Excluir curso', nome: item.nome,
                    explicacao: 'A exclusão será permitida somente se não houver vínculos. Se houver, use Desativar para preservar o histórico.',
                    destino: `/admin/cursos/${req.params.id}/excluir`, voltar: '/admin/cursos', busca: '',
                    token: prepararConfirmacao(req, 'curso', req.params.id),
                });
            } catch (erro) { return next(erro); }
        };

        this.del = async (req, res, next) => {
            try {
                if (!consumirConfirmacao(req, 'curso', req.params.id)) return res.status(403).render('erro', {
                    title: 'Confirmação necessária', mensagemErro: 'Abra novamente a confirmação de exclusão.',
                });
                const item = await excluirCurso(req.params.id);
                if (!item) return res.status(404).render('404', { title: 'Cadastro não encontrado' });
                return res.redirect('/admin/cursos?mensagem=' + encodeURIComponent('Cadastro excluído com sucesso. Os cadastros existentes foram preservados.'));
            } catch (erro) {
                if (erroEsperado(erro)) return renderPagina(res, '', {}, erro.message, erro.status || 400).catch(next);
                return next(erro);
            }
        };
    }
}
