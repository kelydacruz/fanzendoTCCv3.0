import { normalizarTecnologias } from './tecnologias.js';
import { buscarIdeiaReservadaPeloAluno } from './ideiaOperacoes.js';
import { buscarUsuarioPorId, listarProfessores } from './usuarioOperacoes.js';
import { listarCursos } from './cursoOperacoes.js';
import { listarTurmas } from './turmaOperacoes.js';
import { separarLista } from '../services/texto.js';
import { obterId, usuarioEhAdmin, usuarioEhDono } from './permissoes.js';
import { textoComTamanho } from '../services/validacao.js';

// Regras e validações do domínio, sem acesso à requisição ou à resposta HTTP.
export function usuarioInstitucional(usuario) {
    return ['aluno', 'professor', 'admin'].includes(usuario?.perfil);
}

export function usuarioEhOrientador(usuario, tcc) {
    return usuario?.perfil === 'professor'
        && obterId(usuario) === obterId(tcc?.orientadorUsuario || tcc?.orientadorId);
}

export function podeVisualizar(usuario, tcc) {
    if (!tcc) return false;
    if (!tcc.status || tcc.status === 'publicado') {
        return tcc.visibilidade !== 'interno' || usuarioInstitucional(usuario);
    }
    return usuarioEhDono(usuario, tcc) || usuarioEhOrientador(usuario, tcc) || usuarioEhAdmin(usuario);
}

export async function opcoesFormulario(alunoId) {
    const [professores, cursos, turmas, ideiaEmDesenvolvimento] = await Promise.all([
        listarProfessores(),
        listarCursos({ somenteAtivos: true }),
        listarTurmas({ somenteAtivas: true }),
        buscarIdeiaReservadaPeloAluno(alunoId),
    ]);
    return { professores, cursos, turmas, ideiaEmDesenvolvimento };
}

export function localizarOpcao(opcoes, valor, nomeAlternativo = '') {
    return opcoes.find((opcao) => obterId(opcao) === String(valor || ''))
        || opcoes.find((opcao) => opcao.nome === nomeAlternativo)
        || null;
}

export async function contextoDoFormulario(body, alunoId) {
    const opcoes = await opcoesFormulario(alunoId);
    const curso = localizarOpcao(opcoes.cursos, body.cursoCadastro, String(body.curso || '').trim());
    const turma = opcoes.turmas.find((item) => obterId(item) === String(body.turmaCadastro || ''))
        || opcoes.turmas.find((item) => item.nome === String(body.turma || '').trim())
        || null;
    const orientador = await buscarUsuarioPorId(body.orientadorUsuario);
    const orientadorValido = orientador?.perfil === 'professor' && orientador.ativo !== false
        ? orientador
        : null;
    const ideiaId = String(body.ideiaOrigem || '');
    const ideia = ideiaId && obterId(opcoes.ideiaEmDesenvolvimento) === ideiaId
        ? opcoes.ideiaEmDesenvolvimento
        : null;
    return { ...opcoes, curso, turma, orientador: orientadorValido, ideia };
}

export function dadosDoFormulario(body, arquivo, contexto) {
    const turma = contexto.turma;
    const dados = {
        titulo: String(body.titulo || '').trim(),
        tema: String(body.tema || '').trim(),
        resumo: String(body.resumo || '').trim(),
        curso: contexto.curso?.nome || '',
        cursoCadastro: obterId(contexto.curso) || null,
        area: String(body.area || '').trim(),
        turma: turma ? `${turma.nome} — ${turma.ano}` : '',
        turmaCadastro: obterId(turma) || null,
        orientador: contexto.orientador?.nome || '',
        orientadorUsuario: obterId(contexto.orientador) || null,
        ideiaOrigem: obterId(contexto.ideia) || null,
        visibilidade: ['publico', 'interno'].includes(body.visibilidade) ? body.visibilidade : '',
        ano: Number(turma?.ano),
        coautores: separarLista(body.coautores),
        palavrasChave: separarLista(body.palavrasChave),
        tecnologias: normalizarTecnologias(body.tecnologias),
    };
    if (arquivo) dados.pdf = { dados: arquivo.buffer, nome: arquivo.originalname, tipo: arquivo.mimetype };
    return dados;
}

export function validarDados(dados, contexto) {
    const erros = {};
    if (dados.tecnologias.length > 15 || dados.tecnologias.some((nome) => nome.length > 40)) {
        erros.tecnologias = 'Informe até 15 tecnologias, com no máximo 40 caracteres por nome.';
    }
    if (!textoComTamanho(dados.titulo, 3, 180)) erros.titulo = 'Informe um título entre 3 e 180 caracteres.';
    if (!textoComTamanho(dados.tema, 2, 100)) erros.tema = 'Informe o tema do trabalho.';
    if (!textoComTamanho(dados.resumo, 30, 3000)) erros.resumo = 'O resumo deve ter entre 30 e 3.000 caracteres.';
    if (!contexto.curso) erros.cursoCadastro = 'Selecione um curso cadastrado pela administração.';
    if (!textoComTamanho(dados.area, 2, 100)) erros.area = 'Informe a área do conhecimento.';
    if (contexto.turma && (!Number.isInteger(dados.ano) || dados.ano < 1980 || dados.ano > new Date().getFullYear())) erros.turmaCadastro = 'Selecione uma turma do ano atual ou de anos anteriores.';
    if (!contexto.turma) erros.turmaCadastro = 'Selecione uma turma cadastrada pela administração.';
    if (contexto.turma && contexto.curso
        && obterId(contexto.turma.curso || contexto.turma.cursoId) !== obterId(contexto.curso)) {
        erros.turmaCadastro = 'A turma selecionada não pertence ao curso escolhido.';
    }
    if (!contexto.orientador) erros.orientadorUsuario = 'Selecione um professor orientador ativo e confirmado.';
    if (!['publico', 'interno'].includes(dados.visibilidade)) erros.visibilidade = 'Escolha se o TCC será público ou interno.';
    if (dados.coautores.some((nome) => !textoComTamanho(nome, 1, 100))) erros.coautores = 'Cada coautor pode ter no máximo 100 caracteres.';
    if (dados.palavrasChave.some((palavra) => !textoComTamanho(palavra, 1, 50))) erros.palavrasChave = 'Cada palavra-chave pode ter no máximo 50 caracteres.';
    return erros;
}

