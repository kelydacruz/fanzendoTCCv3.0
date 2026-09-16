import test from 'node:test';
import assert from 'node:assert/strict';
import { usandoMongo } from '../services/banco.js';
import conectarBanco from '../config/conexao.js';

test('demonstração só funciona sem banco configurado e fora de produção', async () => {
    const uri = process.env.MONGODB_URI;
    const ambiente = process.env.NODE_ENV;
    try {
        delete process.env.MONGODB_URI;
        process.env.NODE_ENV = 'development';
        assert.equal(usandoMongo(), false);
        process.env.MONGODB_URI = 'mongodb://banco-indisponivel/teste';
        assert.throws(usandoMongo, (erro) => erro.status === 503);
        delete process.env.MONGODB_URI;
        process.env.NODE_ENV = 'production';
        assert.throws(usandoMongo, (erro) => erro.status === 503);
        await assert.rejects(conectarBanco(), (erro) => erro.status === 503);
    } finally {
        if (uri === undefined) delete process.env.MONGODB_URI; else process.env.MONGODB_URI = uri;
        if (ambiente === undefined) delete process.env.NODE_ENV; else process.env.NODE_ENV = ambiente;
    }
});
