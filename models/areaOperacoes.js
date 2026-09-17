import AreaAtuacao from './areaAtuacao.js';
import { areasAtuacao, novoId } from '../data/mock.js';
import { usandoMongo, idValido } from '../config/banco.js';
import { validarNome, validarSituacao, conferirNomeRepetido } from './cadastroValidacao.js';

export async function listarAreasAtuacao({ somenteAtivas = false } = {}) {
    if (usandoMongo()) return AreaAtuacao.find(somenteAtivas ? { ativo: true } : {}).sort({ nome: 1 }).lean();
    return areasAtuacao.filter((area) => !somenteAtivas || area.ativo)
        .sort((a, b) => a.nome.localeCompare(b.nome, 'pt-BR'));
}

export async function buscarAreaAtuacao(id) {
    if (usandoMongo()) return idValido(id) ? AreaAtuacao.findById(id).lean() : null;
    return areasAtuacao.find((area) => area.id === String(id)) || null;
}

async function validarArea(dados, id = '') {
    const nome = validarNome(dados.nome);
    const ativo = validarSituacao(dados.ativo ?? true);
    conferirNomeRepetido(await listarAreasAtuacao(), nome, id);
    return { nome, ativo };
}

export async function cadastrarAreaAtuacao(dados) {
    const valores = await validarArea(dados);
    if (usandoMongo()) return AreaAtuacao.create(valores);
    const area = { id: novoId(), ...valores };
    areasAtuacao.push(area);
    return area;
}

export async function atualizarAreaAtuacao(id, dados) {
    const atual = await buscarAreaAtuacao(id);
    if (!atual) return null;
    const valores = await validarArea({ ...atual, ...dados }, id);
    if (usandoMongo()) return AreaAtuacao.findByIdAndUpdate(id, valores, { new: true, runValidators: true });
    Object.assign(atual, valores);
    return atual;
}

export async function excluirAreaAtuacao(id) {
    if (usandoMongo()) return idValido(id) ? AreaAtuacao.findByIdAndDelete(id) : null;
    const indice = areasAtuacao.findIndex((area) => area.id === String(id));
    // Perfis e ideias guardam o nome como texto, por isso preservam o histórico.
    return indice < 0 ? null : areasAtuacao.splice(indice, 1)[0];
}
