import test from 'node:test';
import assert from 'node:assert/strict';
import { podePublicarTcc, usuarioEhDono } from '../services/permissoes.js';

test('somente aluno pode publicar TCC', () => {
    assert.equal(podePublicarTcc({ perfil: 'aluno' }), true);
    assert.equal(podePublicarTcc({ perfil: 'professor' }), false);
});

test('somente o autor é reconhecido como dono da publicação', () => {
    const publicacao = { autor: { id: 'usuario-1' } };
    assert.equal(usuarioEhDono({ id: 'usuario-1' }, publicacao), true);
    assert.equal(usuarioEhDono({ id: 'usuario-2' }, publicacao), false);
});
