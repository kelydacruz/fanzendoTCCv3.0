function redirecionarComMensagem(res, caminho, mensagem) {
    res.redirect(`${caminho}?mensagem=${encodeURIComponent(mensagem)}`);
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
