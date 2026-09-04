import {
    atualizarTcc,
    avaliarTcc,
    buscarIdeiaReservadaPeloAluno,
    buscarTccDoAluno,
    buscarTccPorId,
    buscarUsuarioPorId,
    cadastrarComentario,
    cadastrarTcc,
    criarNotificacao,
    excluirTcc,
    liberarIdeia,
    listarComentarios,
    listarCursos,
    listarProfessores,
    listarTccs,
    listarTccsDoOrientador,
    listarTccsRelacionados,
    listarTurmas,
    marcarIdeiaUsada,
    obterPdfTcc,
    registrarDownloadTcc,
    registrarVisualizacaoTcc,
} from '../services/repositorio.js';
import { validarConteudo } from '../services/filtroConteudo.js';
import { separarLista } from '../services/texto.js';
import { obterId, usuarioEhAdmin, usuarioEhDono } from '../services/permissoes.js';
import { comentarioValido, textoComTamanho } from '../services/validacao.js';

function usuarioInstitucional(usuario) {
    return ['aluno', 'professor', 'admin'].includes(usuario?.perfil);
}

function usuarioEhOrientador(usuario, tcc) {
    return usuario?.perfil === 'professor'
        && obterId(usuario) === obterId(tcc?.orientadorUsuario || tcc?.orientadorId);
}

function podeVisualizar(usuario, tcc) {
    if (!tcc) return false;
    if (!tcc.status || tcc.status === 'publicado') {
        return tcc.visibilidade !== 'interno' || usuarioInstitucional(usuario);
    }
    return usuarioEhDono(usuario, tcc) || usuarioEhOrientador(usuario, tcc) || usuarioEhAdmin(usuario);
}

async function opcoesFormulario(alunoId) {
    const [professores, cursos, turmas, ideiaEmDesenvolvimento] = await Promise.all([
        listarProfessores(),
        listarCursos({ somenteAtivos: true }),
        listarTurmas({ somenteAtivas: true }),
        buscarIdeiaReservadaPeloAluno(alunoId),
    ]);
    return { professores, cursos, turmas, ideiaEmDesenvolvimento };
}

function localizarOpcao(opcoes, valor, nomeAlternativo = '') {
    return opcoes.find((opcao) => obterId(opcao) === String(valor || ''))
        || opcoes.find((opcao) => opcao.nome === nomeAlternativo)
        || null;
}

async function contextoDoFormulario(body, alunoId) {
    const opcoes = await opcoesFormulario(alunoId);
    const curso = localizarOpcao(opcoes.cursos, body.cursoCadastro, String(body.curso || '').trim());
    const turma = opcoes.turmas.find((item) => obterId(item) === String(body.turmaCadastro || ''))
        || opcoes.turmas.find((item) => item.nome === String(body.turma || '').trim())
        || null;
    const orientador = await buscarUsuarioPorId(body.orientadorUsuario);
    const orientadorValido = orientador?.perfil === 'professor' && orientador.ativo !== false
        ? orientador
        : null;
    const ideiaId = String(body.ideiaOrigem || '');
    const ideia = ideiaId && obterId(opcoes.ideiaEmDesenvolvimento) === ideiaId
        ? opcoes.ideiaEmDesenvolvimento
        : null;
    return { ...opcoes, curso, turma, orientador: orientadorValido, ideia };
}

function dadosDoFormulario(body, arquivo, contexto) {
    const turma = contexto.turma;
    const dados = {
        titulo: String(body.titulo || '').trim(),
        tema: String(body.tema || '').trim(),
        resumo: String(body.resumo || '').trim(),
        curso: contexto.curso?.nome || '',
        cursoCadastro: obterId(contexto.curso) || null,
        area: String(body.area || '').trim(),
        turma: turma ? `${turma.nome} — ${turma.ano}` : '',
        turmaCadastro: obterId(turma) || null,
        orientador: contexto.orientador?.nome || '',
        orientadorUsuario: obterId(contexto.orientador) || null,
        ideiaOrigem: obterId(contexto.ideia) || null,
        visibilidade: ['publico', 'interno'].includes(body.visibilidade) ? body.visibilidade : '',
        ano: Number(turma?.ano),
        coautores: separarLista(body.coautores),
        palavrasChave: separarLista(body.palavrasChave),
    };
    if (arquivo) dados.pdf = { dados: arquivo.buffer, nome: arquivo.originalname, tipo: arquivo.mimetype };
    return dados;
}

function validarDados(dados, contexto) {
    const erros = {};
    if (!textoComTamanho(dados.titulo, 3, 180)) erros.titulo = 'Informe um título entre 3 e 180 caracteres.';
    if (!textoComTamanho(dados.tema, 2, 100)) erros.tema = 'Informe o tema do trabalho.';
    if (!textoComTamanho(dados.resumo, 30, 3000)) erros.resumo = 'O resumo deve ter entre 30 e 3.000 caracteres.';
    if (!contexto.curso) erros.cursoCadastro = 'Selecione um curso cadastrado pela administração.';
    if (!textoComTamanho(dados.area, 2, 100)) erros.area = 'Informe a área do conhecimento.';
    if (!contexto.turma) erros.turmaCadastro = 'Selecione uma turma cadastrada pela administração.';
    if (contexto.turma && contexto.curso
        && obterId(contexto.turma.curso || contexto.turma.cursoId) !== obterId(contexto.curso)) {
        erros.turmaCadastro = 'A turma selecionada não pertence ao curso escolhido.';
    }
    if (!contexto.orientador) erros.orientadorUsuario = 'Selecione um professor orientador ativo e confirmado.';
    if (!['publico', 'interno'].includes(dados.visibilidade)) erros.visibilidade = 'Escolha se o TCC será público ou interno.';
    if (dados.coautores.some((nome) => !textoComTamanho(nome, 1, 100))) erros.coautores = 'Cada coautor pode ter no máximo 100 caracteres.';
    if (dados.palavrasChave.some((palavra) => !textoComTamanho(palavra, 1, 50))) erros.palavrasChave = 'Cada palavra-chave pode ter no máximo 50 caracteres.';
    return erros;
}

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
                return res.render(`${caminhoBase}lst`, { title: 'TCCs publicados', tccs, filtros, opcoes });
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
                        && ['em_analise', 'correcao_solicitada', 'publicado'].includes(tcc.status),
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
                validarConteudo(dados.titulo, dados.tema, dados.resumo, dados.palavrasChave.join(' '));
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
                validarConteudo(dados.titulo, dados.tema, dados.resumo, dados.palavrasChave.join(' '));
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
                if (!['em_analise', 'correcao_solicitada', 'publicado'].includes(tcc.status)) return res.redirect(`/tcc/detalhes/${req.params.id}?mensagem=Este TCC já foi avaliado.`);
                const status = req.body.acao === 'aprovar' ? 'publicado' : 'correcao_solicitada';
                const feedback = String(req.body.feedbackOrientador || '').trim();
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

                const texto = status === 'publicado' ? 'TCC aprovado e publicado no acervo.' : 'Correções solicitadas ao aluno.';
                return res.redirect(`/tcc/detalhes/${req.params.id}?mensagem=${encodeURIComponent(texto)}`);
            } catch (erro) {
                return next(erro);
            }
        };
    }
}
