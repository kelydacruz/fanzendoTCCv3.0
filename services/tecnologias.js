import { normalizarTexto } from './texto.js';

const nomes = {
    js: 'JavaScript', javascript: 'JavaScript', ts: 'TypeScript', typescript: 'TypeScript',
    'node.js': 'Node.js', node: 'Node.js', nodejs: 'Node.js', react: 'React', reactjs: 'React',
    'react.js': 'React', 'react native': 'React Native', html: 'HTML', html5: 'HTML',
    css: 'CSS', css3: 'CSS', mongodb: 'MongoDB', mongo: 'MongoDB', mysql: 'MySQL',
    postgresql: 'PostgreSQL', postgres: 'PostgreSQL', python: 'Python', java: 'Java',
    php: 'PHP', firebase: 'Firebase', arduino: 'Arduino', express: 'Express',
    'express.js': 'Express', ejs: 'EJS', bootstrap: 'Bootstrap', sqlite: 'SQLite',
};

export function normalizarTecnologias(valor = '') {
    const itens = Array.isArray(valor) ? valor : String(valor).split(/[,;\n]/);
    const resultado = new Map();
    for (const item of itens) {
        const texto = String(item).trim().replace(/\s+/g, ' ');
        if (!texto) continue;
        const apelido = normalizarTexto(texto);
        const nome = Object.hasOwn(nomes, apelido) ? nomes[apelido] : texto;
        const chave = normalizarTexto(nome);
        if (!resultado.has(chave)) resultado.set(chave, nome);
    }
    return [...resultado.values()];
}

// Recebe somente os TCCs que o visitante tem permissão para consultar.
export function resumirTecnologias(tccs) {
    const contagens = new Map();
    let informados = 0;
    for (const tcc of tccs) {
        const tecnologias = normalizarTecnologias(tcc.tecnologias || []);
        if (tecnologias.length) informados += 1;
        for (const nome of tecnologias) {
            const chave = normalizarTexto(nome);
            const item = contagens.get(chave) || { nome, total: 0 };
            item.total += 1;
            contagens.set(chave, item);
        }
    }
    const itens = [...contagens.values()].sort((a, b) => b.total - a.total || a.nome.localeCompare(b.nome, 'pt-BR'));
    return { itens, destaques: itens.slice(0, 8), totalTccs: tccs.length, informados, maximo: itens[0]?.total || 1 };
}
