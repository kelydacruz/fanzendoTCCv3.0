import test from 'node:test';
import assert from 'node:assert/strict';
import {
    possuiConteudoInadequado,
    validarConteudo,
} from '../services/filtroConteudo.js';

test('identifica um termo proibido como palavra completa', () => {
    assert.equal(possuiConteudoInadequado('Isto é spam'), true);
    assert.equal(possuiConteudoInadequado('Um texto acadêmico adequado'), false);
});

test('lança erro quando encontra conteúdo bloqueado', () => {
    assert.throws(
        () => validarConteudo('Mensagem com ofensa'),
        /termo não permitido/,
    );
});
