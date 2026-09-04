import express from 'express';
import MensagemController from '../controllers/MensagemController.js';
import { somenteAluno, somenteAutenticado } from '../middleware/autenticacao.js';

const router = express.Router();
const controle = new MensagemController();

router.get('/mensagens', somenteAutenticado, controle.list);
router.get('/mensagens/:id', somenteAutenticado, controle.details);
router.post('/mensagens/ideia/:ideiaId/solicitar', somenteAluno, controle.request);
router.post('/mensagens/:id/responder', somenteAutenticado, controle.respond);
router.post('/mensagens/:id/enviar', somenteAutenticado, controle.send);

export default router;
