import {
    atualizarIdeia,
    buscarIdeiaPorId,
    cadastrarComentario,
    cadastrarIdeia,
    criarNotificacao,
    excluirIdeia,
    liberarIdeia,
    listarComentarios,
    listarCursos,
    listarIdeias,
    registrarInteresseIdeia,
    reservarIdeia,
} from '../services/repositorio.js';
import { validarConteudo } from '../services/filtroConteudo.js';
import { obterId, usuarioEhAdmin, usuarioEhDono } from '../services/permissoes.js';
import { comentarioValido, textoComTamanho } from '../services/validacao.js';

function dadosDoFormulario(body) {
    return {
        titulo: String(body.titulo || '').trim(),
        tema: String(body.tema || '').trim(),
        descricao: String(body.descricao || '').trim(),
        curso: String(body.curso || '').trim(),
        dificuldade: ['Iniciante', 'Intermediária', 'Avançada'].includes(body.dificuldade)
            ? body.dificuldade
            : 'Intermediária',
    };
}

function validarDados(dados, cursos) {
    if (!textoComTamanho(dados.titulo, 3, 180)) return 'Informe um título entre 3 e 180 caracteres.';
    if (!textoComTamanho(dados.tema, 2, 100)) return 'Informe o tema da ideia.';
    if (!textoComTamanho(dados.descricao, 20, 2000)) return 'A descrição deve ter entre 20 e 2.000 caracteres.';
    if (!cursos.some((curso) => curso.nome === dados.curso)) return 'Selecione um curso cadastrado pela administração.';
    return '';
}

function autorId(ideia) {
    return obterId(ideia?.autor || ideia?.autorId);
}

function podeVisualizar(usuario, ideia) {
    if (!usuario || !ideia) return false;
    const dono = autorId(ideia) === obterId(usuario);
    const reservou = obterId(ideia.reservadaPor || ideia.reservadaPorId) === obterId(usuario);
    if (usuarioEhAdmin(usuario) || dono || reservou) return true;
    if (usuario.perfil === 'colaborador') return false;
    return (ideia.moderacao || 'aprovada') === 'aprovada'
        && ideia.status !== 'Em desenvolvimento';
}

async function renderFormulario(res, pagina, status, erro, dados) {
    const cursos = await listarCursos({ somenteAtivos: true });
    return res.status(status).render(`ideia/${pagina}`, {
        title: pagina === 'add' ? 'Publicar ideia' : 'Editar ideia', erro, dados, cursos,
    });
}

export default class IdeiaController {
    constructor(caminhoBase = 'ideia/') {
        this.caminhoBase = caminhoBase;

        this.list = async (req, res, next) => {
            try {
                const colaborador = req.session.usuario.perfil === 'colaborador';
                const origem = colaborador
                    ? 'externa'
                    : (['interna', 'externa'].includes(req.query.origem) ? req.query.origem : 'interna');
                const filtros = {
                    q: req.query.q,
                    curso: req.query.curso,
                    status: req.query.status,
                    dificuldade: req.query.dificuldade,
                    origem,
                    usuario: req.session.usuario,
                    autorId: colaborador ? req.session.usuario.id : '',
                };
                const [ideias, cursosCadastrados] = await Promise.all([
                    listarIdeias(filtros),
                    listarCursos({ somenteAtivos: true }),
                ]);
                return res.render(`${caminhoBase}lst`, {
                    title: colaborador ? 'Minhas ideias' : 'Banco de ideias',
                    ideias,
                    cursos: cursosCadastrados.map((curso) => curso.nome),
                    filtros,
                    colaborador,
                });
            } catch (erro) {
                return next(erro);
            }
        };

        this.details = async (req, res, next) => {
            try {
                const ideia = await buscarIdeiaPorId(req.params.id);
                if (!podeVisualizar(req.session.usuario, ideia)) {
                    return res.status(404).render('404', { title: 'Ideia não encontrada' });
                }
                const comentarios = req.session.usuario.perfil === 'colaborador'
                    ? []
                    : await listarComentarios('ideia', req.params.id);
                const usuarioId = obterId(req.session.usuario);
                const interessados = (ideia.interessados || []).map(obterId);
                const reservadaPor = obterId(ideia.reservadaPor || ideia.reservadaPorId);
                const ehAluno = req.session.usuario.perfil === 'aluno';
                return res.render(`${caminhoBase}detalhes`, {
                    title: ideia.titulo,
                    ideia,
                    comentarios,
                    podeEditar: usuarioEhDono(req.session.usuario, ideia) && ideia.status === 'Disponível',
                    interessado: interessados.includes(usuarioId),
                    reservou: reservadaPor === usuarioId,
                    podeDemonstrarInteresse: ehAluno && ideia.status === 'Disponível' && !interessados.includes(usuarioId),
                    podeReservar: ehAluno && ideia.status === 'Disponível',
                    podeDesistir: ehAluno && reservadaPor === usuarioId,
                    podeSolicitarContato: ehAluno && autorId(ideia) !== usuarioId
                        && (interessados.includes(usuarioId) || reservadaPor === usuarioId),
                    comentariosPermitidos: req.session.usuario.perfil !== 'colaborador',
                });
            } catch (erro) {
                return next(erro);
            }
        };

        this.openAdd = async (req, res, next) => {
            try {
                return renderFormulario(res, 'add', 200, '', {});
            } catch (erro) {
                return next(erro);
            }
        };

        this.add = async (req, res, next) => {
            const dados = dadosDoFormulario(req.body);
            try {
                const cursos = await listarCursos({ somenteAtivos: true });
                validarConteudo(dados.titulo, dados.tema, dados.descricao);
                const erroDados = validarDados(dados, cursos);
                if (erroDados) return renderFormulario(res, 'add', 400, erroDados, req.body);

                const externa = req.session.usuario.perfil === 'colaborador';
                const ideia = await cadastrarIdeia({
                    ...dados,
                    status: 'Disponível',
                    origem: externa ? 'externa' : 'interna',
                    moderacao: externa ? 'pendente' : 'aprovada',
                    autor: req.session.usuario.id,
                });
                const mensagem = externa
                    ? 'Ideia enviada para análise da administração.'
                    : 'Ideia publicada com sucesso.';
                return res.redirect(`/ideia/detalhes/${obterId(ideia)}?mensagem=${encodeURIComponent(mensagem)}`);
            } catch (erro) {
                if (erro.message.includes('termo não permitido')) return renderFormulario(res, 'add', 400, erro.message, req.body);
                return next(erro);
            }
        };

        this.openEdt = async (req, res, next) => {
            try {
                const ideia = await buscarIdeiaPorId(req.params.id);
                if (!ideia) return res.status(404).render('404', { title: 'Ideia não encontrada' });
                if (!usuarioEhDono(req.session.usuario, ideia) || ideia.status !== 'Disponível') {
                    return res.redirect(`/ideia/detalhes/${req.params.id}?mensagem=Esta ideia não está disponível para edição.`);
                }
                return renderFormulario(res, 'edt', 200, '', ideia);
            } catch (erro) {
                return next(erro);
            }
        };

        this.edt = async (req, res, next) => {
            const dados = dadosDoFormulario(req.body);
            try {
                const ideia = await buscarIdeiaPorId(req.params.id);
                if (!ideia) return res.status(404).render('404', { title: 'Ideia não encontrada' });
                if (!usuarioEhDono(req.session.usuario, ideia) || ideia.status !== 'Disponível') {
                    return res.redirect(`/ideia/detalhes/${req.params.id}?mensagem=Esta ideia não está disponível para edição.`);
                }
                const cursos = await listarCursos({ somenteAtivos: true });
                validarConteudo(dados.titulo, dados.tema, dados.descricao);
                const erroDados = validarDados(dados, cursos);
                if (erroDados) return renderFormulario(res, 'edt', 400, erroDados, { ...ideia, ...req.body });

                await atualizarIdeia(req.params.id, {
                    ...dados,
                    moderacao: ideia.origem === 'externa' ? 'pendente' : ideia.moderacao,
                });
                return res.redirect(`/ideia/detalhes/${req.params.id}?mensagem=Ideia atualizada com sucesso.`);
            } catch (erro) {
                if (erro.message.includes('termo não permitido')) return renderFormulario(res, 'edt', 400, erro.message, req.body);
                return next(erro);
            }
        };

        this.del = async (req, res, next) => {
            try {
                const ideia = await buscarIdeiaPorId(req.params.id);
                if (!ideia) return res.status(404).render('404', { title: 'Ideia não encontrada' });
                if (!usuarioEhDono(req.session.usuario, ideia) || ideia.status !== 'Disponível') {
                    return res.redirect(`/ideia/detalhes/${req.params.id}?mensagem=Esta ideia não pode ser excluída agora.`);
                }
                await excluirIdeia(req.params.id);
                return res.redirect('/ideia/lst?mensagem=Ideia excluída com sucesso.');
            } catch (erro) {
                return next(erro);
            }
        };

        this.interesse = async (req, res, next) => {
            try {
                const ideiaAntes = await buscarIdeiaPorId(req.params.id);
                const jaInteressado = (ideiaAntes?.interessados || []).some((item) => obterId(item) === obterId(req.session.usuario));
                const ideia = await registrarInteresseIdeia(req.params.id, req.session.usuario.id);
                if (!ideia) return res.redirect('/ideia/lst?mensagem=Esta ideia não está mais disponível.');
                if (!jaInteressado && autorId(ideia) !== obterId(req.session.usuario)) {
                    await criarNotificacao({
                        destinatario: autorId(ideia),
                        remetente: req.session.usuario.id,
                        tipo: 'ideia_interesse',
                        mensagem: `${req.session.usuario.nome} demonstrou interesse na sua ideia “${ideia.titulo}”.`,
                        link: `/ideia/detalhes/${req.params.id}`,
                    });
                }
                return res.redirect(`/ideia/detalhes/${req.params.id}?mensagem=Interesse registrado. A ideia continua disponível.`);
            } catch (erro) {
                return next(erro);
            }
        };

        this.desenvolver = async (req, res, next) => {
            try {
                const ideia = await reservarIdeia(req.params.id, req.session.usuario.id);
                if (ideia?.erro === 'ALUNO_JA_RESERVOU') {
                    return res.redirect('/perfil?mensagem=Você já possui uma ideia em desenvolvimento. Desista dela antes de escolher outra.');
                }
                if (!ideia) return res.redirect('/ideia/lst?mensagem=Esta ideia não está mais disponível.');
                if (autorId(ideia) !== obterId(req.session.usuario)) {
                    await criarNotificacao({
                        destinatario: autorId(ideia),
                        remetente: req.session.usuario.id,
                        tipo: 'ideia_reservada',
                        mensagem: `Sua ideia “${ideia.titulo}” entrou em desenvolvimento.`,
                        link: `/ideia/detalhes/${req.params.id}`,
                    });
                }
                return res.redirect('/perfil?mensagem=Ideia reservada e adicionada ao seu perfil.');
            } catch (erro) {
                return next(erro);
            }
        };

        this.desistir = async (req, res, next) => {
            try {
                const ideia = await liberarIdeia(req.params.id, req.session.usuario.id);
                if (!ideia) return res.redirect('/perfil?mensagem=Não foi possível liberar esta ideia.');
                if (autorId(ideia) !== obterId(req.session.usuario)) {
                    await criarNotificacao({
                        destinatario: autorId(ideia),
                        remetente: req.session.usuario.id,
                        tipo: 'ideia_liberada',
                        mensagem: `A ideia “${ideia.titulo}” voltou a ficar disponível.`,
                        link: `/ideia/detalhes/${req.params.id}`,
                    });
                }
                return res.redirect('/ideia/lst?mensagem=A ideia voltou a ficar disponível.');
            } catch (erro) {
                return next(erro);
            }
        };

        this.comment = async (req, res, next) => {
            try {
                if (req.session.usuario.perfil === 'colaborador') {
                    return res.redirect(`/ideia/detalhes/${req.params.id}?mensagem=Use a área de mensagens para conversar com o aluno.`);
                }
                const ideia = await buscarIdeiaPorId(req.params.id);
                if (!podeVisualizar(req.session.usuario, ideia)) return res.status(404).render('404', { title: 'Ideia não encontrada' });
                const texto = String(req.body.texto || '').trim();
                validarConteudo(texto);
                if (!comentarioValido(texto)) {
                    return res.redirect(`/ideia/detalhes/${req.params.id}?mensagem=O comentário deve ter entre 1 e 500 caracteres.`);
                }
                await cadastrarComentario({ texto, autor: req.session.usuario.id, alvoTipo: 'ideia', alvoId: req.params.id });
                if (autorId(ideia) && autorId(ideia) !== obterId(req.session.usuario)) {
                    await criarNotificacao({
                        destinatario: autorId(ideia),
                        remetente: req.session.usuario.id,
                        tipo: 'comentario',
                        mensagem: `${req.session.usuario.nome} comentou na sua ideia.`,
                        link: `/ideia/detalhes/${req.params.id}`,
                    });
                }
                return res.redirect(`/ideia/detalhes/${req.params.id}?mensagem=Comentário publicado.`);
            } catch (erro) {
                if (erro.message.includes('termo não permitido')) {
                    return res.redirect(`/ideia/detalhes/${req.params.id}?mensagem=${encodeURIComponent(erro.message)}`);
                }
                return next(erro);
            }
        };
    }
}
