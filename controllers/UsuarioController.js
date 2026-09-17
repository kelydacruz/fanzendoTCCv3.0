// Login com senha e cadastro. GoogleController cuida do Google; ContaController, da confirmação e senha.
import { mensagemBloqueio } from '../services/bloqueio.js';
import bcrypt from 'bcryptjs';
import { buscarUsuarioPorEmail, cadastrarUsuario, registrarLoginUsuario } from '../models/usuarioOperacoes.js';
import { normalizarTexto } from '../services/texto.js';
import { textoComTamanho } from '../services/validacao.js';

import { dadosCadastro, opcoesCadastro, validarCadastro } from '../models/usuarioRegras.js';
import {
    renderLogin,
    usuarioAtivo,
    iniciarSessao,
    iniciarVerificacao,
    loginPrecisaConfirmacao,
    renderCadastro,
} from './usuarioAuxiliares.js';
export default class UsuarioController {
    constructor() {
        this.openLogin = (req, res) => {
            if (req.session.usuario) return res.redirect('/painel');
            const aviso = req.session.avisoBloqueio || '';
            delete req.session.avisoBloqueio;
            return renderLogin(req, res, 200, aviso);
        };

        this.login = async (req, res, next) => {
            const email = normalizarTexto(req.body.email);
            try {
                const usuario = await buscarUsuarioPorEmail(email);
                const senhaCorreta = Boolean(usuario?.senha && await bcrypt.compare(req.body.senha || '', usuario.senha));
                if (!senhaCorreta) return renderLogin(req, res, 401, 'E-mail ou senha incorretos.', email);
                if (!usuarioAtivo(usuario)) return renderLogin(req, res, 403, mensagemBloqueio(usuario), email);

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

        this.openCadastro = async (req, res, next) => {
            if (req.session.usuario) return res.redirect('/painel');
            try {
                return await renderCadastro(res, 200, '', {});
            } catch (erro) {
                return next(erro);
            }
        };

        this.cadastro = async (req, res, next) => {
            const dados = dadosCadastro(req.body);
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

        this.logout = (req, res, next) => {
            req.session.destroy((erro) => {
                if (erro) return next(erro);
                res.clearCookie('acervotcc.sid');
                return res.redirect('/?mensagem=Você saiu da sua conta.');
            });
        };
    }
}
