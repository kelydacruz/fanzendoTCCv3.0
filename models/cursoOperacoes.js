import Curso from './curso.js';
import Turma from './turma.js';
import Tcc from './tcc.js';
import Usuario from './usuario.js';
import {
    cursos,
    turmas,
    tccs,
    usuarios,
    novoId,
} from '../data/mock.js';
import { usandoMongo, idValido } from '../config/banco.js';
import { erroCadastro, validarNome, validarSituacao, conferirNomeRepetido } from './cadastroValidacao.js';

export async function listarCursos({ somenteAtivos = false } = {}) {
    if (usandoMongo()) return Curso.find(somenteAtivos ? { ativo: true } : {}).sort({ nome: 1 }).lean();
    return cursos.filter((curso) => !somenteAtivos || curso.ativo)
        .sort((a, b) => a.nome.localeCompare(b.nome, 'pt-BR'));
}

export async function buscarCurso(id) {
    if (usandoMongo()) return idValido(id) ? Curso.findById(id).lean() : null;
    return cursos.find((curso) => curso.id === String(id)) || null;
}

async function validarCurso(dados, id = '') {
    const nome = validarNome(dados.nome);
    const sigla = validarNome(dados.sigla, 20).toUpperCase();
    const area = validarNome(dados.area);
    const ativo = validarSituacao(dados.ativo ?? true);
    conferirNomeRepetido(await listarCursos(), nome, id);
    return { nome, sigla, area, ativo };
}

export async function cadastrarCurso(dados) {
    const valores = await validarCurso(dados);
    if (usandoMongo()) return Curso.create(valores);
    const curso = { id: novoId(), ...valores };
    cursos.push(curso);
    return curso;
}

export async function atualizarCurso(id, dados) {
    const atual = await buscarCurso(id);
    if (!atual) return null;
    const valores = await validarCurso({ ...atual, ...dados }, id);
    if (usandoMongo()) return Curso.findByIdAndUpdate(id, valores, { new: true, runValidators: true });
    Object.assign(atual, valores);
    return atual;
}

// Não apagamos um curso usado: isso quebraria a referência das turmas e dos TCCs.
export async function excluirCurso(id) {
    const curso = await buscarCurso(id);
    if (!curso) return null;
    let vinculado;
    if (usandoMongo()) {
        const vinculos = await Promise.all([
            Turma.exists({ curso: id }),
            Tcc.exists({ $or: [{ cursoCadastro: id }, { curso: curso.nome }] }),
            Usuario.exists({ curso: curso.nome }),
        ]);
        vinculado = vinculos.some(Boolean);
    } else {
        vinculado = turmas.some((turma) => turma.cursoId === String(id))
            || tccs.some((tcc) => tcc.cursoCadastroId === String(id) || tcc.curso === curso.nome)
            || usuarios.some((usuario) => usuario.curso === curso.nome);
    }
    if (vinculado) throw erroCadastro('Este curso possui turmas, TCCs ou usuários vinculados. Desative-o para impedir novos cadastros sem perder o histórico.', 409);
    if (usandoMongo()) return Curso.findByIdAndDelete(id);
    return cursos.splice(cursos.indexOf(curso), 1)[0];
}
