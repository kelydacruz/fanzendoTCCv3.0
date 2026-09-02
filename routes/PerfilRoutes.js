import express from 'express';
import PerfilController from '../controllers/PerfilController.js';
import { somenteAutenticado } from '../middleware/autenticacao.js';

const router = express.Router();
const controle = new PerfilController();

router.get('/perfil', somenteAutenticado, controle.open);
router.post('/perfil', somenteAutenticado, controle.update);

export default router;
