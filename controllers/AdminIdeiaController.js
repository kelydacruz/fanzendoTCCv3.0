import { alterarModeracaoIdeia, buscarIdeiaPorId, excluirIdeia, listarIdeias } from '../models/ideiaOperacoes.js';
import { criarNotificacao } from '../models/notificacaoOperacoes.js';

function mensagem(res, caminho, texto) {
    return res.redirect(`${caminho}?mensagem=${encodeURIComponent(texto)}`);
}

export default class AdminIdeiaController {
    constructor(caminhoBase = 'admin/') {
        this.ideias = async (req, res, next) => {
            try {
                const busca = typeof req.query.q === 'string' ? req.query.q.trim().slice(0, 150) : '';
                const somenteExternas = req.path === '/admin/ideias/externas';
                const todas = await listarIdeias({ q: busca, incluirOcultas: true });
                const ideias = somenteExternas
                    ? todas.filter((ideia) => ideia.origem === 'externa' && ideia.moderacao === 'pendente')
                    : todas;
                return res.render(`${caminhoBase}ideias`, {
                    title: somenteExternas ? 'Ideias externas novas' : 'Moderação de ideias',
                    ideias, busca, somenteExternas,
                });
            } catch (erro) { return next(erro); }
        };

        this.excluirIdeia = async (req, res, next) => {
            try {
                await excluirIdeia(req.params.id);
                return mensagem(res, '/admin/ideias', 'Ideia removida com sucesso.');
            } catch (erro) {
                return next(erro);
            }
        };

        this.moderarIdeia = async (req, res, next) => {
            try {
                if (!['aprovar', 'rejeitar'].includes(req.body.acao)) return mensagem(res, '/admin/ideias', 'Ação inválida.');
                const moderacao = req.body.acao === 'aprovar' ? 'aprovada' : 'rejeitada';
                const ideia = await buscarIdeiaPorId(req.params.id);
                if (!ideia) return mensagem(res, '/admin/ideias', 'Ideia não encontrada.');
                await alterarModeracaoIdeia(req.params.id, moderacao);
                const autorId = ideia.autor?.id || ideia.autor?._id || ideia.autorId;
                if (autorId) {
                    await criarNotificacao({
                        destinatario: autorId,
                        remetente: req.session.usuario.id,
                        tipo: 'sistema',
                        mensagem: moderacao === 'aprovada'
                            ? `Sua ideia “${ideia.titulo}” foi aprovada e já aparece para os alunos.`
                            : `Sua ideia “${ideia.titulo}” não foi aprovada para o Banco de Ideias.`,
                        link: `/ideia/detalhes/${req.params.id}`,
                    });
                }
                const destino = req.body.fila === 'externas' ? '/admin/ideias/externas' : '/admin/ideias';
                return res.redirect(`${destino}?${new URLSearchParams({ q: typeof req.body.q === 'string' ? req.body.q.slice(0, 150) : '', mensagem: moderacao === 'aprovada' ? 'Ideia aprovada e removida da fila de pendentes.' : 'Ideia recusada e removida da fila de pendentes.' })}`);
            } catch (erro) {
                return next(erro);
            }
        };

    }
}
