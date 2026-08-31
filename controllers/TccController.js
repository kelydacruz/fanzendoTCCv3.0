import {
    listarTccs,
    buscarTccPorId,
    cadastrarTcc,
    atualizarTcc,
    excluirTcc,
    obterPdfTcc,
    listarTccsRelacionados,
    registrarVisualizacaoTcc,
    registrarDownloadTcc,
    listarComentarios,
    cadastrarComentario,
} from '../services/repositorio.js';
import { validarConteudo } from '../services/filtroConteudo.js';
import { separarLista } from '../services/texto.js';
import { usuarioEhDono } from '../services/permissoes.js';
import { anoValido, comentarioValido, textoComTamanho } from '../services/validacao.js';

function dadosDoFormulario(body, arquivo) {
    const dados = {
        titulo: String(body.titulo || '').trim(),
        tema: String(body.tema || '').trim(),
        resumo: String(body.resumo || '').trim(),
        curso: String(body.curso || '').trim(),
        area: String(body.area || '').trim(),
        turma: String(body.turma || '').trim(),
        orientador: String(body.orientador || '').trim(),
        ano: Number(body.ano),
        coautores: separarLista(body.coautores),
        palavrasChave: separarLista(body.palavrasChave),
    };

    if (arquivo) {
        dados.pdf = {
            dados: arquivo.buffer,
            nome: arquivo.originalname,
            tipo: arquivo.mimetype,
        };
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
                const [tccs, todos] = await Promise.all([
                    listarTccs(filtros),
                    listarTccs(),
                ]);
                const opcoes = {
                    cursos: [...new Set(todos.map((tcc) => tcc.curso))].sort(),
                    anos: [...new Set(todos.map((tcc) => tcc.ano))].sort((a, b) => b - a),
                    areas: [...new Set(todos.map((tcc) => tcc.area).filter(Boolean))].sort(),
                    orientadores: [...new Set(todos.map((tcc) => tcc.orientador))].sort(),
                };
                res.render(`${caminhoBase}lst`, {
                    title: 'TCCs publicados', tccs, filtros, opcoes,
                });
            } catch (erro) {
                next(erro);
            }
        };

        this.details = async (req, res, next) => {
            try {
                await registrarVisualizacaoTcc(req.params.id);
                const tcc = await buscarTccPorId(req.params.id);
                if (!tcc) return res.status(404).render('404', { title: 'TCC não encontrado' });
                const [comentarios, relacionados] = await Promise.all([
                    listarComentarios('tcc', req.params.id),
                    listarTccsRelacionados(tcc),
                ]);
                return res.render(`${caminhoBase}detalhes`, {
                    title: tcc.titulo,
                    tcc,
                    comentarios,
                    relacionados,
                    podeEditar: usuarioEhDono(req.session.usuario, tcc),
                    temPdf: Boolean(tcc.pdf?.nome || tcc.pdf?.dados),
                });
            } catch (erro) {
                return next(erro);
            }
        };

        this.openAdd = (req, res) => res.render(`${caminhoBase}add`, {
            title: 'Publicar TCC', erro: '', dados: {},
        });

        this.add = async (req, res, next) => {
            try {
                const dados = dadosDoFormulario(req.body, req.file);
                validarConteudo(dados.titulo, dados.tema, dados.resumo, dados.palavrasChave.join(' '));

                if (!dadosValidos(dados)) {
                    return res.status(400).render(`${caminhoBase}add`, {
                        title: 'Publicar TCC', erro: 'Preencha corretamente os campos obrigatórios.', dados: req.body,
                    });
                }

                const tcc = await cadastrarTcc({ ...dados, autor: req.session.usuario.id });
                return res.redirect(`/tcc/detalhes/${tcc.id || tcc._id}?mensagem=TCC publicado com sucesso.`);
            } catch (erro) {
                if (erro.message.includes('termo não permitido')) {
                    return res.status(400).render(`${caminhoBase}add`, {
                        title: 'Publicar TCC', erro: erro.message, dados: req.body,
                    });
                }
                return next(erro);
            }
        };

        this.openEdt = async (req, res, next) => {
            try {
                const tcc = await buscarTccPorId(req.params.id);
                if (!tcc) return res.status(404).render('404', { title: 'TCC não encontrado' });
                if (!usuarioEhDono(req.session.usuario, tcc)) {
                    return res.redirect(`/tcc/detalhes/${req.params.id}?mensagem=Você só pode editar suas próprias publicações.`);
                }
                return res.render(`${caminhoBase}edt`, { title: 'Editar TCC', erro: '', dados: tcc });
            } catch (erro) {
                return next(erro);
            }
        };

        this.edt = async (req, res, next) => {
            try {
                const tcc = await buscarTccPorId(req.params.id);
                if (!tcc) return res.status(404).render('404', { title: 'TCC não encontrado' });
                if (!usuarioEhDono(req.session.usuario, tcc)) {
                    return res.redirect(`/tcc/detalhes/${req.params.id}?mensagem=Você só pode editar suas próprias publicações.`);
                }

                const dados = dadosDoFormulario(req.body, req.file);
                validarConteudo(dados.titulo, dados.tema, dados.resumo, dados.palavrasChave.join(' '));
                if (!dadosValidos(dados)) {
                    return res.status(400).render(`${caminhoBase}edt`, {
                        title: 'Editar TCC', erro: 'Preencha corretamente os campos obrigatórios.', dados: { ...tcc, ...req.body },
                    });
                }

                await atualizarTcc(req.params.id, dados);
                return res.redirect(`/tcc/detalhes/${req.params.id}?mensagem=TCC atualizado com sucesso.`);
            } catch (erro) {
                if (erro.message.includes('termo não permitido')) {
                    return res.status(400).render(`${caminhoBase}edt`, {
                        title: 'Editar TCC', erro: erro.message, dados: req.body,
                    });
                }
                return next(erro);
            }
        };

        this.del = async (req, res, next) => {
            try {
                const tcc = await buscarTccPorId(req.params.id);
                if (!tcc) return res.status(404).render('404', { title: 'TCC não encontrado' });
                if (!usuarioEhDono(req.session.usuario, tcc)) {
                    return res.redirect(`/tcc/detalhes/${req.params.id}?mensagem=Você só pode excluir suas próprias publicações.`);
                }
                await excluirTcc(req.params.id);
                return res.redirect('/tcc/lst?mensagem=TCC excluído com sucesso.');
            } catch (erro) {
                return next(erro);
            }
        };

        this.pdf = async (req, res, next) => {
            try {
                const pdf = await obterPdfTcc(req.params.id);
                if (!pdf) return res.status(404).render('erro', {
                    title: 'PDF indisponível', mensagemErro: 'Este TCC ainda não possui um PDF anexado.',
                });
                await registrarDownloadTcc(req.params.id);
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
                if (!tcc) return res.status(404).render('404', { title: 'TCC não encontrado' });
                const texto = String(req.body.texto || '').trim();
                validarConteudo(texto);
                if (!comentarioValido(texto)) {
                    return res.redirect(`/tcc/detalhes/${req.params.id}?mensagem=O comentário deve ter entre 1 e 500 caracteres.`);
                }
                await cadastrarComentario({
                    texto,
                    autor: req.session.usuario.id,
                    alvoTipo: 'tcc',
                    alvoId: req.params.id,
                });
                return res.redirect(`/tcc/detalhes/${req.params.id}?mensagem=Comentário publicado.`);
            } catch (erro) {
                if (erro.message.includes('termo não permitido')) {
                    return res.redirect(`/tcc/detalhes/${req.params.id}?mensagem=${encodeURIComponent(erro.message)}`);
                }
                return next(erro);
            }
        };
    }
}
