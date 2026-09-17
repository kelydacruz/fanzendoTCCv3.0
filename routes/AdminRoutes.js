import TurmaRoutes from './TurmaRoutes.js';
import AreaRoutes from './AreaRoutes.js';
import CursoRoutes from './CursoRoutes.js';
import AdminIdeiaController from '../controllers/AdminIdeiaController.js';
import AdminTccController from '../controllers/AdminTccController.js';
import AdminUsuarioController from '../controllers/AdminUsuarioController.js';
import DenunciaController from '../controllers/DenunciaController.js';
import express from 'express';
import AdminController from '../controllers/AdminController.js';
import { somenteAdmin } from '../middleware/autenticacao.js';

const router = express.Router();
const controle = new AdminController();
const adminIdeia = new AdminIdeiaController();
const adminTcc = new AdminTccController();
const adminUsuario = new AdminUsuarioController();

router.use('/admin', somenteAdmin);
router.use(TurmaRoutes);
router.use(AreaRoutes);
router.use(CursoRoutes);
router.get('/admin', controle.index);
router.get('/admin/usuarios', adminUsuario.usuarios);
router.get('/admin/usuarios/:id/remover', adminUsuario.confirmarRemocaoUsuario);
router.post('/admin/usuarios/:id/remover', adminUsuario.removerUsuario);
router.post('/admin/usuarios/:id/status', adminUsuario.alterarUsuario);
router.get('/admin/tccs', adminTcc.tccs);
router.get('/admin/tccs/:id/excluir', adminTcc.confirmarExclusaoTcc);
router.post('/admin/tccs/:id/excluir', adminTcc.excluirTcc);
router.post('/admin/tccs/:id/status', adminTcc.alterarTcc);
router.get('/admin/ideias', adminIdeia.ideias);
router.get('/admin/ideias/externas', adminIdeia.ideias);
router.post('/admin/ideias/:id/moderar', adminIdeia.moderarIdeia);
router.post('/admin/ideias/:id/excluir', adminIdeia.excluirIdeia);
router.get('/admin/filtro', controle.filtro);
router.post('/admin/filtro', controle.atualizarFiltro);

router.get('/admin/denuncias/:id/excluir', new DenunciaController().confirmDelete);
router.post('/admin/denuncias/:id/excluir', new DenunciaController().delete);
router.get('/admin/denuncias', new DenunciaController().list);
router.post('/admin/denuncias/:id/analisar', new DenunciaController().resolve);

export default router;
