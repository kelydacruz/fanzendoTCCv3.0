import test from 'node:test';
import assert from 'node:assert/strict';
import {
    normalizarTexto,
    escaparRegex,
    separarLista,
    classeStatus,
} from '../services/texto.js';

test('normaliza acentos, caixa e espaços', () => {
    assert.equal(normalizarTexto('  Educação TÉCNICA  '), 'educacao tecnica');
});

test('escapa caracteres especiais usados em expressão regular', () => {
    assert.equal(escaparRegex('TCC (web)?'), 'TCC \\(web\\)\\?');
});

test('transforma uma lista separada por vírgulas e remove itens vazios', () => {
    assert.deepEqual(separarLista('Ana, Bruno, , Carla'), ['Ana', 'Bruno', 'Carla']);
});

test('gera uma classe CSS segura para o status', () => {
    assert.equal(classeStatus('Em desenvolvimento'), 'em-desenvolvimento');
    assert.equal(classeStatus('Concluída'), 'concluida');
});
