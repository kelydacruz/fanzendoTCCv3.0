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

const cookiesDeTeste = new Map();

async function entrar(email, senha) {
    const chave = `${email}:${senha}`;
    if (cookiesDeTeste.has(chave)) return cookiesDeTeste.get(chave);
    const resposta = await enviarFormulario('/entrar', { email, senha });
    assert.equal(resposta.status, 302);
    assert.match(resposta.headers.get('location'), /^\/painel/);
    const cookie = resposta.headers.get('set-cookie').split(';')[0];
    cookiesDeTeste.set(chave, cookie);
    return cookie;
}

async function entrarAdmin() {
    if (cookiesDeTeste.has('admin')) return cookiesDeTeste.get('admin');
    const resposta = await enviarFormulario('/entrar', {
        email: 'admin@exemplo.com',
        senha: '123456',
    });
    assert.equal(resposta.status, 302);
    assert.match(resposta.headers.get('location'), /^\/admin/);
    const cookie = resposta.headers.get('set-cookie').split(';')[0];
    cookiesDeTeste.set('admin', cookie);
    return cookie;
}

async function cadastrarAlunoParaTeste() {
    const resposta = await enviarFormulario('/cadastro', {
        nome: 'Aluno do Fluxo',
        email: 'fluxo@academico.ifsul.edu.br',
        curso: 'Técnico em Informática',
        areaAtuacao: '',
        senha: 'senha-segura-123',
    });
    assert.equal(resposta.status, 302);
    assert.match(resposta.headers.get('location'), /^\/painel/);
    return resposta.headers.get('set-cookie').split(';')[0];
}

test('oferece início público e mantém o acervo como consulta sem login', async () => {
    const inicio = await requisicao('/');
    assert.equal(inicio.status, 200);
    assert.match(await inicio.text(), /Encontre referências/i);

    const paginas = [
        ['/sobre', 'Conheça o AcervoTCC'],
        ['/tcc/lst', 'TCCs publicados'],
        ['/tcc/detalhes/horta-inteligente', 'Horta inteligente'],
    ];

    for (const [caminho, trecho] of paginas) {
        const resposta = await requisicao(caminho);
        assert.equal(resposta.status, 200, caminho);
        assert.match(await resposta.text(), new RegExp(trecho, 'i'), caminho);
    }

    for (const caminho of ['/ideia/lst', '/ideia/detalhes/ideia-enchentes', '/aprender']) {
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

    const notificacoesSemLogin = await requisicao('/notificacoes');
    assert.equal(notificacoesSemLogin.status, 302);
    assert.match(notificacoesSemLogin.headers.get('location'), /^\/entrar/);

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
        area: 'Outros',
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
        area: 'Outros',
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
    for (const caminho of ['/admin', '/admin/usuarios', '/admin/cursos', '/admin/areas', '/admin/turmas', '/admin/tccs', '/admin/ideias', '/admin/filtro']) {
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

test('renderiza notificações para o usuário autenticado', async () => {
    const cookieAluno = await entrar('aluna@exemplo.com', '123456');
    const resposta = await requisicao('/notificacoes', { headers: { cookie: cookieAluno } });
    assert.equal(resposta.status, 200);
    assert.match(await resposta.text(), /Notificações/);
});

test('professor pede correções e aprova a publicação no acervo', async () => {
    const cookieProfessor = await entrar('professora@exemplo.com', '123456');
    const orientacoes = await requisicao('/orientacoes?situacao=publicado', { headers: { cookie: cookieProfessor } });
    assert.equal(orientacoes.status, 200);
    assert.match(await orientacoes.text(), /Horta inteligente/i);

    const { tccs } = await import('../data/mock.js');
    tccs.find((item) => item.id === 'horta-inteligente').status = 'em_analise';

    const correcao = await enviarFormulario('/orientacoes/horta-inteligente/avaliar', {
        acao: 'corrigir',
        feedbackOrientador: 'Revise a justificativa e detalhe melhor os resultados obtidos.',
    }, cookieProfessor);
    assert.equal(correcao.status, 302);
    assert.ok(correcao.headers.get('location').startsWith('/orientacoes?'));
    const pendentes = await requisicao('/orientacoes', { headers: { cookie: cookieProfessor } });
    assert.doesNotMatch(await pendentes.text(), /Horta inteligente/);
    const aguardando = await requisicao('/orientacoes?situacao=correcao_solicitada', { headers: { cookie: cookieProfessor } });
    assert.match(await aguardando.text(), /Horta inteligente/);

    const privado = await requisicao('/tcc/detalhes/horta-inteligente');
    assert.equal(privado.status, 404);

    const aprovacao = await enviarFormulario('/orientacoes/horta-inteligente/avaliar', {
        acao: 'aprovar',
        feedbackOrientador: 'Trabalho aprovado para publicação.',
    }, cookieProfessor);
    assert.equal(aprovacao.status, 302);
    assert.ok(aprovacao.headers.get('location').startsWith('/orientacoes?'));
    const aprovados = await requisicao('/orientacoes?situacao=publicado', { headers: { cookie: cookieProfessor } });
    assert.match(await aprovados.text(), /Horta inteligente/);
    const corrigindo = await requisicao('/orientacoes?situacao=correcao_solicitada', { headers: { cookie: cookieProfessor } });
    assert.doesNotMatch(await corrigindo.text(), /Horta inteligente/);

    const detalhesProfessor = await requisicao('/tcc/detalhes/horta-inteligente', { headers: { cookie: cookieProfessor } });
    assert.doesNotMatch(await detalhesProfessor.text(), /Avaliar trabalho|Aprovar e publicar/);
    await enviarFormulario('/orientacoes/horta-inteligente/avaliar', { acao: 'corrigir', feedbackOrientador: 'Tentativa após aprovação.' }, cookieProfessor);
    assert.equal(tccs.find((item) => item.id === 'horta-inteligente').status, 'publicado');

    const publicado = await requisicao('/tcc/detalhes/horta-inteligente');
    assert.equal(publicado.status, 200);
});

test('mostra cursos e turmas do administrador e aponta cada campo inválido do TCC', async () => {
    const cookieAluno = await cadastrarAlunoParaTeste();
    const formulario = await requisicao('/tcc/add', { headers: { cookie: cookieAluno } });
    assert.equal(formulario.status, 200);
    const htmlFormulario = await formulario.text();
    assert.match(htmlFormulario, /Técnico em Informática/);
    assert.match(htmlFormulario, /3º ano — 2025/);

    const incompleto = await enviarFormulario('/tcc/add', {
        titulo: '',
        tema: '',
        resumo: '',
        cursoCadastro: '',
        area: '',
        turmaCadastro: '',
        orientadorUsuario: '',
        visibilidade: '',
        tecnologias: 'x'.repeat(41),
    }, cookieAluno);
    assert.equal(incompleto.status, 400);
    const htmlIncompleto = await incompleto.text();
    assert.match(htmlIncompleto, /Informe até 15 tecnologias/);
    assert.match(htmlIncompleto, /Informe um título entre 3 e 180 caracteres/);
    assert.match(htmlIncompleto, /Selecione um curso cadastrado pela administração/);
    assert.match(htmlIncompleto, /Selecione uma turma cadastrada pela administração/);
    assert.match(htmlIncompleto, /Selecione um professor orientador ativo e confirmado/);

    const criacao = await enviarFormulario('/tcc/add', {
        titulo: 'Portal acessível para serviços escolares',
        tema: 'Acessibilidade digital',
        resumo: 'Aplicação web criada para organizar serviços escolares e facilitar o acesso de estudantes a informações acadêmicas importantes.',
        cursoCadastro: 'curso-informatica',
        area: 'Desenvolvimento web',
        turmaCadastro: 'turma-info-2025',
        orientadorUsuario: 'usuario-professora',
        visibilidade: 'interno',
        coautores: '',
        palavrasChave: 'acessibilidade, escola, web',
        tecnologias: 'js, JavaScript, Node.js, MongoDB',
    }, cookieAluno);
    assert.equal(criacao.status, 302);
    const caminhoTcc = criacao.headers.get('location').split('?')[0];
    assert.match(caminhoTcc, /^\/tcc\/detalhes\//);

    const visitante = await requisicao(caminhoTcc);
    assert.equal(visitante.status, 404);

    const alunoAutenticado = await requisicao(caminhoTcc, { headers: { cookie: cookieAluno } });
    assert.equal(alunoAutenticado.status, 200);
    const detalhesSalvos = await alunoAutenticado.text();
    assert.match(detalhesSalvos, /Tecnologias utilizadas/);
    assert.match(detalhesSalvos, /MongoDB/);
});


test('gráfico respeita visibilidade, filtros e ausência de resultados', async () => {
    const publica = await requisicao('/tcc/lst');
    const htmlPublico = await publica.text();
    assert.match(htmlPublico, /Tecnologias mais usadas/);
    assert.match(htmlPublico, /JavaScript: 2 TCCs/);
    assert.doesNotMatch(htmlPublico, /Firebase/);

    const cookie = await entrar('professora@exemplo.com', '123456');
    const interna = await requisicao('/tcc/lst', { headers: { cookie } });
    assert.match(await interna.text(), /Firebase: 1 TCCs/);

    const filtrada = await requisicao('/tcc/lst?curso=T%C3%A9cnico%20em%20Meio%20Ambiente');
    const htmlFiltrado = await filtrada.text();
    assert.match(htmlFiltrado, /JavaScript: 1 TCCs/);
    assert.doesNotMatch(htmlFiltrado, /Arduino/);

    const vazia = await requisicao('/tcc/lst?q=naoexiste123456');
    assert.match(await vazia.text(), /O gráfico começa com o primeiro registro/);
});

test('denúncia protege conversa, evita duplicação e permite análise apenas ao admin', async () => {
    const { conversasIdeia, mensagensIdeia, notificacoes } = await import('../data/mock.js');
    const { listarDenuncias, denunciarMensagem } = await import('../services/denuncias.js');
    conversasIdeia.push({ id: 'conversa-denuncia', ideiaId: 'ideia-enchentes', alunoId: 'usuario-aluna', autorIdeiaId: 'usuario-colaborador', status: 'ativa' });
    mensagensIdeia.push({ id: 'mensagem-denuncia', conversaId: 'conversa-denuncia', autorId: 'usuario-colaborador', texto: 'Mensagem de teste para análise.', createdAt: new Date() });
    const aluno = await entrar('aluna@exemplo.com', '123456');
    const professor = await entrar('professora@exemplo.com', '123456');
    const url = '/mensagens/conversa-denuncia/denunciar/mensagem-denuncia';
    assert.equal((await enviarFormulario(url, { motivo: 'Contato inadequado para esta ideia.' })).status, 302);
    assert.equal((await enviarFormulario(url, { motivo: 'Contato inadequado para esta ideia.' }, professor)).status, 400);
    assert.equal(await denunciarMensagem('conversa-denuncia', 'mensagem-denuncia', 'usuario-colaborador', 'Minha própria mensagem'), null);
    assert.equal(await denunciarMensagem('conversa-denuncia', 'mensagem-inexistente', 'usuario-aluna', 'Mensagem não existe'), null);
    assert.equal((await enviarFormulario(url, { motivo: 'Contato inadequado para esta ideia.' }, aluno)).status, 302);
    assert.equal((await enviarFormulario(url, { motivo: 'Contato inadequado para esta ideia.' }, aluno)).status, 302);
    const itens = await listarDenuncias();
    assert.equal(itens.length, 1);
    const paginaConversa = await requisicao('/mensagens/conversa-denuncia', { headers: { cookie: aluno } });
    assert.equal(paginaConversa.status, 200);
    assert.match(await paginaConversa.text(), /Denunciar mensagem/);
    assert.equal((await requisicao('/admin/denuncias', { headers: { cookie: aluno } })).status, 302);
    const acao = `/admin/denuncias/${itens[0].id}/analisar`;
    assert.equal((await enviarFormulario(acao, { resposta: 'Resposta indevida' }, aluno)).status, 302);
    assert.equal(itens[0].status, 'pendente');
    const admin = await entrarAdmin();
    const paginaAdmin = await requisicao('/admin/denuncias', { headers: { cookie: admin } });
    assert.equal(paginaAdmin.status, 200);
    assert.match(await paginaAdmin.text(), /Mensagem de teste para análise/);
    assert.equal((await enviarFormulario(acao, { resposta: 'Conteúdo analisado pela administração.' }, admin)).status, 302);
    assert.equal(itens[0].status, 'analisada');
    assert.ok(notificacoes.some((item) => item.mensagem.includes('Sua denúncia foi analisada')));
});

test('bloqueio exige motivo, avisa a conta autenticada e permite reativação', async () => {
    const admin = await entrarAdmin();
    const cookie = await entrar('colaborador@exemplo.com', '12345678');
    const caminho = '/admin/usuarios/usuario-colaborador/status';
    const motivo = 'Uso inadequado das mensagens <teste>.';
    const semMotivo = await enviarFormulario(caminho, { ativo: 'false' }, admin);
    assert.equal(semMotivo.status, 400);
    assert.equal((await requisicao('/perfil', { headers: { cookie } })).status, 200);
    assert.equal((await enviarFormulario(caminho, { ativo: 'false', motivoBloqueio: motivo }, cookie)).status, 302);
    assert.equal((await enviarFormulario(caminho, { ativo: 'false', motivoBloqueio: motivo }, admin)).status, 302);
    const sessao = await requisicao('/perfil', { headers: { cookie } });
    assert.equal(sessao.status, 302);
    assert.equal(sessao.headers.get('location'), '/entrar');
    const anonimo = sessao.headers.get('set-cookie').split(';')[0];
    const aviso = await requisicao('/entrar', { headers: { cookie: anonimo } });
    const html = await aviso.text();
    assert.match(html, /Uso inadequado das mensagens &lt;teste&gt;/);
    assert.doesNotMatch(html, /mensagens <teste>/);
    assert.doesNotMatch(await (await requisicao('/entrar', { headers: { cookie: anonimo } })).text(), /Uso inadequado/);
    const incorreta = await enviarFormulario('/entrar', { email: 'colaborador@exemplo.com', senha: 'incorreta' });
    assert.equal(incorreta.status, 401);
    assert.doesNotMatch(await incorreta.text(), /Uso inadequado/);
    const bloqueado = await enviarFormulario('/entrar', { email: 'colaborador@exemplo.com', senha: '12345678' });
    assert.equal(bloqueado.status, 403);
    assert.match(await bloqueado.text(), /Uso inadequado/);
    assert.equal((await enviarFormulario(caminho, { ativo: 'true' }, admin)).status, 302);
    const { buscarUsuarioPorId } = await import('../services/repositorio.js');
    assert.equal((await buscarUsuarioPorId('usuario-colaborador')).motivoBloqueio, '');
    assert.equal((await enviarFormulario('/entrar', { email: 'colaborador@exemplo.com', senha: '12345678' })).status, 302);
});

test('admin pesquisa TCCs e mantém filtros após alterar situação', async () => {
    const cookie = await entrarAdmin();
    async function lista(query) {
        const resposta = await requisicao(`/admin/tccs?${query}`, { headers: { cookie } });
        assert.equal(resposta.status, 200);
        return resposta.text();
    }
    const horta = await lista('q=HORTA&situacao=publicado');
    assert.match(horta, /Horta inteligente/);
    assert.doesNotMatch(horta, /Descarte Certo/);
    const curso = await lista('q=meio%20ambiente');
    assert.match(curso, /Descarte Certo/);
    assert.doesNotMatch(curso, /Horta inteligente/);
    assert.match(await lista('q=naoexiste123456'), /Nenhum TCC encontrado/);
    assert.match(await lista('q=%5B.*'), /Nenhum TCC encontrado/);
    const alteracao = await enviarFormulario('/admin/tccs/horta-inteligente/status', {
        status: 'em_analise', feedbackOrientador: 'Reavaliar o trabalho.', q: 'HORTA', situacao: 'publicado',
    }, cookie);
    assert.equal(alteracao.status, 302);
    const retorno = new URL(alteracao.headers.get('location'), origem);
    assert.equal(retorno.searchParams.get('q'), 'HORTA');
    assert.equal(retorno.searchParams.get('situacao'), 'publicado');
    assert.match(await lista('q=HORTA&situacao=publicado'), /Nenhum TCC encontrado/);
    assert.match(await lista('q=HORTA&situacao=em_analise'), /Horta inteligente/);
    await enviarFormulario('/admin/tccs/horta-inteligente/status', { status: 'publicado' }, cookie);
});

test('exclusão de TCC exige admin e confirmação e remove comentários', async () => {
    const { tccs, comentarios, ideias, notificacoes } = await import('../data/mock.js');
    tccs.push({ id: 'tcc-excluir-teste', titulo: 'Trabalho para excluir', autorId: 'usuario-aluna', status: 'publicado', visibilidade: 'publico' });
    comentarios.push({ id: 'comentario-excluir', alvoTipo: 'tcc', alvoId: 'tcc-excluir-teste', texto: 'Teste' });
    ideias.push({ id: 'ideia-exclusao', titulo: 'Ideia preservada', status: 'Usada', tccRelacionadoId: 'tcc-excluir-teste' });
    const caminho = '/admin/tccs/tcc-excluir-teste/excluir';
    const admin = await entrarAdmin();
    const aluno = await entrar('aluna@exemplo.com', '123456');
    const professor = await entrar('professora@exemplo.com', '123456');
    for (const cookie of ['', aluno, professor]) {
        assert.equal((await requisicao(caminho, { headers: { cookie } })).status, 302);
        assert.equal((await enviarFormulario(caminho, {}, cookie)).status, 302);
    }
    assert.equal((await enviarFormulario(caminho, {}, admin)).status, 403);
    const confirmacao = await requisicao(caminho + '?q=Trabalho&situacao=publicado', { headers: { cookie: admin } });
    assert.equal(confirmacao.status, 200);
    const html = await confirmacao.text();
    assert.match(html, /Trabalho para excluir/);
    assert.ok(tccs.some((tcc) => tcc.id === 'tcc-excluir-teste'));
    const token = html.match(/name="token" value="([^"]+)"/)[1];
    assert.equal((await enviarFormulario('/admin/tccs/horta-inteligente/excluir', { token }, admin)).status, 403);
    const resposta = await enviarFormulario(caminho, { token, q: 'Trabalho', situacao: 'publicado' }, admin);
    assert.equal(resposta.status, 302);
    const retorno = new URL(resposta.headers.get('location'), origem);
    assert.equal(retorno.searchParams.get('q'), 'Trabalho');
    assert.equal(retorno.searchParams.get('mensagem'), 'TCC excluído com sucesso.');
    assert.ok(!tccs.some((tcc) => tcc.id === 'tcc-excluir-teste'));
    assert.ok(!comentarios.some((item) => item.id === 'comentario-excluir'));
    assert.equal(ideias.find((item) => item.id === 'ideia-exclusao').tccRelacionadoId, null);
    assert.ok(notificacoes.some((item) => item.mensagem.includes('excluiu o TCC “Trabalho para excluir”')));
    assert.equal((await requisicao('/tcc/detalhes/tcc-excluir-teste')).status, 404);
    assert.equal((await enviarFormulario(caminho, { token }, admin)).status, 403);
});

test('autor não demonstra interesse nem reserva sua ideia e aceita área Outros', async () => {
    const aluno = await entrar('aluna@exemplo.com', '123456');
    const dados = { titulo: 'Proposta de melhoria comunitária', tema: 'Comunidade', descricao: 'Uma proposta para organizar e melhorar serviços utilizados pela comunidade local.', area: 'Outros', dificuldade: 'Iniciante' };
    const criacao = await enviarFormulario('/ideia/add', dados, aluno);
    assert.equal(criacao.status, 302);
    const caminho = criacao.headers.get('location').split('?')[0];
    const id = caminho.split('/').pop();
    const html = await (await requisicao(caminho, { headers: { cookie: aluno } })).text();
    assert.doesNotMatch(html, /Tenho interesse|Usar no meu TCC/);
    for (const acao of ['interesse', 'desenvolver']) await enviarFormulario(`/ideia/${id}/${acao}`, {}, aluno);
    const { buscarIdeiaPorId } = await import('../services/repositorio.js');
    const ideia = await buscarIdeiaPorId(id);
    assert.equal(ideia.status, 'Disponível');
    assert.equal((ideia.interessados || []).length, 0);
    assert.match(await (await requisicao('/ideia/lst?area=Outros', { headers: { cookie: aluno } })).text(), /Proposta de melhoria comunitária/);
    const outroCurso = await enviarFormulario('/ideia/add', { ...dados, area: 'Área inexistente' }, aluno);
    assert.equal(outroCurso.status, 400);
});

test('colaborador recebe início próprio sem chamadas para produzir TCC', async () => {
    cookiesDeTeste.delete('colaborador@exemplo.com:12345678');
    const cookie = await entrar('colaborador@exemplo.com', '12345678');
    const resposta = await requisicao('/', { headers: { cookie } });
    assert.equal(resposta.status, 200);
    const html = await resposta.text();
    assert.match(html, /Compartilhe ideias/);
    assert.match(html, /Minhas ideias/);
    assert.doesNotMatch(html, /seu próximo projeto|Aprenda a fazer seu TCC|Publicar meu TCC/);
});

test('admin pesquisa e exclui denúncia com confirmação sem apagar mensagem', async () => {
    const { denunciarMensagem, listarDenuncias } = await import('../services/denuncias.js');
    const { conversasIdeia, mensagensIdeia } = await import('../data/mock.js');
    conversasIdeia.push({ id: 'conversa-remover-denuncia', ideiaId: 'ideia-enchentes', alunoId: 'usuario-aluna', autorIdeiaId: 'usuario-colaborador', status: 'ativa' });
    mensagensIdeia.push({ id: 'mensagem-remover-denuncia', conversaId: 'conversa-remover-denuncia', autorId: 'usuario-colaborador', texto: 'Conteúdo para pesquisa exclusiva', createdAt: new Date() });
    const item = await denunciarMensagem('conversa-remover-denuncia', 'mensagem-remover-denuncia', 'usuario-aluna', 'Motivo de pesquisa exclusiva');
    const admin = await entrarAdmin();
    const aluno = await entrar('aluna@exemplo.com', '123456');
    const caminho = `/admin/denuncias/${item.id}/excluir`;
    assert.equal((await enviarFormulario(caminho, {}, aluno)).status, 302);
    assert.equal((await enviarFormulario(caminho, {}, admin)).status, 403);
    const busca = await requisicao('/admin/denuncias?q=pesquisa%20exclusiva', { headers: { cookie: admin } });
    assert.match(await busca.text(), /Conteúdo para pesquisa exclusiva/);
    const vazia = await requisicao('/admin/denuncias?q=naoexiste987', { headers: { cookie: admin } });
    assert.match(await vazia.text(), /Nenhuma denúncia encontrada/);
    const confirmacao = await requisicao(caminho, { headers: { cookie: admin } });
    assert.equal(confirmacao.status, 200);
    const token = (await confirmacao.text()).match(/name="token" value="([^"]+)"/)[1];
    const remocao = await enviarFormulario(caminho, { token, q: 'pesquisa exclusiva' }, admin);
    assert.equal(remocao.status, 302);
    assert.equal(new URL(remocao.headers.get('location'), origem).searchParams.get('q'), 'pesquisa exclusiva');
    assert.ok(!(await listarDenuncias()).some((denuncia) => denuncia.id === item.id));
    assert.ok(mensagensIdeia.some((mensagem) => mensagem.id === 'mensagem-remover-denuncia'));
});

test('remove somente usuário bloqueado e preserva autoria e bloqueio de acesso', async () => {
    const { usuarios } = await import('../data/mock.js');
    const { removerUsuarioBloqueado, buscarUsuarioPorId, listarUsuarios, alterarStatusUsuario } = await import('../services/repositorio.js');
    const admin = await entrarAdmin();
    const aluno = await entrar('aluna@exemplo.com', '123456');
    assert.equal(await removerUsuarioBloqueado('usuario-aluna'), null);
    const original = usuarios.find((item) => item.id === 'usuario-aluna');
    usuarios.push({ ...original, id: 'usuario-remover', nome: 'Conta removível', email: 'remover@academico.ifsul.edu.br', ativo: false });
    const caminho = '/admin/usuarios/usuario-remover/remover';
    assert.equal((await enviarFormulario(caminho, {}, aluno)).status, 302);
    assert.equal((await enviarFormulario(caminho, {}, admin)).status, 403);
    const confirmacao = await requisicao(caminho, { headers: { cookie: admin } });
    assert.equal(confirmacao.status, 200);
    const token = (await confirmacao.text()).match(/name="token" value="([^"]+)"/)[1];
    assert.equal((await enviarFormulario(caminho, { token }, admin)).status, 302);
    const removido = await buscarUsuarioPorId('usuario-remover');
    assert.equal(removido.removido, true);
    assert.equal(removido.nome, 'Conta removível');
    assert.ok(!(await listarUsuarios()).some((item) => item.id === 'usuario-remover'));
    assert.equal(await alterarStatusUsuario('usuario-remover', true), null);
    const login = await enviarFormulario('/entrar', { email: 'remover@academico.ifsul.edu.br', senha: '123456' });
    assert.equal(login.status, 403);
    assert.match(await login.text(), /conta foi removida/);
});

test('denuncia comentários acessíveis e usuários com resposta e sem duplicação', async () => {
    const { comentarios, tccs, notificacoes } = await import('../data/mock.js');
    const { denunciarAlvo, listarDenuncias } = await import('../services/denuncias.js');
    const { buscarUsuarioPorId } = await import('../services/repositorio.js');
    const aluno = await entrar('aluna@exemplo.com', '123456');
    const usuario = await buscarUsuarioPorId('usuario-aluna');
    comentarios.push({ id: 'comentario-denunciavel', autorId: 'usuario-professora', alvoTipo: 'tcc', alvoId: 'horta-inteligente', texto: 'Comentário para análise', createdAt: new Date() });
    const contexto = { publicacaoTipo: 'tcc', publicacaoId: 'horta-inteligente' };
    const caminho = '/denunciar/comentario/comentario-denunciavel';
    assert.equal((await requisicao(caminho + '?' + new URLSearchParams(contexto))).status, 302);
    assert.equal((await enviarFormulario(caminho, contexto, aluno)).status, 403);
    const formulario = await requisicao(caminho + '?' + new URLSearchParams(contexto), { headers: { cookie: aluno } });
    assert.equal(formulario.status, 200);
    const token = (await formulario.text()).match(/name="token" value="([^"]+)"/)[1];
    assert.equal((await enviarFormulario(caminho, { ...contexto, token, motivo: 'Conteúdo inadequado para a discussão.' }, aluno)).status, 302);
    const item = await denunciarAlvo('comentario', 'comentario-denunciavel', usuario, 'Outro motivo de análise.', contexto);
    assert.equal((await listarDenuncias()).filter((d) => d.mensagem === 'comentario:comentario-denunciavel').length, 1);
    assert.equal(await denunciarAlvo('usuario', 'usuario-aluna', usuario, 'Denúncia de mim mesmo.'), null);
    const professor = await buscarUsuarioPorId('usuario-professora');
    assert.equal(await denunciarAlvo('comentario', 'comentario-denunciavel', professor, 'Meu comentário.', contexto), null);
    const tcc = tccs.find((t) => t.id === 'horta-inteligente');
    const anterior = tcc.visibilidade;
    tcc.visibilidade = 'interno';
    const externo = await buscarUsuarioPorId('usuario-colaborador');
    assert.equal(await denunciarAlvo('comentario', 'comentario-denunciavel', externo, 'Não posso acessar.', contexto), null);
    tcc.visibilidade = anterior;
    assert.equal(await denunciarAlvo('comentario', 'comentario-denunciavel', usuario, 'Contexto errado.', { publicacaoTipo: 'ideia', publicacaoId: 'ideia-enchentes' }), null);
    const perfil = await requisicao('/denunciar/usuario/usuario-professora', { headers: { cookie: aluno } });
    assert.equal(perfil.status, 200);
    const tokenPerfil = (await perfil.text()).match(/name="token" value="([^"]+)"/)[1];
    assert.equal((await enviarFormulario('/denunciar/usuario/usuario-professora', { token: tokenPerfil, motivo: 'Conduta que precisa ser analisada.' }, aluno)).status, 302);
    const admin = await entrarAdmin();
    assert.equal((await enviarFormulario(`/admin/denuncias/${item.id}/analisar`, { resposta: 'Análise do comentário concluída.' }, admin)).status, 302);
    assert.ok(notificacoes.some((n) => n.mensagem.includes('Análise do comentário concluída.') && n.link === '/tcc/detalhes/horta-inteligente'));
    const lista = await requisicao('/admin/denuncias?q=comentario', { headers: { cookie: admin } });
    assert.match(await lista.text(), /Comentário para análise/);
});

test('ideias usam áreas ativas da administração e preservam cadastro anterior', async () => {
    const { cadastrarAreaAtuacao } = await import('../services/repositorio.js');
    await cadastrarAreaAtuacao({ nome: 'Sustentabilidade comunitária' });
    const aluno = await entrar('aluna@exemplo.com', '123456');
    const formulario = await requisicao('/ideia/add', { headers: { cookie: aluno } });
    const html = await formulario.text();
    assert.match(html, /Área relacionada/);
    assert.match(html, /Sustentabilidade comunitária/);
    assert.doesNotMatch(html, /Curso relacionado/);
    const resposta = await enviarFormulario('/ideia/add', { titulo: 'Projeto de sustentabilidade', tema: 'Comunidade', descricao: 'Uma proposta para melhorar a sustentabilidade e a organização da comunidade.', area: 'Sustentabilidade comunitária', dificuldade: 'Iniciante' }, aluno);
    assert.equal(resposta.status, 302);
    const filtrada = await requisicao('/ideia/lst?area=' + encodeURIComponent('Sustentabilidade comunitária'), { headers: { cookie: aluno } });
    assert.match(await filtrada.text(), /Projeto de sustentabilidade/);
});

test('resumo administrativo ignora removidos e mantém contas apenas bloqueadas', async () => {
    const { usuarios } = await import('../data/mock.js');
    const { resumoAdministrativo, removerUsuarioBloqueado, listarUsuarios } = await import('../services/repositorio.js');
    const antes = await resumoAdministrativo();
    const ids = ['contagem-aluno', 'contagem-professor'];
    try {
        usuarios.push({ id: ids[0], nome: 'Aluno da contagem', perfil: 'aluno', ativo: false });
        usuarios.push({ id: ids[1], nome: 'Professor da contagem', perfil: 'professor', ativo: false });
        const bloqueados = await resumoAdministrativo();
        assert.equal(bloqueados.totalUsuarios, antes.totalUsuarios + 2);
        assert.equal(bloqueados.totalAlunos, antes.totalAlunos + 1);
        assert.equal(bloqueados.totalProfessores, antes.totalProfessores + 1);
        for (const id of ids) await removerUsuarioBloqueado(id);
        const removidos = await resumoAdministrativo();
        assert.equal(removidos.totalUsuarios, antes.totalUsuarios);
        assert.equal(removidos.totalAlunos, antes.totalAlunos);
        assert.equal(removidos.totalProfessores, antes.totalProfessores);
        assert.equal(removidos.totalUsuarios, (await listarUsuarios()).length);
        assert.ok(ids.every((id) => usuarios.some((usuario) => usuario.id === id)));
    } finally {
        for (let i = usuarios.length - 1; i >= 0; i--) if (ids.includes(usuarios[i].id)) usuarios.splice(i, 1);
    }
});

test('admin exclui área com confirmação e preserva ideias e perfis existentes', async () => {
    const { cadastrarAreaAtuacao, listarAreasAtuacao, resumoAdministrativo } = await import('../services/repositorio.js');
    const { ideias, usuarios } = await import('../data/mock.js');
    const nome = 'Área para excluir';
    const antes = await resumoAdministrativo();
    const area = await cadastrarAreaAtuacao({ nome });
    ideias.push({ id: 'ideia-area-excluida', titulo: 'Ideia preservada', area: nome });
    usuarios.push({ id: 'perfil-area-excluida', nome: 'Professor preservado', perfil: 'professor', areaAtuacao: nome });
    const admin = await entrarAdmin();
    const aluno = await entrar('aluna@exemplo.com', '123456');
    const caminho = `/admin/areas/${area.id}/excluir`;
    for (const cookie of ['', aluno]) {
        assert.equal((await requisicao(caminho, { headers: { cookie } })).status, 302);
        assert.equal((await enviarFormulario(caminho, {}, cookie)).status, 302);
    }
    assert.equal((await enviarFormulario(caminho, {}, admin)).status, 403);
    const confirmacao = await requisicao(caminho, { headers: { cookie: admin } });
    assert.equal(confirmacao.status, 200);
    const html = await confirmacao.text();
    assert.match(html, /Área para excluir/);
    assert.ok((await listarAreasAtuacao()).some((item) => item.id === area.id));
    const token = html.match(/name="token" value="([^"]+)"/)[1];
    assert.equal((await enviarFormulario(caminho, { token }, admin)).status, 302);
    assert.ok(!(await listarAreasAtuacao()).some((item) => item.id === area.id));
    assert.equal((await resumoAdministrativo()).totalAreas, antes.totalAreas);
    assert.equal(ideias.find((item) => item.id === 'ideia-area-excluida').area, nome);
    assert.equal(usuarios.find((item) => item.id === 'perfil-area-excluida').areaAtuacao, nome);
    assert.equal((await requisicao(caminho, { headers: { cookie: admin } })).status, 404);
    assert.equal((await enviarFormulario(caminho, { token }, admin)).status, 403);
    const formulario = await requisicao('/ideia/add', { headers: { cookie: aluno } });
    assert.doesNotMatch(await formulario.text(), /Área para excluir/);
});
