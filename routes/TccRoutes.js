import OrientacaoController from '../controllers/OrientacaoController.js';
import { validarCsrf } from '../middleware/csrf.js';
import express from 'express';
import multer from 'multer';
import TccController from '../controllers/TccController.js';
import { somenteAutenticado, somenteAluno, somenteProfessor } from '../middleware/autenticacao.js';

const router = express.Router();
const controle = new TccController();
const orientacao = new OrientacaoController();
const upload = multer({
    storage: multer.memoryStorage(),
    limits: { fileSize: 5 * 1024 * 1024 },
    fileFilter: (req, file, callback) => {
        if (file.mimetype !== 'application/pdf') return callback(new Error('Envie apenas arquivos PDF.'));
        return callback(null, true);
    },
});

function validarAssinaturaPdf(req, res, next) {
    if (!req.file) return next();
    // Conferimos o início do arquivo, pois o tipo informado pelo navegador pode ser falso.
    const assinatura = req.file.buffer.subarray(0, 5).toString('ascii');
    if (assinatura !== '%PDF-') return next(new Error('Envie apenas arquivos PDF.'));
    return next();
}

router.get('/tcc/lst', controle.list);
router.get('/tcc/add', somenteAluno, controle.openAdd);
router.post('/tcc/add', somenteAluno, upload.single('pdf'), validarCsrf, validarAssinaturaPdf, controle.add);
router.get('/tcc/detalhes/:id', controle.details);
router.get('/tcc/pdf/:id', controle.pdf);
router.get('/tcc/edt/:id', somenteAluno, controle.openEdt);
router.post('/tcc/edt/:id', somenteAluno, upload.single('pdf'), validarCsrf, validarAssinaturaPdf, controle.edt);
router.post('/tcc/del/:id', somenteAluno, controle.del);
router.post('/tcc/comentario/:id', somenteAutenticado, controle.comment);
router.get('/orientacoes', somenteProfessor, orientacao.orientacoes);
router.post('/orientacoes/:id/avaliar', somenteProfessor, orientacao.avaliar);

router.get('/tccs', (req, res) => res.redirect(`/tcc/lst${req.url.includes('?') ? req.url.slice(req.url.indexOf('?')) : ''}`));
router.get('/tccs/:id', (req, res) => res.redirect(`/tcc/detalhes/${req.params.id}`));

export default router;
