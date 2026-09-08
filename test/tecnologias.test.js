import test from 'node:test';
import assert from 'node:assert/strict';
import { normalizarTecnologias, resumirTecnologias } from '../services/tecnologias.js';

test('padroniza nomes, separadores e remove repetições por TCC', () => {
    assert.deepEqual(normalizarTecnologias(' js, JavaScript; NODEJS\nnode.js, CSS3, css, Ferramenta X, ferramenta x'),
        ['JavaScript', 'Node.js', 'CSS', 'Ferramenta X']);
    assert.deepEqual(normalizarTecnologias('constructor, __proto__'), ['constructor', '__proto__']);
});

test('conta cada tecnologia uma vez por trabalho e informa cobertura dos dados', () => {
    const resumo = resumirTecnologias([
        { tecnologias: ['JS', 'JavaScript', 'Node.js'] },
        { tecnologias: ['javascript', 'CSS'] },
        {},
    ]);
    assert.equal(resumo.totalTccs, 3);
    assert.equal(resumo.informados, 2);
    assert.deepEqual(resumo.itens, [
        { nome: 'JavaScript', total: 2 }, { nome: 'CSS', total: 1 }, { nome: 'Node.js', total: 1 },
    ]);
});

test('mantém todos os valores na tabela e limita as barras a oito', () => {
    const resumo = resumirTecnologias([{ tecnologias: Array.from({ length: 12 }, (_, i) => `Ferramenta ${i}`) }]);
    assert.equal(resumo.destaques.length, 8);
    assert.equal(resumo.itens.length, 12);
    assert.deepEqual(resumirTecnologias([]), { itens: [], destaques: [], totalTccs: 0, informados: 0, maximo: 1 });
});
