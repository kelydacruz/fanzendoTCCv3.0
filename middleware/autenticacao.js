import { buscarUsuarioPorId } from '../services/repositorio.js';

function redirecionarComMensagem(res, caminho, mensagem) {
    res.redirect(`${caminho}?mensagem=${encodeURIComponent(mensagem)}`);
}

export async function validarUsuarioDaSessao(req, res, next) {
    if (!req.session.usuario) return next();
    try {
        const usuario = await buscarUsuarioPorId(req.session.usuario.id);
        if (!usuario || usuario.ativo === false) {
            return req.session.destroy(() => redirecionarComMensagem(
                res,
                '/entrar',
                'Sua sessão foi encerrada. Procure a administração se precisar de ajuda.',
            ));
        }
        req.session.usuario.nome = usuario.nome;
        req.session.usuario.email = usuario.email;
        req.session.usuario.perfil = usuario.perfil;
        return next();
    } catch (erro) {
        return next(erro);
    }
}

export function adicionarUsuarioNasTelas(req, res, next) {
    res.locals.usuario = req.session.usuario || null;
    res.locals.caminhoAtual = req.path;
    res.locals.mensagem = req.query.mensagem || '';
    next();
}

export function somenteAutenticado(req, res, next) {
    if (req.session.usuario) return next();
    return redirecionarComMensagem(res, '/entrar', 'Entre na sua conta para continuar.');
}

export function somenteAluno(req, res, next) {
    if (!req.session.usuario) {
        return redirecionarComMensagem(res, '/entrar', 'Entre na sua conta para continuar.');
    }
    if (req.session.usuario.perfil !== 'aluno') {
        return redirecionarComMensagem(res, '/tcc/lst', 'Somente alunos podem publicar TCCs.');
    }
    return next();
}

export function somenteProfessor(req, res, next) {
    if (!req.session.usuario) {
        return redirecionarComMensagem(res, '/entrar', 'Entre na sua conta para continuar.');
    }
    if (req.session.usuario.perfil !== 'professor') {
        return redirecionarComMensagem(res, '/painel', 'Esta área é exclusiva para professores.');
    }
    return next();
}

export function somenteAdmin(req, res, next) {
    if (!req.session.usuario) {
        return redirecionarComMensagem(res, '/entrar', 'Entre na sua conta para continuar.');
    }
    if (req.session.usuario.perfil !== 'admin') {
        return redirecionarComMensagem(res, '/painel', 'Esta área é exclusiva para administradores.');
    }
    return next();
}
