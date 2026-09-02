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

async function entrarAdmin() {
    const resposta = await enviarFormulario('/entrar', {
        email: 'admin@exemplo.com',
        senha: '123456',
    });
    assert.equal(resposta.status, 302);
    assert.match(resposta.headers.get('location'), /^\/admin/);
    return resposta.headers.get('set-cookie').split(';')[0];
}

test('mantém o acervo de TCCs como única área de consulta pública', async () => {
    const inicio = await requisicao('/');
    assert.equal(inicio.status, 302);
    assert.equal(inicio.headers.get('location'), '/tcc/lst');

    const paginas = [
        ['/tcc/lst', 'TCCs publicados'],
        ['/tcc/detalhes/horta-inteligente', 'Horta inteligente'],
    ];

    for (const [caminho, trecho] of paginas) {
        const resposta = await requisicao(caminho);
        assert.equal(resposta.status, 200, caminho);
        assert.match(await resposta.text(), new RegExp(trecho, 'i'), caminho);
    }

    for (const caminho of ['/ideia/lst', '/ideia/detalhes/ideia-enchentes', '/aprender', '/sobre']) {
        const resposta = await requisicao(caminho);
        assert.equal(resposta.status, 302, caminho);
        assert.match(resposta.headers.get('location'), /^\/entrar/);
    }

    const css = await requisicao('/public/css/style.css');
    assert.equal(css.status, 200);
    assert.match(css.headers.get('content-type'), /text\/css/);

    const paginaInexistente = await requisicao('/pagina-inexistente');
    assert.equal(paginaInexistente.status, 404);
});

test('envia cabeçalhos de segurança e usa cookie próprio para a sessão', async () => {
    const pagina = await requisicao('/tcc/lst');
    assert.equal(pagina.headers.get('x-powered-by'), null);
    assert.equal(pagina.headers.get('x-content-type-options'), 'nosniff');
    assert.match(pagina.headers.get('content-security-policy') || '', /default-src/);

    const login = await enviarFormulario('/entrar', {
        email: 'aluna@exemplo.com',
        senha: '123456',
    });
    const cookie = login.headers.get('set-cookie') || '';
    assert.match(cookie, /^acervotcc\.sid=/);
    assert.match(cookie, /HttpOnly/i);
    assert.match(cookie, /SameSite=Lax/i);
});

test('recusa arquivo falso mesmo quando o tipo informado é PDF', async () => {
    const cookieAluno = await entrar('aluna@exemplo.com', '123456');
    const formulario = new FormData();
    formulario.append('titulo', 'Documento acadêmico de demonstração');
    formulario.append('tema', 'Segurança de arquivos');
    formulario.append('resumo', 'Trabalho de demonstração com conteúdo suficiente para validar o formulário e testar o envio seguro de documentos.');
    formulario.append('curso', 'Técnico em Informática');
    formulario.append('area', 'Desenvolvimento web');
    formulario.append('turma', '3º ano');
    formulario.append('orientador', 'Prof. Carlos Souza');
    formulario.append('ano', String(new Date().getFullYear()));
    formulario.append('pdf', new Blob(['arquivo que não é PDF'], { type: 'application/pdf' }), 'falso.pdf');

    const resposta = await requisicao('/tcc/add', {
        method: 'POST',
        headers: { cookie: cookieAluno },
        body: formulario,
    });

    assert.equal(resposta.status, 400);
    assert.match(await resposta.text(), /Envie apenas arquivos PDF/);
});

test('filtra e ordena o catálogo de TCCs', async () => {
    const filtrada = await requisicao('/tcc/lst?curso=T%C3%A9cnico%20em%20Meio%20Ambiente');
    assert.equal(filtrada.status, 200);
    const htmlFiltrado = await filtrada.text();
    assert.match(htmlFiltrado, /Descarte Certo/);
    assert.doesNotMatch(htmlFiltrado, /Horta inteligente/);

    const ordenada = await requisicao('/tcc/lst?ordem=visualizados');
    assert.equal(ordenada.status, 200);
    assert.match(await ordenada.text(), /Mais visualizados/);

    const cookieAluno = await entrar('aluna@exemplo.com', '123456');
    const ideiasIniciantes = await requisicao('/ideia/lst?dificuldade=Iniciante', { headers: { cookie: cookieAluno } });
    assert.equal(ideiasIniciantes.status, 200);
    assert.match(await ideiasIniciantes.text(), /Educa%C3%A7%C3%A3o financeira|Educação financeira/i);
});

test('protege páginas privadas e respeita o perfil do usuário', async () => {
    const semLogin = await requisicao('/painel');
    assert.equal(semLogin.status, 302);
    assert.match(semLogin.headers.get('location'), /^\/entrar/);

    const codigoSemLogin = await requisicao('/confirmar-codigo');
    assert.equal(codigoSemLogin.status, 302);
    assert.equal(codigoSemLogin.headers.get('location'), '/entrar');

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
        dificuldade: 'Intermediária',
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
        dificuldade: 'Avançada',
    }, cookieAluno);
    assert.equal(edicao.status, 302);

    const exclusao = await enviarFormulario(`/ideia/del/${id}`, {}, cookieAluno);
    assert.equal(exclusao.status, 302);

    const removida = await requisicao(`/ideia/detalhes/${id}`, { headers: { cookie: cookieAluno } });
    assert.equal(removida.status, 404);
});

test('publica um TCC e bloqueia conteúdo configurado como inadequado', async () => {
    const cookieAluno = await entrar('aluna@exemplo.com', '123456');

    const criacaoTcc = await enviarFormulario('/tcc/add', {
        titulo: 'Plataforma de organização de estudos',
        tema: 'Educação e tecnologia',
        resumo: 'Aplicação web para organizar tarefas acadêmicas, registrar avanços e apoiar a rotina de estudantes do ensino técnico.',
        curso: 'Técnico em Informática',
        area: 'Desenvolvimento web',
        turma: '3º ano',
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
        dificuldade: 'Iniciante',
    }, cookieAluno);

    assert.equal(conteudoBloqueado.status, 400);
    assert.match(await conteudoBloqueado.text(), /termo não permitido/);
});

test('protege e renderiza os módulos da área administrativa', async () => {
    const semLogin = await requisicao('/admin');
    assert.equal(semLogin.status, 302);
    assert.match(semLogin.headers.get('location'), /^\/entrar/);

    const cookieProfessor = await entrar('professora@exemplo.com', '123456');
    const adminNegado = await requisicao('/admin', { headers: { cookie: cookieProfessor } });
    assert.equal(adminNegado.status, 302);
    assert.match(adminNegado.headers.get('location'), /^\/painel/);

    const cookieAdmin = await entrarAdmin();
    for (const caminho of ['/admin', '/admin/usuarios', '/admin/cursos', '/admin/turmas', '/admin/tccs', '/admin/ideias']) {
        const resposta = await requisicao(caminho, { headers: { cookie: cookieAdmin } });
        assert.equal(resposta.status, 200, caminho);
    }
});

test('exibe e atualiza o perfil do usuário autenticado', async () => {
    const cookieAluno = await entrar('aluna@exemplo.com', '123456');
    const perfil = await requisicao('/perfil', { headers: { cookie: cookieAluno } });
    assert.equal(perfil.status, 200);
    assert.match(await perfil.text(), /Meu perfil/);

    const atualizacao = await enviarFormulario('/perfil', {
        nome: 'Aluna Exemplo Atualizada',
        curso: 'Técnico em Informática',
    }, cookieAluno);
    assert.equal(atualizacao.status, 302);
    assert.match(atualizacao.headers.get('location'), /^\/perfil/);
});

test('professor pede correções e aprova a publicação no acervo', async () => {
    const cookieProfessor = await entrar('professora@exemplo.com', '123456');
    const orientacoes = await requisicao('/orientacoes', { headers: { cookie: cookieProfessor } });
    assert.equal(orientacoes.status, 200);
    assert.match(await orientacoes.text(), /Horta inteligente/i);

    const correcao = await enviarFormulario('/orientacoes/horta-inteligente/avaliar', {
        acao: 'corrigir',
        feedbackOrientador: 'Revise a justificativa e detalhe melhor os resultados obtidos.',
    }, cookieProfessor);
    assert.equal(correcao.status, 302);

    const privado = await requisicao('/tcc/detalhes/horta-inteligente');
    assert.equal(privado.status, 404);

    const aprovacao = await enviarFormulario('/orientacoes/horta-inteligente/avaliar', {
        acao: 'aprovar',
        feedbackOrientador: 'Trabalho aprovado para publicação.',
    }, cookieProfessor);
    assert.equal(aprovacao.status, 302);

    const publicado = await requisicao('/tcc/detalhes/horta-inteligente');
    assert.equal(publicado.status, 200);
});
