export function normalizarTexto(valor = '') {
    return String(valor)
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .toLocaleLowerCase('pt-BR')
        .trim();
}

export function escaparRegex(valor = '') {
    return String(valor).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

export function separarLista(valor = '') {
    return String(valor)
        .split(',')
        .map((item) => item.trim())
        .filter(Boolean)
        .slice(0, 10);
}

export function classeStatus(valor = '') {
    return normalizarTexto(valor).replaceAll(' ', '-');
}
