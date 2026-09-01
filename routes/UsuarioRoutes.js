import express from 'express';
import UsuarioController, {
    limitarConfirmacao,
    limitarLogin,
    limitarReenvio,
} from '../controllers/UsuarioController.js';
import { somenteAutenticado } from '../middleware/autenticacao.js';

const router = express.Router();
const controle = new UsuarioController();

router.get('/entrar', controle.openLogin);
router.post('/entrar', limitarLogin, controle.login);
router.post('/entrar/google', limitarLogin, controle.loginGoogle);
router.get('/cadastro', controle.openCadastro);
router.post('/cadastro', controle.cadastro);
router.get('/cadastro/google', controle.openCadastroGoogle);
router.post('/cadastro/google', limitarLogin, controle.cadastroGoogle);
router.get('/confirmar-codigo', controle.openConfirmacao);
router.post('/confirmar-codigo', limitarConfirmacao, controle.confirmarCodigo);
router.post('/confirmar-codigo/reenviar', limitarReenvio, controle.reenviarCodigo);
router.get('/conta/seguranca', somenteAutenticado, controle.seguranca);
router.post('/conta/definir-senha/solicitar', somenteAutenticado, limitarReenvio, controle.solicitarSenha);
router.get('/conta/definir-senha', somenteAutenticado, controle.openDefinirSenha);
router.post('/conta/definir-senha', somenteAutenticado, limitarConfirmacao, controle.definirSenha);
router.post('/sair', controle.logout);

export default router;
