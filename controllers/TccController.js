import { resumirTecnologias } from '../models/tecnologias.js';
import {
    atualizarTcc,
    buscarTccDoAluno,
    buscarTccPorId,
    cadastrarTcc,
    excluirTcc,
    listarTccs,
    listarTccsRelacionados,
    obterPdfTcc,
    registrarDownloadTcc,
    registrarVisualizacaoTcc,
} from '../models/tccOperacoes.js';
import { buscarIdeiaReservadaPeloAluno, liberarIdeia } from '../models/ideiaOperacoes.js';
import { cadastrarComentario, listarComentarios } from '../models/comentarioOperacoes.js';
import { criarNotificacao } from '../models/notificacaoOperacoes.js';
import { validarConteudo } from '../models/filtroConteudo.js';
import { obterId, usuarioEhDono } from '../models/permissoes.js';
import { comentarioValido } from '../services/validacao.js';

import {
    usuarioInstitucional,
    usuarioEhOrientador,
    podeVisualizar,
    opcoesFormulario,
    contextoDoFormulario,
    dadosDoFormulario,
    validarDados,
} from '../models/tccRegras.js';

async function renderFormulario(res, pagina, status, erro, dados, alunoId, erros = {}) {
    const opcoes = await opcoesFormulario(alunoId);
    return res.status(status).render(`tcc/${pagina}`, {
        title: pagina === 'add' ? 'Enviar TCC' : 'Editar TCC',
        erro,
        erros,
        dados,
        ...opcoes,
    });
}

function primeiraMensagem(erros) {
    return Object.values(erros)[0] || '';
}

export default class TccController {
    constructor(caminhoBase = 'tcc/') {
        this.caminhoBase = caminhoBase;

        this.list = async (req, res, next) => {
            try {
                const filtros = {
                    q: req.query.q,
                    curso: req.query.curso,
                    ano: req.query.ano,
                    area: req.query.area,
                    orientador: req.query.orientador,
                    ordem: req.query.ordem || 'recentes',
                    usuario: req.session.usuario || null,
                };
                const [tccs, todos] = await Promise.all([listarTccs(filtros), listarTccs({ usuario: filtros.usuario })]);
                const opcoes = {
                    cursos: [...new Set(todos.map((tcc) => tcc.curso))].sort(),
                    anos: [...new Set(todos.map((tcc) => tcc.ano))].sort((a, b) => b - a),
                    areas: [...new Set(todos.map((tcc) => tcc.area).filter(Boolean))].sort(),
                    orientadores: [...new Set(todos.map((tcc) => tcc.orientador))].sort(),
                };
                return res.render(`${caminhoBase}lst`, { title: 'TCCs publicados', tccs, filtros, opcoes, grafico: resumirTecnologias(tccs) });
            } catch (erro) {
                return next(erro);
            }
        };

        this.details = async (req, res, next) => {
            try {
                const tcc = await buscarTccPorId(req.params.id);
                if (!podeVisualizar(req.session.usuario, tcc)) return res.status(404).render('404', { title: 'TCC não encontrado' });
                if (!tcc.status || tcc.status === 'publicado') await registrarVisualizacaoTcc(req.params.id);
                const [comentarios, relacionados] = await Promise.all([
                    listarComentarios('tcc', req.params.id),
                    (!tcc.status || tcc.status === 'publicado') ? listarTccsRelacionados(tcc) : [],
                ]);
                const dono = usuarioEhDono(req.session.usuario, tcc);
                return res.render(`${caminhoBase}detalhes`, {
                    title: tcc.titulo,
                    tcc,
                    comentarios,
                    relacionados,
                    podeEditar: dono && ['em_analise', 'correcao_solicitada'].includes(tcc.status),
                    podeExcluir: dono && tcc.status !== 'publicado',
                    podeAvaliar: usuarioEhOrientador(req.session.usuario, tcc)
                        && ['em_analise', 'correcao_solicitada'].includes(tcc.status),
                    temPdf: Boolean(tcc.pdf?.nome || tcc.pdf?.dados),
                    comentariosPermitidos: usuarioInstitucional(req.session.usuario),
                });
            } catch (erro) {
                return next(erro);
            }
        };

        this.openAdd = async (req, res, next) => {
            try {
                const existente = await buscarTccDoAluno(req.session.usuario.id);
                if (existente) {
                    return res.redirect(`/tcc/detalhes/${obterId(existente)}?mensagem=${encodeURIComponent('Cada aluno pode enviar um TCC. Edite o trabalho já cadastrado.')}`);
                }
                const ideia = await buscarIdeiaReservadaPeloAluno(req.session.usuario.id);
                return renderFormulario(res, 'add', 200, '', {
                    visibilidade: 'interno',
                    curso: req.session.usuario.curso || '',
                    ideiaOrigem: obterId(ideia),
                }, req.session.usuario.id);
            } catch (erro) {
                return next(erro);
            }
        };

        this.add = async (req, res, next) => {
            try {
                const existente = await buscarTccDoAluno(req.session.usuario.id);
                if (existente) return res.redirect(`/tcc/detalhes/${obterId(existente)}?mensagem=Você já possui um TCC cadastrado.`);

                const contexto = await contextoDoFormulario(req.body, req.session.usuario.id);
                const dados = dadosDoFormulario(req.body, req.file, contexto);
                validarConteudo(dados.titulo, dados.tema, dados.resumo, dados.palavrasChave.join(' '), dados.tecnologias.join(' '));
                const erros = validarDados(dados, contexto);
                if (Object.keys(erros).length) {
                    return renderFormulario(res, 'add', 400, primeiraMensagem(erros), req.body, req.session.usuario.id, erros);
                }

                const tcc = await cadastrarTcc({
                    ...dados,
                    autor: req.session.usuario.id,
                    status: 'em_analise',
                    feedbackOrientador: '',
                    enviadoEm: new Date(),
                });
                await criarNotificacao({
                    destinatario: dados.orientadorUsuario,
                    remetente: req.session.usuario.id,
                    tipo: 'tcc_recebido',
                    mensagem: `${req.session.usuario.nome} enviou um TCC para sua orientação.`,
                    link: `/tcc/detalhes/${obterId(tcc)}`,
                });
                return res.redirect(`/tcc/detalhes/${obterId(tcc)}?mensagem=${encodeURIComponent('TCC enviado ao professor orientador para análise.')}`);
            } catch (erro) {
                if (erro.message.includes('termo não permitido')) {
                    return renderFormulario(res, 'add', 400, erro.message, req.body, req.session.usuario.id);
                }
                return next(erro);
            }
        };

        this.openEdt = async (req, res, next) => {
            try {
                const tcc = await buscarTccPorId(req.params.id);
                if (!tcc) return res.status(404).render('404', { title: 'TCC não encontrado' });
                if (!usuarioEhDono(req.session.usuario, tcc)) return res.redirect(`/tcc/detalhes/${req.params.id}?mensagem=Você só pode editar seu próprio TCC.`);
                if (!['em_analise', 'correcao_solicitada'].includes(tcc.status)) return res.redirect(`/tcc/detalhes/${req.params.id}?mensagem=Este TCC não está disponível para edição.`);
                return renderFormulario(res, 'edt', 200, '', tcc, req.session.usuario.id);
            } catch (erro) {
                return next(erro);
            }
        };

        this.edt = async (req, res, next) => {
            try {
                const tcc = await buscarTccPorId(req.params.id);
                if (!tcc) return res.status(404).render('404', { title: 'TCC não encontrado' });
                if (!usuarioEhDono(req.session.usuario, tcc)) return res.redirect(`/tcc/detalhes/${req.params.id}?mensagem=Você só pode editar seu próprio TCC.`);
                if (!['em_analise', 'correcao_solicitada'].includes(tcc.status)) return res.redirect(`/tcc/detalhes/${req.params.id}?mensagem=Este TCC não está disponível para edição.`);

                const contexto = await contextoDoFormulario(req.body, req.session.usuario.id);
                const dados = dadosDoFormulario(req.body, req.file, contexto);
                validarConteudo(dados.titulo, dados.tema, dados.resumo, dados.palavrasChave.join(' '), dados.tecnologias.join(' '));
                const erros = validarDados(dados, contexto);
                if (Object.keys(erros).length) {
                    return renderFormulario(res, 'edt', 400, primeiraMensagem(erros), { ...tcc, ...req.body }, req.session.usuario.id, erros);
                }

                await atualizarTcc(req.params.id, {
                    ...dados,
                    status: 'em_analise',
                    feedbackOrientador: '',
                    enviadoEm: new Date(),
                    avaliadoEm: null,
                });
                await criarNotificacao({
                    destinatario: dados.orientadorUsuario,
                    remetente: req.session.usuario.id,
                    tipo: 'tcc_recebido',
                    mensagem: `${req.session.usuario.nome} reenviou o TCC com as correções solicitadas.`,
                    link: `/tcc/detalhes/${req.params.id}`,
                });
                return res.redirect(`/tcc/detalhes/${req.params.id}?mensagem=${encodeURIComponent('Correções enviadas novamente ao orientador.')}`);
            } catch (erro) {
                if (erro.message.includes('termo não permitido')) {
                    return renderFormulario(res, 'edt', 400, erro.message, req.body, req.session.usuario.id);
                }
                return next(erro);
            }
        };

        this.del = async (req, res, next) => {
            try {
                const tcc = await buscarTccPorId(req.params.id);
                if (!tcc) return res.status(404).render('404', { title: 'TCC não encontrado' });
                if (!usuarioEhDono(req.session.usuario, tcc) || tcc.status === 'publicado') {
                    return res.redirect(`/tcc/detalhes/${req.params.id}?mensagem=Este TCC não pode ser excluído pelo aluno.`);
                }
                const ideiaId = obterId(tcc.ideiaOrigem || tcc.ideiaOrigemId);
                if (ideiaId) await liberarIdeia(ideiaId, req.session.usuario.id);
                await excluirTcc(req.params.id);
                return res.redirect('/painel?mensagem=TCC excluído com sucesso.');
            } catch (erro) {
                return next(erro);
            }
        };

        this.pdf = async (req, res, next) => {
            try {
                const tcc = await buscarTccPorId(req.params.id);
                if (!podeVisualizar(req.session.usuario, tcc)) return res.status(404).render('404', { title: 'TCC não encontrado' });
                const pdf = await obterPdfTcc(req.params.id);
                if (!pdf) return res.status(404).render('erro', { title: 'PDF indisponível', mensagemErro: 'Este TCC ainda não possui um PDF anexado.' });
                if (!tcc.status || tcc.status === 'publicado') await registrarDownloadTcc(req.params.id);
                res.type(pdf.tipo || 'application/pdf');
                const nomeSeguro = String(pdf.nome || 'tcc.pdf').replace(/[^a-zA-Z0-9._-]/g, '_');
                res.setHeader('Content-Disposition', `inline; filename="${nomeSeguro}"`);
                res.setHeader('X-Content-Type-Options', 'nosniff');
                return res.send(pdf.dados);
            } catch (erro) {
                return next(erro);
            }
        };

        this.comment = async (req, res, next) => {
            try {
                if (!usuarioInstitucional(req.session.usuario)) {
                    return res.redirect(`/tcc/detalhes/${req.params.id}?mensagem=Somente a comunidade escolar pode comentar em TCCs.`);
                }
                const tcc = await buscarTccPorId(req.params.id);
                if (!podeVisualizar(req.session.usuario, tcc)) return res.status(404).render('404', { title: 'TCC não encontrado' });
                const texto = String(req.body.texto || '').trim();
                validarConteudo(texto);
                if (!comentarioValido(texto)) return res.redirect(`/tcc/detalhes/${req.params.id}?mensagem=O comentário deve ter entre 1 e 500 caracteres.`);
                await cadastrarComentario({ texto, autor: req.session.usuario.id, alvoTipo: 'tcc', alvoId: req.params.id });
                const autorId = obterId(tcc.autor || tcc.autorId);
                if (autorId && autorId !== obterId(req.session.usuario)) {
                    await criarNotificacao({
                        destinatario: autorId,
                        remetente: req.session.usuario.id,
                        tipo: 'comentario',
                        mensagem: `${req.session.usuario.nome} comentou no seu TCC.`,
                        link: `/tcc/detalhes/${req.params.id}`,
                    });
                }
                return res.redirect(`/tcc/detalhes/${req.params.id}?mensagem=Comentário publicado.`);
            } catch (erro) {
                if (erro.message.includes('termo não permitido')) return res.redirect(`/tcc/detalhes/${req.params.id}?mensagem=${encodeURIComponent(erro.message)}`);
                return next(erro);
            }
        };

    }
}
