import {
    alterarStatusUsuario,
    atualizarCurso,
    atualizarTurma,
    avaliarTcc,
    buscarTccPorId,
    cadastrarCurso,
    cadastrarTurma,
    criarNotificacao,
    excluirIdeia,
    listarCursos,
    listarAreasAtuacao,
    cadastrarAreaAtuacao,
    atualizarAreaAtuacao,
    listarIdeias,
    listarTodosTccs,
    listarTurmas,
    listarUsuarios,
    resumoAdministrativo,
} from '../services/repositorio.js';
import { textoComTamanho } from '../services/validacao.js';
import { carregarTermosProibidos, salvarTermosProibidos } from '../services/filtroConteudo.js';

function mensagem(res, caminho, texto) {
    return res.redirect(`${caminho}?mensagem=${encodeURIComponent(texto)}`);
}

export default class AdminController {
    constructor(caminhoBase = 'admin/') {
        this.caminhoBase = caminhoBase;

        this.index = async (req, res, next) => {
            try {
                const resumo = await resumoAdministrativo();
                return res.render(`${caminhoBase}index`, { title: 'Administração', resumo });
            } catch (erro) {
                return next(erro);
            }
        };

        this.usuarios = async (req, res, next) => {
            try {
                const usuarios = await listarUsuarios(req.query.q || '');
                return res.render(`${caminhoBase}usuarios`, {
                    title: 'Gerenciar usuários', usuarios, busca: req.query.q || '',
                });
            } catch (erro) {
                return next(erro);
            }
        };

        this.alterarUsuario = async (req, res, next) => {
            try {
                if (String(req.params.id) === String(req.session.usuario.id)) {
                    return mensagem(res, '/admin/usuarios', 'Você não pode bloquear sua própria conta.');
                }
                await alterarStatusUsuario(req.params.id, req.body.ativo === 'true');
                return mensagem(res, '/admin/usuarios', 'Situação do usuário atualizada.');
            } catch (erro) {
                return next(erro);
            }
        };

        this.cursos = async (req, res, next) => {
            try {
                const cursos = await listarCursos();
                return res.render(`${caminhoBase}cursos`, { title: 'Cursos técnicos', cursos, erro: '' });
            } catch (erro) {
                return next(erro);
            }
        };

        this.adicionarCurso = async (req, res, next) => {
            const dados = {
                nome: String(req.body.nome || '').trim(),
                sigla: String(req.body.sigla || '').trim().toUpperCase(),
                area: String(req.body.area || '').trim(),
            };
            try {
                if (!textoComTamanho(dados.nome, 2, 100)
                    || !textoComTamanho(dados.sigla, 2, 20)
                    || !textoComTamanho(dados.area, 2, 100)) {
                    const cursos = await listarCursos();
                    return res.status(400).render(`${caminhoBase}cursos`, {
                        title: 'Cursos técnicos', cursos, erro: 'Preencha corretamente os dados do curso.',
                    });
                }
                await cadastrarCurso(dados);
                return mensagem(res, '/admin/cursos', 'Curso cadastrado com sucesso.');
            } catch (erro) {
                if (erro.code === 11000) return mensagem(res, '/admin/cursos', 'Já existe um curso com esse nome.');
                return next(erro);
            }
        };

        this.alterarCurso = async (req, res, next) => {
            try {
                await atualizarCurso(req.params.id, { ativo: req.body.ativo === 'true' });
                return mensagem(res, '/admin/cursos', 'Situação do curso atualizada.');
            } catch (erro) {
                return next(erro);
            }
        };

        this.areas = async (req, res, next) => {
            try {
                const areas = await listarAreasAtuacao();
                return res.render(`${caminhoBase}areas`, { title: 'Áreas de atuação', areas, erro: '' });
            } catch (erro) {
                return next(erro);
            }
        };

        this.adicionarArea = async (req, res, next) => {
            const nome = String(req.body.nome || '').trim();
            try {
                if (!textoComTamanho(nome, 2, 100)) {
                    const areas = await listarAreasAtuacao();
                    return res.status(400).render(`${caminhoBase}areas`, {
                        title: 'Áreas de atuação', areas, erro: 'Informe uma área entre 2 e 100 caracteres.',
                    });
                }
                await cadastrarAreaAtuacao({ nome });
                return mensagem(res, '/admin/areas', 'Área de atuação cadastrada com sucesso.');
            } catch (erro) {
                if (erro.code === 11000) return mensagem(res, '/admin/areas', 'Essa área já foi cadastrada.');
                return next(erro);
            }
        };

        this.alterarArea = async (req, res, next) => {
            try {
                await atualizarAreaAtuacao(req.params.id, { ativo: req.body.ativo === 'true' });
                return mensagem(res, '/admin/areas', 'Situação da área atualizada.');
            } catch (erro) {
                return next(erro);
            }
        };

        this.turmas = async (req, res, next) => {
            try {
                const [turmas, cursos] = await Promise.all([listarTurmas(), listarCursos({ somenteAtivos: true })]);
                return res.render(`${caminhoBase}turmas`, { title: 'Turmas técnicas', turmas, cursos, erro: '' });
            } catch (erro) {
                return next(erro);
            }
        };

        this.adicionarTurma = async (req, res, next) => {
            const dados = {
                nome: String(req.body.nome || '').trim(),
                ano: Number(req.body.ano),
                curso: req.body.curso,
            };
            try {
                const anoMaximo = new Date().getFullYear() + 5;
                if (!textoComTamanho(dados.nome, 2, 50)
                    || !Number.isInteger(dados.ano)
                    || dados.ano < 2000
                    || dados.ano > anoMaximo
                    || !dados.curso) {
                    const [turmas, cursos] = await Promise.all([listarTurmas(), listarCursos({ somenteAtivos: true })]);
                    return res.status(400).render(`${caminhoBase}turmas`, {
                        title: 'Turmas técnicas', turmas, cursos, erro: 'Preencha corretamente os dados da turma.',
                    });
                }
                await cadastrarTurma(dados);
                return mensagem(res, '/admin/turmas', 'Turma cadastrada com sucesso.');
            } catch (erro) {
                if (erro.code === 11000) return mensagem(res, '/admin/turmas', 'Essa turma já foi cadastrada.');
                return next(erro);
            }
        };

        this.alterarTurma = async (req, res, next) => {
            try {
                await atualizarTurma(req.params.id, { ativo: req.body.ativo === 'true' });
                return mensagem(res, '/admin/turmas', 'Situação da turma atualizada.');
            } catch (erro) {
                return next(erro);
            }
        };

        this.tccs = async (req, res, next) => {
            try {
                const tccs = await listarTodosTccs();
                return res.render(`${caminhoBase}tccs`, { title: 'Moderação de TCCs', tccs });
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
                if (autorId && ['publicado', 'correcao_solicitada', 'rejeitado'].includes(req.body.status)) {
                    await criarNotificacao({
                        destinatario: autorId,
                        remetente: req.session.usuario.id,
                        tipo: req.body.status === 'publicado' ? 'tcc_aprovado' : 'correcao_solicitada',
                        mensagem: req.body.status === 'publicado'
                            ? 'A administração aprovou seu TCC para o acervo público.'
                            : 'A administração atualizou a situação do seu TCC. Consulte os detalhes.',
                        link: `/tcc/detalhes/${req.params.id}`,
                    });
                }
                return mensagem(res, '/admin/tccs', 'Situação do TCC atualizada.');
            } catch (erro) {
                return next(erro);
            }
        };

        this.ideias = async (req, res, next) => {
            try {
                const ideias = await listarIdeias({ q: req.query.q || '' });
                return res.render(`${caminhoBase}ideias`, {
                    title: 'Moderação de ideias', ideias, busca: req.query.q || '',
                });
            } catch (erro) {
                return next(erro);
            }
        };

        this.excluirIdeia = async (req, res, next) => {
            try {
                await excluirIdeia(req.params.id);
                return mensagem(res, '/admin/ideias', 'Ideia removida com sucesso.');
            } catch (erro) {
                return next(erro);
            }
        };

        this.filtro = async (req, res, next) => {
            try {
                const termos = await carregarTermosProibidos();
                return res.render(`${caminhoBase}filtro`, { title: 'Palavras proibidas', termos, erro: '' });
            } catch (erro) {
                return next(erro);
            }
        };

        this.atualizarFiltro = async (req, res, next) => {
            const termos = String(req.body.termos || '')
                .split(/[\n,;]/)
                .map((termo) => termo.trim())
                .filter(Boolean);
            try {
                if (!termos.length) {
                    return res.status(400).render(`${caminhoBase}filtro`, {
                        title: 'Palavras proibidas', termos, erro: 'Cadastre pelo menos um termo para manter a moderação ativa.',
                    });
                }
                await salvarTermosProibidos(termos);
                return mensagem(res, '/admin/filtro', 'Palavras proibidas atualizadas com sucesso.');
            } catch (erro) {
                return next(erro);
            }
        };
    }
}
