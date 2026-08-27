import test, { after, before } from 'node:test';
import assert from 'node:assert/strict';
import app from '../app.js';

let servidor;
let origem;

before(async () => {
    await new Promise((resolve) => {
        servidor = app.listen(0, '127.0.0.1', () => {
            const endereco = servidor.address();
            origem = `http://127.0.0.1:${endereco.port}`;
            resolve();
        });
    });
});

after(async () => {
    await new Promise((resolve, reject) => {
        servidor.close((erro) => (erro ? reject(erro) : resolve()));
    });
});

async function requisicao(caminho, opcoes = {}) {
    return fetch(`${origem}${caminho}`, {
        redirect: 'manual',
        ...opcoes,
    });
}

async function enviarFormulario(caminho, dados, cookie = '') {
    return requisicao(caminho, {
        method: 'POST',
        headers: {
            'content-type': 'application/x-www-form-urlencoded',
            ...(cookie ? { cookie } : {}),
        },
        body: new URLSearchParams(dados),
    });
}

async function entrar(email, senha) {
    const resposta = await enviarFormulario('/entrar', { email, senha });
    assert.equal(resposta.status, 302);
    assert.match(resposta.headers.get('location'), /^\/painel/);
    return resposta.headers.get('set-cookie').split(';')[0];
}

test('renderiza páginas públicas e arquivos estáticos', async () => {
    const paginas = [
        ['/', 'Encontre inspiração'],
        ['/tcc/lst', 'TCCs publicados'],
        ['/tcc/detalhes/horta-inteligente', 'Horta inteligente'],
        ['/ideia/lst', 'Banco de ideias'],
        ['/ideia/detalhes/ideia-enchentes', 'Aplicativo de alerta'],
        ['/sobre', 'Por que criar o AcervoTCC?'],
    ];

    for (const [caminho, trecho] of paginas) {
        const resposta = await requisicao(caminho);
        assert.equal(resposta.status, 200, caminho);
        assert.match(await resposta.text(), new RegExp(trecho, 'i'), caminho);
    }

    const css = await requisicao('/public/css/style.css');
    assert.equal(css.status, 200);
    assert.match(css.headers.get('content-type'), /text\/css/);

    const paginaInexistente = await requisicao('/pagina-inexistente');
    assert.equal(paginaInexistente.status, 404);
});

test('protege páginas privadas e respeita o perfil do usuário', async () => {
    const semLogin = await requisicao('/painel');
    assert.equal(semLogin.status, 302);
    assert.match(semLogin.headers.get('location'), /^\/entrar/);

    const cookieProfessor = await entrar('professora@exemplo.com', '123456');
    const publicarTcc = await requisicao('/tcc/add', { headers: { cookie: cookieProfessor } });
    assert.equal(publicarTcc.status, 302);
    assert.match(publicarTcc.headers.get('location'), /^\/tcc\/lst/);

    const painel = await requisicao('/painel', { headers: { cookie: cookieProfessor } });
    assert.equal(painel.status, 200);
    assert.match(await painel.text(), /Professora/);
});

test('executa o fluxo de criação, comentário, edição e exclusão de ideia', async () => {
    const cookieAluno = await entrar('aluna@exemplo.com', '123456');

    const criacao = await enviarFormulario('/ideia/add', {
        titulo: 'Mapa colaborativo de acessibilidade',
        tema: 'Acessibilidade urbana',
        descricao: 'Plataforma para registrar barreiras e recursos acessíveis nos espaços da comunidade escolar.',
        curso: 'Técnico em Informática',
        status: 'Disponível',
    }, cookieAluno);

    assert.equal(criacao.status, 302);
    const localCriado = criacao.headers.get('location');
    const id = localCriado.match(/^\/ideia\/detalhes\/([^?]+)/)?.[1];
    assert.ok(id);

    const detalhes = await requisicao(`/ideia/detalhes/${id}`, { headers: { cookie: cookieAluno } });
    assert.equal(detalhes.status, 200);
    assert.match(await detalhes.text(), /Mapa colaborativo/);

    const comentario = await enviarFormulario(`/ideia/comentario/${id}`, {
        texto: 'A proposta pode começar com um levantamento dentro da própria escola.',
    }, cookieAluno);
    assert.equal(comentario.status, 302);

    const edicao = await enviarFormulario(`/ideia/edt/${id}`, {
        titulo: 'Mapa escolar de acessibilidade',
        tema: 'Acessibilidade urbana',
        descricao: 'Plataforma para registrar barreiras e recursos acessíveis nos espaços da comunidade escolar.',
        curso: 'Técnico em Informática',
        status: 'Em desenvolvimento',
    }, cookieAluno);
    assert.equal(edicao.status, 302);

    const exclusao = await enviarFormulario(`/ideia/del/${id}`, {}, cookieAluno);
    assert.equal(exclusao.status, 302);

    const removida = await requisicao(`/ideia/detalhes/${id}`);
    assert.equal(removida.status, 404);
});

test('publica um TCC e bloqueia conteúdo configurado como inadequado', async () => {
    const cookieAluno = await entrar('aluna@exemplo.com', '123456');

    const criacaoTcc = await enviarFormulario('/tcc/add', {
        titulo: 'Plataforma de organização de estudos',
        tema: 'Educação e tecnologia',
        resumo: 'Aplicação web para organizar tarefas acadêmicas, registrar avanços e apoiar a rotina de estudantes do ensino técnico.',
        curso: 'Técnico em Informática',
        orientador: 'Prof. Carlos Souza',
        ano: String(new Date().getFullYear()),
        coautores: '',
        palavrasChave: 'educação, organização, web',
    }, cookieAluno);

    assert.equal(criacaoTcc.status, 302);
    assert.match(criacaoTcc.headers.get('location'), /^\/tcc\/detalhes\//);

    const conteudoBloqueado = await enviarFormulario('/ideia/add', {
        titulo: 'Mensagem com spam',
        tema: 'Teste de filtro',
        descricao: 'Esta descrição possui tamanho suficiente para validar corretamente o formulário.',
        curso: 'Técnico em Informática',
        status: 'Disponível',
    }, cookieAluno);

    assert.equal(conteudoBloqueado.status, 400);
    assert.match(await conteudoBloqueado.text(), /termo não permitido/);
});
