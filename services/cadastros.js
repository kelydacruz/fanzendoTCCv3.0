import Curso from '../models/curso.js';
import Turma from '../models/turma.js';
import AreaAtuacao from '../models/areaAtuacao.js';
import { cursos, areasAtuacao, turmas, novoId } from '../data/mock.js';
import { usandoMongo, idValido } from './banco.js';
import { preencherTurmaDemo } from './dadosDemo.js';

// Funções de cadastros: cada consulta usa MongoDB ou os dados locais de demonstração.
export async function listarCursos({ somenteAtivos = false } = {}) {
    if (usandoMongo()) {
        const filtro = somenteAtivos ? { ativo: true } : {};
        return Curso.find(filtro).sort({ nome: 1 }).lean();
    }
    return cursos
        .filter((curso) => !somenteAtivos || curso.ativo)
        .sort((a, b) => a.nome.localeCompare(b.nome, 'pt-BR'));
}

export async function listarAreasAtuacao({ somenteAtivas = false } = {}) {
    if (usandoMongo()) {
        const filtro = somenteAtivas ? { ativo: true } : {};
        return AreaAtuacao.find(filtro).sort({ nome: 1 }).lean();
    }
    return areasAtuacao
        .filter((area) => !somenteAtivas || area.ativo)
        .sort((a, b) => a.nome.localeCompare(b.nome, 'pt-BR'));
}

export async function cadastrarAreaAtuacao(dados) {
    if (usandoMongo()) return AreaAtuacao.create(dados);
    const area = { id: novoId(), ativo: true, ...dados };
    areasAtuacao.push(area);
    return area;
}

export async function atualizarAreaAtuacao(id, dados) {
    if (usandoMongo()) {
        if (!idValido(id)) return null;
        return AreaAtuacao.findByIdAndUpdate(id, dados, { new: true, runValidators: true });
    }
    const indice = areasAtuacao.findIndex((item) => item.id === String(id));
    if (indice < 0) return null;
    areasAtuacao[indice] = { ...areasAtuacao[indice], ...dados };
    return areasAtuacao[indice];
}

export async function cadastrarCurso(dados) {
    if (usandoMongo()) return Curso.create(dados);
    const curso = { id: novoId(), ativo: true, ...dados };
    cursos.push(curso);
    return curso;
}

export async function atualizarCurso(id, dados) {
    if (usandoMongo()) {
        if (!idValido(id)) return null;
        return Curso.findByIdAndUpdate(id, dados, { new: true, runValidators: true });
    }
    const indice = cursos.findIndex((item) => item.id === String(id));
    if (indice < 0) return null;
    cursos[indice] = { ...cursos[indice], ...dados };
    return cursos[indice];
}

export async function listarTurmas({ somenteAtivas = false } = {}) {
    if (usandoMongo()) {
        const filtro = somenteAtivas ? { ativo: true } : {};
        return Turma.find(filtro).populate('curso', 'nome sigla ativo').sort({ ano: -1, nome: 1 }).lean();
    }
    return turmas
        .filter((turma) => !somenteAtivas || turma.ativo)
        .map(preencherTurmaDemo)
        .sort((a, b) => b.ano - a.ano || a.nome.localeCompare(b.nome, 'pt-BR'));
}

export async function cadastrarTurma(dados) {
    if (usandoMongo()) return Turma.create(dados);
    const turma = { id: novoId(), ativo: true, cursoId: String(dados.curso), ...dados };
    delete turma.curso;
    turmas.push(turma);
    return preencherTurmaDemo(turma);
}

export async function atualizarTurma(id, dados) {
    if (usandoMongo()) {
        if (!idValido(id)) return null;
        return Turma.findByIdAndUpdate(id, dados, { new: true, runValidators: true });
    }
    const indice = turmas.findIndex((item) => item.id === String(id));
    if (indice < 0) return null;
    const cursoId = dados.curso ? String(dados.curso) : turmas[indice].cursoId;
    turmas[indice] = { ...turmas[indice], ...dados, cursoId };
    delete turmas[indice].curso;
    return preencherTurmaDemo(turmas[indice]);
}

export async function excluirAreaAtuacao(id) {
    if (usandoMongo()) {
        if (!idValido(id)) return null;
        return AreaAtuacao.findByIdAndDelete(id);
    }
    const indice = areasAtuacao.findIndex((area) => area.id === String(id));
    return indice < 0 ? null : areasAtuacao.splice(indice, 1)[0];
}
