import { avaliarTcc, buscarTccPorId, listarTccsDoOrientador } from '../models/tccOperacoes.js';
import { marcarIdeiaUsada } from '../models/ideiaOperacoes.js';
import { criarNotificacao } from '../models/notificacaoOperacoes.js';
import { obterId } from '../models/permissoes.js';
import { textoComTamanho } from '../services/validacao.js';

import { usuarioEhOrientador } from '../models/tccRegras.js';

export default class OrientacaoController {
    constructor(caminhoBase = 'tcc/') {
        this.orientacoes = async (req, res, next) => {
            try {
                const todos = await listarTccsDoOrientador(req.session.usuario.id);
                const abas = [
                    { valor: 'em_analise', nome: 'Pendentes' },
                    { valor: 'correcao_solicitada', nome: 'Aguardando correção' },
                    { valor: 'publicado', nome: 'Aprovados' },
                    { valor: 'rejeitado', nome: 'Rejeitados' },
                ];
                const situacao = abas.some((aba) => aba.valor === req.query.situacao) ? req.query.situacao : 'em_analise';
                const statusDoTcc = (tcc) => tcc.status || 'publicado';
                const tccs = todos.filter((tcc) => statusDoTcc(tcc) === situacao);
                abas.forEach((aba) => { aba.total = todos.filter((tcc) => statusDoTcc(tcc) === aba.valor).length; });
                return res.render(`${caminhoBase}orientacoes`, { title: 'TCCs orientados', tccs, abas, situacao });
            } catch (erro) {
                return next(erro);
            }
        };

        this.avaliar = async (req, res, next) => {
            try {
                const tcc = await buscarTccPorId(req.params.id);
                if (!tcc || !usuarioEhOrientador(req.session.usuario, tcc)) return res.redirect('/orientacoes?mensagem=Você não é o orientador deste TCC.');
                if (!['em_analise', 'correcao_solicitada'].includes(tcc.status)) return res.redirect(`/tcc/detalhes/${req.params.id}?mensagem=Este TCC já foi avaliado.`);
                if (!['aprovar', 'corrigir'].includes(req.body.acao)) return res.redirect('/orientacoes?mensagem=Ação inválida.');
                const status = req.body.acao === 'aprovar' ? 'publicado' : 'correcao_solicitada';
                const feedback = String(req.body.feedbackOrientador || '').trim();
                if (feedback.length > 2000) return res.redirect(`/tcc/detalhes/${req.params.id}?mensagem=O parecer deve ter até 2.000 caracteres.`);
                if (status === 'correcao_solicitada' && !textoComTamanho(feedback, 5, 2000)) {
                    return res.redirect(`/tcc/detalhes/${req.params.id}?mensagem=Explique as correções necessárias.`);
                }
                await avaliarTcc(req.params.id, { status, feedbackOrientador: feedback });
                const autorId = obterId(tcc.autor || tcc.autorId);
                await criarNotificacao({
                    destinatario: autorId,
                    remetente: req.session.usuario.id,
                    tipo: status === 'publicado' ? 'tcc_aprovado' : 'correcao_solicitada',
                    mensagem: status === 'publicado'
                        ? `Seu TCC foi aprovado no acervo ${tcc.visibilidade === 'interno' ? 'interno' : 'público'}.`
                        : 'O professor orientador solicitou correções no seu TCC.',
                    link: `/tcc/detalhes/${req.params.id}`,
                });

                if (status === 'publicado') {
                    const ideiaId = obterId(tcc.ideiaOrigem || tcc.ideiaOrigemId);
                    const ideia = ideiaId ? await marcarIdeiaUsada(ideiaId, req.params.id) : null;
                    const autorIdeiaId = obterId(ideia?.autor || ideia?.autorId);
                    if (ideia && autorIdeiaId && autorIdeiaId !== autorId) {
                        await criarNotificacao({
                            destinatario: autorIdeiaId,
                            remetente: req.session.usuario.id,
                            tipo: 'ideia_usada',
                            mensagem: `A ideia “${ideia.titulo}” foi utilizada em um TCC aprovado.`,
                            link: `/ideia/detalhes/${ideiaId}`,
                        });
                    }
                }

                const texto = status === 'publicado' ? 'TCC aprovado e publicado com sucesso. Consulte a aba Aprovados.' : 'Correções enviadas ao aluno com sucesso. O trabalho está em Aguardando correção.';
                return res.redirect(`/orientacoes?mensagem=${encodeURIComponent(texto)}`);
            } catch (erro) {
                return next(erro);
            }
        };
    }
}
