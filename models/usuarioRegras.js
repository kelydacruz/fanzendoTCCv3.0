import { listarAreasAtuacao } from './areaOperacoes.js';
import { listarCursos } from './cursoOperacoes.js';
import { normalizarTexto } from '../services/texto.js';
import { perfilPeloEmail } from './perfis.js';
import { emailValido, textoComTamanho } from '../services/validacao.js';

export function dadosCadastro(body, emailForcado = '', perfilForcado = '') {
    const email = normalizarTexto(emailForcado || body.email);
    return {
        nome: String(body.nome || '').trim(),
        email,
        perfil: perfilForcado || perfilPeloEmail(email),
        curso: String(body.curso || '').trim(),
        areaAtuacao: String(body.areaAtuacao || '').trim(),
    };
}

export async function opcoesCadastro() {
    const [cursos, areas] = await Promise.all([
        listarCursos({ somenteAtivos: true }),
        listarAreasAtuacao({ somenteAtivas: true }),
    ]);
    return { cursos, areas };
}

export function opcaoValida(valor, opcoes) {
    return opcoes.some((opcao) => normalizarTexto(opcao.nome) === normalizarTexto(valor));
}

export function validarCadastro(dados, opcoes = null) {
    if (!textoComTamanho(dados.nome, 3, 100) || !emailValido(dados.email)) {
        return 'Informe nome e e-mail válidos.';
    }
    if (!dados.perfil) {
        return 'Use o e-mail acadêmico do IFSul para aluno ou o e-mail institucional para professor.';
    }
    if (dados.perfil === 'admin') {
        return 'A conta administrativa deve ser criada pelo botão Entrar com Google.';
    }
    if (dados.perfil === 'aluno' && !textoComTamanho(dados.curso, 2, 100)) {
        return 'Informe o curso do aluno.';
    }
    if (dados.perfil === 'aluno' && opcoes && !opcaoValida(dados.curso, opcoes.cursos)) {
        return 'Selecione um curso cadastrado pela administração.';
    }
    if (dados.perfil === 'professor' && !textoComTamanho(dados.areaAtuacao, 2, 100)) {
        return 'Informe a área de atuação do professor.';
    }
    if (dados.perfil === 'professor' && opcoes && !opcaoValida(dados.areaAtuacao, opcoes.areas)) {
        return 'Selecione uma área de atuação cadastrada pela administração.';
    }
    return '';
}

