import { mensagemBloqueio } from '../services/bloqueio.js';
import { randomBytes } from 'crypto';
import { criarVerificacao, mascararEmail } from '../models/verificacaoOperacoes.js';

import { opcoesCadastro } from '../models/usuarioRegras.js';
export function renderLogin(req, res, status, erro, email = '') {
    req.session.googleNonce = randomBytes(32).toString('hex');
    return res.status(status).render('usuario/login', {
        title: 'Entrar', erro, dados: { email }, googleNonce: req.session.googleNonce,
    });
}

export function renderConfirmacao(req, res, status = 200, erro = '', mensagem = '') {
    const pendente = req.session.autenticacaoPendente;
    if (!pendente) return res.redirect('/entrar');
    return res.status(status).render('usuario/confirmar-codigo', {
        title: pendente.acao === 'definir_senha' ? 'Confirmar alteração' : 'Confirmar acesso',
        erro,
        mensagemCodigo: mensagem,
        emailMascarado: mascararEmail(pendente.email),
    });
}

export function regenerarSessao(req) {
    return new Promise((resolve, reject) => {
        req.session.regenerate((erro) => (erro ? reject(erro) : resolve()));
    });
}

export function salvarSessao(req) {
    return new Promise((resolve, reject) => {
        req.session.save((erro) => (erro ? reject(erro) : resolve()));
    });
}

export function usuarioAtivo(usuario) {
    return usuario && usuario.ativo !== false;
}

// Troca o identificador da sessão após autenticar para impedir reaproveitamento de uma sessão anterior.
export async function iniciarSessao(req, res, usuario, mensagem) {
    if (!usuarioAtivo(usuario)) return renderLogin(req, res, 403, mensagemBloqueio(usuario));
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

export async function iniciarVerificacao(req, res, usuario, finalidade, mensagem, acao = 'login') {
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

export function exigirCodigoAdministrativo() {
    return process.env.ADMIN_EXIGIR_CODIGO === 'true';
}

export function loginPrecisaConfirmacao(req, usuario) {
    if (req.modoDemo) return false;
    return !usuario.emailVerificado || (usuario.perfil === 'admin' && exigirCodigoAdministrativo());
}

export async function renderCadastro(res, status, erro, dados) {
    const opcoes = await opcoesCadastro();
    return res.status(status).render('usuario/cadastro', {
        title: 'Criar conta', erro, dados, ...opcoes,
    });
}

export async function renderCadastroGoogle(res, status, erro, dados) {
    const opcoes = await opcoesCadastro();
    return res.status(status).render('usuario/cadastro-google', {
        title: 'Completar cadastro', erro, dados, ...opcoes,
    });
}

