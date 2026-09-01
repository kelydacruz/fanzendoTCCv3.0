import { listarTccs, listarIdeias, resumoDoPainel } from '../services/repositorio.js';
import { modulos } from '../data/modulos.js';

export default class GeralController {
    constructor() {
        this.home = async (req, res, next) => {
            try {
                const [tccs, ideias] = await Promise.all([
                    listarTccs(),
                    listarIdeias(),
                ]);
                const cursos = [...new Set(tccs.map((tcc) => tcc.curso))]
                    .sort()
                    .map((nome) => ({
                        nome,
                        total: tccs.filter((tcc) => tcc.curso === nome).length,
                    }));

                res.render('home', {
                    title: 'Início',
                    tccs: tccs.slice(0, 3),
                    ideias: ideias.slice(0, 3),
                    cursos,
                    totalTccs: tccs.length,
                    totalIdeias: ideias.length,
                    totalVisualizacoes: tccs.reduce((total, tcc) => total + (tcc.visualizacoes || 0), 0),
                });
            } catch (erro) {
                next(erro);
            }
        };

        this.painel = async (req, res, next) => {
            try {
                if (req.session.usuario.perfil === 'admin') return res.redirect('/admin');
                const resumo = await resumoDoPainel(req.session.usuario.id);
                res.render('painel', { title: 'Meu painel', resumo });
            } catch (erro) {
                next(erro);
            }
        };

        this.sobre = (req, res) => res.render('sobre', { title: 'Sobre o projeto' });

        this.aprender = (req, res) => res.render('aprender', {
            title: 'Aprenda a fazer seu TCC',
            modulos,
        });

        this.saude = (req, res) => res.json({
            status: 'ok',
            modo: req.modoDemo ? 'demonstracao' : 'mongodb',
        });
    }
}
