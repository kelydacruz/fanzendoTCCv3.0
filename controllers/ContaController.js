import bcrypt from 'bcryptjs';
import { atualizarSenhaUsuario, buscarUsuarioPorId, buscarUsuarioComCredenciaisPorId, confirmarAcessoUsuario } from '../models/usuarioOperacoes.js';
import { textoComTamanho } from '../services/validacao.js';
import { criarVerificacao, validarCodigo } from '../models/verificacaoOperacoes.js';

import { renderConfirmacao, salvarSessao, iniciarSessao } from './usuarioAuxiliares.js';

export default class ContaController {
    constructor() {
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

    }
}
