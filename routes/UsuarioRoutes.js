import ContaController from '../controllers/ContaController.js';
import GoogleController from '../controllers/GoogleController.js';
import rateLimit from 'express-rate-limit';
import express from 'express';
import UsuarioController from '../controllers/UsuarioController.js';
import { limitarLogin, limitarConfirmacao, limitarReenvio } from '../middleware/limitesLogin.js';
import { somenteAutenticado } from '../middleware/autenticacao.js';

const router = express.Router();
const controle = new UsuarioController();
const conta = new ContaController();
const google = new GoogleController();

router.get('/entrar', controle.openLogin);
router.post('/entrar', limitarLogin, controle.login);
router.post('/entrar/google', limitarLogin, google.loginGoogle);
router.get('/cadastro', controle.openCadastro);
router.post('/cadastro', rateLimit({ windowMs: 15 * 60 * 1000, limit: 5 }), controle.cadastro);
router.get('/cadastro/google', google.openCadastroGoogle);
router.post('/cadastro/google', limitarLogin, google.cadastroGoogle);
router.get('/confirmar-codigo', conta.openConfirmacao);
router.post('/confirmar-codigo', limitarConfirmacao, conta.confirmarCodigo);
router.post('/confirmar-codigo/reenviar', limitarReenvio, conta.reenviarCodigo);
router.get('/conta/seguranca', somenteAutenticado, conta.seguranca);
router.post('/conta/definir-senha/solicitar', somenteAutenticado, limitarReenvio, conta.solicitarSenha);
router.get('/conta/definir-senha', somenteAutenticado, conta.openDefinirSenha);
router.post('/conta/definir-senha', somenteAutenticado, limitarConfirmacao, conta.definirSenha);
router.post('/sair', controle.logout);

export default router;
