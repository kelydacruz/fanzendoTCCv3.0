import {
    atualizarDadosPerfilUsuario,
    buscarUsuarioPorId,
} from '../services/repositorio.js';
import { descricaoPerfil } from '../services/perfis.js';
import { textoComTamanho } from '../services/validacao.js';

function dadosValidos(usuario, dados) {
    if (!textoComTamanho(dados.nome, 3, 100)) return 'Informe um nome entre 3 e 100 caracteres.';
    if (usuario.perfil === 'aluno' && !textoComTamanho(dados.curso, 2, 100)) {
        return 'Informe o curso do aluno.';
    }
    if (usuario.perfil === 'professor' && !textoComTamanho(dados.areaAtuacao, 2, 100)) {
        return 'Informe a área de atuação do professor.';
    }
    return '';
}

export default class PerfilController {
    constructor() {
        this.open = async (req, res, next) => {
            try {
                const usuario = await buscarUsuarioPorId(req.session.usuario.id);
                if (!usuario) return res.redirect('/entrar');
                return res.render('perfil/index', {
                    title: 'Meu perfil',
                    erro: '',
                    dados: usuario,
                    descricaoPerfil: descricaoPerfil(usuario.perfil),
                });
            } catch (erro) {
                return next(erro);
            }
        };

        this.update = async (req, res, next) => {
            try {
                const usuario = await buscarUsuarioPorId(req.session.usuario.id);
                if (!usuario) return res.redirect('/entrar');
                const dados = {
                    nome: String(req.body.nome || '').trim(),
                    curso: String(req.body.curso || '').trim(),
                    areaAtuacao: String(req.body.areaAtuacao || '').trim(),
                };
                const erro = dadosValidos(usuario, dados);
                if (erro) {
                    return res.status(400).render('perfil/index', {
                        title: 'Meu perfil', erro, dados: { ...usuario, ...dados },
                        descricaoPerfil: descricaoPerfil(usuario.perfil),
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
