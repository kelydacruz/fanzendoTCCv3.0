import bcrypt from 'bcryptjs';
import { rateLimit } from 'express-rate-limit';
import {
    buscarUsuarioPorEmail,
    cadastrarUsuario,
} from '../services/repositorio.js';
import { normalizarTexto } from '../services/texto.js';
import { emailValido, perfilValido, textoComTamanho } from '../services/validacao.js';

export const limitarLogin = rateLimit({
    windowMs: 15 * 60 * 1000,
    limit: 20,
    standardHeaders: true,
    legacyHeaders: false,
});

function iniciarSessao(req, res, next, usuario, mensagem) {
    req.session.regenerate((erro) => {
        if (erro) return next(erro);

        req.session.usuario = {
            id: String(usuario.id || usuario._id),
            nome: usuario.nome,
            email: usuario.email,
            perfil: usuario.perfil,
        };

        return req.session.save((erroSessao) => {
            if (erroSessao) return next(erroSessao);
            return res.redirect(`/painel?mensagem=${encodeURIComponent(mensagem)}`);
        });
    });
}

export default class UsuarioController {
    constructor() {
        this.openLogin = (req, res) => {
            if (req.session.usuario) return res.redirect('/painel');
            return res.render('usuario/login', { title: 'Entrar', erro: '', dados: {} });
        };

        this.login = async (req, res, next) => {
            try {
                const email = normalizarTexto(req.body.email);
                const usuario = await buscarUsuarioPorEmail(email);
                const senhaCorreta = usuario && await bcrypt.compare(req.body.senha || '', usuario.senha);

                if (!senhaCorreta) {
                    return res.status(401).render('usuario/login', {
                        title: 'Entrar',
                        erro: 'E-mail ou senha incorretos.',
                        dados: { email },
                    });
                }

                return iniciarSessao(req, res, next, usuario, 'Login realizado com sucesso.');
            } catch (erro) {
                return next(erro);
            }
        };

        this.openCadastro = (req, res) => {
            if (req.session.usuario) return res.redirect('/painel');
            return res.render('usuario/cadastro', { title: 'Criar conta', erro: '', dados: {} });
        };

        this.cadastro = async (req, res, next) => {
            try {
                const dados = {
                    nome: String(req.body.nome || '').trim(),
                    email: normalizarTexto(req.body.email),
                    perfil: req.body.perfil,
                    curso: String(req.body.curso || '').trim(),
                    areaAtuacao: String(req.body.areaAtuacao || '').trim(),
                };

                if (!textoComTamanho(dados.nome, 3, 100)
                    || !emailValido(dados.email)
                    || !perfilValido(dados.perfil)) {
                    return res.status(400).render('usuario/cadastro', {
                        title: 'Criar conta', erro: 'Informe nome, e-mail e perfil válidos.', dados,
                    });
                }
                if (dados.perfil === 'aluno' && !textoComTamanho(dados.curso, 2, 100)) {
                    return res.status(400).render('usuario/cadastro', {
                        title: 'Criar conta', erro: 'Informe o curso do aluno.', dados,
                    });
                }
                if (dados.perfil === 'professor' && !textoComTamanho(dados.areaAtuacao, 2, 100)) {
                    return res.status(400).render('usuario/cadastro', {
                        title: 'Criar conta', erro: 'Informe a área de atuação do professor.', dados,
                    });
                }
                if (!textoComTamanho(req.body.senha, 6, 72)) {
                    return res.status(400).render('usuario/cadastro', {
                        title: 'Criar conta', erro: 'A senha deve ter entre 6 e 72 caracteres.', dados,
                    });
                }
                if (await buscarUsuarioPorEmail(dados.email)) {
                    return res.status(409).render('usuario/cadastro', {
                        title: 'Criar conta', erro: 'Já existe uma conta com este e-mail.', dados,
                    });
                }

                const usuario = await cadastrarUsuario({
                    ...dados,
                    senha: await bcrypt.hash(req.body.senha, 10),
                });

                return iniciarSessao(req, res, next, usuario, 'Conta criada com sucesso.');
            } catch (erro) {
                if (erro.code === 11000) {
                    return res.status(409).render('usuario/cadastro', {
                        title: 'Criar conta', erro: 'Já existe uma conta com este e-mail.', dados: req.body,
                    });
                }
                return next(erro);
            }
        };

        this.logout = (req, res, next) => {
            req.session.destroy((erro) => {
                if (erro) return next(erro);
                res.clearCookie('connect.sid');
                return res.redirect('/?mensagem=Você saiu da sua conta.');
            });
        };
    }
}
