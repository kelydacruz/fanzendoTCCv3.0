import {
    createHmac,
    randomInt,
    randomUUID,
    timingSafeEqual,
} from 'crypto';
import VerificacaoLogin from '../models/verificacaoLogin.js';
import { enviarCodigoEmail } from './email.js';

const MAXIMO_TENTATIVAS = 5;

function minutosValidade() {
    const valor = Number(process.env.CODIGO_VALIDADE_MINUTOS || 10);
    return Number.isFinite(valor) ? Math.min(Math.max(valor, 5), 15) : 10;
}

function segredoCodigo() {
    const segredo = process.env.OTP_SECRET || process.env.SESSION_SECRET;

    if (!segredo) {
        const erro = new Error('Defina OTP_SECRET ou SESSION_SECRET para proteger os códigos.');
        erro.code = 'SEGREDO_CODIGO_AUSENTE';
        throw erro;
    }

    return segredo;
}

function gerarHash(identificador, codigo) {
    return createHmac('sha256', segredoCodigo())
        .update(`${identificador}:${codigo}`)
        .digest('hex');
}

function hashesIguais(hashA, hashB) {
    const a = Buffer.from(hashA, 'hex');
    const b = Buffer.from(hashB, 'hex');
    return a.length === b.length && timingSafeEqual(a, b);
}

export function gerarCodigo() {
    return String(randomInt(0, 1_000_000)).padStart(6, '0');
}

export function formatoCodigoValido(codigo) {
    return /^\d{6}$/.test(String(codigo || '').trim());
}

export function mascararEmail(email) {
    const [usuario, dominio] = String(email || '').split('@');
    if (!usuario || !dominio) return 'seu e-mail';
    const inicio = usuario.slice(0, Math.min(2, usuario.length));
    return `${inicio}${'*'.repeat(Math.max(2, usuario.length - inicio.length))}@${dominio}`;
}

export async function criarVerificacao(usuario, finalidade) {
    const identificador = randomUUID();
    const codigo = gerarCodigo();
    const validade = minutosValidade();
    const expiraEm = new Date(Date.now() + validade * 60 * 1000);

    await VerificacaoLogin.updateMany(
        { usuario: usuario._id, usado: false },
        { $set: { usado: true } },
    );

    const verificacao = await VerificacaoLogin.create({
        usuario: usuario._id,
        identificador,
        codigoHash: gerarHash(identificador, codigo),
        finalidade,
        expiraEm,
    });

    try {
        await enviarCodigoEmail({
            destino: usuario.email,
            codigo,
            minutosValidade: validade,
        });
    } catch (erro) {
        await VerificacaoLogin.deleteOne({ _id: verificacao._id });
        throw erro;
    }

    return { identificador, expiraEm };
}

export async function validarCodigo(identificador, codigo) {
    if (!formatoCodigoValido(codigo)) {
        return { ok: false, erro: 'Código inválido ou expirado.' };
    }

    const verificacao = await VerificacaoLogin.findOne({
        identificador,
        usado: false,
        expiraEm: { $gt: new Date() },
    }).select('+codigoHash');

    if (!verificacao || verificacao.tentativas >= MAXIMO_TENTATIVAS) {
        return { ok: false, erro: 'Código inválido ou expirado.' };
    }

    const hashRecebido = gerarHash(identificador, String(codigo).trim());
    if (!hashesIguais(verificacao.codigoHash, hashRecebido)) {
        verificacao.tentativas += 1;
        if (verificacao.tentativas >= MAXIMO_TENTATIVAS) verificacao.usado = true;
        await verificacao.save();
        return { ok: false, erro: 'Código inválido ou expirado.' };
    }

    verificacao.usado = true;
    await verificacao.save();
    return { ok: true };
}
