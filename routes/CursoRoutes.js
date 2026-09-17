import express from 'express';
import CursoController from '../controllers/CursoController.js';

const router = express.Router();
const controle = new CursoController();

// AdminRoutes aplica a permissão de administrador antes destas rotas.
router.get('/admin/cursos', controle.list);
router.post('/admin/cursos', controle.add);
router.get('/admin/cursos/:id/editar', controle.openEdt);
router.post('/admin/cursos/:id/editar', controle.edt);
router.post('/admin/cursos/:id/status', controle.status);
router.get('/admin/cursos/:id/excluir', controle.confirmDelete);
router.post('/admin/cursos/:id/excluir', controle.del);

export default router;
