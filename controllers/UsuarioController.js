import bcrypt from 'bcryptjs';
import { randomBytes } from 'crypto';
import { rateLimit } from 'express-rate-limit';
import {
    atualizarPerfilUsuario,
    atualizarSenhaUsuario,
    buscarUsuarioPorEmail,
    buscarUsuarioPorGoogleId,
    buscarUsuarioPorId,
    buscarUsuarioComCredenciaisPorId,
    cadastrarUsuario,
    confirmarAcessoUsuario,
    listarAreasAtuacao,
    listarCursos,
    registrarLoginUsuario,
    vincularContaGoogle,
} from '../services/repositorio.js';
import { verificarCredencialGoogle } from '../services/autenticacaoGoogle.js';
import { normalizarTexto } from '../services/texto.js';
import { perfilPeloEmail } from '../services/perfis.js';
import { emailValido, textoComTamanho } from '../services/validacao.js';
import { criarVerificacao, mascararEmail, validarCodigo } from '../services/verificacaoLogin.js';

function renderLogin(req, res, status, erro, email = '') {
    req.session.googleNonce = randomBytes(32).toString('hex');
    return res.status(status).render('usuario/login', {
        title: 'Entrar', erro, dados: { email }, googleNonce: req.session.googleNonce,
    });
}

function renderConfirmacao(req, res, status = 200, erro = '', mensagem = '') {
    const pendente = req.session.autenticacaoPendente;
    if (!pendente) return res.redirect('/entrar');
    return res.status(status).render('usuario/confirmar-codigo', {
        title: pendente.acao === 'definir_senha' ? 'Confirmar alteração' : 'Confirmar acesso',
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
    handler: (req, res) => renderLogin(req, res, 429, 'Muitas tentativas de acesso. Aguarde alguns minutos e tente novamente.', normalizarTexto(req.body.email)),
});

export const limitarConfirmacao = rateLimit({
    windowMs: 15 * 60 * 1000,
    limit: 15,
    standardHeaders: true,
    legacyHeaders: false,
    handler: (req, res) => renderConfirmacao(req, res, 429, 'Muitas tentativas. Solicite um novo código em alguns minutos.'),
});

export const limitarReenvio = rateLimit({
    windowMs: 15 * 60 * 1000,
    limit: 3,
    standardHeaders: true,
    legacyHeaders: false,
    handler: (req, res) => renderConfirmacao(req, res, 429, 'Limite de reenvios atingido. Aguarde alguns minutos.'),
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

function usuarioAtivo(usuario) {
    return usuario && usuario.ativo !== false;
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
    const destino = usuario.perfil === 'admin' ? '/admin' : '/painel';
    return res.redirect(`${destino}?mensagem=${encodeURIComponent(mensagem)}`);
}

async function iniciarVerificacao(req, res, usuario, finalidade, mensagem, acao = 'login') {
    if (req.modoDemo) return iniciarSessao(req, res, usuario, mensagem);
    const verificacao = await criarVerificacao(usuario, finalidade);
    await regenerarSessao(req);
    req.session.autenticacaoPendente = {
        usuarioId: String(usuario._id),
        identificador: verificacao.identificador,
        email: usuario.email,
        finalidade,
        mensagem,
        acao,
    };
    await salvarSessao(req);
    return res.redirect('/confirmar-codigo');
}

function exigirCodigoAdministrativo() {
    return process.env.ADMIN_EXIGIR_CODIGO === 'true';
}

function loginPrecisaConfirmacao(req, usuario) {
    if (req.modoDemo) return false;
    return !usuario.emailVerificado || (usuario.perfil === 'admin' && exigirCodigoAdministrativo());
}

function dadosCadastro(req, emailForcado = '', perfilForcado = '') {
    const email = normalizarTexto(emailForcado || req.body.email);
    return {
        nome: String(req.body.nome || '').trim(),
        email,
        perfil: perfilForcado || perfilPeloEmail(email),
        curso: String(req.body.curso || '').trim(),
        areaAtuacao: String(req.body.areaAtuacao || '').trim(),
    };
}

async function opcoesCadastro() {
    const [cursos, areas] = await Promise.all([
        listarCursos({ somenteAtivos: true }),
        listarAreasAtuacao({ somenteAtivas: true }),
    ]);
    return { cursos, areas };
}

function opcaoValida(valor, opcoes) {
    return opcoes.some((opcao) => normalizarTexto(opcao.nome) === normalizarTexto(valor));
}

function validarCadastro(dados, opcoes = null) {
    if (!textoComTamanho(dados.nome, 3, 100) || !emailValido(dados.email)) {
        return 'Informe nome e e-mail válidos.';
    }
    if (!dados.perfil) {
        return 'Use o e-mail acadêmico do IFSul para aluno ou o e-mail institucional para professor.';
    }
    if (dados.perfil === 'admin') {
        return 'A conta administrativa deve ser criada pelo botão Entrar com Google.';
    }
    if (dados.perfil === 'aluno' && !textoComTamanho(dados.curso, 2, 100)) {
        return 'Informe o curso do aluno.';
    }
    if (dados.perfil === 'aluno' && opcoes && !opcaoValida(dados.curso, opcoes.cursos)) {
        return 'Selecione um curso cadastrado pela administração.';
    }
    if (dados.perfil === 'professor' && !textoComTamanho(dados.areaAtuacao, 2, 100)) {
        return 'Informe a área de atuação do professor.';
    }
    if (dados.perfil === 'professor' && opcoes && !opcaoValida(dados.areaAtuacao, opcoes.areas)) {
        return 'Selecione uma área de atuação cadastrada pela administração.';
    }
    return '';
}

async function renderCadastro(res, status, erro, dados) {
    const opcoes = await opcoesCadastro();
    return res.status(status).render('usuario/cadastro', {
        title: 'Criar conta', erro, dados, ...opcoes,
    });
}

async function renderCadastroGoogle(res, status, erro, dados) {
    const opcoes = await opcoesCadastro();
    return res.status(status).render('usuario/cadastro-google', {
        title: 'Completar cadastro', erro, dados, ...opcoes,
    });
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
                const senhaCorreta = Boolean(usuario?.senha && await bcrypt.compare(req.body.senha || '', usuario.senha));
                if (!senhaCorreta) return renderLogin(req, res, 401, 'E-mail ou senha incorretos.', email);
                if (!usuarioAtivo(usuario)) return renderLogin(req, res, 403, 'Esta conta está bloqueada. Procure a administração.', email);

                if (loginPrecisaConfirmacao(req, usuario)) {
                    const finalidade = usuario.perfil === 'admin' ? 'admin_login' : 'confirmar_email';
                    const mensagem = usuario.perfil === 'admin'
                        ? 'Acesso administrativo confirmado.'
                        : 'E-mail confirmado e login realizado.';
                    return await iniciarVerificacao(req, res, usuario, finalidade, mensagem);
                }

                const atualizado = await registrarLoginUsuario(usuario.id || usuario._id);
                return iniciarSessao(req, res, atualizado || usuario, 'Login realizado com sucesso.');
            } catch (erro) {
                if (erro.code === 'EMAIL_NAO_CONFIGURADO') return renderLogin(req, res, 503, erro.message, email);
                return next(erro);
            }
        };

        this.loginGoogle = async (req, res, next) => {
            try {
                if (req.modoDemo) {
                    return renderLogin(req, res, 503, 'O login com Google fica disponível quando MongoDB e as credenciais forem configurados.');
                }

                let dadosGoogle;
                try {
                    dadosGoogle = await verificarCredencialGoogle(req.body.credential, req.session.googleNonce);
                } catch (erroGoogle) {
                    if (erroGoogle.code === 'GOOGLE_NAO_CONFIGURADO') return renderLogin(req, res, 503, erroGoogle.message);
                    return renderLogin(req, res, 401, 'Não foi possível confirmar o acesso com Google.');
                }

                const perfil = perfilPeloEmail(dadosGoogle.email);
                if (!perfil) {
                    return renderLogin(req, res, 403, 'Não foi possível identificar o tipo desta conta.', dadosGoogle.email);
                }

                let usuario = await buscarUsuarioPorGoogleId(dadosGoogle.googleId);
                if (!usuario) usuario = await buscarUsuarioPorEmail(dadosGoogle.email);

                if (usuario?.googleId && usuario.googleId !== dadosGoogle.googleId) {
                    return renderLogin(req, res, 401, 'Não foi possível vincular esta conta Google.');
                }
                if (!usuarioAtivo(usuario) && usuario) return renderLogin(req, res, 403, 'Esta conta está bloqueada. Procure a administração.');

                if (usuario) {
                    if (!usuario.googleId) usuario = await vincularContaGoogle(usuario._id, dadosGoogle.googleId);
                    if (usuario.perfil !== perfil) usuario = await atualizarPerfilUsuario(usuario._id, perfil);
                    usuario = await confirmarAcessoUsuario(usuario._id);
                    if (perfil === 'admin' && exigirCodigoAdministrativo()) {
                        return iniciarVerificacao(req, res, usuario, 'admin_login', 'Acesso administrativo confirmado.');
                    }
                    return iniciarSessao(req, res, usuario, 'Acesso com Google confirmado.');
                }

                if (perfil === 'admin') {
                    usuario = await cadastrarUsuario({
                        nome: dadosGoogle.nome,
                        email: dadosGoogle.email,
                        perfil: 'admin',
                        googleId: dadosGoogle.googleId,
                        emailVerificado: true,
                        ativo: true,
                    });
                    if (exigirCodigoAdministrativo()) {
                        return iniciarVerificacao(req, res, usuario, 'admin_login', 'Acesso administrativo confirmado.');
                    }
                    return iniciarSessao(req, res, usuario, 'Conta administrativa criada com segurança.');
                }

                await regenerarSessao(req);
                req.session.cadastroGoogle = { ...dadosGoogle, perfil };
                await salvarSessao(req);
                return res.redirect('/cadastro/google');
            } catch (erro) {
                if (erro.code === 11000) return renderLogin(req, res, 409, 'Este e-mail já está ligado a outra conta.');
                return next(erro);
            }
        };

        this.openCadastro = async (req, res, next) => {
            if (req.session.usuario) return res.redirect('/painel');
            try {
                return await renderCadastro(res, 200, '', {});
            } catch (erro) {
                return next(erro);
            }
        };

        this.cadastro = async (req, res, next) => {
            const dados = dadosCadastro(req);
            try {
                const opcoes = await opcoesCadastro();
                const erroDados = validarCadastro(dados, opcoes);
                if (erroDados) return renderCadastro(res, 400, erroDados, dados);
                if (!textoComTamanho(req.body.senha, 8, 72)) {
                    return renderCadastro(res, 400, 'A senha deve ter entre 8 e 72 caracteres.', dados);
                }
                if (await buscarUsuarioPorEmail(dados.email)) {
                    return renderCadastro(res, 409, 'Este e-mail já possui uma conta. Entre para continuar.', dados);
                }

                const usuario = await cadastrarUsuario({
                    ...dados,
                    senha: await bcrypt.hash(req.body.senha, 10),
                    emailVerificado: false,
                    ativo: true,
                });
                return await iniciarVerificacao(req, res, usuario, 'cadastro', 'Conta criada e e-mail confirmado.');
            } catch (erro) {
                if (erro.code === 'EMAIL_NAO_CONFIGURADO') return renderLogin(req, res, 503, 'A conta foi criada, mas o envio de e-mail ainda não está configurado.', dados.email);
                if (erro.code === 11000) return renderCadastro(res, 409, 'Já existe uma conta com este e-mail.', dados);
                return next(erro);
            }
        };

        this.openCadastroGoogle = async (req, res, next) => {
            if (req.session.usuario) return res.redirect('/painel');
            if (!req.session.cadastroGoogle) return res.redirect('/entrar');
            try {
                return await renderCadastroGoogle(res, 200, '', req.session.cadastroGoogle);
            } catch (erro) {
                return next(erro);
            }
        };

        this.cadastroGoogle = async (req, res, next) => {
            const contaGoogle = req.session.cadastroGoogle;
            if (!contaGoogle) return res.redirect('/entrar');
            const dados = dadosCadastro(req, contaGoogle.email, contaGoogle.perfil);
            try {
                const opcoes = await opcoesCadastro();
                const erroDados = validarCadastro(dados, opcoes);
                if (erroDados) return renderCadastroGoogle(res, 400, erroDados, dados);

                let usuario = await buscarUsuarioPorEmail(contaGoogle.email);
                if (usuario?.googleId && usuario.googleId !== contaGoogle.googleId) return renderLogin(req, res, 401, 'Não foi possível vincular esta conta Google.');
                if (usuario) usuario = await vincularContaGoogle(usuario._id, contaGoogle.googleId);
                else {
                    usuario = await cadastrarUsuario({
                        ...dados,
                        googleId: contaGoogle.googleId,
                        emailVerificado: true,
                        ativo: true,
                    });
                }

                usuario = await confirmarAcessoUsuario(usuario._id);
                return iniciarSessao(req, res, usuario, 'Conta Google cadastrada com sucesso.');
            } catch (erro) {
                if (erro.code === 11000) return renderLogin(req, res, 409, 'Este e-mail já está ligado a outra conta.');
                return next(erro);
            }
        };

        this.openConfirmacao = (req, res) => renderConfirmacao(req, res);

        this.confirmarCodigo = async (req, res, next) => {
            const pendente = req.session.autenticacaoPendente;
            if (!pendente) return res.redirect('/entrar');
            try {
                const resultado = await validarCodigo(pendente.identificador, req.body.codigo);
                if (!resultado.ok) return renderConfirmacao(req, res, 400, resultado.erro);

                if (pendente.acao === 'definir_senha') {
                    req.session.senhaAutorizada = { usuarioId: pendente.usuarioId, expiraEm: Date.now() + 10 * 60 * 1000 };
                    delete req.session.autenticacaoPendente;
                    await salvarSessao(req);
                    return res.redirect('/conta/definir-senha');
                }

                const usuario = await confirmarAcessoUsuario(pendente.usuarioId);
                if (!usuario) return res.redirect('/entrar');
                return iniciarSessao(req, res, usuario, pendente.mensagem);
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
                const verificacao = await criarVerificacao(usuario, pendente.finalidade || 'login');
                req.session.autenticacaoPendente.identificador = verificacao.identificador;
                await salvarSessao(req);
                return renderConfirmacao(req, res, 200, '', 'Um novo código foi enviado.');
            } catch (erro) {
                if (erro.code === 'EMAIL_NAO_CONFIGURADO') return renderConfirmacao(req, res, 503, erro.message);
                return next(erro);
            }
        };

        this.seguranca = async (req, res, next) => {
            try {
                const usuario = await buscarUsuarioComCredenciaisPorId(req.session.usuario.id);
                if (!usuario) return res.redirect('/entrar');
                return res.render('usuario/seguranca', {
                    title: 'Segurança da conta', temSenha: Boolean(usuario.senha), temGoogle: Boolean(usuario.googleId),
                });
            } catch (erro) {
                return next(erro);
            }
        };

        this.solicitarSenha = async (req, res, next) => {
            try {
                const usuario = await buscarUsuarioPorId(req.session.usuario.id);
                if (!usuario) return res.redirect('/entrar');
                if (req.modoDemo) {
                    req.session.senhaAutorizada = {
                        usuarioId: String(usuario.id || usuario._id),
                        expiraEm: Date.now() + 10 * 60 * 1000,
                    };
                    await salvarSessao(req);
                    return res.redirect('/conta/definir-senha');
                }
                const verificacao = await criarVerificacao(usuario, 'definir_senha');
                req.session.autenticacaoPendente = {
                    usuarioId: String(usuario.id || usuario._id),
                    identificador: verificacao.identificador,
                    email: usuario.email,
                    finalidade: 'definir_senha',
                    acao: 'definir_senha',
                };
                await salvarSessao(req);
                return res.redirect('/confirmar-codigo');
            } catch (erro) {
                return next(erro);
            }
        };

        this.openDefinirSenha = (req, res) => {
            const autorizacao = req.session.senhaAutorizada;
            if (!autorizacao || autorizacao.expiraEm < Date.now()) {
                delete req.session.senhaAutorizada;
                return res.redirect('/conta/seguranca?mensagem=Solicite um novo código para definir a senha.');
            }
            return res.render('usuario/definir-senha', { title: 'Definir senha', erro: '' });
        };

        this.definirSenha = async (req, res, next) => {
            const autorizacao = req.session.senhaAutorizada;
            if (!autorizacao || autorizacao.expiraEm < Date.now()) return res.redirect('/conta/seguranca?mensagem=A autorização expirou.');
            if (!textoComTamanho(req.body.senha, 8, 72)) {
                return res.status(400).render('usuario/definir-senha', { title: 'Definir senha', erro: 'A senha deve ter entre 8 e 72 caracteres.' });
            }
            if (req.body.senha !== req.body.confirmacao) {
                return res.status(400).render('usuario/definir-senha', { title: 'Definir senha', erro: 'As senhas informadas são diferentes.' });
            }
            try {
                await atualizarSenhaUsuario(autorizacao.usuarioId, await bcrypt.hash(req.body.senha, 10));
                delete req.session.senhaAutorizada;
                await salvarSessao(req);
                return res.redirect('/conta/seguranca?mensagem=Senha definida com sucesso.');
            } catch (erro) {
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
