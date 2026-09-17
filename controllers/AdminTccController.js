import { randomBytes } from 'node:crypto';
import { normalizarTexto } from '../services/texto.js';
import { marcarIdeiaUsada, liberarIdeia } from '../models/ideiaOperacoes.js';
import { avaliarTcc, buscarTccPorId, excluirTcc, listarTodosTccs } from '../models/tccOperacoes.js';
import { criarNotificacao } from '../models/notificacaoOperacoes.js';

function filtrosTcc(dados) {
    return {
        q: typeof dados.q === 'string' ? dados.q.trim().slice(0, 150) : '',
        situacao: ['em_analise', 'correcao_solicitada', 'publicado', 'rejeitado'].includes(dados.situacao) ? dados.situacao : '',
    };
}

function mensagem(res, caminho, texto) {
    return res.redirect(`${caminho}?mensagem=${encodeURIComponent(texto)}`);
}

export default class AdminTccController {
    constructor(caminhoBase = 'admin/') {
        this.tccs = async (req, res, next) => {
            try {
                const filtros = filtrosTcc(req.query);
                const todos = await listarTodosTccs();
                const termo = normalizarTexto(filtros.q);
                const tccs = todos.filter((tcc) => {
                    const texto = [tcc.titulo, tcc.tema, tcc.autor?.nome, tcc.orientadorUsuario?.nome,
                        tcc.orientador, tcc.curso, tcc.turma].filter(Boolean).join(' ');
                    return (!termo || normalizarTexto(texto).includes(termo))
                        && (!filtros.situacao || (tcc.status || 'publicado') === filtros.situacao);
                });
                return res.render(`${caminhoBase}tccs`, { title: 'Moderação de TCCs', tccs, filtros });
            } catch (erro) {
                return next(erro);
            }
        };

        this.confirmarExclusaoTcc = async (req, res, next) => {
            try {
                const tcc = await buscarTccPorId(req.params.id);
                if (!tcc) return res.status(404).render('404', { title: 'TCC não encontrado' });
                req.session.tokenExclusaoTcc = randomBytes(32).toString('hex');
                req.session.tccParaExcluir = String(req.params.id);
                return res.render(`${caminhoBase}excluir-tcc`, {
                    title: 'Excluir TCC', tcc, filtros: filtrosTcc(req.query),
                    token: req.session.tokenExclusaoTcc,
                });
            } catch (erro) {
                return next(erro);
            }
        };

        this.excluirTcc = async (req, res, next) => {
            try {
                if (!req.session.tokenExclusaoTcc || req.body.token !== req.session.tokenExclusaoTcc || req.session.tccParaExcluir !== String(req.params.id)) {
                    return res.status(403).render('erro', { title: 'Exclusão não confirmada', mensagemErro: 'Abra novamente a confirmação de exclusão do TCC.' });
                }
                const tcc = await buscarTccPorId(req.params.id);
                if (!tcc) return res.status(404).render('404', { title: 'TCC não encontrado' });
                delete req.session.tokenExclusaoTcc;
                delete req.session.tccParaExcluir;
                const autorId = tcc.autor?.id || tcc.autor?._id || tcc.autorId;
                const ideiaId = String(tcc.ideiaOrigem?.id || tcc.ideiaOrigem?._id || tcc.ideiaOrigemId || '');
                if (ideiaId && autorId) await liberarIdeia(ideiaId, autorId);
                await excluirTcc(req.params.id);
                if (autorId) await criarNotificacao({
                    destinatario: autorId, remetente: req.session.usuario.id, tipo: 'sistema',
                    mensagem: `A administração excluiu o TCC “${tcc.titulo}”.`,
                    link: '/painel',
                });
                const retorno = new URLSearchParams({ ...filtrosTcc(req.body), mensagem: 'TCC excluído com sucesso.' });
                return res.redirect(`/admin/tccs?${retorno}`);
            } catch (erro) {
                return next(erro);
            }
        };

        this.alterarTcc = async (req, res, next) => {
            const statusPermitidos = ['em_analise', 'correcao_solicitada', 'publicado', 'rejeitado'];
            try {
                if (!statusPermitidos.includes(req.body.status)) {
                    return mensagem(res, '/admin/tccs', 'Situação inválida.');
                }
                const tcc = await buscarTccPorId(req.params.id);
                if (!tcc) return mensagem(res, '/admin/tccs', 'TCC não encontrado.');
                await avaliarTcc(req.params.id, {
                    status: req.body.status,
                    feedbackOrientador: req.body.feedbackOrientador,
                });
                const autorId = tcc.autor?.id || tcc.autor?._id || tcc.autorId;
                const ideiaId = String(tcc.ideiaOrigem?.id || tcc.ideiaOrigem?._id || tcc.ideiaOrigemId || '');
                if (ideiaId && req.body.status === 'publicado') await marcarIdeiaUsada(ideiaId, req.params.id);
                if (ideiaId && req.body.status === 'rejeitado' && autorId) await liberarIdeia(ideiaId, autorId);
                if (autorId && ['publicado', 'correcao_solicitada', 'rejeitado'].includes(req.body.status)) {
                    await criarNotificacao({
                        destinatario: autorId,
                        remetente: req.session.usuario.id,
                        tipo: req.body.status === 'publicado' ? 'tcc_aprovado' : 'correcao_solicitada',
                        mensagem: req.body.status === 'publicado'
                            ? `A administração aprovou seu TCC para o acervo ${tcc.visibilidade === 'interno' ? 'interno' : 'público'}.`
                            : 'A administração atualizou a situação do seu TCC. Consulte os detalhes.',
                        link: `/tcc/detalhes/${req.params.id}`,
                    });
                }
                const retorno = new URLSearchParams({ ...filtrosTcc(req.body), mensagem: 'Situação do TCC atualizada. Se o trabalho deixou de corresponder ao filtro, ele não aparece nesta lista.' });
                return res.redirect(`/admin/tccs?${retorno}`);
            } catch (erro) {
                return next(erro);
            }
        };

    }
}
