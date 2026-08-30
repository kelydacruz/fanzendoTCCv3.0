import {
    listarIdeias,
    buscarIdeiaPorId,
    cadastrarIdeia,
    atualizarIdeia,
    excluirIdeia,
    listarComentarios,
    cadastrarComentario,
} from '../services/repositorio.js';
import { validarConteudo } from '../services/filtroConteudo.js';
import { usuarioEhDono } from '../services/permissoes.js';
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
        status: ['Disponível', 'Em desenvolvimento', 'Concluída'].includes(body.status)
            ? body.status
            : 'Disponível',
    };
}

function dadosValidos(dados) {
    return textoComTamanho(dados.titulo, 3, 180)
        && textoComTamanho(dados.tema, 2, 100)
        && textoComTamanho(dados.descricao, 20, 2000)
        && textoComTamanho(dados.curso, 2, 100);
}

export default class IdeiaController {
    constructor(caminhoBase = 'ideia/') {
        this.caminhoBase = caminhoBase;

        this.list = async (req, res, next) => {
            try {
                const filtros = {
                    q: req.query.q,
                    curso: req.query.curso,
                    status: req.query.status,
                    dificuldade: req.query.dificuldade,
                };
                const ideias = await listarIdeias(filtros);
                const cursos = [...new Set((await listarIdeias()).map((ideia) => ideia.curso))].sort();
                res.render(`${caminhoBase}lst`, { title: 'Banco de ideias', ideias, cursos, filtros });
            } catch (erro) {
                next(erro);
            }
        };

        this.details = async (req, res, next) => {
            try {
                const ideia = await buscarIdeiaPorId(req.params.id);
                if (!ideia) return res.status(404).render('404', { title: 'Ideia não encontrada' });
                const comentarios = await listarComentarios('ideia', req.params.id);
                return res.render(`${caminhoBase}detalhes`, {
                    title: ideia.titulo,
                    ideia,
                    comentarios,
                    podeEditar: usuarioEhDono(req.session.usuario, ideia),
                });
            } catch (erro) {
                return next(erro);
            }
        };

        this.openAdd = (req, res) => res.render(`${caminhoBase}add`, {
            title: 'Publicar ideia', erro: '', dados: {},
        });

        this.add = async (req, res, next) => {
            try {
                const dados = dadosDoFormulario(req.body);
                validarConteudo(dados.titulo, dados.tema, dados.descricao);
                if (!dadosValidos(dados)) {
                    return res.status(400).render(`${caminhoBase}add`, {
                        title: 'Publicar ideia', erro: 'Preencha todos os campos obrigatórios.', dados: req.body,
                    });
                }
                const ideia = await cadastrarIdeia({ ...dados, autor: req.session.usuario.id });
                return res.redirect(`/ideia/detalhes/${ideia.id || ideia._id}?mensagem=Ideia publicada com sucesso.`);
            } catch (erro) {
                if (erro.message.includes('termo não permitido')) {
                    return res.status(400).render(`${caminhoBase}add`, {
                        title: 'Publicar ideia', erro: erro.message, dados: req.body,
                    });
                }
                return next(erro);
            }
        };

        this.openEdt = async (req, res, next) => {
            try {
                const ideia = await buscarIdeiaPorId(req.params.id);
                if (!ideia) return res.status(404).render('404', { title: 'Ideia não encontrada' });
                if (!usuarioEhDono(req.session.usuario, ideia)) {
                    return res.redirect(`/ideia/detalhes/${req.params.id}?mensagem=Você só pode editar suas próprias publicações.`);
                }
                return res.render(`${caminhoBase}edt`, { title: 'Editar ideia', erro: '', dados: ideia });
            } catch (erro) {
                return next(erro);
            }
        };

        this.edt = async (req, res, next) => {
            try {
                const ideia = await buscarIdeiaPorId(req.params.id);
                if (!ideia) return res.status(404).render('404', { title: 'Ideia não encontrada' });
                if (!usuarioEhDono(req.session.usuario, ideia)) {
                    return res.redirect(`/ideia/detalhes/${req.params.id}?mensagem=Você só pode editar suas próprias publicações.`);
                }
                const dados = dadosDoFormulario(req.body);
                validarConteudo(dados.titulo, dados.tema, dados.descricao);
                if (!dadosValidos(dados)) {
                    return res.status(400).render(`${caminhoBase}edt`, {
                        title: 'Editar ideia', erro: 'Preencha todos os campos obrigatórios.', dados: { ...ideia, ...req.body },
                    });
                }
                await atualizarIdeia(req.params.id, dados);
                return res.redirect(`/ideia/detalhes/${req.params.id}?mensagem=Ideia atualizada com sucesso.`);
            } catch (erro) {
                if (erro.message.includes('termo não permitido')) {
                    return res.status(400).render(`${caminhoBase}edt`, {
                        title: 'Editar ideia', erro: erro.message, dados: req.body,
                    });
                }
                return next(erro);
            }
        };

        this.del = async (req, res, next) => {
            try {
                const ideia = await buscarIdeiaPorId(req.params.id);
                if (!ideia) return res.status(404).render('404', { title: 'Ideia não encontrada' });
                if (!usuarioEhDono(req.session.usuario, ideia)) {
                    return res.redirect(`/ideia/detalhes/${req.params.id}?mensagem=Você só pode excluir suas próprias publicações.`);
                }
                await excluirIdeia(req.params.id);
                return res.redirect('/ideia/lst?mensagem=Ideia excluída com sucesso.');
            } catch (erro) {
                return next(erro);
            }
        };

        this.comment = async (req, res, next) => {
            try {
                const ideia = await buscarIdeiaPorId(req.params.id);
                if (!ideia) return res.status(404).render('404', { title: 'Ideia não encontrada' });
                const texto = String(req.body.texto || '').trim();
                validarConteudo(texto);
                if (!comentarioValido(texto)) {
                    return res.redirect(`/ideia/detalhes/${req.params.id}?mensagem=O comentário deve ter entre 1 e 500 caracteres.`);
                }
                await cadastrarComentario({
                    texto,
                    autor: req.session.usuario.id,
                    alvoTipo: 'ideia',
                    alvoId: req.params.id,
                });
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
