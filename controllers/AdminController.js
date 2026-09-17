import { resumoAdministrativo } from '../models/resumos.js';
import { carregarTermosProibidos, salvarTermosProibidos } from '../models/filtroConteudo.js';

function mensagem(res, caminho, texto) {
    return res.redirect(`${caminho}?mensagem=${encodeURIComponent(texto)}`);
}

export default class AdminController {
    constructor(caminhoBase = 'admin/') {
        this.caminhoBase = caminhoBase;

        this.index = async (req, res, next) => {
            try {
                const resumo = await resumoAdministrativo();
                return res.render(`${caminhoBase}index`, { title: 'Administração', resumo });
            } catch (erro) {
                return next(erro);
            }
        };

        this.filtro = async (req, res, next) => {
            try {
                const termos = await carregarTermosProibidos();
                return res.render(`${caminhoBase}filtro`, { title: 'Palavras proibidas', termos, erro: '' });
            } catch (erro) {
                return next(erro);
            }
        };

        this.atualizarFiltro = async (req, res, next) => {
            const termos = String(req.body.termos || '')
                .split(/[\n,;]/)
                .map((termo) => termo.trim())
                .filter(Boolean);
            try {
                if (!termos.length) {
                    return res.status(400).render(`${caminhoBase}filtro`, {
                        title: 'Palavras proibidas', termos, erro: 'Cadastre pelo menos um termo para manter a moderação ativa.',
                    });
                }
                await salvarTermosProibidos(termos);
                return mensagem(res, '/admin/filtro', 'Palavras proibidas atualizadas com sucesso.');
            } catch (erro) {
                return next(erro);
            }
        };
    }
}
