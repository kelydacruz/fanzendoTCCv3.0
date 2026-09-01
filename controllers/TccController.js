import {
    atualizarTcc,
    avaliarTcc,
    buscarTccDoAluno,
    buscarTccPorId,
    buscarUsuarioPorId,
    cadastrarComentario,
    cadastrarTcc,
    excluirTcc,
    listarComentarios,
    listarProfessores,
    listarTccs,
    listarTccsDoOrientador,
    listarTccsRelacionados,
    obterPdfTcc,
    registrarDownloadTcc,
    registrarVisualizacaoTcc,
} from '../services/repositorio.js';
import { validarConteudo } from '../services/filtroConteudo.js';
import { separarLista } from '../services/texto.js';
import { obterId, usuarioEhAdmin, usuarioEhDono } from '../services/permissoes.js';
import { anoValido, comentarioValido, textoComTamanho } from '../services/validacao.js';

function dadosDoFormulario(body, arquivo, orientador) {
    const dados = {
        titulo: String(body.titulo || '').trim(),
        tema: String(body.tema || '').trim(),
        resumo: String(body.resumo || '').trim(),
        curso: String(body.curso || '').trim(),
        area: String(body.area || '').trim(),
        turma: String(body.turma || '').trim(),
        orientador: orientador?.nome || '',
        orientadorUsuario: orientador?.id || orientador?._id || null,
        ano: Number(body.ano),
        coautores: separarLista(body.coautores),
        palavrasChave: separarLista(body.palavrasChave),
    };

    if (arquivo) {
        dados.pdf = { dados: arquivo.buffer, nome: arquivo.originalname, tipo: arquivo.mimetype };
    }
    return dados;
}

function dadosValidos(dados) {
    return textoComTamanho(dados.titulo, 3, 180)
        && textoComTamanho(dados.tema, 2, 100)
        && textoComTamanho(dados.resumo, 30, 3000)
        && textoComTamanho(dados.curso, 2, 100)
        && textoComTamanho(dados.area, 2, 100)
        && textoComTamanho(dados.turma, 2, 50)
        && textoComTamanho(dados.orientador, 3, 100)
        && anoValido(dados.ano)
        && dados.coautores.every((nome) => textoComTamanho(nome, 1, 100))
        && dados.palavrasChave.every((palavra) => textoComTamanho(palavra, 1, 50));
}

function usuarioEhOrientador(usuario, tcc) {
    return usuario?.perfil === 'professor'
        && obterId(usuario) === obterId(tcc?.orientadorUsuario || tcc?.orientadorId);
}

function podeVisualizar(usuario, tcc) {
    return !tcc?.status
        || tcc.status === 'publicado'
        || usuarioEhDono(usuario, tcc)
        || usuarioEhOrientador(usuario, tcc)
        || usuarioEhAdmin(usuario);
}

async function orientadorValido(id) {
    const usuario = await buscarUsuarioPorId(id);
    if (!usuario || usuario.perfil !== 'professor' || usuario.ativo === false) return null;
    return usuario;
}

async function renderFormulario(res, pagina, status, erro, dados) {
    const professores = await listarProfessores();
    return res.status(status).render(`tcc/${pagina}`, {
        title: pagina === 'add' ? 'Enviar TCC' : 'Editar TCC', erro, dados, professores,
    });
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
                };
                const [tccs, todos] = await Promise.all([listarTccs(filtros), listarTccs()]);
                const opcoes = {
                    cursos: [...new Set(todos.map((tcc) => tcc.curso))].sort(),
                    anos: [...new Set(todos.map((tcc) => tcc.ano))].sort((a, b) => b - a),
                    areas: [...new Set(todos.map((tcc) => tcc.area).filter(Boolean))].sort(),
                    orientadores: [...new Set(todos.map((tcc) => tcc.orientador))].sort(),
                };
                return res.render(`${caminhoBase}lst`, { title: 'TCCs publicados', tccs, filtros, opcoes });
            } catch (erro) {
                return next(erro);
            }
        };

        this.details = async (req, res, next) => {
            try {
                const tcc = await buscarTccPorId(req.params.id);
                if (!tcc || !podeVisualizar(req.session.usuario, tcc)) {
                    return res.status(404).render('404', { title: 'TCC não encontrado' });
                }
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
                    podeAvaliar: usuarioEhOrientador(req.session.usuario, tcc),
                    temPdf: Boolean(tcc.pdf?.nome || tcc.pdf?.dados),
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
                return renderFormulario(res, 'add', 200, '', {});
            } catch (erro) {
                return next(erro);
            }
        };

        this.add = async (req, res, next) => {
            try {
                const existente = await buscarTccDoAluno(req.session.usuario.id);
                if (existente) return res.redirect(`/tcc/detalhes/${obterId(existente)}?mensagem=Você já possui um TCC cadastrado.`);

                const orientador = await orientadorValido(req.body.orientadorUsuario);
                const dados = dadosDoFormulario(req.body, req.file, orientador);
                validarConteudo(dados.titulo, dados.tema, dados.resumo, dados.palavrasChave.join(' '));
                if (!dadosValidos(dados)) {
                    return renderFormulario(res, 'add', 400, 'Preencha corretamente os campos obrigatórios e escolha um professor orientador.', req.body);
                }

                const tcc = await cadastrarTcc({
                    ...dados,
                    autor: req.session.usuario.id,
                    status: 'em_analise',
                    feedbackOrientador: '',
                    enviadoEm: new Date(),
                });
                return res.redirect(`/tcc/detalhes/${obterId(tcc)}?mensagem=${encodeURIComponent('TCC enviado ao professor orientador para análise.')}`);
            } catch (erro) {
                if (erro.message.includes('termo não permitido')) return renderFormulario(res, 'add', 400, erro.message, req.body);
                return next(erro);
            }
        };

        this.openEdt = async (req, res, next) => {
            try {
                const tcc = await buscarTccPorId(req.params.id);
                if (!tcc) return res.status(404).render('404', { title: 'TCC não encontrado' });
                if (!usuarioEhDono(req.session.usuario, tcc)) return res.redirect(`/tcc/detalhes/${req.params.id}?mensagem=Você só pode editar seu próprio TCC.`);
                if (!['em_analise', 'correcao_solicitada'].includes(tcc.status)) return res.redirect(`/tcc/detalhes/${req.params.id}?mensagem=Este TCC não está disponível para edição.`);
                return renderFormulario(res, 'edt', 200, '', tcc);
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

                const orientador = await orientadorValido(req.body.orientadorUsuario);
                const dados = dadosDoFormulario(req.body, req.file, orientador);
                validarConteudo(dados.titulo, dados.tema, dados.resumo, dados.palavrasChave.join(' '));
                if (!dadosValidos(dados)) {
                    return renderFormulario(res, 'edt', 400, 'Preencha corretamente os campos obrigatórios.', { ...tcc, ...req.body });
                }

                await atualizarTcc(req.params.id, {
                    ...dados,
                    status: 'em_analise',
                    feedbackOrientador: '',
                    enviadoEm: new Date(),
                    avaliadoEm: null,
                });
                return res.redirect(`/tcc/detalhes/${req.params.id}?mensagem=${encodeURIComponent('Correções enviadas novamente ao orientador.')}`);
            } catch (erro) {
                if (erro.message.includes('termo não permitido')) return renderFormulario(res, 'edt', 400, erro.message, req.body);
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
                await excluirTcc(req.params.id);
                return res.redirect('/painel?mensagem=TCC excluído com sucesso.');
            } catch (erro) {
                return next(erro);
            }
        };

        this.pdf = async (req, res, next) => {
            try {
                const tcc = await buscarTccPorId(req.params.id);
                if (!tcc || !podeVisualizar(req.session.usuario, tcc)) return res.status(404).render('404', { title: 'TCC não encontrado' });
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
                const tcc = await buscarTccPorId(req.params.id);
                if (!tcc || !podeVisualizar(req.session.usuario, tcc)) return res.status(404).render('404', { title: 'TCC não encontrado' });
                const texto = String(req.body.texto || '').trim();
                validarConteudo(texto);
                if (!comentarioValido(texto)) return res.redirect(`/tcc/detalhes/${req.params.id}?mensagem=O comentário deve ter entre 1 e 500 caracteres.`);
                await cadastrarComentario({ texto, autor: req.session.usuario.id, alvoTipo: 'tcc', alvoId: req.params.id });
                return res.redirect(`/tcc/detalhes/${req.params.id}?mensagem=Comentário publicado.`);
            } catch (erro) {
                if (erro.message.includes('termo não permitido')) return res.redirect(`/tcc/detalhes/${req.params.id}?mensagem=${encodeURIComponent(erro.message)}`);
                return next(erro);
            }
        };

        this.orientacoes = async (req, res, next) => {
            try {
                const tccs = await listarTccsDoOrientador(req.session.usuario.id);
                return res.render(`${caminhoBase}orientacoes`, { title: 'TCCs orientados', tccs });
            } catch (erro) {
                return next(erro);
            }
        };

        this.avaliar = async (req, res, next) => {
            try {
                const tcc = await buscarTccPorId(req.params.id);
                if (!tcc || !usuarioEhOrientador(req.session.usuario, tcc)) return res.redirect('/orientacoes?mensagem=Você não é o orientador deste TCC.');
                const status = req.body.acao === 'aprovar' ? 'publicado' : 'correcao_solicitada';
                const feedback = String(req.body.feedbackOrientador || '').trim();
                if (status === 'correcao_solicitada' && !textoComTamanho(feedback, 5, 2000)) {
                    return res.redirect(`/tcc/detalhes/${req.params.id}?mensagem=Explique as correções necessárias.`);
                }
                await avaliarTcc(req.params.id, { status, feedbackOrientador: feedback });
                const texto = status === 'publicado' ? 'TCC aprovado e publicado no acervo.' : 'Correções solicitadas ao aluno.';
                return res.redirect(`/tcc/detalhes/${req.params.id}?mensagem=${encodeURIComponent(texto)}`);
            } catch (erro) {
                return next(erro);
            }
        };
    }
}
