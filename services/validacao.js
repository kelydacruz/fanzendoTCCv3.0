export function textoComTamanho(valor, minimo, maximo) {
    const texto = String(valor || '').trim();
    return texto.length >= minimo && texto.length <= maximo;
}

export function emailValido(valor) {
    const email = String(valor || '').trim();
    if (email.length > 150) return false;
    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

export function perfilValido(valor) {
    return ['aluno', 'professor'].includes(valor);
}

export function anoValido(valor) {
    const ano = Number(valor);
    const anoAtual = new Date().getFullYear();
    return Number.isInteger(ano) && ano >= 1980 && ano <= anoAtual;
}

export function comentarioValido(valor) {
    return textoComTamanho(valor, 1, 500);
}
