import express from 'express';
import TurmaController from '../controllers/TurmaController.js';

const router = express.Router();
const controle = new TurmaController();

// AdminRoutes aplica a permissão de administrador antes destas rotas.
router.get('/admin/turmas', controle.list);
router.post('/admin/turmas', controle.add);
router.get('/admin/turmas/:id/editar', controle.openEdt);
router.post('/admin/turmas/:id/editar', controle.edt);
router.post('/admin/turmas/:id/status', controle.status);
router.get('/admin/turmas/:id/excluir', controle.confirmDelete);
router.post('/admin/turmas/:id/excluir', controle.del);

export default router;
