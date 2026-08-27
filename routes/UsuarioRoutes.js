import express from 'express';
import UsuarioController, { limitarLogin } from '../controllers/UsuarioController.js';

const router = express.Router();
const controle = new UsuarioController();

router.get('/entrar', controle.openLogin);
router.post('/entrar', limitarLogin, controle.login);
router.get('/cadastro', controle.openCadastro);
router.post('/cadastro', controle.cadastro);
router.post('/sair', controle.logout);

export default router;
