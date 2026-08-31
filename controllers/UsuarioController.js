import bcrypt from 'bcryptjs';
import { randomBytes } from 'crypto';
import { rateLimit } from 'express-rate-limit';
import {
    buscarUsuarioPorEmail,
    buscarUsuarioPorGoogleId,
    buscarUsuarioPorId,
    cadastrarUsuario,
    confirmarAcessoUsuario,
    vincularContaGoogle,
} from '../services/repositorio.js';
import { verificarCredencialGoogle } from '../services/autenticacaoGoogle.js';
import { normalizarTexto } from '../services/texto.js';
import { emailValido, perfilValido, textoComTamanho } from '../services/validacao.js';
import {
    criarVerificacao,
    mascararEmail,
    validarCodigo,
} from '../services/verificacaoLogin.js';

function renderLogin(req, res, status, erro, email = '') {
    req.session.googleNonce = randomBytes(32).toString('hex');
    return res.status(status).render('usuario/login', {
        title: 'Entrar',
        erro,
        dados: { email },
        googleNonce: req.session.googleNonce,
    });
}

function renderConfirmacao(req, res, status = 200, erro = '', mensagem = '') {
    const pendente = req.session.autenticacaoPendente;
    if (!pendente) return res.redirect('/entrar');

    return res.status(status).render('usuario/confirmar-codigo', {
        title: 'Confirmar acesso',
        erro,
        mensagemCodigo: mensagem,
        emailMascarado: mascararEmail(pendente.email),
    });
}

export const limitarLogin = rateLimit({
    windowMs: 15 * 60 * 1000,
    limit: 10,
    standardHeaders: true,
    legacyHeaders: false,
    handler: (req, res) => renderLogin(
        req,
        res,
        429,
        'Muitas tentativas de acesso. Aguarde alguns minutos e tente novamente.',
        normalizarTexto(req.body.email),
    ),
});

export const limitarConfirmacao = rateLimit({
    windowMs: 15 * 60 * 1000,
    limit: 15,
    standardHeaders: true,
    legacyHeaders: false,
    handler: (req, res) => renderConfirmacao(
        req,
        res,
        429,
        'Muitas tentativas. Solicite um novo código em alguns minutos.',
    ),
});

export const limitarReenvio = rateLimit({
    windowMs: 15 * 60 * 1000,
    limit: 3,
    standardHeaders: true,
    legacyHeaders: false,
    handler: (req, res) => renderConfirmacao(
        req,
        res,
        429,
        'Limite de reenvios atingido. Aguarde alguns minutos.',
    ),
});

function regenerarSessao(req) {
    return new Promise((resolve, reject) => {
        req.session.regenerate((erro) => (erro ? reject(erro) : resolve()));
    });
}

function salvarSessao(req) {
    return new Promise((resolve, reject) => {
        req.session.save((erro) => (erro ? reject(erro) : resolve()));
    });
}

async function iniciarSessao(req, res, usuario, mensagem) {
    await regenerarSessao(req);
    req.session.usuario = {
        id: String(usuario.id || usuario._id),
        nome: usuario.nome,
        email: usuario.email,
        perfil: usuario.perfil,
    };
    await salvarSessao(req);
    return res.redirect(`/painel?mensagem=${encodeURIComponent(mensagem)}`);
}

async function iniciarVerificacao(req, res, usuario, finalidade, mensagem) {
    if (req.modoDemo) return iniciarSessao(req, res, usuario, mensagem);

    const verificacao = await criarVerificacao(usuario, finalidade);
    await regenerarSessao(req);
    req.session.autenticacaoPendente = {
        usuarioId: String(usuario._id),
        identificador: verificacao.identificador,
        email: usuario.email,
        mensagem,
    };
    await salvarSessao(req);
    return res.redirect('/confirmar-codigo');
}

function dadosCadastro(req) {
    return {
        nome: String(req.body.nome || '').trim(),
        email: normalizarTexto(req.body.email),
        perfil: req.body.perfil,
        curso: String(req.body.curso || '').trim(),
        areaAtuacao: String(req.body.areaAtuacao || '').trim(),
    };
}

function validarCadastro(dados) {
    if (!textoComTamanho(dados.nome, 3, 100)
        || !emailValido(dados.email)
        || !perfilValido(dados.perfil)) {
        return 'Informe nome, e-mail e perfil válidos.';
    }
    if (dados.perfil === 'aluno' && !textoComTamanho(dados.curso, 2, 100)) {
        return 'Informe o curso do aluno.';
    }
    if (dados.perfil === 'professor' && !textoComTamanho(dados.areaAtuacao, 2, 100)) {
        return 'Informe a área de atuação do professor.';
    }
    return '';
}

export default class UsuarioController {
    constructor() {
        this.openLogin = (req, res) => {
            if (req.session.usuario) return res.redirect('/painel');
            return renderLogin(req, res, 200, '');
        };

        this.login = async (req, res, next) => {
            const email = normalizarTexto(req.body.email);

            try {
                const usuario = await buscarUsuarioPorEmail(email);
                const senhaCorreta = Boolean(
                    usuario?.senha
                    && await bcrypt.compare(req.body.senha || '', usuario.senha),
                );

                if (!senhaCorreta) {
                    return renderLogin(req, res, 401, 'E-mail ou senha incorretos.', email);
                }

                return await iniciarVerificacao(
                    req,
                    res,
                    usuario,
                    'login',
                    'Login realizado com sucesso.',
                );
            } catch (erro) {
                if (erro.code === 'EMAIL_NAO_CONFIGURADO') {
                    return renderLogin(req, res, 503, erro.message, email);
                }
                return next(erro);
            }
        };

        this.loginGoogle = async (req, res, next) => {
            try {
                if (req.modoDemo) {
                    return renderLogin(
                        req,
                        res,
                        503,
                        'O login com Google fica disponível quando MongoDB e as credenciais forem configurados.',
                    );
                }

                let dadosGoogle;
                try {
                    dadosGoogle = await verificarCredencialGoogle(
                        req.body.credential,
                        req.session.googleNonce,
                    );
                } catch (erroGoogle) {
                    if (erroGoogle.code === 'GOOGLE_NAO_CONFIGURADO') {
                        return renderLogin(req, res, 503, erroGoogle.message);
                    }
                    return renderLogin(req, res, 401, 'Não foi possível confirmar o acesso com Google.');
                }
                let usuario = await buscarUsuarioPorGoogleId(dadosGoogle.googleId);

                if (!usuario) {
                    usuario = await buscarUsuarioPorEmail(dadosGoogle.email);

                    if (usuario?.googleId && usuario.googleId !== dadosGoogle.googleId) {
                        return renderLogin(req, res, 401, 'Não foi possível vincular esta conta Google.');
                    }

                    if (usuario) {
                        usuario = await vincularContaGoogle(usuario._id, dadosGoogle.googleId);
                    } else {
                        await regenerarSessao(req);
                        req.session.cadastroGoogle = dadosGoogle;
                        await salvarSessao(req);
                        return res.redirect('/cadastro/google');
                    }
                }

                return await iniciarVerificacao(
                    req,
                    res,
                    usuario,
                    'google',
                    'Acesso com Google confirmado.',
                );
            } catch (erro) {
                if (erro.code === 'EMAIL_NAO_CONFIGURADO') {
                    return renderLogin(req, res, 503, erro.message);
                }
                if (erro.code === 11000) {
                    return renderLogin(req, res, 409, 'Este e-mail já está ligado a outra conta.');
                }
                return next(erro);
            }
        };

        this.openCadastro = (req, res) => {
            if (req.session.usuario) return res.redirect('/painel');
            return res.render('usuario/cadastro', { title: 'Criar conta', erro: '', dados: {} });
        };

        this.cadastro = async (req, res, next) => {
            const dados = dadosCadastro(req);

            try {
                const erroDados = validarCadastro(dados);
                if (erroDados) {
                    return res.status(400).render('usuario/cadastro', {
                        title: 'Criar conta', erro: erroDados, dados,
                    });
                }
                if (!textoComTamanho(req.body.senha, 6, 72)) {
                    return res.status(400).render('usuario/cadastro', {
                        title: 'Criar conta',
                        erro: 'A senha deve ter entre 6 e 72 caracteres.',
                        dados,
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
                    emailVerificado: false,
                });

                try {
                    return await iniciarVerificacao(
                        req,
                        res,
                        usuario,
                        'cadastro',
                        'Conta criada e e-mail confirmado.',
                    );
                } catch (erroEmail) {
                    if (erroEmail.code === 'EMAIL_NAO_CONFIGURADO') {
                        return renderLogin(
                            req,
                            res,
                            503,
                            'A conta foi criada, mas o envio de e-mail ainda não está configurado.',
                            dados.email,
                        );
                    }
                    throw erroEmail;
                }
            } catch (erro) {
                if (erro.code === 11000) {
                    return res.status(409).render('usuario/cadastro', {
                        title: 'Criar conta', erro: 'Já existe uma conta com este e-mail.', dados,
                    });
                }
                return next(erro);
            }
        };

        this.openCadastroGoogle = (req, res) => {
            if (req.session.usuario) return res.redirect('/painel');
            if (!req.session.cadastroGoogle) return res.redirect('/entrar');

            return res.render('usuario/cadastro-google', {
                title: 'Completar cadastro',
                erro: '',
                dados: {
                    nome: req.session.cadastroGoogle.nome,
                    email: req.session.cadastroGoogle.email,
                },
            });
        };

        this.cadastroGoogle = async (req, res, next) => {
            const contaGoogle = req.session.cadastroGoogle;
            if (!contaGoogle) return res.redirect('/entrar');

            const dados = {
                ...dadosCadastro(req),
                email: contaGoogle.email,
            };

            try {
                const erroDados = validarCadastro(dados);
                if (erroDados) {
                    return res.status(400).render('usuario/cadastro-google', {
                        title: 'Completar cadastro', erro: erroDados, dados,
                    });
                }

                let usuario = await buscarUsuarioPorEmail(contaGoogle.email);
                if (usuario?.googleId && usuario.googleId !== contaGoogle.googleId) {
                    return renderLogin(req, res, 401, 'Não foi possível vincular esta conta Google.');
                }

                if (usuario) {
                    usuario = await vincularContaGoogle(usuario._id, contaGoogle.googleId);
                } else {
                    usuario = await cadastrarUsuario({
                        ...dados,
                        googleId: contaGoogle.googleId,
                        emailVerificado: false,
                    });
                }

                return await iniciarVerificacao(
                    req,
                    res,
                    usuario,
                    'google',
                    'Conta Google cadastrada e confirmada.',
                );
            } catch (erro) {
                if (erro.code === 'EMAIL_NAO_CONFIGURADO') {
                    return renderLogin(req, res, 503, erro.message, contaGoogle.email);
                }
                if (erro.code === 11000) {
                    return renderLogin(req, res, 409, 'Este e-mail já está ligado a outra conta.');
                }
                return next(erro);
            }
        };

        this.openConfirmacao = (req, res) => renderConfirmacao(req, res);

        this.confirmarCodigo = async (req, res, next) => {
            const pendente = req.session.autenticacaoPendente;
            if (!pendente) return res.redirect('/entrar');

            try {
                const resultado = await validarCodigo(pendente.identificador, req.body.codigo);
                if (!resultado.ok) {
                    return renderConfirmacao(req, res, 400, resultado.erro);
                }

                const usuario = await confirmarAcessoUsuario(pendente.usuarioId);
                if (!usuario) return res.redirect('/entrar');
                return await iniciarSessao(req, res, usuario, pendente.mensagem);
            } catch (erro) {
                return next(erro);
            }
        };

        this.reenviarCodigo = async (req, res, next) => {
            const pendente = req.session.autenticacaoPendente;
            if (!pendente) return res.redirect('/entrar');

            try {
                const usuario = await buscarUsuarioPorId(pendente.usuarioId);
                if (!usuario) return res.redirect('/entrar');

                const verificacao = await criarVerificacao(usuario, 'login');
                req.session.autenticacaoPendente.identificador = verificacao.identificador;
                await salvarSessao(req);
                return renderConfirmacao(req, res, 200, '', 'Um novo código foi enviado.');
            } catch (erro) {
                if (erro.code === 'EMAIL_NAO_CONFIGURADO') {
                    return renderConfirmacao(req, res, 503, erro.message);
                }
                return next(erro);
            }
        };

        this.logout = (req, res, next) => {
            req.session.destroy((erro) => {
                if (erro) return next(erro);
                res.clearCookie('acervotcc.sid');
                return res.redirect('/?mensagem=Você saiu da sua conta.');
            });
        };
    }
}
