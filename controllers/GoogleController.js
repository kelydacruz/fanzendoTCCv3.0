import { mensagemBloqueio } from '../services/bloqueio.js';
import {
    atualizarPerfilUsuario,
    buscarUsuarioPorEmail,
    buscarUsuarioPorGoogleId,
    cadastrarUsuario,
    confirmarAcessoUsuario,
    vincularContaGoogle,
} from '../models/usuarioOperacoes.js';
import { verificarCredencialGoogle } from '../services/autenticacaoGoogle.js';
import { perfilPeloEmail } from '../models/perfis.js';

import { dadosCadastro, opcoesCadastro, validarCadastro } from '../models/usuarioRegras.js';
import {
    renderLogin,
    regenerarSessao,
    salvarSessao,
    usuarioAtivo,
    iniciarSessao,
    iniciarVerificacao,
    exigirCodigoAdministrativo,
    renderCadastroGoogle,
} from './usuarioAuxiliares.js';

export default class GoogleController {
    constructor() {
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
                if (!usuarioAtivo(usuario) && usuario) return renderLogin(req, res, 403, mensagemBloqueio(usuario));

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
            const dados = dadosCadastro(req.body, contaGoogle.email, contaGoogle.perfil);
            try {
                const opcoes = await opcoesCadastro();
                const erroDados = validarCadastro(dados, opcoes);
                if (erroDados) return renderCadastroGoogle(res, 400, erroDados, dados);

                let usuario = await buscarUsuarioPorEmail(contaGoogle.email);
                if (usuario?.googleId && usuario.googleId !== contaGoogle.googleId) return renderLogin(req, res, 401, 'Não foi possível vincular esta conta Google.');
                if (usuario && !usuarioAtivo(usuario)) return renderLogin(req, res, 403, mensagemBloqueio(usuario));
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

    }
}
