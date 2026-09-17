import express from 'express';
import AreaController from '../controllers/AreaController.js';

const router = express.Router();
const controle = new AreaController();

// AdminRoutes aplica a permissão de administrador antes destas rotas.
router.get('/admin/areas', controle.list);
router.post('/admin/areas', controle.add);
router.get('/admin/areas/:id/editar', controle.openEdt);
router.post('/admin/areas/:id/editar', controle.edt);
router.post('/admin/areas/:id/status', controle.status);
router.get('/admin/areas/:id/excluir', controle.confirmDelete);
router.post('/admin/areas/:id/excluir', controle.del);

export default router;
