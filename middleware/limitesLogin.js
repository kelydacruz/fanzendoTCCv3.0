import { rateLimit } from 'express-rate-limit';
import { normalizarTexto } from '../services/texto.js';
import { renderLogin, renderConfirmacao } from '../controllers/usuarioAuxiliares.js';

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

