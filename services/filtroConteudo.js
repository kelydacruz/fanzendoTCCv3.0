import Configuracao from '../models/configuracao.js';
import { mongoose } from '../config/conexao.js';
import { normalizarTexto } from './texto.js';

const CONFIG_CHAVE = 'filtro_conteudo';
const palavrasPadrao = ['palavrao', 'ofensa', 'spam'];
let termosCache = null;
let carregamento = null;

function termosDoAmbiente() {
    const termosExtras = String(process.env.TERMOS_PROIBIDOS || '')
        .split(',')
        .map((termo) => normalizarTexto(termo))
        .filter(Boolean);
    return [...new Set([...palavrasPadrao, ...termosExtras])];
}

function normalizarLista(termos) {
    return [...new Set((Array.isArray(termos) ? termos : String(termos || '').split(','))
        .map((termo) => normalizarTexto(termo))
        .filter((termo) => termo.length >= 2 && termo.length <= 60))].slice(0, 100);
}

export async function carregarTermosProibidos() {
    if (termosCache) return termosCache;
    if (carregamento) return carregamento;
    carregamento = (async () => {
        if (mongoose.connection.readyState === 1) {
            const configuracao = await Configuracao.findOne({ chave: CONFIG_CHAVE }).lean();
            termosCache = normalizarLista(configuracao?.termosProibidos || termosDoAmbiente());
        } else {
            termosCache = termosDoAmbiente();
        }
        return termosCache;
    })();
    try {
        return await carregamento;
    } finally {
        carregamento = null;
    }
}

export function listarTermosProibidos() {
    return [...(termosCache || termosDoAmbiente())];
}

export async function salvarTermosProibidos(termos) {
    const lista = normalizarLista(termos);
    if (mongoose.connection.readyState === 1) {
        await Configuracao.findOneAndUpdate(
            { chave: CONFIG_CHAVE },
            { chave: CONFIG_CHAVE, termosProibidos: lista },
            { upsert: true, new: true, runValidators: true },
        );
    }
    termosCache = lista;
    return listarTermosProibidos();
}

export function possuiConteudoInadequado(...campos) {
    const conteudo = normalizarTexto(campos.join(' '));
    const palavras = conteudo.split(/[^a-z0-9]+/).filter(Boolean);

    return listarTermosProibidos().some((termo) => {
        if (termo.includes(' ')) return conteudo.includes(termo);
        return palavras.includes(termo);
    });
}

export function validarConteudo(...campos) {
    if (possuiConteudoInadequado(...campos)) {
        throw new Error('O conteúdo possui um termo não permitido pela plataforma.');
    }
}
