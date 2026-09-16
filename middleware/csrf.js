import { randomBytes, timingSafeEqual } from 'node:crypto';

// Cada sessão recebe uma chave. Um site externo não consegue lê-la para enviar formulários em seu nome.
export function prepararCsrf(req, res, next) {
    if (!req.session.csrf) req.session.csrf = randomBytes(32).toString('hex');
    res.locals.csrfToken = req.session.csrf;
    res.set('Cache-Control', 'no-store');
    next();
}

export function validarCsrf(req, res, next) {
    if (['GET', 'HEAD', 'OPTIONS'].includes(req.method)) return next();
    const token = req.get('x-csrf-token') || req.body?._csrf;
    const esperado = req.session.csrf;
    if (typeof token === 'string' && typeof esperado === 'string' && token.length === esperado.length
        && Buffer.byteLength(token) === Buffer.byteLength(esperado)
        && timingSafeEqual(Buffer.from(token), Buffer.from(esperado))) return next();
    return res.status(403).render('erro', { title: 'Formulário expirado', mensagemErro: 'Atualize a página e tente enviar o formulário novamente.' });
}
