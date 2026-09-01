import test from 'node:test';
import assert from 'node:assert/strict';
import {
    podeModerar,
    podePublicarTcc,
    usuarioEhAdmin,
    usuarioEhDono,
    usuarioEhProfessor,
} from '../services/permissoes.js';

test('somente aluno pode publicar TCC', () => {
    assert.equal(podePublicarTcc({ perfil: 'aluno' }), true);
    assert.equal(podePublicarTcc({ perfil: 'professor' }), false);
});

test('separa permissões de professor e administrador', () => {
    assert.equal(usuarioEhProfessor({ perfil: 'professor' }), true);
    assert.equal(usuarioEhAdmin({ perfil: 'admin' }), true);
    assert.equal(podeModerar({ perfil: 'professor' }), true);
    assert.equal(podeModerar({ perfil: 'admin' }), true);
    assert.equal(podeModerar({ perfil: 'aluno' }), false);
});

test('somente o autor é reconhecido como dono da publicação', () => {
    const publicacao = { autor: { id: 'usuario-1' } };
    assert.equal(usuarioEhDono({ id: 'usuario-1' }, publicacao), true);
    assert.equal(usuarioEhDono({ id: 'usuario-2' }, publicacao), false);
});
