import express from 'express';
import GeralController from '../controllers/GeralController.js';
import { somenteAutenticado } from '../middleware/autenticacao.js';

const router = express.Router();
const controle = new GeralController();

router.get('/', controle.home);
router.get('/painel', somenteAutenticado, controle.painel);
router.get('/aprender', controle.aprender);
router.get('/sobre', controle.sobre);
router.get('/saude', controle.saude);

export default router;
