import test from 'node:test';
import assert from 'node:assert/strict';
import {
    anoValido,
    comentarioValido,
    emailValido,
    perfilValido,
    textoComTamanho,
} from '../services/validacao.js';

test('valida tamanhos de texto após remover espaços externos', () => {
    assert.equal(textoComTamanho('  TCC  ', 3, 10), true);
    assert.equal(textoComTamanho('oi', 3, 10), false);
});

test('aceita somente e-mails com estrutura básica válida', () => {
    assert.equal(emailValido('aluna@escola.edu.br'), true);
    assert.equal(emailValido('email-incompleto'), false);
});

test('aceita os dois perfis previstos nos requisitos', () => {
    assert.equal(perfilValido('aluno'), true);
    assert.equal(perfilValido('professor'), true);
    assert.equal(perfilValido('visitante'), false);
});

test('valida o intervalo de anos e o tamanho de comentários', () => {
    assert.equal(anoValido(new Date().getFullYear()), true);
    assert.equal(anoValido(1979), false);
    assert.equal(comentarioValido('Sugestão objetiva.'), true);
    assert.equal(comentarioValido('   '), false);
});
