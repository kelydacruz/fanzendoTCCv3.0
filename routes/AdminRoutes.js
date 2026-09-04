import express from 'express';
import AdminController from '../controllers/AdminController.js';
import { somenteAdmin } from '../middleware/autenticacao.js';

const router = express.Router();
const controle = new AdminController();

router.use('/admin', somenteAdmin);
router.get('/admin', controle.index);
router.get('/admin/usuarios', controle.usuarios);
router.post('/admin/usuarios/:id/status', controle.alterarUsuario);
router.get('/admin/cursos', controle.cursos);
router.post('/admin/cursos', controle.adicionarCurso);
router.post('/admin/cursos/:id/status', controle.alterarCurso);
router.get('/admin/areas', controle.areas);
router.post('/admin/areas', controle.adicionarArea);
router.post('/admin/areas/:id/status', controle.alterarArea);
router.get('/admin/turmas', controle.turmas);
router.post('/admin/turmas', controle.adicionarTurma);
router.post('/admin/turmas/:id/status', controle.alterarTurma);
router.get('/admin/tccs', controle.tccs);
router.post('/admin/tccs/:id/status', controle.alterarTcc);
router.get('/admin/ideias', controle.ideias);
router.post('/admin/ideias/:id/moderar', controle.moderarIdeia);
router.post('/admin/ideias/:id/excluir', controle.excluirIdeia);
router.get('/admin/filtro', controle.filtro);
router.post('/admin/filtro', controle.atualizarFiltro);

export default router;
