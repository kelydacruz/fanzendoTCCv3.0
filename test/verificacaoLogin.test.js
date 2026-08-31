import test from 'node:test';
import assert from 'node:assert/strict';
import {
    formatoCodigoValido,
    gerarCodigo,
    mascararEmail,
} from '../services/verificacaoLogin.js';

test('gera códigos com exatamente seis números', () => {
    for (let i = 0; i < 30; i += 1) {
        assert.match(gerarCodigo(), /^\d{6}$/);
    }
});

test('aceita somente o formato esperado para o código', () => {
    assert.equal(formatoCodigoValido('012345'), true);
    assert.equal(formatoCodigoValido('12345'), false);
    assert.equal(formatoCodigoValido('1234567'), false);
    assert.equal(formatoCodigoValido('12a456'), false);
});

test('esconde parte do e-mail na tela de confirmação', () => {
    assert.equal(mascararEmail('aluna@exemplo.com'), 'al***@exemplo.com');
    assert.equal(mascararEmail('a@exemplo.com'), 'a**@exemplo.com');
});
