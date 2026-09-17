import Turma from './turma.js';
import Tcc from './tcc.js';
import { turmas, tccs, novoId } from '../data/mock.js';
import { usandoMongo, idValido } from '../config/banco.js';
import { preencherTurmaDemo } from '../data/relacionamentos.js';
import { buscarCurso } from './cursoOperacoes.js';
import { erroCadastro, validarNome, validarSituacao } from './cadastroValidacao.js';

export async function listarTurmas({ somenteAtivas = false } = {}) {
    if (usandoMongo()) return Turma.find(somenteAtivas ? { ativo: true } : {})
        .populate('curso', 'nome sigla ativo').sort({ ano: -1, nome: 1 }).lean();
    return turmas.filter((turma) => !somenteAtivas || turma.ativo)
        .map(preencherTurmaDemo).sort((a, b) => b.ano - a.ano || a.nome.localeCompare(b.nome, 'pt-BR'));
}

export async function buscarTurma(id) {
    if (usandoMongo()) return idValido(id) ? Turma.findById(id).lean() : null;
    return turmas.find((turma) => turma.id === String(id)) || null;
}

async function validarTurma(dados, id = '', cursoAnterior = '') {
    const nome = validarNome(dados.nome, 50);
    const ano = Number(dados.ano);
    if (!Number.isInteger(ano) || ano < 2000 || ano > new Date().getFullYear() + 5) {
        throw erroCadastro('Informe um ano entre 2000 e os próximos cinco anos.');
    }
    const cursoId = String(dados.curso || '');
    const curso = await buscarCurso(cursoId);
    // Na edição, uma turma pode manter seu curso inativo, mas não mudar para outro inativo.
    if (!curso || (!curso.ativo && cursoId !== cursoAnterior)) throw erroCadastro('Selecione um curso ativo cadastrado.');
    const ativo = validarSituacao(dados.ativo ?? true);
    const repetida = (await listarTurmas()).some((turma) => String(turma.id || turma._id) !== String(id)
        && turma.nome.toLocaleLowerCase('pt-BR') === nome.toLocaleLowerCase('pt-BR')
        && turma.ano === ano && String(turma.curso?._id || turma.curso?.id || turma.cursoId) === cursoId);
    if (repetida) throw erroCadastro('Já existe uma turma com esse nome, ano e curso.', 409);
    return { nome, ano, curso: cursoId, ativo };
}

export async function cadastrarTurma(dados) {
    const valores = await validarTurma(dados);
    if (usandoMongo()) return Turma.create(valores);
    const { curso, ...campos } = valores;
    const turma = { id: novoId(), ...campos, cursoId: curso };
    turmas.push(turma);
    return preencherTurmaDemo(turma);
}

export async function atualizarTurma(id, dados) {
    const atual = await buscarTurma(id);
    if (!atual) return null;
    const cursoAnterior = String(atual.curso || atual.cursoId);
    const valores = await validarTurma({ ...atual, curso: cursoAnterior, ...dados }, id, cursoAnterior);
    if (usandoMongo()) return Turma.findByIdAndUpdate(id, valores, { new: true, runValidators: true });
    const { curso, ...campos } = valores;
    Object.assign(atual, campos, { cursoId: curso });
    return preencherTurmaDemo(atual);
}

export async function excluirTurma(id) {
    const turma = await buscarTurma(id);
    if (!turma) return null;
    const nomes = [turma.nome, `${turma.nome} — ${turma.ano}`];
    const vinculado = usandoMongo()
        ? await Tcc.exists({ $or: [{ turmaCadastro: id }, { turma: { $in: nomes } }] })
        : tccs.some((tcc) => tcc.turmaCadastroId === String(id) || nomes.includes(tcc.turma));
    if (vinculado) throw erroCadastro('Esta turma possui TCCs vinculados. Desative-a para impedir novos envios sem perder o histórico.', 409);
    if (usandoMongo()) return Turma.findByIdAndDelete(id);
    return turmas.splice(turmas.indexOf(turma), 1)[0];
}
