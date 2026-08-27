import { normalizarTexto } from './texto.js';

const palavrasPadrao = ['palavrao', 'ofensa', 'spam'];

function termosProibidos() {
    const termosExtras = String(process.env.TERMOS_PROIBIDOS || '')
        .split(',')
        .map((termo) => normalizarTexto(termo))
        .filter(Boolean);

    return [...palavrasPadrao, ...termosExtras];
}

export function possuiConteudoInadequado(...campos) {
    const conteudo = normalizarTexto(campos.join(' '));
    const palavras = conteudo.split(/[^a-z0-9]+/).filter(Boolean);

    return termosProibidos().some((termo) => {
        if (termo.includes(' ')) return conteudo.includes(termo);
        return palavras.includes(termo);
    });
}

export function validarConteudo(...campos) {
    if (possuiConteudoInadequado(...campos)) {
        throw new Error('O conteúdo possui um termo não permitido pela plataforma.');
    }
}
