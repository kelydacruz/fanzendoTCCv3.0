import { obterId, usuarioEhAdmin } from './permissoes.js';
import { textoComTamanho } from '../services/validacao.js';

// Regras e validações do domínio, sem acesso à requisição ou à resposta HTTP.
export function dadosDoFormulario(body) {
    return {
        titulo: String(body.titulo || '').trim(),
        tema: String(body.tema || '').trim(),
        descricao: String(body.descricao || '').trim(),
        area: String(body.area || '').trim(),
        dificuldade: ['Iniciante', 'Intermediária', 'Avançada'].includes(body.dificuldade)
            ? body.dificuldade
            : 'Intermediária',
    };
}

export function validarDados(dados, areas) {
    if (!textoComTamanho(dados.titulo, 3, 180)) return 'Informe um título entre 3 e 180 caracteres.';
    if (!textoComTamanho(dados.tema, 2, 100)) return 'Informe o tema da ideia.';
    if (!textoComTamanho(dados.descricao, 20, 2000)) return 'A descrição deve ter entre 20 e 2.000 caracteres.';
    if (dados.area !== 'Outros' && !areas.some((area) => area.nome === dados.area)) return 'Selecione uma área cadastrada ou a opção Outros.';
    return '';
}

export function autorId(ideia) {
    return obterId(ideia?.autor || ideia?.autorId);
}

export function podeVisualizar(usuario, ideia) {
    if (!usuario || !ideia) return false;
    const dono = autorId(ideia) === obterId(usuario);
    const reservou = obterId(ideia.reservadaPor || ideia.reservadaPorId) === obterId(usuario);
    if (usuarioEhAdmin(usuario) || dono || reservou) return true;
    if (usuario.perfil === 'colaborador') return false;
    return (ideia.moderacao || 'aprovada') === 'aprovada'
        && ideia.status !== 'Em desenvolvimento';
}

