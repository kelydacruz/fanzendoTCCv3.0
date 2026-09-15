import { randomBytes } from 'node:crypto';

export function prepararConfirmacao(req, acao, id) {
    const token = randomBytes(32).toString('hex');
    req.session.confirmacao = { acao, id: String(id), token };
    return token;
}

export function consumirConfirmacao(req, acao, id) {
    const item = req.session.confirmacao;
    if (!item || item.acao !== acao || item.id !== String(id) || req.body.token !== item.token) return false;
    delete req.session.confirmacao;
    return true;
}
