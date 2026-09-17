import { prepararConfirmacao, consumirConfirmacao } from '../services/confirmacao.js';
import { alterarStatusUsuario, buscarUsuarioPorId, removerUsuarioBloqueado, listarUsuarios } from '../models/usuarioOperacoes.js';

function mensagem(res, caminho, texto) {
    return res.redirect(`${caminho}?mensagem=${encodeURIComponent(texto)}`);
}

export default class AdminUsuarioController {
    constructor(caminhoBase = 'admin/') {
        this.usuarios = async (req, res, next) => {
            try {
                const usuarios = await listarUsuarios(req.query.q || '');
                return res.render(`${caminhoBase}usuarios`, {
                    title: 'Gerenciar usuários', usuarios, busca: req.query.q || '',
                });
            } catch (erro) {
                return next(erro);
            }
        };

        this.confirmarRemocaoUsuario = async (req, res, next) => {
            try {
                const item = await buscarUsuarioPorId(req.params.id);
                if (!item || item.ativo !== false || item.removido || item.perfil === 'admin') return mensagem(res, '/admin/usuarios', 'Somente contas bloqueadas de alunos, professores ou colaboradores podem ser removidas.');
                const busca = typeof req.query.q === 'string' ? req.query.q.slice(0, 150) : '';
                return res.render('admin/confirmar-remocao', {
                    title: 'Remover usuário bloqueado', nome: item.nome,
                    explicacao: 'A conta sairá da lista de usuários e continuará sem acesso. A autoria de TCCs, ideias e mensagens será preservada. Os dados da conta serão mantidos para preservar o histórico e o bloqueio.',
                    destino: `/admin/usuarios/${req.params.id}/remover`, voltar: `/admin/usuarios?q=${encodeURIComponent(busca)}`,
                    busca, token: prepararConfirmacao(req, 'usuario', req.params.id),
                });
            } catch (erro) { return next(erro); }
        };

        this.removerUsuario = async (req, res, next) => {
            try {
                if (!consumirConfirmacao(req, 'usuario', req.params.id)) return res.status(403).render('erro', { title: 'Confirmação necessária', mensagemErro: 'Abra novamente a confirmação de remoção.' });
                const item = await removerUsuarioBloqueado(req.params.id);
                if (!item) return mensagem(res, '/admin/usuarios', 'A conta precisa estar bloqueada e não pode ser de administrador.');
                const busca = typeof req.body.q === 'string' ? req.body.q.slice(0, 150) : '';
                return res.redirect(`/admin/usuarios?${new URLSearchParams({ q: busca, mensagem: 'Usuário removido. O histórico de autoria foi preservado.' })}`);
            } catch (erro) { return next(erro); }
        };

        this.alterarUsuario = async (req, res, next) => {
            try {
                if (String(req.params.id) === String(req.session.usuario.id)) {
                    return mensagem(res, '/admin/usuarios', 'Você não pode bloquear sua própria conta.');
                }
                const ativo = req.body.ativo === 'true';
                const motivo = typeof req.body.motivoBloqueio === 'string' ? req.body.motivoBloqueio.trim() : '';
                if (!['true', 'false'].includes(req.body.ativo) || (!ativo && (motivo.length < 5 || motivo.length > 500))) {
                    return res.status(400).render('erro', { title: 'Bloqueio não realizado', mensagemErro: 'Informe um motivo entre 5 e 500 caracteres.' });
                }
                const atualizado = await alterarStatusUsuario(req.params.id, ativo, motivo);
                if (!atualizado) return res.status(404).render('404', { title: 'Usuário não encontrado' });
                return mensagem(res, '/admin/usuarios', 'Situação do usuário atualizada.');
            } catch (erro) {
                return next(erro);
            }
        };

    }
}
