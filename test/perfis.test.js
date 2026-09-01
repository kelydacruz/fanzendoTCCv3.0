import test from 'node:test';
import assert from 'node:assert/strict';
import { perfilPeloEmail } from '../services/perfis.js';

test('define aluno e professor pelo domínio institucional exato', () => {
    assert.equal(perfilPeloEmail('kely@academico.ifsul.edu.br'), 'aluno');
    assert.equal(perfilPeloEmail('docente@ifsul.edu.br'), 'professor');
    assert.equal(perfilPeloEmail('docente@ifsul.edu.br.site-falso.com'), null);
    assert.equal(perfilPeloEmail('pessoa@gmail.com'), null);
});

test('reconhece somente o e-mail administrativo configurado', () => {
    const anterior = process.env.ADMIN_EMAIL;
    process.env.ADMIN_EMAIL = 'administracao.acervo@gmail.com';
    assert.equal(perfilPeloEmail('administracao.acervo@gmail.com'), 'admin');
    assert.equal(perfilPeloEmail('outra-conta@gmail.com'), null);
    if (anterior === undefined) delete process.env.ADMIN_EMAIL;
    else process.env.ADMIN_EMAIL = anterior;
});
