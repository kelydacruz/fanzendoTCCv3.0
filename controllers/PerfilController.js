import {
    atualizarDadosPerfilUsuario,
    buscarUsuarioPorId,
    listarAreasAtuacao,
    listarCursos,
} from '../services/repositorio.js';
import { descricaoPerfil } from '../services/perfis.js';
import { textoComTamanho } from '../services/validacao.js';

function opcaoValida(valor, opcoes) {
    return opcoes.some((opcao) => opcao.nome.toLowerCase() === String(valor || '').trim().toLowerCase());
}

function dadosValidos(usuario, dados, opcoes) {
    if (!textoComTamanho(dados.nome, 3, 100)) return 'Informe um nome entre 3 e 100 caracteres.';
    if (usuario.perfil === 'aluno' && !textoComTamanho(dados.curso, 2, 100)) {
        return 'Informe o curso do aluno.';
    }
    if (usuario.perfil === 'aluno' && !opcaoValida(dados.curso, opcoes.cursos)) {
        return 'Selecione um curso cadastrado pela administração.';
    }
    if (usuario.perfil === 'professor' && !textoComTamanho(dados.areaAtuacao, 2, 100)) {
        return 'Informe a área de atuação do professor.';
    }
    if (usuario.perfil === 'professor' && !opcaoValida(dados.areaAtuacao, opcoes.areas)) {
        return 'Selecione uma área de atuação cadastrada pela administração.';
    }
    return '';
}

async function opcoesPerfil() {
    const [cursos, areas] = await Promise.all([
        listarCursos({ somenteAtivos: true }),
        listarAreasAtuacao({ somenteAtivas: true }),
    ]);
    return { cursos, areas };
}

export default class PerfilController {
    constructor() {
        this.open = async (req, res, next) => {
            try {
                const usuario = await buscarUsuarioPorId(req.session.usuario.id);
                if (!usuario) return res.redirect('/entrar');
                const opcoes = await opcoesPerfil();
                return res.render('perfil/index', {
                    title: 'Meu perfil',
                    erro: '',
                    dados: usuario,
                    descricaoPerfil: descricaoPerfil(usuario.perfil),
                    ...opcoes,
                });
            } catch (erro) {
                return next(erro);
            }
        };

        this.update = async (req, res, next) => {
            try {
                const usuario = await buscarUsuarioPorId(req.session.usuario.id);
                if (!usuario) return res.redirect('/entrar');
                const opcoes = await opcoesPerfil();
                const dados = {
                    nome: String(req.body.nome || '').trim(),
                    curso: String(req.body.curso || '').trim(),
                    areaAtuacao: String(req.body.areaAtuacao || '').trim(),
                };
                const erro = dadosValidos(usuario, dados, opcoes);
                if (erro) {
                    return res.status(400).render('perfil/index', {
                        title: 'Meu perfil', erro, dados: { ...usuario, ...dados },
                        descricaoPerfil: descricaoPerfil(usuario.perfil),
                        ...opcoes,
                    });
                }
                const atualizado = await atualizarDadosPerfilUsuario(usuario.id || usuario._id, dados);
                req.session.usuario.nome = atualizado.nome;
                await new Promise((resolve, reject) => req.session.save((erroSessao) => (
                    erroSessao ? reject(erroSessao) : resolve()
                )));
                return res.redirect('/perfil?mensagem=Perfil atualizado com sucesso.');
            } catch (erro) {
                return next(erro);
            }
        };
    }
}
