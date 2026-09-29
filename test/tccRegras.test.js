import test from 'node:test';
import assert from 'node:assert/strict';
import { cursos, turmas, usuarios } from '../data/mock.js';
import { contextoDoFormulario, dadosDoFormulario, opcoesFormulario, validarDados } from '../models/tccRegras.js';

const formulario = {
    titulo: 'Acervo de trabalhos acadêmicos',
    tema: 'Organização de trabalhos',
    resumo: 'Sistema para organizar trabalhos acadêmicos e facilitar a consulta de referências.',
    cursoCadastro: 'curso-informatica',
    turmaCadastro: 'turma-info-2025',
    orientadorUsuario: 'usuario-professora',
    area: 'Desenvolvimento de Sistemas',
    visibilidade: 'interno',
};

async function errosDoFormulario(body, tccAtual = null) {
    const contexto = await contextoDoFormulario(body, 'aluno-teste', tccAtual);
    return validarDados(dadosDoFormulario(body, null, contexto), contexto);
}

test('recusa orientador não confirmado mesmo quando seu ID é enviado diretamente', async () => {
    const professor = usuarios.find((usuario) => usuario.id === formulario.orientadorUsuario);
    const confirmado = professor.emailVerificado;
    try {
        professor.emailVerificado = false;
        assert.ok((await errosDoFormulario(formulario)).orientadorUsuario);
        professor.emailVerificado = true;
        assert.deepEqual(await errosDoFormulario(formulario), {});
    } finally {
        professor.emailVerificado = confirmado;
    }
});

test('permite somente áreas cadastradas ou a área histórica do próprio TCC', async () => {
    const body = { ...formulario, area: 'Área antiga do trabalho' };
    assert.ok((await errosDoFormulario(body)).area);
    assert.deepEqual(await errosDoFormulario(body, { area: body.area }), {});
    assert.ok((await errosDoFormulario({ ...body, area: 'Área inventada' }, { area: body.area })).area);
});

test('mantém curso e turma inativos existentes, mas recusa novos vínculos inativos', async () => {
    const curso = cursos.find((item) => item.id === formulario.cursoCadastro);
    const turma = turmas.find((item) => item.id === formulario.turmaCadastro);
    const cursoAtivo = curso.ativo;
    const turmaAtiva = turma.ativo;
    const tccAtual = { cursoCadastroId: curso.id, turmaCadastroId: turma.id };
    try {
        curso.ativo = false;
        turma.ativo = false;
        assert.deepEqual(await errosDoFormulario(formulario, tccAtual), {});
        const errosNovo = await errosDoFormulario(formulario);
        assert.ok(errosNovo.cursoCadastro);
        assert.ok(errosNovo.turmaCadastro);
        const opcoes = await opcoesFormulario('aluno-teste', tccAtual);
        assert.ok(opcoes.cursos.some((item) => item.id === curso.id));
        assert.ok(opcoes.turmas.some((item) => item.id === turma.id));
        assert.ok((await errosDoFormulario({ ...formulario, turmaCadastro: 'turma-info-2024' }, tccAtual)).turmaCadastro);
        assert.deepEqual(await errosDoFormulario(formulario, {
            cursoCadastro: { _id: curso.id }, turmaCadastro: { _id: turma.id },
        }), {});
    } finally {
        curso.ativo = cursoAtivo;
        turma.ativo = turmaAtiva;
    }
});
