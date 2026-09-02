import express from 'express';
import NotificacaoController from '../controllers/NotificacaoController.js';
import { somenteAutenticado } from '../middleware/autenticacao.js';

const router = express.Router();
const controle = new NotificacaoController();

router.get('/notificacoes', somenteAutenticado, controle.list);
router.post('/notificacoes/todas-lidas', somenteAutenticado, controle.readAll);
router.post('/notificacoes/:id/lida', somenteAutenticado, controle.read);

export default router;
