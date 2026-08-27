import { listarTccs, listarIdeias, resumoDoPainel } from '../services/repositorio.js';

export default class GeralController {
    constructor() {
        this.home = async (req, res, next) => {
            try {
                const [tccs, ideias] = await Promise.all([
                    listarTccs(),
                    listarIdeias(),
                ]);
                res.render('home', {
                    title: 'Início',
                    tccs: tccs.slice(0, 3),
                    ideias: ideias.slice(0, 3),
                    totalTccs: tccs.length,
                    totalIdeias: ideias.length,
                });
            } catch (erro) {
                next(erro);
            }
        };

        this.painel = async (req, res, next) => {
            try {
                const resumo = await resumoDoPainel(req.session.usuario.id);
                res.render('painel', { title: 'Meu painel', resumo });
            } catch (erro) {
                next(erro);
            }
        };

        this.sobre = (req, res) => res.render('sobre', { title: 'Sobre o projeto' });

        this.saude = (req, res) => res.json({
            status: 'ok',
            modo: req.modoDemo ? 'demonstracao' : 'mongodb',
        });
    }
}
